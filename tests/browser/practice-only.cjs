const {chromium,webkit}=require('playwright');const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../build/web');const shots=path.resolve(__dirname,'../../docs/screenshots');
(async()=>{
 fs.mkdirSync(shots,{recursive:true});
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e)res.writeHead(404).end();else res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html'}).end(b);});});
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const engine=process.env.TEST_BROWSER==='webkit'?webkit:chromium;const browser=await engine.launch(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('popup',()=>errors.push('Unexpected popup'));
 try{
  await page.goto('http://127.0.0.1:8765/');await page.locator('.exam').first().waitFor();
  const report=await page.evaluate(async()=>{
   const failures=[];let count=0,questions=0;const normalize=v=>String(v??'').trim().toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ');
   for(const exam of PracticeApp.bank.filter(e=>!e.examId.startsWith('sample-'))){
    PracticeApp.open(exam.examId);const mapped=new Set([...document.querySelectorAll('#questions [data-qids]')].flatMap(i=>JSON.parse(i.dataset.qids)));
    for(const image of document.querySelectorAll('.pane img')){try{await image.decode();if(!image.naturalWidth)throw new Error('empty');}catch(_){failures.push({id:exam.examId,brokenFigure:true});}}
    const missing=Object.keys(exam.answerKey).filter(id=>!mapped.has(id));if(missing.length)failures.push({id:exam.examId,missing});
    const expected=id=>Array.isArray(exam.answerKey[id])?exam.answerKey[id]:[exam.answerKey[id]];
    for(const input of document.querySelectorAll('#questions [data-qids]')){
     const ids=JSON.parse(input.dataset.qids);const accepted=ids.flatMap(expected).map(normalize);
     if(input.type==='radio'||input.type==='checkbox')input.checked=accepted.includes(normalize(input.value));
     else if(input.tagName==='SELECT'){const choice=[...input.options].find(o=>accepted.includes(normalize(o.value)));input.value=choice?.value||'';}
     else input.value=expected(ids[0])[0]??'';
    }
    const score=PracticeApp.grade();if(score.correct!==score.total)failures.push({id:exam.examId,correct:score.correct,total:score.total,wrong:score.items.filter(i=>!i.correct).map(i=>({id:i.id,actual:i.actual,expected:i.expected,controls:[...document.querySelectorAll('#questions [data-qids]')].filter(n=>JSON.parse(n.dataset.qids).includes(i.id)).map(n=>({type:n.type,options:n.options?[...n.options].map(o=>o.value):undefined}))}))});count++;questions+=score.total;
   }PracticeApp.list();return {count,questions,failures};
  });
  assert.deepEqual(report.failures,[],'real database rendering or grading failed');console.log(`Database: ${report.count} readings, ${report.questions} answers rendered and graded.`);
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal clipping');
  }
  await page.setViewportSize({width:390,height:844});await page.getByRole('searchbox',{name:'搜索题目'}).fill('Harbor');await page.screenshot({path:path.join(shots,'practice-library.png')});
  await page.getByRole('button',{name:/开始练习 Harbor/}).click();await page.getByRole('textbox',{name:'答案 1',exact:true}).waitFor();
  await page.getByRole('tab',{name:'文章',exact:true}).click();await page.locator('#passage').getByText(/paper notebook in a shed/).waitFor();await page.screenshot({path:path.join(shots,'practice-passage.png')});
  await page.getByRole('tab',{name:'题目',exact:true}).click();
  for(const [n,text] of [[1,'shed'],[2,'lantern'],[3,'cedar']])await page.getByRole('textbox',{name:'答案 '+n,exact:true}).fill(text);
  await page.getByRole('button',{name:'收起键盘'}).click();assert.equal(await page.evaluate(()=>document.activeElement.tagName),'MAIN','Done did not leave the answer field');
  for(const [n,value] of [[4,'TRUE'],[5,'FALSE'],[6,'NOT GIVEN']])await page.getByRole('radio',{name:'第 '+n+' 题 '+value,exact:true}).check();
  await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('得分 6 / 6',{exact:true}).waitFor();assert.equal(await page.locator('.review li').count(),6);await page.screenshot({path:path.join(shots,'practice-result.png')});
  await page.getByRole('button',{name:'重新做这篇'}).click();await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('得分 0 / 6',{exact:true}).waitFor();
  await page.getByRole('button',{name:'重新做这篇'}).click();await page.getByRole('textbox',{name:'答案 1',exact:true}).fill('draft-marker');await page.getByRole('button',{name:'返回题库'}).click();
  await page.getByRole('button',{name:/开始练习 Harbor/}).click();assert.equal(await page.getByRole('textbox',{name:'答案 1',exact:true}).inputValue(),'draft-marker');
  await page.reload();await page.locator('.exam').first().waitFor();await page.getByRole('searchbox',{name:'搜索题目'}).fill('Harbor');await page.getByRole('button',{name:/开始练习 Harbor/}).click();assert.equal(await page.getByRole('textbox',{name:'答案 1',exact:true}).inputValue(),'draft-marker');
  assert.deepEqual(errors,[]);console.log('Open, passage/questions, grading, negative score, immediate return, restart and phone bounds passed.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
