(() => {
  'use strict';
  const app=document.getElementById('app');
  const state={bank:[],exam:null,pane:'questions',query:'',submitted:false,answers:{},groups:[],choiceSets:new Set()};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').trim().toLocaleLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ');
  const qid=value=>{const m=String(value||'').match(/\d+/);return m?'q'+Number(m[0]):'';};
  const idsOf=value=>[...String(value||'').matchAll(/\d+/g)].map(m=>'q'+Number(m[0]));
  const display=id=>state.exam?.questionDisplayMap?.[id]||String(id).replace(/^q/,'');
  let noticeTimer,focusedInput;
  app.tabIndex=-1;
  function dismissKeyboard(){
    if(focusedInput?.isConnected)focusedInput.blur();
    document.activeElement?.blur();app.focus({preventScroll:true});
  }
  function notice(text){const box=document.getElementById('notice');box.textContent=text;box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>box.hidden=true,3500);}
  function clean(html){
    const template=document.createElement('template');template.innerHTML=html||'';
    template.content.querySelectorAll('script,style,link,iframe,object,embed,button,nav,footer,input[type=hidden]').forEach(n=>n.remove());
    template.content.querySelectorAll('*').forEach(node=>{
      const svg=!!node.closest('svg');
      for(const a of [...node.attributes])if((a.name==='style'&&!svg)||(a.name==='id'&&!svg&&!['INPUT','SELECT','TEXTAREA'].includes(node.tagName))||a.name.startsWith('on')||a.name==='draggable'||a.name==='data-answer'||a.name==='srcdoc')node.removeAttribute(a.name);
      if(node.tagName==='A')node.removeAttribute('href');
      if(node.tagName==='IMG'&&!/^(data:image\/|assets\/|\.\/assets\/)/i.test(node.getAttribute('src')||''))node.removeAttribute('src');
    });
    return template.innerHTML;
  }
  function list(){
    const count=state.bank.filter(e=>!e.examId.startsWith('sample-')).length||state.bank.length;
    state.exam=null;app.innerHTML='<header class="top"><h1>阅读练习</h1><p class="count">'+count+' 篇阅读</p><input class="search" id="search" type="search" placeholder="搜索文章" aria-label="搜索题目" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" value="'+esc(state.query)+'"></header><section class="list" id="exam-list" aria-label="题库"></section>';
    function filter(){const needle=normalize(state.query);const rows=state.bank.filter(e=>normalize(e.meta?.title||e.examId).includes(needle));document.getElementById('exam-list').innerHTML=rows.length?rows.map(e=>'<button class="exam" data-open="'+esc(e.examId)+'" aria-label="开始练习 '+esc(e.meta?.title||e.examId)+'"><small>'+esc(e.meta?.category||'阅读')+'</small><strong>'+esc(e.meta?.title||e.examId)+'</strong><span>开始练习 →</span></button>').join(''):'<p class="empty">没有找到文章</p>';}
    document.getElementById('search').addEventListener('input',e=>{state.query=e.target.value;filter();});document.getElementById('search').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur();});filter();
  }
  function radioTables(body){
    body.querySelectorAll('table').forEach(table=>{
      if(!table.querySelector('input[type=radio]'))return;
      const replacement=document.createElement('div');
      [...table.querySelectorAll('tr')].forEach(row=>{
        const radios=[...row.querySelectorAll('input[type=radio]')];if(!radios.length)return;
        const field=document.createElement('fieldset');const legend=document.createElement('legend');legend.innerHTML=row.cells[0]?.innerHTML||'';field.append(legend);
        const choices=document.createElement('div');choices.className='radio-options';radios.forEach(input=>{const label=document.createElement('label');label.append(input,document.createTextNode(input.value));choices.append(label);});field.append(choices);replacement.append(field);
      });table.replaceWith(replacement);
    });
  }
  function prepareGroup(group,index,passage){
    const element=document.createElement('section');element.className='group';element.dataset.group=String(index);element.innerHTML=clean((group.leadHtml||'')+(group.bodyHtml||''));radioTables(element);
    element.querySelectorAll('.group').forEach(node=>node.classList.remove('group'));
    const ids=group.questionIds||[];const options=[];const seen=new Set();
    element.querySelectorAll('.drag-item,.draggable-word,[data-word],.card[data-value],.card[data-letter]').forEach(item=>{
      const text=item.textContent.trim();const value=item.dataset.word||item.dataset.heading||item.dataset.letter||item.dataset.value||item.dataset.option||text.match(/^([a-z]+|\d+)[.)\s]/i)?.[1];
      if(value&&!seen.has(value)){seen.add(value);options.push({value,text});}
    });
    const bound=new Set(),bindings=new Map();
    element.querySelectorAll('input,select,textarea').forEach(input=>{
      const raw=input.name||input.id;
      let mapped=idsOf(raw).map(id=>ids.includes(id)?id:ids.find(key=>String(display(key))===id.slice(1))).filter(Boolean);
      if(!mapped.length)mapped=bindings.get(raw)||ids.filter(id=>!bound.has(id)).slice(0,1);
      if(raw)bindings.set(raw,mapped);
      if(!mapped.length){input.remove();return;}
      input.dataset.qids=JSON.stringify(mapped);mapped.forEach(id=>bound.add(id));
      if(input.type==='checkbox'){
        const expected=state.exam.answerKey[mapped[0]];
        if(mapped.length===1&&Array.isArray(expected))state.choiceSets.add(mapped[0]);
        input.dataset.max=String(mapped.length>1?mapped.length:Array.isArray(expected)?expected.length:ids.length);
      }
      if(!['radio','checkbox'].includes(input.type)){if(input.tagName==='INPUT')input.type='text';input.classList.add('answer');input.setAttribute('aria-label','答案 '+display(mapped[0]));input.autocomplete='off';input.autocapitalize='none';input.setAttribute('autocorrect','off');input.spellcheck=false;input.removeAttribute('value');}
      else {input.setAttribute('aria-label','第 '+mapped.map(display).join('、')+' 题 '+input.value);input.closest('label')?.classList.add('answer-option');}
    });
    element.querySelectorAll('[data-question],.match-dropzone,.dropzone,.drop-target').forEach(slot=>{
      const id=qid(slot.dataset.question||slot.dataset.questionId||slot.dataset.target);if(ids.includes(id)&&!bound.has(id)){slot.replaceWith(answerRow(id,options));bound.add(id);}
    });
    for(const id of ids)if(!bound.has(id)){element.append(answerRow(id,options));bound.add(id);}
    if(options.length)element.querySelectorAll('p').forEach(p=>{if(/drag.*drop|drop.*drag/i.test(p.textContent))p.textContent='选择与每道题对应的选项。';});
    element.querySelectorAll('table').forEach(table=>{const wrapper=document.createElement('div');wrapper.className='table-scroll';table.replaceWith(wrapper);wrapper.append(table);});
    return element;
  }
  function answerRow(id,options){
    const row=document.createElement('div');row.className='answer-row';const label=document.createElement('label');label.textContent='第 '+display(id)+' 题';row.append(label);
    const input=document.createElement(options.length?'select':'input');input.className='answer';input.dataset.qids=JSON.stringify([id]);input.name=id;input.setAttribute('aria-label','答案 '+display(id));
    if(options.length)input.innerHTML='<option value="">请选择</option>'+options.map(o=>'<option value="'+esc(o.value)+'">'+esc(o.text)+'</option>').join('');
    else{input.type='text';input.autocomplete='off';input.autocapitalize='none';input.setAttribute('autocorrect','off');input.spellcheck=false;}
    row.append(input);return row;
  }
  function restore(){
    document.querySelectorAll('#questions [data-qids]').forEach(input=>{
      const ids=JSON.parse(input.dataset.qids);const answer=state.answers[ids[0]];
      if(input.type==='checkbox')input.checked=Array.isArray(answer)&&answer.includes(input.value);
      else if(input.type==='radio')input.checked=normalize(answer)===normalize(input.value);
      else input.value=Array.isArray(answer)?answer.join(' / '):(answer||'');
      input.disabled=state.submitted;
    });
  }
  function collect(){
    const answers={};const checkboxes=new Map();
    document.querySelectorAll('#questions [data-qids]').forEach(input=>{
      const ids=JSON.parse(input.dataset.qids);
      if(input.type==='checkbox'){const key=input.dataset.qids;if(!checkboxes.has(key))checkboxes.set(key,{ids,values:[]});if(input.checked)checkboxes.get(key).values.push(input.value);}
      else if(input.type!=='radio'||input.checked)ids.forEach(id=>answers[id]=input.value);
    });
    checkboxes.forEach(({ids,values})=>ids.forEach(id=>answers[id]=values));return answers;
  }
  function save(){if(!state.exam)return;state.answers=collect();try{localStorage.setItem('practice-only:'+state.exam.examId,JSON.stringify({answers:state.answers,submitted:state.submitted}));}catch(_){notice('这次作答暂未保存，请先完成当前练习。');}}
  function matches(actual,expected){const allowed=Array.isArray(expected)?expected:[expected];return allowed.some(value=>normalize(actual)===normalize(value));}
  function grade(answers=collect()){
    const items=Object.entries(state.exam.answerKey).map(([id,expected])=>{
      const actual=answers[id];let correct=false,points=0,weight=state.choiceSets.has(id)?expected.length:1;
      if(Array.isArray(actual)){
        const group=state.groups.find(g=>(g.questionIds||[]).includes(id));const max=group?.questionIds?.length||1;
        if(state.choiceSets.has(id)){
          const chosen=[...new Set(actual.map(normalize))];points=chosen.length<=weight?chosen.filter(value=>expected.some(e=>normalize(e)===value)).length:0;correct=points===weight;
        }else{correct=actual.length<=max&&actual.some(value=>matches(value,expected));points=correct?1:0;}
      }else correct=normalize(actual)!==''&&matches(actual,expected);
      if(!Array.isArray(actual))points=correct?1:0;
      return {id,actual,expected,correct,points,weight};
    });return {correct:items.reduce((n,i)=>n+i.points,0),total:items.reduce((n,i)=>n+i.weight,0),items};
  }
  function result(){
    const score=grade(state.answers);const box=document.getElementById('result');
    box.innerHTML='<div class="result"><strong>得分 '+score.correct+' / '+score.total+'</strong><p>标准答案已显示在下方。</p><button class="plain" data-redo>重新做这篇</button></div><ol class="review">'+score.items.map(item=>'<li><strong>第 '+esc(display(item.id))+' 题</strong><p class="'+(item.correct?'ok':'wrong')+'">'+(item.correct?'✓ ':'')+'我的答案：'+esc(Array.isArray(item.actual)?item.actual.join('、'):item.actual||'未作答')+'</p><p class="reference">参考答案：'+esc(Array.isArray(item.expected)?item.expected.join(' / '):item.expected)+'</p></li>').join('')+'</ol>';
    box.hidden=false;document.getElementById('submit').hidden=true;document.getElementById('progress').textContent='已提交 · '+score.correct+' / '+score.total;
  }
  function pane(name){dismissKeyboard();state.pane=name;document.getElementById('passage').classList.toggle('is-hidden',name!=='passage');document.getElementById('questions').classList.toggle('is-hidden',name!=='questions');document.getElementById('passage').inert=name!=='passage';document.getElementById('questions').inert=name!=='questions';document.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-selected',b.dataset.pane===name));}
  function open(id){
    state.exam=state.bank.find(e=>e.examId===id);if(!state.exam)throw new Error('题目不存在');state.groups=state.exam.questionGroups||[];state.choiceSets=new Set();
    let draft;try{draft=JSON.parse(localStorage.getItem('practice-only:'+id)||'null');}catch(_){}state.answers=draft?.answers||{};state.submitted=draft?.submitted===true;
    app.innerHTML='<header class="practice-top"><button class="plain" data-back aria-label="返回题库">‹ 返回</button><h1>'+esc(state.exam.meta?.title||id)+'</h1><button class="plain" data-done aria-label="收起键盘">完成</button></header><nav class="switch" aria-label="练习内容"><button data-pane="passage" role="tab">文章</button><button data-pane="questions" role="tab">题目</button></nav><div class="panes"><article class="pane" id="passage" aria-label="阅读文章"></article><section class="pane" id="questions" aria-label="作答"><div id="result" hidden></div><div id="groups"></div></section></div><footer class="bottom"><small id="progress">'+Object.keys(state.exam.answerKey).length+' 道题</small><button id="submit" class="primary" aria-label="提交答案">提交答案</button></footer>';
    const passage=document.getElementById('passage');passage.innerHTML='<h2>'+esc(state.exam.meta?.title||'')+'</h2>'+(state.exam.passage?.blocks||[]).map(b=>clean(b.bodyHtml||b.html||b.contentHtml||'')).join('');
    passage.querySelectorAll('input,select,textarea,[data-question],.match-dropzone,.dropzone').forEach(slot=>{const id=qid(slot.name||slot.dataset.question||slot.dataset.questionId||slot.id);const marker=document.createElement('span');marker.className='slot-number';marker.textContent=id?'['+display(id)+']':'';slot.replaceWith(marker);});
    const groups=document.getElementById('groups');state.groups.forEach((g,i)=>groups.append(prepareGroup(g,i,passage)));
    const mapped=new Set([...groups.querySelectorAll('[data-qids]')].flatMap(i=>JSON.parse(i.dataset.qids)));
    for(const id of Object.keys(state.exam.answerKey))if(!mapped.has(id))groups.append(answerRow(id,[]));
    restore();pane('questions');if(state.submitted)result();
  }
  app.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.open)open(button.dataset.open);
    if(button.hasAttribute('data-back')){dismissKeyboard();save();list();}
    if(button.hasAttribute('data-done'))dismissKeyboard();
    if(button.dataset.pane)pane(button.dataset.pane);
    if(button.id==='submit'){dismissKeyboard();state.submitted=true;save();result();restore();document.getElementById('questions').scrollTop=0;pane('questions');}
    if(button.hasAttribute('data-redo')){state.answers={};state.submitted=false;localStorage.removeItem('practice-only:'+state.exam.examId);open(state.exam.examId);}
  });
  app.addEventListener('change',event=>{const input=event.target;if(!input.dataset.qids)return;if(input.type==='checkbox'&&input.checked){const all=[...document.querySelectorAll('#questions input[type=checkbox]')].filter(i=>i.dataset.qids===input.dataset.qids);const max=Number(input.dataset.max)||1;if(all.filter(i=>i.checked).length>max){input.checked=false;notice('最多选择 '+max+' 项');}}save();});
  app.addEventListener('input',event=>{if(event.target.dataset.qids)save();});
  function fit(){
    const viewport=window.visualViewport;
    document.documentElement.style.setProperty('--app-height',(viewport?.height||innerHeight)+'px');
    document.documentElement.style.setProperty('--app-top',(viewport?.offsetTop||0)+'px');
  }
  function revealAnswer(){
    const input=focusedInput;
    if(!input?.isConnected||document.activeElement!==input||!input.dataset.qids)return;
    const pane=input.closest('.pane');if(!pane)return;
    const field=input.getBoundingClientRect(),bounds=pane.getBoundingClientRect();
    if(field.bottom>bounds.bottom-12)pane.scrollTop+=field.bottom-bounds.bottom+12;
    else if(field.top<bounds.top+12)pane.scrollTop+=field.top-bounds.top-12;
  }
  app.addEventListener('pointerdown',event=>{if(event.target.closest('[data-done]')){event.preventDefault();dismissKeyboard();}});
  app.addEventListener('focusin',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){focusedInput=event.target;requestAnimationFrame(revealAnswer);}});
  const resize=()=>{fit();requestAnimationFrame(revealAnswer);};
  window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',fit);window.addEventListener('resize',resize);fit();window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  window.PracticeApp={open,list,collect,grade,get bank(){return state.bank;},get current(){return state.exam;}};
  fetch('bank.json').then(r=>{if(!r.ok)throw new Error('题库读取失败');return r.json();}).then(data=>{if(!Array.isArray(data.exams)||!data.exams.length)throw new Error('题库为空');state.bank=data.exams;list();}).catch(error=>{app.innerHTML='<p class="loading">'+esc(error.message)+'。请关闭后重新打开。</p>';});
})();
