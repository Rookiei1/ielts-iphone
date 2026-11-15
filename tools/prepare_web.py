"""Build the standalone practice app. Only the reading database is reused."""
from __future__ import annotations
import hashlib
import json
import os
import shutil
import zipfile
from pathlib import Path
from sample_bank import EXAMS
from fetch_public_bank import fetch_bank

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'build' / 'web'
FIELDS = ('schemaVersion','examId','meta','passage','questionGroups','answerKey','questionOrder','questionDisplayMap')

def select_data(exams):
    return [{key:exam[key] for key in FIELDS if key in exam} for exam in exams]

def load_database():
    if os.environ.get('IELTS_LOCAL_BANK') == '1':
        with zipfile.ZipFile(ROOT/'private-data/reading-bank.zip') as archive:
            return select_data(json.loads(archive.read(name)) for name in archive.namelist() if name.startswith('exams/'))
    if os.environ.get('IELTS_SAMPLE_ONLY') == '1':return list(EXAMS)
    return fetch_bank()

def main():
    exams = load_database()
    full_count = len(exams)
    if os.environ.get('IELTS_REQUIRE_FULL_BANK') == '1' and full_count != 242:
        raise SystemExit(f'Expected 242 readings, received {full_count}')
    if os.environ.get('IELTS_TEST_FIXTURES') == '1':
        known = {exam['examId'] for exam in exams}
        exams += [exam for exam in EXAMS if exam['examId'] not in known]
    if DEST.resolve() != (ROOT/'build/web').resolve() or not DEST.resolve().is_relative_to(ROOT.resolve()):
        raise SystemExit('Unsafe build destination')
    if DEST.exists(): shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    for source,target in [('practice.html','index.html'),('practice.js','practice.js'),('practice.css','practice.css')]:
        shutil.copy2(ROOT/'ios-src'/source, DEST/target)
    bank = {'format':'ielts-practice-only-v2','exams':select_data(exams)}
    (DEST/'bank.json').write_text(json.dumps(bank,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    shutil.copy2(ROOT/'native/IELTSViewController.swift',ROOT/'ios/App/App/IELTSViewController.swift')
    manifest = {'readingCount':full_count,'testFixtures':len(exams)-full_count,'databaseSha256':hashlib.sha256((DEST/'bank.json').read_bytes()).hexdigest()}
    (DEST/'build-manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
    print(f'Standalone practice built: {full_count} readings; {len(exams)-full_count} test fixtures; no desktop runtime.')

if __name__ == '__main__': main()
