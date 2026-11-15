"""Turn the local reading bank into a JSON zip. Never executes the source files."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reading_source import SourceRejected, extract_registered_object

EXAM_DIR = Path("assets/generated/reading-exams")
NOTE_DIR = Path("assets/generated/reading-explanations")
AUTHOR_FOOTER = re.compile(
    r"<p\b[^>]*>\s*Compiled,\s*formatted,\s*and\s*lightly\s*proofread\s+by\s+ZYZ\s+Reading\s+Walks\.[\s\S]*?</p>",
    re.IGNORECASE,
)


def clean_display_html(value):
    """Remove the promotional footer from rendered HTML; retain source/audit metadata."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower().endswith("html") and isinstance(item, str):
                value[key] = AUTHOR_FOOTER.sub("", item)
            else:
                clean_display_html(item)
    elif isinstance(value, list):
        for item in value:
            clean_display_html(item)


def convert(source: Path, output: Path) -> dict:
    exams_root = source / EXAM_DIR
    notes_root = source / NOTE_DIR
    if not exams_root.is_dir():
        raise SystemExit(f"reading exams not found: {exams_root}")
    exams = {}
    failures = []
    for path in sorted(exams_root.glob("*.js")):
        if path.name == "manifest.js":
            continue
        try:
            exam_id, payload = extract_registered_object(path.read_text(encoding="utf-8"))
            if "passage" not in payload or "answerKey" not in payload:
                raise SourceRejected("missing passage or answerKey")
            clean_display_html(payload)
            exams[exam_id] = payload
        except SourceRejected as error:
            failures.append({"file": path.name, "reason": str(error)})
    notes = {}
    note_failures = []
    if notes_root.is_dir():
        for path in sorted(notes_root.glob("*.js")):
            if path.name == "manifest.js":
                continue
            try:
                exam_id, payload = extract_registered_object(path.read_text(encoding="utf-8"))
                clean_display_html(payload)
                notes[exam_id] = payload
            except SourceRejected as error:
                note_failures.append({"file": path.name, "reason": str(error)})
    missing = sorted(set(exams) - set(notes))
    catalog = []
    for exam_id, payload in exams.items():
        meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
        catalog.append({
            "id": exam_id,
            "title": str(meta.get("title") or exam_id),
            "category": str(meta.get("category") or ""),
            "frequency": str(meta.get("frequency") or ""),
            "hasExplanation": exam_id in notes,
        })
    bank = {
        "format": "ielts-iphone-bank-v1",
        "counts": {
            "exams": len(exams),
            "explanations": len(notes),
            "missingExplanations": len(missing),
            "examFailures": len(failures),
            "explanationFailures": len(note_failures),
        },
        "missingExplanationIds": missing,
        "failures": failures + note_failures,
    }
    blob = json.dumps({"exams": exams, "notes": notes}, ensure_ascii=False, sort_keys=True).encode("utf-8")
    bank["checksum"] = hashlib.sha256(blob).hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("bank.json", json.dumps({k: v for k, v in bank.items() if k != "failures"}, ensure_ascii=False))
        for exam_id, payload in exams.items():
            archive.writestr(f"exams/{exam_id}.json", json.dumps(payload, ensure_ascii=False))
        for exam_id, payload in notes.items():
            archive.writestr(f"explanations/{exam_id}.json", json.dumps(payload, ensure_ascii=False))
    report = dict(bank)
    report["output"] = str(output)
    return report


def main():
    parser = argparse.ArgumentParser(description="Pack the local reading bank into private-data.")
    parser.add_argument("--source", type=Path, default=Path(r"C:\Users\86195\Desktop\app respo\IELTS\程序文件"))
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "private-data" / "reading-bank.zip")
    args = parser.parse_args()
    report = convert(args.source, args.output)
    counts = report["counts"]
    print(
        f"exams_ok={counts['exams']} exams_failed={counts['examFailures']} "
        f"explanations_ok={counts['explanations']} explanations_missing={counts['missingExplanations']} "
        f"explanations_failed={counts['explanationFailures']}"
    )
    if report["failures"]:
        for item in report["failures"][:20]:
            print(f"failed {item['file']}: {item['reason']}")
    if report["missingExplanationIds"]:
        print("missing_explanation_ids=" + ",".join(report["missingExplanationIds"][:30]))
    report_path = args.output.with_suffix(".report.json")
    public = {k: report[k] for k in ("counts", "missingExplanationIds", "checksum", "failures")}
    report_path.write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
