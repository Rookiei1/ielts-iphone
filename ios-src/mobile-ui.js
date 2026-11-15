(function (window, document) {
  'use strict';
  window.__IELTS_MOBILE_APP__ = true;
  const state = { tab: 'browse', reviewId: null, part: 'all', frequency: 'all', query: '', limit: 40, records: [], exams: [], ready: false };
  const icons = {
    browse: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5zM4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>',
    records: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let root, main, title, counter, refreshToken = 0, navigationToken = 0;
  function status(message, type = 'error') {
    if (window.IELTSMobileBridge) window.IELTSMobileBridge.status(message, type);
  }
  function score(record) {
    const info = record.scoreInfo || record.realData?.scoreInfo || {};
    const correct = Number(info.correct ?? info.correctCount ?? info.correctAnswers ?? record.correctCount ?? record.correctAnswers);
    const total = Number(info.total ?? info.totalQuestions ?? record.totalQuestions ?? record.totalCount);
    if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) return { correct, total, rate: correct / total };
    const raw = Number(record.accuracy ?? record.score ?? info.accuracy);
    return { correct: null, total: null, rate: Number.isFinite(raw) ? (raw > 1 ? raw / 100 : raw) : null };
  }
  function scoreText(record) {
    const value = score(record);
    return value.total ? value.correct + ' / ' + value.total : value.rate != null ? Math.round(value.rate * 100) + '%' : '已完成';
  }
  function dateOf(record) {
    const value = record.endTime || record.completedAt || record.date || record.timestamp || record.startTime || record.createdAt;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function recordTitle(record) {
    return record.title || record.examTitle || state.exams.find(exam => String(exam.id) === String(record.examId))?.title || (record.type === 'suite' ? '套题练习' : '阅读练习');
  }
  function frequency(exam) {
    const value = String(exam.frequency || '').toLowerCase();
    if (['high','ultra-high','高频','超高频'].includes(value)) return 'high';
    if (['medium','mid','very-high','中频','次高频'].includes(value)) return 'medium';
    if (['low','低频'].includes(value)) return 'low';
    return '';
  }
  function favorites() {
    try { return new Set(JSON.parse(localStorage.getItem('ielts-mobile-favorites-v1') || '[]')); }
    catch (_) { return new Set(); }
  }
  function card(exam, favoriteIds) {
    const record = state.records.find(row => String(row.examId) === String(exam.id));
    const saved = favoriteIds.has(exam.id);
    const label = ({high:'高频',medium:'中频',low:'低频'})[frequency(exam)] || '阅读';
    return '<article class="m-exam" data-exam-id="' + escape(exam.id) + '">' +
      '<div class="m-exam-top"><span class="m-part">' + escape(exam.category || '阅读') + '</span><span class="m-frequency">' + label + '</span>' +
      '<button class="m-bookmark' + (saved ? ' is-saved' : '') + '" data-m-favorite="' + escape(exam.id) + '" aria-label="' + (saved ? '取消收藏 ' : '收藏 ') + escape(exam.title) + '" aria-pressed="' + saved + '">' + svg('star') + '</button></div>' +
      '<h2>' + escape(exam.title) + '</h2><div class="m-exam-bottom">' +
      '<span class="m-exam-state' + (record ? ' is-done' : '') + '">' + (record ? '上次 ' + scoreText(record) : '尚未练习') + '</span>' +
      '<button class="m-start" data-m-open="' + escape(exam.id) + '" aria-label="开始练习 ' + escape(exam.title) + '">' + (record ? '再练一次' : '开始练习') + svg('arrow') + '</button></div></article>';
  }
  function renderList() {
    const list = document.getElementById('mobile-exams');
    if (!list) return;
    const query = state.query.toLocaleLowerCase().trim();
    const filtered = state.exams.filter(exam => (state.part === 'all' || exam.category === state.part) &&
      (state.frequency === 'all' || frequency(exam) === state.frequency) && (!query || String(exam.title).toLocaleLowerCase().includes(query)));
    document.getElementById('mobile-result-count').textContent = filtered.length + ' 篇阅读';
    list.innerHTML = filtered.length ? filtered.slice(0, state.limit).map(exam => card(exam, favorites())).join('') :
      '<div class="m-empty"><h2>没有找到文章</h2><p>试试其他关键词或筛选条件。</p><button class="m-secondary" data-m-clear>清除筛选</button></div>';
    document.getElementById('mobile-more').hidden = filtered.length <= state.limit;
  }
  function browse() {
    main.innerHTML = '<section class="m-library" aria-label="阅读题库">' +
      '<label class="m-search">' + svg('search') + '<input id="mobile-search" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="搜索文章或中文标题" aria-label="搜索题目" value="' + escape(state.query) + '"></label>' +
      '<div class="m-filters"><div class="m-segments" role="group" aria-label="阅读部分">' + ['all','P1','P2','P3'].map(part =>
        '<button data-m-part="' + part + '" aria-pressed="' + (state.part === part) + '">' + (part === 'all' ? '全部' : part) + '</button>').join('') + '</div>' +
      '<label class="m-frequency-select"><span class="m-sr">频率</span><select id="mobile-frequency" aria-label="频率筛选"><option value="all">全部频率</option><option value="high">高频</option><option value="medium">中频</option><option value="low">低频</option></select></label></div>' +
      '<div class="m-list-heading"><span id="mobile-result-count"></span><button class="m-text-button" data-m-suite>套题练习</button></div>' +
      '<div id="mobile-exams" class="m-exams"></div><button id="mobile-more" class="m-secondary m-load-more" data-m-more>加载更多</button></section>';
    document.getElementById('mobile-frequency').value = state.frequency;
    document.getElementById('mobile-search').addEventListener('input', event => { state.query = event.target.value; state.limit = 40; renderList(); });
    document.getElementById('mobile-frequency').addEventListener('change', event => { state.frequency = event.target.value; state.limit = 40; renderList(); });
    renderList();
  }
  function records() {
    const values = state.records.map(score).filter(row => row.rate != null);
    const average = values.length ? Math.round(values.reduce((sum, row) => sum + row.rate, 0) / values.length * 100) + '%' : '—';
    main.innerHTML = '<section aria-label="练习记录"><div class="m-stat-row"><div><strong>' + state.records.length + '</strong><span>完成练习</span></div><div><strong>' + average + '</strong><span>平均正确率</span></div></div>' +
      (state.records.length ? '<div class="m-history">' + state.records.map(record => {
        const date = dateOf(record);
        return '<button class="m-record" data-m-record="' + escape(record.id) + '"><div><strong>' + escape(recordTitle(record)) + '</strong><span>' + (date ? escape(date.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})) : '练习记录') + '</span></div><b>' + escape(scoreText(record)) + '</b>' + svg('arrow') + '</button>';
      }).join('') + '</div>' : '<div class="m-empty"><div class="m-empty-icon">' + svg('records') + '</div><h2>从第一篇开始</h2><p>提交后，成绩与复盘会保存在这里。</p><button class="m-primary" data-m-tab="browse">去做题</button></div>') + '</section>';
  }
  function settings() {
    const isPrivate = !!window.__IELTS_IPHONE_ACTIVE__;
    main.innerHTML = '<section aria-label="数据设置"><div class="m-bank-card"><div class="m-bank-icon">' + svg('browse') + '</div><div><h2>' + (isPrivate ? '我的阅读题库' : '内置示例题库') + '</h2><p>' + state.exams.length + ' 篇 · 离线可用</p></div></div>' +
      '<h2 class="m-group-title">题库</h2><div class="m-settings-group"><button data-iphone-action="import-bank"><span><strong>导入阅读题库</strong><small>从“文件”选择题库 ZIP</small></span>' + svg('arrow') + '</button>' +
      (isPrivate ? '<button data-iphone-action="use-sample"><span><strong>切换到示例题</strong><small>个人题库仍保存在本机</small></span>' + svg('arrow') + '</button>' : '') + '</div>' +
      '<h2 class="m-group-title">备份与迁移</h2><div class="m-settings-group"><button data-iphone-action="export-data"><span><strong>导出学习备份</strong><small>保存到“文件”或通过系统分享</small></span>' + svg('arrow') + '</button><button data-iphone-action="import-data"><span><strong>导入学习记录</strong><small>合并电脑或手机导出的 JSON</small></span>' + svg('arrow') + '</button></div>' +
      '<p class="m-help">题库和记录保存在这台设备。更换设备或卸载前，请先导出备份。</p><div class="m-version">雅思练习 <span>1.1.0</span></div></section>';
  }
  function navigate(tab) {
    navigationToken++;
    state.reviewId = null;
    state.tab = ['browse','records','settings'].includes(tab) ? tab : 'browse';
    title.textContent = ({browse:'阅读练习',records:'练习记录',settings:'我的'})[state.tab];
    counter.hidden = state.tab !== 'browse';
    counter.textContent = state.exams.length + ' 篇';
    root.querySelectorAll('[data-m-tab]').forEach(button => button.setAttribute('aria-current',button.dataset.mTab === state.tab ? 'page' : 'false'));
    if (!state.ready) { main.innerHTML = '<div class="m-empty" role="status"><p>正在打开题库…</p></div>'; return; }
    ({browse,records,settings})[state.tab]();
    window.scrollTo(0,0);
  }
  async function refresh() {
    const token = ++refreshToken;
    try {
      await window.AppData.ready;
      const records = await window.AppData.practice.list({projection:'light'});
      if (token !== refreshToken) return;
      state.exams = (window.getReadingExamIndex ? window.getReadingExamIndex() : []).filter(exam => exam.type !== 'listening');
      state.records = records.filter(record => !['interrupted','abandoned','pending'].includes(record.status) && !record.isInterrupted).sort((a,b) => (dateOf(b)?.getTime() || 0) - (dateOf(a)?.getTime() || 0));
      state.ready = true;
      // A child WKWebView may finish sending messages after the user opens a record.
      // Refresh the data without replacing the active review or its scroll position.
      if (state.reviewId) return;
      if (state.tab === 'browse' && document.getElementById('mobile-exams')) renderList();
      else navigate(state.tab);
      counter.textContent = state.exams.length + ' 篇';
    } catch (error) { status('读取学习数据失败：' + error.message); }
  }
  async function openExam(id, button) {
    if (!state.ready) return;
    if (button) button.disabled = true;
    try {
      if (window.AppEntry?.ensurePracticeSuiteGroup) await window.AppEntry.ensurePracticeSuiteGroup();
      const result = await window.app.openExam(id);
      if (result === false) throw new Error('练习没有打开，请重试。');
      localStorage.setItem('ielts-mobile-last-exam',id);
    } catch (error) { status(error.message || '打开练习失败'); }
    finally { if (button) button.disabled = false; }
  }
  async function detail(id) {
    state.reviewId = id;
    const token = ++navigationToken;
    try {
      const record = await window.AppData.practice.get(id);
      if (token !== navigationToken || state.reviewId !== id) return;
      if (!record) throw new Error('这条记录已不存在');
      const data = record.realData || record;
      const user = record.answers || record.answerMap || data.userAnswers || record.userAnswers || {};
      const correct = record.correctAnswerMap || data.correctAnswerMap || (typeof data.correctAnswers === 'object' ? data.correctAnswers : {});
      const ids = [...new Set([...Object.keys(typeof user === 'object' ? user : {}),...Object.keys(typeof correct === 'object' ? correct : {})])];
      title.textContent = '练习复盘'; counter.hidden = true;
      main.innerHTML = '<section class="m-review"><button class="m-text-button" data-m-tab="records">‹ 返回记录</button><h2>' + escape(recordTitle(record)) + '</h2><div class="m-review-score">' + escape(scoreText(record)) + '<small>本次得分</small></div>' +
        (ids.length ? '<ol class="m-answer-list">' + ids.map(question => '<li><strong>第 ' + escape(String(question).replace(/^q/,'')) + ' 题</strong><p>我的答案：' + escape(Array.isArray(user[question]) ? user[question].join(' / ') : user[question] || '未作答') + '</p><p class="m-correct">参考答案：' + escape(Array.isArray(correct[question]) ? correct[question].join(' / ') : correct[question] ?? '未记录') + '</p></li>').join('') + '</ol>' : '<p class="m-help">这条旧记录未包含逐题作答。可重新练习并查看解析。</p>') +
        '<button class="m-primary" data-m-open="' + escape(record.examId) + '">重新练习这篇</button></section>';
      window.scrollTo(0,0);
    } catch (error) {
      if (token !== navigationToken) return;
      state.reviewId = null;
      status(error.message);
    }
  }
  function boot() {
    if (document.getElementById('left') || document.getElementById('mobile-app')) return;
    root = document.createElement('div'); root.id = 'mobile-app';
    root.innerHTML = '<header class="m-header"><h1 id="mobile-title">阅读练习</h1><button id="mobile-bank-count" class="m-count" data-m-tab="settings" aria-label="题库设置"></button></header><main id="mobile-main"></main><nav class="m-tabs" aria-label="主导航">' +
      [['browse','题库'],['records','记录'],['settings','我的']].map(([tab,label]) => '<button data-m-tab="' + tab + '" aria-label="' + label + '">' + svg(tab) + '<span>' + label + '</span></button>').join('') + '</nav>';
    document.body.append(root);
    document.body.classList.add('mobile-redesign');
    document.body.classList.remove('hero-body','boot-active');
    const legacy = document.getElementById('app');
    if (legacy) { legacy.hidden = true; legacy.setAttribute('aria-hidden','true'); }
    main = document.getElementById('mobile-main'); title = document.getElementById('mobile-title'); counter = document.getElementById('mobile-bank-count');
    root.addEventListener('click', async event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.mTab) navigate(button.dataset.mTab);
      if (button.dataset.mPart) { state.part = button.dataset.mPart; state.limit = 40; browse(); }
      if (button.hasAttribute('data-m-clear')) { state.part = state.frequency = 'all'; state.query = ''; browse(); }
      if (button.hasAttribute('data-m-more')) { state.limit += 40; renderList(); }
      if (button.dataset.mFavorite) {
        const values = favorites(); const id = button.dataset.mFavorite;
        if (values.has(id)) values.delete(id); else values.add(id);
        try { localStorage.setItem('ielts-mobile-favorites-v1',JSON.stringify([...values])); renderList(); }
        catch (_) { status('收藏没有保存成功，请先导出学习备份并检查存储空间。'); }
      }
      if (button.dataset.mOpen) await openExam(button.dataset.mOpen,button);
      if (button.dataset.mRecord) await detail(button.dataset.mRecord);
      if (button.hasAttribute('data-m-suite')) {
        try {
          if (window.AppEntry?.ensureSessionSuiteReady) await window.AppEntry.ensureSessionSuiteReady();
          if (window.app._ensureSuiteRecoveryReady) await window.app._ensureSuiteRecoveryReady();
          const session = window.app.currentSuiteSession;
          if (session && ['active','initializing','finalizing'].includes(session.status)) await window.app.resumeSuitePractice(session.id);
          else await window.app.startSuitePractice({flowMode:'classic',frequencyScope:'all'});
        } catch (error) { status(error.message || '套题暂时无法开始'); }
      }
    });
    navigate('browse');
    const start = Date.now();
    const timer = setInterval(async () => {
      if (window.AppData?.ready && window.getReadingExamIndex && window.app?.openExam) {
        clearInterval(timer);
        if (window.AppEntry?.ensurePracticeSuiteGroup) await window.AppEntry.ensurePracticeSuiteGroup();
        await refresh();
      } else if (Date.now() - start > 20000) { clearInterval(timer); status('启动未完成，请关闭后重新打开；已有学习数据不会清空。'); }
    },50);
    window.addEventListener('focus',refresh);
    window.addEventListener('message',() => setTimeout(refresh,200));
    document.addEventListener('visibilitychange',() => { if (!document.hidden) refresh(); });
    window.IELTSMobileUI = {navigate,refresh};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})(window,document);
