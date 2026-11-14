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
      const error = new DOMException("请使用底部的「导入题库」或「导入学习数据」。", "AbortError");
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
      }, 2200);
    }
  }

  function isPracticePage() {
    return Boolean(document.getElementById("left") && document.getElementById("right"));
  }

  function bootUi() {
    if (document.getElementById("iphone-bar")) return;
    const practice = isPracticePage();
    document.body.classList.add(practice ? "iphone-practice-page" : "iphone-library-page");
    const bar = document.createElement("div");
    bar.id = "iphone-bar";
    if (practice) {
      bar.innerHTML = [
        '<button type="button" data-iphone-action="passage" aria-pressed="false">文章</button>',
        '<button type="button" data-iphone-action="questions" aria-pressed="true">题目</button>',
        '<button type="button" data-iphone-action="smaller">A-</button>',
        '<button type="button" data-iphone-action="larger">A+</button>',
        '<button type="button" data-iphone-action="close">返回</button>'
      ].join("");
    } else {
      const buttons = [
        '<button type="button" data-iphone-action="import-bank">导入题库</button>',
        '<button type="button" data-iphone-action="import-data">导入记录</button>',
        '<button type="button" data-iphone-action="export-data">导出备份</button>'
      ];
      if (readActive()) {
        buttons.push('<button type="button" data-iphone-action="use-sample">示例题</button>');
      }
      bar.innerHTML = buttons.join("");
    }
    const status = document.createElement("div");
    status.id = "iphone-status";
    status.dataset.state = "idle";
    status.setAttribute("role", "status");
    const bankInput = fileInput("iphone-bank-file", ".zip,application/zip");
    const dataInput = fileInput("iphone-data-file", ".json,application/json");
    document.body.append(bar, status, bankInput, dataInput);
    if (practice) {
      document.body.dataset.iphonePane = "questions";
      rememberScroll();
      watchResults();
    }
    bar.addEventListener("click", onBar);
    bankInput.addEventListener("change", function () { if (bankInput.files[0]) importBank(bankInput.files[0]); bankInput.value = ""; });
    dataInput.addEventListener("change", function () { if (dataInput.files[0]) importLearningData(dataInput.files[0]); dataInput.value = ""; });
    if (location.pathname.indexOf("listening-practice") >= 0) {
      setStatus("当前安装包没有听力音频或听力题。听力页会保持空白。", "error");
    }
  }

  function fileInput(id, accept) {
    const input = document.createElement("input");
    input.id = id;
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    return input;
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

  let zoom = 1;
  function onBar(event) {
    const button = event.target.closest("[data-iphone-action]");
    if (!button) return;
    const action = button.dataset.iphoneAction;
    if (action === "passage" || action === "questions") showPane(action);
    if (action === "smaller" || action === "larger") {
      zoom = Math.min(1.6, Math.max(0.85, zoom + (action === "larger" ? 0.1 : -0.1)));
      document.documentElement.style.zoom = String(zoom);
    }
    if (action === "import-bank") document.getElementById("iphone-bank-file").click();
    if (action === "import-data") document.getElementById("iphone-data-file").click();
    if (action === "export-data") exportLearningData();
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
      setStatus("已选中选项，再点答案框。", "idle");
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
      setStatus("学习数据已导入。电脑上的记录不会自动同步，这次是手动导入。", "success");
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
