const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = path.resolve(__dirname, '../third_party/ielts-practice/js');
const hostSource = fs.readFileSync(path.join(sourceRoot, 'app/examSessionMixin.js'), 'utf8');
const readingSource = fs.readFileSync(path.join(sourceRoot, 'runtime/unifiedReadingPage.js'), 'utf8').replace(/\r\n/g, '\n');

function host(url) {
  const window = {location:new URL(url)};
  vm.runInNewContext(hostSource, {window,URL,console});
  return window.ExamSystemAppMixins.examSession;
}

function reader(url, expectedParentOrigin = '') {
  const deliveries = [];
  const parent = {closed:false,postMessage:(message,origin) => deliveries.push({message,origin})};
  const state = {parentWindow:parent,expectedParentOrigin,windowSessionToken:'window-token',examId:'sample-harbor'};
  const context = vm.createContext({global:{location:new URL(url)},state,HOST_MESSAGE_SOURCE:'exam_host',MESSAGE_SOURCE:'practice_page'});
  // Exercise the actual trust/transport functions without booting the DOM renderer.
  for (const name of ['isLocalNativeAppPage','isNativeAppMessageOrigin','normalizeWindowSessionToken','buildEnvelope','acceptHostInitMessage','isTrustedHostMessage','postMessage']) {
    const start = readingSource.indexOf(`    function ${name}(`);
    const end = readingSource.indexOf('\n    }\n',start);
    assert.ok(start >= 0 && end > start, `Missing reading channel function: ${name}`);
    vm.runInContext(readingSource.slice(start,end+6),context);
  }
  const message = (origin = 'null', token = 'window-token', source = parent) => ({
    event:{origin,source},envelope:{source:'exam_host'},data:{parentOrigin:origin,windowSessionToken:token}
  });
  return {context,state,parent,deliveries,message};
}

test('the bundled iOS endpoint is bound even though its URL origin is opaque', () => {
  const app = host('capacitor://localhost/index.html');
  const info = app._resolveExamMessageEndpoint('capacitor://localhost/assets/generated/reading-exams/reading-practice-unified.html');
  assert.equal(info.expectedOrigin,'null');
  assert.equal(info.allowOpaqueOrigin,true);
  for (const origin of ['null','capacitor://localhost']) assert.equal(app._isExpectedExamMessageOrigin(info,origin),true);
  assert.equal(app._isExpectedExamMessageOrigin({...info,allowOpaqueOrigin:false},'null'),false);
  for (const origin of ['','file://','https://localhost','capacitor://other']) assert.equal(app._isExpectedExamMessageOrigin(info,origin),false);
  assert.equal(app._resolveExamMessageEndpoint('capacitor://other/exam.html').allowOpaqueOrigin,false);
  assert.equal(app._resolveExamMessageEndpoint('data:text/html,bad').allowOpaqueOrigin,false);
});

test('native initialization still requires the exact opener, host tag and a token', () => {
  const {context,state,message} = reader('capacitor://localhost/exam.html');
  const accept = item => context.acceptHostInitMessage(item.event,item.envelope,item.data);
  assert.equal(accept(message('null')),true);
  assert.equal(state.parentOriginIsOpaque,true);
  assert.equal(accept(message('capacitor://localhost')),true);
  assert.equal(accept(message('https://localhost')),false);
  assert.equal(accept(message('file://')),false);
  assert.equal(accept(message('null','window-token',{})),false);
  assert.equal(accept(message('null','')),false);
  const foreignTag = message(); foreignTag.envelope.source = 'other';
  assert.equal(accept(foreignTag),false);
  const wrongDeclaredOrigin = message(); wrongDeclaredOrigin.data.parentOrigin = 'https://example.com';
  assert.equal(accept(wrongDeclaredOrigin),false);
  const trusted = message();
  assert.equal(context.isTrustedHostMessage(trusted.event,trusted.envelope,trusted.data),true);
  trusted.data.windowSessionToken = 'stale-token';
  assert.equal(context.isTrustedHostMessage(trusted.event,trusted.envelope,trusted.data),false);
});

test('native readiness targets only the actual parent; normal web origins stay pinned', () => {
  const native = reader('capacitor://localhost/exam.html');
  assert.equal(native.context.postMessage('REQUEST_INIT',{}),true);
  assert.equal(native.deliveries[0].origin,'*');
  native.state.parentWindow = null;
  assert.equal(native.context.postMessage('REQUEST_INIT',{}),false);
  const web = reader('https://example.com/exam.html','https://example.com');
  assert.equal(web.context.postMessage('REQUEST_INIT',{}),true);
  assert.equal(web.deliveries[0].origin,'https://example.com');
  const invalid = web.message('null');
  assert.equal(web.context.acceptHostInitMessage(invalid.event,invalid.envelope,invalid.data),false);
  const valid = web.message('https://example.com');
  assert.equal(web.context.acceptHostInitMessage(valid.event,valid.envelope,valid.data),true);
  const app = host('https://example.com/index.html');
  assert.equal(app._resolveExamMessageEndpoint('/exam.html').expectedOrigin,'https://example.com');
  assert.equal(app._resolveExamMessageEndpoint('capacitor://localhost/exam.html').allowOpaqueOrigin,false);
});
