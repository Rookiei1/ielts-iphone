(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IELTSBank = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
  const LIMITS = { zipBytes: 40000000, rawBytes: 80000000, files: 800, fileBytes: 2000000 };

  function decodeStoredZip(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (data.byteLength > LIMITS.zipBytes) throw new Error("题库包超过大小限制");
    const files = {};
    let offset = 0;
    let raw = 0;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    while (offset + 30 <= data.length) {
      const signature = view.getUint32(offset, true);
      if (signature === 0x02014b50 || signature === 0x06054b50) break;
      if (signature !== 0x04034b50) throw new Error("题库包不是可识别的 ZIP");
      const flags = view.getUint16(offset + 6, true);
      const method = view.getUint16(offset + 8, true);
      const compressed = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const name = new TextDecoder().decode(data.slice(nameStart, nameStart + nameLength));
      const dataStart = nameStart + nameLength + extraLength;
      const dataEnd = dataStart + compressed;
      if (dataEnd > data.length) throw new Error("题库包不完整");
      if ((flags & 0x1) !== 0) throw new Error("不接受加密压缩包");
      if (method !== 0) throw new Error("请使用未压缩的题库包");
      if (!name.endsWith("/")) {
        if (Object.keys(files).length >= LIMITS.files) throw new Error("题库包文件过多");
        const safe = safePath(name);
        const content = data.slice(dataStart, dataEnd);
        if (content.byteLength > LIMITS.fileBytes) throw new Error("单个题目超过大小限制");
        raw += content.byteLength;
        if (raw > LIMITS.rawBytes) throw new Error("题库解压后超过大小限制");
        files[safe] = new TextDecoder().decode(content);
      }
      offset = dataEnd;
    }
    if (!files["bank.json"]) throw new Error("题库包缺少 bank.json");
    return files;
  }

  function safePath(name) {
    const value = String(name || "").replace(/\\/g, "/");
    if (!value || value.startsWith("/") || value.includes("\0") || value.split("/").some((part) => part === ".." || part === ".")) {
      throw new Error("题库包路径不安全");
    }
    if (!/^(?:bank\.json|exams\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.json|explanations\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.json)$/.test(value)) {
      throw new Error("题库包包含不允许的文件");
    }
    return value;
  }

  function readPack(files) {
    const bank = JSON.parse(files["bank.json"]);
    if (!bank || bank.format !== "ielts-iphone-bank-v1") throw new Error("题库包版本无法识别");
    const exams = {};
    const notes = {};
    for (const [path, text] of Object.entries(files)) {
      if (path === "bank.json") continue;
      const payload = JSON.parse(text);
      const id = path.split("/")[1].replace(/\.json$/, "");
      if (!ID_PATTERN.test(id) || !payload || payload.examId !== id) throw new Error("题目编号不一致");
      if (path.startsWith("exams/")) {
        if (!payload.passage || !payload.answerKey || !Array.isArray(payload.questionOrder)) throw new Error("题目结构不完整");
        exams[id] = payload;
      } else {
        notes[id] = payload;
      }
    }
    const ids = Object.keys(exams);
    if (!ids.length) throw new Error("题库包里没有阅读题");
    const manifest = {};
    const explanationManifest = {};
    ids.forEach((id) => {
      const meta = exams[id].meta || {};
      manifest[id] = {
        examId: id, dataKey: id, script: "./" + id + ".js",
        title: String(meta.title || id), category: String(meta.category || ""),
        frequency: String(meta.frequency || ""), hasHtml: true, hasPdf: false,
        sourceKind: "private-import", questionTypes: [], questionTypeDetails: {}
      };
      if (notes[id]) {
        explanationManifest[id] = {
          examId: id, dataKey: id, script: "../reading-explanations/" + id + ".js",
          title: String(meta.title || id)
        };
      }
    });
    return { bank, exams, notes, manifest, explanationManifest, checksum: String(bank.checksum || "") };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("IELTSIphonePrivateBank", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("exams")) db.createObjectStore("exams");
        if (!db.objectStoreNames.contains("explanations")) db.createObjectStore("explanations");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开本机题库存储"));
    });
  }

  function commitPack(db, pack) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["exams", "explanations", "meta"], "readwrite");
      const exams = tx.objectStore("exams");
      const notes = tx.objectStore("explanations");
      exams.clear();
      notes.clear();
      Object.entries(pack.exams).forEach(([id, value]) => exams.put(value, id));
      Object.entries(pack.notes).forEach(([id, value]) => notes.put(value, id));
      tx.objectStore("meta").put({ checksum: pack.checksum, savedAt: Date.now() }, "active");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("题库写入失败"));
      tx.onabort = () => reject(tx.error || new Error("题库写入已回滚"));
    });
  }

  function activate(pack) {
    const record = {
      format: 1, bankId: "private", checksum: pack.checksum,
      manifest: pack.manifest, explanationManifest: pack.explanationManifest
    };
    localStorage.setItem("ielts-iphone-active-bank-v1", JSON.stringify(record));
    return record;
  }

  return { decodeStoredZip, readPack, openDatabase, commitPack, activate, LIMITS };
});
