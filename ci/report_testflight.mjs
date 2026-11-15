// Read-only Apple processing and tester-access audit. Never prints key material or tester identities.
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const API = 'https://api.appstoreconnect.apple.com';
const APP_ID = '6834748437';

export function summarizeBuild(build, included, groups) {
  const related = (name, type) => included.find(item => item.type === type && item.id === build.relationships?.[name]?.data?.id);
  const detail = related('buildBetaDetail', 'buildBetaDetails')?.attributes || {};
  const version = related('preReleaseVersion', 'preReleaseVersions')?.attributes?.version;
  const accessible = groups.filter(group => group.attributes.isInternalGroup &&
    (group.attributes.hasAccessToAllBuilds || group.buildIds.has(build.id)));
  return {
    appId: APP_ID, buildId: build.id, version, build: build.attributes.version,
    processingState: build.attributes.processingState, expired: build.attributes.expired,
    internalBetaState: detail.internalBuildState, externalBetaState: detail.externalBuildState,
    internalGroups: accessible.map(group => ({
      name: group.attributes.name, testerCount: group.testerCount,
      allBuilds: group.attributes.hasAccessToAllBuilds === true
    })),
    availableToExistingInternalTesters: build.attributes.processingState === 'VALID' &&
      build.attributes.expired === false && detail.internalBuildState === 'IN_BETA_TESTING' &&
      accessible.some(group => group.testerCount > 0)
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const expectedBuild = value('--build');
  const expectedVersion = value('--version');
  const key = JSON.parse(await readFile(process.env.ASC_KEY_FILEPATH, 'utf8'));
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({alg:'ES256',kid:key.key_id,typ:'JWT'})}.${encode({iss:key.issuer_id,iat:now-10,exp:now+600,aud:'appstoreconnect-v1'})}`;
  const token = `${unsigned}.${sign('sha256',Buffer.from(unsigned),{key:key.key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  async function request(path) {
    const url = new URL(path, API);
    if (url.origin !== API) throw new Error('Refusing an unexpected Apple API origin');
    const response = await fetch(url, {headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Apple API ${url.pathname}: HTTP ${response.status} ${(error.errors || []).map(item => item.code).join(', ')}`);
    }
    return response.json();
  }
  async function list(path) {
    const items = [];
    while (path) {
      const result = await request(path);
      items.push(...result.data);
      path = result.links?.next;
    }
    return items;
  }
  const query = new URLSearchParams({'filter[app]':APP_ID,sort:'-uploadedDate',limit:'20',include:'preReleaseVersion,buildBetaDetail'});
  if (expectedBuild) query.set('filter[version]', expectedBuild);
  const result = await request(`/v1/builds?${query}`);
  const included = result.included || [];
  const builds = result.data.filter(build => !expectedVersion ||
    included.some(item => item.type === 'preReleaseVersions' && item.id === build.relationships?.preReleaseVersion?.data?.id && item.attributes.version === expectedVersion));
  if (!builds.length) throw new Error('Requested TestFlight build was not returned by Apple');
  const groups = await list(`/v1/apps/${APP_ID}/betaGroups?limit=200`);
  for (const group of groups) {
    group.buildIds = new Set();
    group.testerCount = 0;
    if (!group.attributes.isInternalGroup) continue;
    if (!group.attributes.hasAccessToAllBuilds) {
      group.buildIds = new Set((await list(`/v1/betaGroups/${group.id}/relationships/builds?limit=200`)).map(item => item.id));
    }
    group.testerCount = (await list(`/v1/betaGroups/${group.id}/relationships/betaTesters?limit=200`)).length;
  }
  const reports = builds.slice(0, 3).map(build => summarizeBuild(build, included, groups));
  const json = JSON.stringify(reports, null, 2);
  console.log(json);
  const output = new URL('../build/release/', import.meta.url);
  await mkdir(output, {recursive:true});
  await writeFile(new URL('testflight-status.json', output), json + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = reports.map(report => `- ${report.version} (${report.build}): ${report.processingState}, internal ${report.internalBetaState}; existing tester access: ${report.availableToExistingInternalTesters}\n`);
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\nTestFlight processing and access audit:\n\n${lines.join('')}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
