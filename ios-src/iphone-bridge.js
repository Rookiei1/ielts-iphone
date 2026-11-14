(function installIphoneBridge(window, document) {
  "use strict";
  if (window.__IELTS_IPHONE_BRIDGE__) return;
  window.__IELTS_IPHONE_BRIDGE__ = true;
  const KEY = "ielts-iphone-active-bank-v1";

  function readActive() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "null");
      return value && value.bankId === "private" && value.manifest ? value : null;
    } catch (_) {
      return null;
    }
  }

  function installOverride() {
    const active = readActive();
    if (!active) return;
    window.__IELTS_IPHONE_ACTIVE__ = active;
    replaceGlobal("__READING_EXAM_MANIFEST__", function () { return active.manifest; });
    replaceGlobal("__READING_EXAM_INDEX__", function () { return indexFrom(active.manifest); });
    replaceGlobal("__READING_EXPLANATION_MANIFEST__", function () { return active.explanationManifest || {}; });
    replaceGlobal("completeExamIndex", function () { return indexFrom(active.manifest); });
  }

  function replaceGlobal(name, factory) {
    let current;
    Object.defineProperty(window, name, {
      configurable: true,
      get: function () { return current; },
      set: function (value) { current = window.__IELTS_IPHONE_ACTIVE__ ? factory() : value; }
    });
  }

  function indexFrom(manifest) {
    const index = Object.keys(manifest).map(function (id) {
      const entry = manifest[id] || {};
      return {
        id: id, title: entry.title || id, category: entry.category || "", frequency: entry.frequency || "",
        questionTypes: entry.questionTypes || [], questionTypeDetails: entry.questionTypeDetails || {},
        hasHtml: true, hasPdf: false, sourceKind: entry.sourceKind || "private-import", type: "reading"
      };
    });
    index.pathRoot = { reading: "private/", listening: "ListeningPractice/" };
    return index;
  }

  installOverride();

  const originalAppend = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (node && node.tagName === "SCRIPT" && interceptScript(node)) return node;
    return originalAppend.call(this, node);
  };

  function interceptScript(node) {
    const active = window.__IELTS_IPHONE_ACTIVE__;
    const url = node.src || node.getAttribute("src") || "";
    const match = String(url).match(/reading-(exams|explanations)\/([^/?#]+)\.js$/);
    if (!active || !match || match[2] === "manifest") return false;
    const id = decodeURIComponent(match[2]);
    const table = match[1] === "exams" ? active.manifest : active.explanationManifest;
    if (!table || !table[id]) return false;
    loadPrivate(match[1], id).then(function () {
      if (typeof node.onload === "function") node.onload(new Event("load"));
    }).catch(function () {
      if (typeof node.onerror === "function") node.onerror(new Event("error"));
    });
    return true;
  }

  function loadPrivate(kind, id) {
    const request = indexedDB.open("IELTSIphonePrivateBank", 1);
    return new Promise(function (resolve, reject) {
      request.onerror = function () { reject(request.error); };
      request.onsuccess = function () {
        const store = kind === "exams" ? "exams" : "explanations";
        const tx = request.result.transaction(store, "readonly");
        const get = tx.objectStore(store).get(id);
        get.onsuccess = function () {
          if (!get.result) { reject(new Error("missing")); return; }
          const registryName = kind === "exams" ? "__READING_EXAM_DATA__" : "__READING_EXPLANATION_DATA__";
          const registry = window[registryName];
          if (!registry || typeof registry.register !== "function") { reject(new Error("registry")); return; }
          if (typeof registry.has !== "function" || !registry.has(id)) registry.register(id, get.result);
          resolve(true);
        };
        get.onerror = function () { reject(get.error); };
      };
    });
  }

  if (typeof window.showDirectoryPicker !== "function") {
    window.showDirectoryPicker = function () {
      const error = new DOMException("请在「设置」中选择「导入阅读题库 (.zip)」或「导入学习记录」。", "AbortError");
      setStatus(error.message, "error");
      return Promise.reject(error);
    };
  }

  let statusTimer = 0;
  function setStatus(message, state) {
    const node = document.getElementById("iphone-status");
    if (!node) return;
    clearTimeout(statusTimer);
    node.textContent = message || "";
    node.dataset.state = state || "idle";
    if (message && state !== "error" && state !== "pending") {
      statusTimer = setTimeout(function () {
        node.textContent = "";
        node.dataset.state = "idle";
      }, 2400);
    }
  }

  function isPracticePage() {
    return Boolean(document.getElementById("left") && document.getElementById("right"));
  }

  function fileInput(id, accept) {
    const input = document.createElement("input");
    input.id = id;
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    return input;
  }

  const TAB_ICONS = {
    browse: '<svg class="iphone-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    practice: '<svg class="iphone-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 15"></polyline></svg>',
    settings: '<svg class="iphone-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
  };

  function bankSummary() {
    const active = readActive();
    if (active) {
      const count = Object.keys(active.manifest || {}).length;
      return { isPrivate: true, pill: "私密 · " + count + " 篇", detail: "已加载私有阅读题库（共 " + count + " 篇，离线可用）" };
    }
    return { isPrivate: false, pill: "示例 · 3 篇", detail: "当前使用 3 篇内置示例题。可导入 reading-bank.zip 切换完整题库。" };
  }

  function setupLibraryChrome() {
    const info = bankSummary();
    if (!document.getElementById("iphone-top-bar")) {
      const header = document.createElement("header");
      header.id = "iphone-top-bar";
      header.innerHTML =
        '<h1 id="iphone-top-title">雅思阅读</h1>' +
        '<button type="button" id="iphone-bank-pill" data-iphone-action="open-settings">' + info.pill + "</button>";
      document.body.prepend(header);
    }

    const browseView = document.getElementById("browse-view");
    const searchRow = browseView && browseView.querySelector(".search-row");
    const freqFilter = (searchRow && searchRow.querySelector(".browse-frequency-filter")) || document.getElementById("browse-frequency-filter-buttons");
    const learningControls = document.getElementById("browse-learning-controls");
    if (searchRow && freqFilter && learningControls && !searchRow.querySelector(".iphone-filter-row")) {
      const filterRow = document.createElement("div");
      filterRow.className = "iphone-filter-row";
      searchRow.appendChild(filterRow);
      filterRow.appendChild(freqFilter);
      filterRow.appendChild(learningControls);
    }

    const examList = document.getElementById("exam-list-container");
    if (browseView && examList && !document.getElementById("iphone-bank-banner")) {
      const banner = document.createElement("div");
      banner.id = "iphone-bank-banner";
      banner.hidden = info.isPrivate;
      banner.innerHTML =
        '<div class="iphone-bank-banner__text"><strong>内置 3 篇示例题</strong><span>导入 reading-bank.zip 解锁完整题库</span></div>' +
        '<button type="button" class="iphone-bank-banner__btn" data-iphone-action="import-bank">导入题库</button>';
      browseView.insertBefore(banner, examList);
    }

    const settingsView = document.getElementById("settings-view");
    if (settingsView && !document.getElementById("iphone-settings-group")) {
      const group = document.createElement("section");
      group.id = "iphone-settings-group";
      group.innerHTML = [
        '<div class="iphone-settings-card">',
        '  <div class="iphone-settings-card__header">题库管理</div>',
        '  <div class="iphone-settings-status-row" id="iphone-bank-status-text"></div>',
        '  <button type="button" class="iphone-settings-row-btn" data-iphone-action="import-bank"><span>导入阅读题库 (.zip)</span><small>选择文件</small></button>',
        info.isPrivate ? '  <button type="button" class="iphone-settings-row-btn" data-iphone-action="use-sample"><span>切回内置示例</span><small>3 篇</small></button>' : "",
        "</div>",
        '<div class="iphone-settings-card">',
        '  <div class="iphone-settings-card__header">学习记录与备份</div>',
        '  <button type="button" class="iphone-settings-row-btn" data-iphone-action="import-data"><span>导入学习记录 (.json)</span><small>合并导入</small></button>',
        '  <button type="button" class="iphone-settings-row-btn" data-iphone-action="export-data"><span>导出学习备份</span><small>分享 / 存储</small></button>',
        "</div>"
      ].join("");
      group.querySelector("#iphone-bank-status-text").textContent = info.detail;
      settingsView.prepend(group);
    }

    const TAB_LABELS = { browse: "题库浏览", practice: "练习记录", settings: "数据设置" };
    const HEADER_TITLES = { browse: "雅思阅读", practice: "练习记录", settings: "题库与设置" };
    const navButtons = document.querySelectorAll(".main-nav .hero-nav__btn[data-view]");
    navButtons.forEach(function (button) {
      const view = button.dataset.view;
      if (!TAB_ICONS[view] || button.dataset.iphoneEnhanced === "1") return;
      button.dataset.iphoneEnhanced = "1";
      const label = TAB_LABELS[view] || button.textContent.trim();
      button.innerHTML = TAB_ICONS[view] + "<span>" + label + "</span>";
    });

    function syncTopTitle() {
      const activeBtn = document.querySelector(".main-nav .hero-nav__btn.active[data-view]");
      const titleNode = document.getElementById("iphone-top-title");
      if (activeBtn && titleNode) {
        titleNode.textContent = HEADER_TITLES[activeBtn.dataset.view] || "雅思阅读";
      }
    }

    const nav = document.querySelector(".main-nav.hero-nav");
    if (nav) {
      new MutationObserver(syncTopTitle).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    syncTopTitle();
  }

  function setupPracticeChrome() {
    const headerLeft = document.querySelector(".header-left");
    const details = document.querySelector(".candidate-details");
    if (headerLeft && !document.getElementById("iphone-practice-back")) {
      const backBtn = document.createElement("button");
      backBtn.id = "iphone-practice-back";
      backBtn.type = "button";
      backBtn.dataset.iphoneAction = "close";
      backBtn.setAttribute("aria-label", "返回题库");
      backBtn.textContent = "‹ 返回";
      headerLeft.prepend(backBtn);
    }
    if (details && !document.getElementById("iphone-practice-title")) {
      const titleSpan = document.createElement("div");
      titleSpan.id = "iphone-practice-title";
      const examTitle = document.getElementById("exam-title");
      titleSpan.textContent = (examTitle && examTitle.textContent) || document.title || "阅读练习";
      details.prepend(titleSpan);
      if (examTitle) {
        new MutationObserver(function () {
          titleSpan.textContent = examTitle.textContent || document.title || "阅读练习";
        }).observe(examTitle, { childList: true, characterData: true, subtree: true });
      }
    }

    function syncPartSections() {
      const sections = [...document.querySelectorAll(".part-nav-section")];
      const nonEmpty = [];
      sections.forEach(function (section) {
        const hasButtons = section.querySelector(".part-nav-questions")?.children.length > 0;
        section.classList.toggle("iphone-part-empty", !hasButtons);
        if (hasButtons) nonEmpty.push(section);
      });
      const activeNonEmpty = nonEmpty.find(function (section) {
        return section.classList.contains("active");
      });
      sections.forEach(function (section) {
        const show = !section.classList.contains("iphone-part-empty") && (!activeNonEmpty || section === activeNonEmpty);
        section.classList.toggle("iphone-part-show", show);
      });
    }

    const nav = document.querySelector(".practice-nav");
    if (nav) {
      new MutationObserver(syncPartSections).observe(nav, { childList: true, subtree: true });
      syncPartSections();
    }
  }

  function bootUi() {
    if (document.getElementById("iphone-status")) return;
    const practice = isPracticePage();
    document.body.classList.add(practice ? "iphone-practice-page" : "iphone-library-page");

    const status = document.createElement("div");
    status.id = "iphone-status";
    status.dataset.state = "idle";
    status.setAttribute("role", "status");
    const bankInput = fileInput("iphone-bank-file", ".zip,application/zip");
    const dataInput = fileInput("iphone-data-file", ".json,application/json");
    document.body.append(status, bankInput, dataInput);

    if (practice) {
      const bar = document.createElement("div");
      bar.id = "iphone-bar";
      bar.innerHTML = [
        '<button type="button" data-iphone-action="passage" aria-pressed="false">文章</button>',
        '<button type="button" data-iphone-action="questions" aria-pressed="true">题目</button>',
        '<button type="button" data-iphone-action="smaller">A-</button>',
        '<button type="button" data-iphone-action="larger">A+</button>',
        '<button type="button" data-iphone-action="close">返回</button>'
      ].join("");
      document.body.append(bar);
      setupPracticeChrome();
      document.body.dataset.iphonePane = "questions";
      rememberScroll();
      watchResults();
    } else {
      setupLibraryChrome();
    }

    document.addEventListener("click", function (event) {
      const actionBtn = event.target.closest && event.target.closest("[data-iphone-action]");
      if (actionBtn) {
        onAction(actionBtn.dataset.iphoneAction);
      }
      const jumpBtn = practice && event.target.closest && event.target.closest("[data-result-question-id]");
      if (jumpBtn) {
        showPane("passage");
      }
    });

    bankInput.addEventListener("change", function () { if (bankInput.files[0]) importBank(bankInput.files[0]); bankInput.value = ""; });
    dataInput.addEventListener("change", function () { if (dataInput.files[0]) importLearningData(dataInput.files[0]); dataInput.value = ""; });
    if (location.pathname.indexOf("listening-practice") >= 0) {
      setStatus("当前安装包没有听力音频或听力题。听力页会保持空白。", "error");
    }
  }

  const scrollMemory = { left: 0, right: 0 };
  function isPaneVisible(pane, expectedName) {
    return Boolean(pane && document.body.dataset.iphonePane === expectedName && pane.offsetParent !== null);
  }

  function rememberScroll() {
    const left = document.getElementById("left");
    const right = document.getElementById("right");
    if (left) left.addEventListener("scroll", function () {
      if (isPaneVisible(left, "passage")) scrollMemory.left = left.scrollTop;
    });
    if (right) right.addEventListener("scroll", function () {
      if (isPaneVisible(right, "questions")) scrollMemory.right = right.scrollTop;
    });
  }

  function syncPaneButtons(name) {
    const bar = document.getElementById("iphone-bar");
    if (!bar) return;
    bar.querySelectorAll('[data-iphone-action="passage"], [data-iphone-action="questions"]').forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.iphoneAction === name ? "true" : "false");
    });
  }

  function showPane(name) {
    const left = document.getElementById("left");
    const right = document.getElementById("right");
    const previous = document.body.dataset.iphonePane;
    if (previous === "passage" && left && left.offsetParent !== null) scrollMemory.left = left.scrollTop;
    if (previous === "questions" && right && right.offsetParent !== null) scrollMemory.right = right.scrollTop;
    document.body.dataset.iphonePane = name;
    syncPaneButtons(name);
    const restore = function () {
      if (name === "passage" && left) left.scrollTop = scrollMemory.left;
      if (name === "questions" && right) right.scrollTop = scrollMemory.right;
    };
    restore();
    requestAnimationFrame(restore);
  }

  let fontSizePx = 16;
  function onAction(action) {
    if (action === "passage" || action === "questions") showPane(action);
    if (action === "smaller" || action === "larger") {
      fontSizePx = Math.min(22, Math.max(13, fontSizePx + (action === "larger" ? 1 : -1)));
      document.documentElement.style.setProperty("--iphone-read-size", fontSizePx + "px");
      setStatus("字号 " + fontSizePx + "px", "idle");
    }
    if (action === "import-bank") document.getElementById("iphone-bank-file").click();
    if (action === "import-data") document.getElementById("iphone-data-file").click();
    if (action === "export-data") exportLearningData();
    if (action === "open-settings") {
      const settingsBtn = document.querySelector('.main-nav .nav-btn[data-view="settings"]');
      if (settingsBtn) settingsBtn.click();
    }
    if (action === "use-sample") { localStorage.removeItem(KEY); setStatus("已改回示例题。", "success"); location.reload(); }
    if (action === "close") {
      window.close();
      if (!window.opener && window.history.length > 1) window.history.back();
    }
  }

  let selected = null;
  document.addEventListener("click", function (event) {
    const item = event.target.closest && event.target.closest(".drag-item, .draggable-word, .card");
    const zone = event.target.closest && event.target.closest(".paragraph-dropzone, .match-dropzone, .drop-target-summary");
    if (item && !zone) {
      if (item.classList.contains("option-consumed") || item.dataset.consumed === "1") return;
      selected = item;
      document.querySelectorAll(".iphone-selected").forEach(function (node) { node.classList.remove("iphone-selected"); });
      item.classList.add("iphone-selected");
      setStatus("已选中选项，请点目标空格。", "idle");
      return;
    }
    if (zone && selected) {
      const value = selected.dataset.heading || selected.dataset.option || selected.dataset.key || selected.dataset.value || selected.textContent.trim();
      placeAnswer(zone, value, selected.textContent.trim());
      const group = zone.closest(".unified-group");
      if (group && group.dataset.allowOptionReuse === "false") {
        selected.dataset.consumed = "1";
        selected.classList.add("option-consumed");
      }
      selected.classList.remove("iphone-selected");
      selected = null;
      setStatus("", "idle");
    }
  }, true);

  function placeAnswer(zone, value, label) {
    zone.dataset.answerValue = value;
    zone.dataset.answerLabel = label;
    zone.classList.remove("correct", "wrong");
    zone.classList.add("dropzone-filled");
    let holder = zone.querySelector(".dropped-items");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "dropped-items";
      zone.appendChild(holder);
    }
    holder.textContent = "";
    const chip = document.createElement("div");
    chip.className = "drag-item drag-item--assigned";
    chip.textContent = label;
    chip.dataset.answerValue = value;
    holder.appendChild(chip);
  }

  async function importBank(file) {
    setStatus("正在检查题库包…", "pending");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pack = window.IELTSBank.readPack(window.IELTSBank.decodeStoredZip(bytes));
      const active = readActive();
      if (active && active.checksum && active.checksum === pack.checksum) {
        setStatus("这套题库已经导入，没有重复写入。", "duplicate");
        return;
      }
      const db = await window.IELTSBank.openDatabase();
      await window.IELTSBank.commitPack(db, pack);
      window.IELTSBank.activate(pack);
      await mirrorBank(pack);
      setStatus("题库已保存到本机，正在切换。", "success");
      location.reload();
    } catch (error) {
      setStatus(error && error.message ? error.message : "题库导入失败，原题库未改变。", "error");
    }
  }

  async function mirrorBank(pack) {
    const filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (!filesystem) return;
    const writes = [writeFile(filesystem, "bank/manifest.json", JSON.stringify({
      checksum: pack.checksum, manifest: pack.manifest, explanationManifest: pack.explanationManifest
    }))];
    Object.entries(pack.exams).forEach(function (pair) { writes.push(writeFile(filesystem, "bank/exams/" + pair[0] + ".json", JSON.stringify(pair[1]))); });
    await Promise.all(writes);
  }

  function writeFile(filesystem, path, text) {
    return filesystem.writeFile({
      path: path, directory: "DATA", recursive: true,
      data: btoa(unescape(encodeURIComponent(text)))
    });
  }

  async function ensureRecorderReady() {
    if (window.practiceRecorder && typeof window.practiceRecorder.exportData === "function") {
      return window.practiceRecorder;
    }
    if (window.AppEntry && typeof window.AppEntry.ensurePracticeSuiteGroup === "function") {
      await window.AppEntry.ensurePracticeSuiteGroup();
    }
    if (window.app && typeof window.app.ensurePracticeRecorder === "function") {
      await window.app.ensurePracticeRecorder();
    }
    const recorder = window.practiceRecorder || (window.app && window.app.components && window.app.components.practiceRecorder);
    if (!recorder || typeof recorder.importData !== "function" || typeof recorder.exportData !== "function") {
      throw new Error("练习记录模块还没准备好");
    }
    return recorder;
  }

  async function importLearningData(file) {
    setStatus("正在导入学习数据…", "pending");
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object") throw new Error("学习数据格式不正确");
      const recorder = await ensureRecorderReady();
      const receipt = await recorder.importData(data, { merge: true });
      if (!receipt || receipt.committed !== true) throw new Error("学习数据没有提交成功");
      setStatus("学习数据已导入。", "success");
    } catch (error) {
      setStatus(error && error.message ? error.message : "学习数据导入失败。", "error");
    }
  }

  async function exportLearningData() {
    setStatus("正在导出…", "pending");
    try {
      const recorder = await ensureRecorderReady();
      const json = await recorder.exportData("json");
      if (typeof json !== "string" || !json.trim()) throw new Error("没有导出到数据");
      JSON.parse(json);
      const share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
      const filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
      if (share && filesystem) {
        await filesystem.writeFile({ path: "IELTS-Practice-backup.json", directory: "DOCUMENTS", data: json, encoding: "utf8", recursive: true });
        const uri = await filesystem.getUri({ path: "IELTS-Practice-backup.json", directory: "DOCUMENTS" });
        await share.share({ title: "雅思练习学习备份", url: uri.uri, dialogTitle: "导出学习数据" });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        link.download = "IELTS-Practice-backup.json";
        link.click();
      }
      setStatus("备份已导出。", "success");
    } catch (error) {
      setStatus(error && error.message ? error.message : "导出失败。", "error");
    }
  }

  function watchResults() {
    const results = document.getElementById("results");
    if (!results) return;
    const observer = new MutationObserver(function () {
      if (!results.textContent || results.querySelector(".iphone-explanation-note")) return;
      setTimeout(function () {
        if (document.querySelector(".reading-passage-explanation, .reading-explanation-card, .reading-group-explanation")) return;
        const note = document.createElement("p");
        note.className = "iphone-explanation-note";
        note.textContent = "这篇没有配套解析。正确答案仍可对照，这里不会编造解析。";
        results.appendChild(note);
      }, 700);
    });
    observer.observe(results, { childList: true });
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest && event.target.closest('[data-action-value="listening"]');
    if (!button) return;
    setTimeout(function () {
      const box = document.getElementById("exam-list-container");
      if (!box || box.querySelector(".iphone-listening-empty")) return;
      const note = document.createElement("p");
      note.className = "iphone-listening-empty";
      note.textContent = "没有随包提供听力题、音频或 PDF。把自备听力资料导入后才会出现在这里。";
      box.prepend(note);
    }, 400);
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if (document.body) bootUi();
  else document.addEventListener("DOMContentLoaded", bootUi);
})(window, document);
