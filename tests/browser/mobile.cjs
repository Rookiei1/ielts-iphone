const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../build/web');
const shots = path.resolve(__dirname, '../../docs/screenshots');
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function ready(page) { await page.waitForFunction(() => window.__IELTS_READING_READY__ === true); await paint(page); }
function serve() {
  const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'};
  const server = http.createServer((req,res) => {
    const relative = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file,(error,data) => { if (error) res.writeHead(404).end(); else res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(data); });
  });
  return new Promise(resolve => server.listen(8765,'127.0.0.1',() => resolve(server)));
}
async function bounds(page, selector) {
  const failures = await page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > innerWidth + 1);
  }).map(node => ({tag:node.tagName,id:node.id,cls:node.className,left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})).slice(0,8));
  assert.deepEqual(failures,[], 'content crosses the iPhone viewport');
}
async function practice(page, name) {
  const promise = page.waitForEvent('popup');
  await page.locator('.m-exam').filter({hasText:name}).getByRole('button',{name:/开始练习/}).click();
  const popup = await promise;
  await popup.setViewportSize({width:390,height:844});
  await ready(popup);
  assert.equal(await popup.opener(),page);
  await bounds(popup,'#mobile-practice-header, #iphone-bar, #right, #left, .practice-nav');
  return popup;
}
async function main() {
  fs.mkdirSync(shots,{recursive:true});
  const server = await serve();
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const options = process.env.TEST_BROWSER_CHANNEL ? {channel:process.env.TEST_BROWSER_CHANNEL} : {};
  const browser = await engine.launch(options);
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page = await context.newPage();
  const errors = [];
  let privatePhase = false;
  context.on('page', p => p.on('pageerror', e => errors.push(String(e))));
  page.on('pageerror',e => errors.push(String(e)));
  try {
    await page.goto('http://127.0.0.1:8765/');
    await page.locator('.m-exam').first().waitFor();
    assert.equal(await page.title(),'雅思练习');
    assert.equal(await page.locator('.m-exam').count(),3);
    const text = await page.locator('body').innerText();
    for (const name of ['ZYZ','小红书','Salloway','IELTS Atlas','解锁']) assert.ok(!text.includes(name),name);
    for (const width of [320,375,390,430]) {
      await page.setViewportSize({width,height:844}); await paint(page);
      await bounds(page,'#mobile-app, #mobile-app *');
      const header = await page.locator('.m-header').boundingBox();
      const card = await page.locator('.m-exam').first().boundingBox();
      assert.ok(header.y >= -1 && header.y < 2,'unwanted space above header');
      assert.ok(card.x >= 12 && card.y < 320,'card is cropped or below an oversized header');
      await page.screenshot({path:path.join(shots,`mobile-library-${width}.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('searchbox',{name:'搜索题目'}).fill('Glass'); assert.equal(await page.locator('.m-exam').count(),1);
    await page.getByRole('searchbox',{name:'搜索题目'}).fill('');
    await page.locator('[data-m-part="P2"]').click(); assert.equal(await page.locator('.m-exam').count(),1);
    await page.locator('[data-m-part="all"]').click();
    await page.getByRole('combobox',{name:'频率筛选'}).selectOption('high'); assert.equal(await page.locator('.m-exam').count(),1);
    await page.getByRole('combobox',{name:'频率筛选'}).selectOption('all');

    let popup = await practice(page,'Harbor Notebook');
    await popup.getByRole('button',{name:'文章',exact:true}).click(); await paint(popup);
    await popup.locator('#left').evaluate(node => { node.scrollTop = 240; }); await paint(popup);
    await popup.getByRole('button',{name:'题目',exact:true}).click();
    await popup.getByRole('button',{name:'文章',exact:true}).click(); await paint(popup);
    assert.ok(await popup.locator('#left').evaluate(node => node.scrollTop) >= 200,'article lost its scroll position');
    await popup.getByRole('button',{name:'题目',exact:true}).click();
    for (const [id,value] of [['q1','shed'],['q2','lantern'],['q3','cedar']]) await popup.locator('#'+id+'_input').fill(value);
    for (const [id,value] of [['q4','TRUE'],['q5','FALSE'],['q6','NOT GIVEN']]) await popup.locator(`input[name="${id}"][value="${value}"]`).check();
    await popup.locator('#submit-btn').click();
    await popup.getByText('得分 6 / 6').waitFor();
    await popup.screenshot({path:path.join(shots,'mobile-practice-result.png')});
    await popup.getByRole('button',{name:'文章',exact:true}).click();
    await popup.getByText('原创解析：笔记放在码头边的棚屋里').waitFor();
    await popup.screenshot({path:path.join(shots,'mobile-passage.png')});
    await popup.close();
    let saved = await page.evaluate(() => window.AppData.practice.list({projection:'light'}));
    assert.equal(saved.filter(row => row.examId === 'sample-harbor').length,1);

    popup = await practice(page,'Glass Loft');
    await popup.locator('.drag-item').filter({hasText:'loft'}).click();
    await popup.locator('.match-dropzone[data-question="q1"]').click();
    await popup.locator('.drag-item').filter({hasText:'shed'}).click();
    await popup.locator('.match-dropzone[data-question="q2"]').click();
    await popup.locator('#submit-btn').click();
    await popup.getByText('得分 2 / 2').waitFor();
    await popup.close();
    await page.evaluate(() => window.IELTSMobileUI.refresh());
    await page.getByRole('button',{name:'记录',exact:true}).click();
    await page.locator('.m-record').filter({hasText:'Harbor Notebook'}).waitFor();
    await page.screenshot({path:path.join(shots,'mobile-records.png')});
    await page.locator('.m-record').filter({hasText:'Harbor Notebook'}).click();
    await page.locator('.m-review').waitFor();
    await page.evaluate(() => window.IELTSMobileUI.refresh());
    assert.equal(await page.locator('.m-answer-list li').count(),6,'review is missing saved answers');
    await page.locator('.m-answer-list').getByText('我的答案：shed',{exact:true}).waitFor();
    await page.screenshot({path:path.join(shots,'mobile-review.png')});
    await page.getByRole('button',{name:'我的',exact:true}).click();
    await page.getByRole('button',{name:/导入阅读题库/}).waitFor();
    await page.screenshot({path:path.join(shots,'mobile-settings.png')});
    const result = await page.evaluate(async () => {
      await window.AppEntry.ensurePracticeSuiteGroup();
      if (typeof window.app.ensurePracticeRecorder === 'function') await window.app.ensurePracticeRecorder();
      const recorder = window.practiceRecorder || window.app.components.practiceRecorder;
      return recorder.importData(JSON.parse(await recorder.exportData('json')),{merge:true});
    });
    assert.equal(result.committed,true);
    assert.equal(await page.evaluate(async () => (await window.AppData.practice.list({projection:'light'})).length),2);
    await page.reload(); await page.locator('.m-exam').first().waitFor();
    await page.getByRole('button',{name:'记录',exact:true}).click();
    assert.equal(await page.locator('.m-record').count(),2);
    await page.getByRole('button',{name:'题库',exact:true}).click();
    const draft = await practice(page,'Harbor Notebook');
    await draft.locator('#q1_input').fill('draft-marker');
    await Promise.all([draft.waitForEvent('close'),draft.getByRole('button',{name:'返回题库',exact:true}).click()]);
    const restored = await practice(page,'Harbor Notebook');
    assert.equal(await restored.locator('#q1_input').inputValue(),'draft-marker','answers lost when returning to the library');
    await restored.close();
    const suitePopup = page.waitForEvent('popup');
    await page.getByRole('button',{name:'套题练习',exact:true}).click();
    const suite = await suitePopup;
    await ready(suite);
    assert.ok(await page.evaluate(() => !!window.app.currentSuiteSession?.id),'suite session not created');
    await suite.close();
    await page.evaluate(async () => {
      const session = window.app.currentSuiteSession;
      if (session && window.app.abandonSuiteRecovery) await window.app.abandonSuiteRecovery(session.id);
    });
    if (process.env.PRIVATE_BANK_PATH) {
      privatePhase = true;
      await Promise.all([
        page.waitForEvent('domcontentloaded'),
        page.locator('#iphone-bank-file').setInputFiles(process.env.PRIVATE_BANK_PATH)
      ]);
      await page.locator('.m-exam').first().waitFor();
      assert.equal(await page.locator('#mobile-bank-count').innerText(),'242 篇','private bank count mismatch');
      await page.locator('#iphone-bank-file').setInputFiles(process.env.PRIVATE_BANK_PATH);
      await page.locator('#iphone-status[data-state="duplicate"]').waitFor();
      const opened = page.waitForEvent('popup');
      await page.locator('.m-start').first().click();
      const privatePractice = await opened;
      await ready(privatePractice);
      assert.ok(await privatePractice.locator('.unified-group').count() > 0,'private reading did not render');
      await privatePractice.close();
      await page.reload(); await page.locator('.m-exam').first().waitFor();
      assert.equal(await page.locator('#mobile-bank-count').innerText(),'242 篇','private bank lost after reload');
      console.log('Private local import: 242 readings, duplicate protection, practice and reload passed. No private screenshots saved.');
    }
    assert.deepEqual(errors,[]);
    console.log('Mobile layout, reading, grading, touch matching, review and persistence passed.');
  } catch (error) {
    console.log('Paint stack:',await page.evaluate(() => document.elementsFromPoint(180,300).slice(0,6).map(node => ({tag:node.tagName,id:node.id,cls:node.className}))).catch(() => 'Page was navigating'));
    if (!privatePhase) for (const [i,p] of context.pages().entries()) await p.screenshot({path:path.join(shots,`mobile-failure-${i}.png`)}).catch(()=>{});
    throw error;
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
