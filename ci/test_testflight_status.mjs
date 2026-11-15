import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBuild } from './report_testflight.mjs';

test('availability requires a processed build, beta access, and an existing internal tester', () => {
  const build = {id:'new-build', attributes:{version:'3',processingState:'VALID',expired:false},relationships:{preReleaseVersion:{data:{id:'version'}},buildBetaDetail:{data:{id:'detail'}}}};
  const included = [{type:'preReleaseVersions',id:'version',attributes:{version:'1.1.0'}},{type:'buildBetaDetails',id:'detail',attributes:{internalBuildState:'IN_BETA_TESTING',externalBuildState:'READY_FOR_BETA_TESTING'}}];
  const internal = {attributes:{name:'Existing internal',isInternalGroup:true,hasAccessToAllBuilds:false},testerCount:1,buildIds:new Set(['new-build'])};
  const external = {...internal,attributes:{...internal.attributes,isInternalGroup:false}};
  const report = groups => summarizeBuild(build, included, groups);
  assert.equal(report([internal]).availableToExistingInternalTesters, true);
  assert.equal(report([external]).availableToExistingInternalTesters, false);
  assert.equal(report([{...internal,testerCount:0}]).availableToExistingInternalTesters, false);
  assert.equal(report([{...internal,buildIds:new Set(['old-build'])}]).availableToExistingInternalTesters, false);
  assert.equal(report([{...internal,buildIds:new Set(),attributes:{...internal.attributes,hasAccessToAllBuilds:true}}]).availableToExistingInternalTesters, true);
  build.attributes.processingState = 'PROCESSING';
  assert.equal(report([internal]).availableToExistingInternalTesters, false);
  build.attributes.processingState = 'VALID';
  build.attributes.expired = true;
  assert.equal(report([internal]).availableToExistingInternalTesters, false);
});
