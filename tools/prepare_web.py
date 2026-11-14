"""Build the offline web root from the pinned GPL source and original samples."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "third_party" / "ielts-practice"
DEST = ROOT / "build" / "web"
sys.path.insert(0, str(ROOT / "tools"))
from sample_bank import CATALOG, EXAMS, EXPLANATIONS  # noqa: E402

FORBIDDEN = ("A Brief History of Tea", "睡着过项目组/2. 所有文章")


def write_register(path: Path, function_name: str, registry: str, exam_id: str, payload: dict):
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    path.write_text(
        "(function " + function_name + "(global) {\n"
        "  'use strict';\n"
        f"  if (!global.{registry} || typeof global.{registry}.register !== \"function\") {{\n"
        f"    throw new Error(\"{registry}_missing\");\n"
        "  }\n"
        f"  global.{registry}.register({json.dumps(exam_id)}, {body});\n"
        "})(typeof window !== \"undefined\" ? window : globalThis);\n",
        encoding="utf-8",
    )


def manifest_js(entries: dict) -> str:
    return (
        "(function registerReadingExamManifest(global) {\n"
        "  'use strict';\n"
        "  const PATH_ROOT = { reading: 'sample/', listening: 'ListeningPractice/' };\n"
        f"  const manifest = {json.dumps(entries, ensure_ascii=False, indent=2)};\n"
        "  function clonePathRoot() { return Object.assign({}, PATH_ROOT); }\n"
        "  function cloneQuestionTypeMetadata(entry) {\n"
        "    return {\n"
        "      questionTypes: Array.isArray(entry.questionTypes) ? entry.questionTypes.slice() : [],\n"
        "      questionTypeDetails: Object.fromEntries(Object.entries(entry.questionTypeDetails || {}).map(function (pair) { return [pair[0], pair[1].slice()]; }))\n"
        "    };\n"
        "  }\n"
        "  function cloneIndexEntry(entry) { return Object.assign({}, entry, cloneQuestionTypeMetadata(entry)); }\n"
        "  function buildReadingExamIndex() {\n"
        "    const index = Object.keys(manifest).map(function (id) {\n"
        "      const entry = manifest[id] || {};\n"
        "      return Object.assign({\n"
        "        id: entry.examId || id, title: entry.title || '', category: entry.category || '',\n"
        "        frequency: entry.frequency || '', difficultyScore: entry.difficultyScore,\n"
        "        path: entry.path || '', filename: entry.filename || '', hasHtml: entry.hasHtml === true,\n"
        "        hasPdf: false, pdfFilename: '', sourceKind: entry.sourceKind || 'generated-reading', type: 'reading'\n"
        "      }, cloneQuestionTypeMetadata(entry));\n"
        "    });\n"
        "    index.pathRoot = clonePathRoot();\n"
        "    return index;\n"
        "  }\n"
        "  function getReadingExamIndex() {\n"
        "    const index = global.__READING_EXAM_INDEX__;\n"
        "    const cloned = Array.isArray(index) ? index.map(cloneIndexEntry) : buildReadingExamIndex();\n"
        "    cloned.pathRoot = clonePathRoot();\n"
        "    return cloned;\n"
        "  }\n"
        "  global.__READING_EXAM_MANIFEST__ = manifest;\n"
        "  global.__READING_EXAM_INDEX__ = buildReadingExamIndex();\n"
        "  global.__READING_EXAM_INDEX__.pathRoot = clonePathRoot();\n"
        "  global.__READING_EXAM_PATH_ROOT__ = clonePathRoot();\n"
        "  global.getReadingExamIndex = getReadingExamIndex;\n"
        "  global.getReadingExamIndex.pathRoot = clonePathRoot();\n"
        "  global.completeExamIndex = getReadingExamIndex();\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    )


def entry(exam_id: str, info: dict, folder: str) -> dict:
    return {
        "examId": exam_id,
        "dataKey": exam_id,
        "script": f"./{exam_id}.js" if folder == "reading-exams" else f"../reading-explanations/{exam_id}.js",
        "title": info["title"],
        "category": info["category"],
        "frequency": info["frequency"],
        "difficultyScore": info["difficultyScore"],
        "path": "sample/",
        "filename": f"{exam_id}.html",
        "hasHtml": True,
        "hasPdf": False,
        "sourceKind": "original-sample",
        "questionTypes": info["questionTypes"],
        "questionTypeDetails": {kind: ["original"] for kind in info["questionTypes"]},
    }


def inject(html: str) -> str:
    tags = (
        '<link rel="stylesheet" href="/ios/iphone.css">\n'
        '<script src="/ios/bank.js"></script>\n'
        '<script src="/ios/iphone-bridge.js"></script>\n'
    )
    if 'name="viewport"' in html and "viewport-fit=cover" not in html:
        html = html.replace(
            'content="width=device-width, initial-scale=1.0"',
            'content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"',
        )
    return html.replace("<head>", "<head>\n" + tags, 1).replace("<head ", "<head " , 1) if False else _inject_head(html, tags)


def _inject_head(html: str, tags: str) -> str:
    import re
    if "/ios/iphone-bridge.js" in html:
        return html
    return re.sub(r"<head[^>]*>", lambda match: match.group(0) + "\n" + tags, html, count=1)


def assert_clean(root: Path):
    roots = [
        root / "assets" / "generated" / "reading-exams",
        root / "assets" / "generated" / "reading-explanations",
        root / "ios",
    ]
    for base in roots:
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for needle in ("A Brief History of Tea", "Maori Fish Hooks", "睡着过项目组"):
                if needle in text:
                    raise SystemExit(f"Refusing to ship third-party passage material in {path}")


def main():
    if not SOURCE.joinpath("scripts", "build-bundles.mjs").is_file():
        raise SystemExit("Pinned upstream source is missing. See UPSTREAM.md.")
    if DEST.exists():
        shutil.rmtree(DEST)
    shutil.copytree(SOURCE, DEST, ignore=shutil.ignore_patterns("node_modules"))
    exams_dir = DEST / "assets" / "generated" / "reading-exams"
    notes_dir = DEST / "assets" / "generated" / "reading-explanations"
    exams_dir.mkdir(parents=True, exist_ok=True)
    notes_dir.mkdir(parents=True, exist_ok=True)
    exam_entries = {}
    note_entries = {}
    for exam in EXAMS:
        exam_id = exam["examId"]
        write_register(exams_dir / f"{exam_id}.js", "registerReadingExamData", "__READING_EXAM_DATA__", exam_id, exam)
        exam_entries[exam_id] = entry(exam_id, CATALOG[exam_id], "reading-exams")
    for note in EXPLANATIONS:
        exam_id = note["examId"]
        write_register(notes_dir / f"{exam_id}.js", "registerReadingExplanationData", "__READING_EXPLANATION_DATA__", exam_id, note)
        info = CATALOG[exam_id]
        note_entries[exam_id] = {
            "examId": exam_id, "dataKey": exam_id,
            "script": f"../reading-explanations/{exam_id}.js",
            "title": info["title"], "sourceDoc": "original", "matchedTitle": info["title"],
        }
    (exams_dir / "manifest.js").write_text(manifest_js(exam_entries), encoding="utf-8")
    (notes_dir / "manifest.js").write_text(
        "(function registerReadingExplanationManifest(global) {\n  'use strict';\n  global.__READING_EXPLANATION_MANIFEST__ = "
        + json.dumps(note_entries, ensure_ascii=False, indent=2)
        + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
        encoding="utf-8",
    )
    listening = DEST / "assets" / "generated" / "listening-exams"
    listening.mkdir(parents=True, exist_ok=True)
    (listening / "manifest.js").write_text(
        "(function (global) { 'use strict'; global.__LISTENING_EXAM_MANIFEST__ = {}; })(typeof window !== 'undefined' ? window : globalThis);\n",
        encoding="utf-8",
    )
    (listening / "listening-index.compat.js").write_text(
        "(function (global) { 'use strict'; global.__LISTENING_EXAM_INDEX__ = []; })(typeof window !== 'undefined' ? window : globalThis);\n",
        encoding="utf-8",
    )
    shutil.copy2(ROOT / "content" / "ielts_core.bundle.js", DEST / "assets" / "wordlists" / "ielts_core.bundle.js")
    subprocess.run(["node", "scripts/build-bundles.mjs"], cwd=DEST, check=True)
    ios = DEST / "ios"
    ios.mkdir(parents=True, exist_ok=True)
    for name in ("bank.js", "iphone-bridge.js", "iphone.css"):
        shutil.copy2(ROOT / "ios-src" / name, ios / name)
    for html in DEST.rglob("*.html"):
        html.write_text(inject(html.read_text(encoding="utf-8")), encoding="utf-8")
    assert_clean(DEST)
    print(f"web root ready: {DEST}")


if __name__ == "__main__":
    main()
