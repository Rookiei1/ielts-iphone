"""Run one iPhone flow with a fresh simulator and bounded startup/test waits."""
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
role = sys.argv[1]
if role not in ('compact', 'large'):
    raise SystemExit('Expected compact or large')
catalog = json.loads(Path('build/devices.json').read_text())['devices']
runtimes = [(key, [d for d in devices if d.get('isAvailable') and 'iPhone' in d.get('name', '')])
            for key, devices in catalog.items() if '.iOS-' in key]
runtimes = [(key, devices) for key, devices in runtimes if devices]
runtime, devices = max(runtimes, key=lambda item: tuple(map(int, re.findall(r'\d+', item[0]))))
if role == 'compact':
    candidates = [d for d in devices if 'Max' not in d['name']]
    device = min(candidates, key=lambda d: ('16e' not in d['name'], d['name']))
else:
    candidates = [d for d in devices if 'Max' in d['name']]
    device = min(candidates, key=lambda d: ('16 Pro Max' not in d['name'], d['name']))
udid = device['udid']
result = Path(f'build/MobileUI-{role}.xcresult')
output = Path(f'build/native-screenshots/{role}')
output.mkdir(parents=True, exist_ok=True)
log = Path(f'build/logs/ui-{role}.log')
log.parent.mkdir(parents=True, exist_ok=True)


def run(command, timeout, stream=None):
    process = subprocess.Popen(command, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        return process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        print(f'Timed out after {timeout}s: {command[0]}', flush=True)
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        return 124


print(f'Validating {device["name"]} on {runtime}', flush=True)
status = 1
try:
    if run(['xcrun', 'simctl', 'shutdown', 'all'], 60) != 0:
        raise RuntimeError('Could not stop other simulators')
    if run(['xcrun', 'simctl', 'boot', udid], 60) != 0:
        raise RuntimeError('Could not boot selected iPhone')
    if run(['xcrun', 'simctl', 'bootstatus', udid, '-b'], 240) != 0:
        raise RuntimeError('Selected iPhone did not finish booting')
    command = ['xcodebuild', 'test', '-project', 'ios/App/App.xcodeproj', '-scheme', 'AppMobileUITests',
               '-configuration', 'Debug', '-destination', f'platform=iOS Simulator,id={udid}',
               '-destination-timeout', '90', '-derivedDataPath', 'build/DerivedData',
               '-resultBundlePath', str(result), '-parallel-testing-enabled', 'NO',
               '-test-timeouts-enabled', 'YES', '-default-test-execution-time-allowance', '180',
               '-maximum-test-execution-time-allowance', '240',
               'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO']
    print('iPhone ready; starting the actual practice flow.', flush=True)
    with log.open('w') as handle:
        status = run(command, 720, handle)
finally:
    if result.exists():
        run(['xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(result), '--output-path', str(output)], 60)
    if status != 0:
        run(['xcrun', 'simctl', 'io', udid, 'screenshot', str(output / 'device-at-stop.png')], 30)
        if log.exists():
            print('\n'.join(log.read_text(errors='replace').splitlines()[-100:]), flush=True)
    run(['xcrun', 'simctl', 'shutdown', udid], 60)
    Path(f'build/logs/{role}-result.json').write_text(json.dumps({
        'device': device['name'], 'runtime': runtime, 'exitCode': status
    }, indent=2) + '\n')
raise SystemExit(status)
