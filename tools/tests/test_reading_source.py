import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reading_source import SourceRejected, extract_registered_object
from convert_private_bank import convert


VALID = """
(function registerReadingExamData(global) {
  global.__READING_EXAM_DATA__.register("sample-harbor", {"examId":"sample-harbor","passage":{"blocks":[]},"answerKey":{"q1":"shed"},"questionOrder":["q1"]});
})(globalThis);
"""


class ParserTests(unittest.TestCase):
    def test_extracts_json_without_eval(self):
        exam_id, payload = extract_registered_object(VALID)
        self.assertEqual(exam_id, "sample-harbor")
        self.assertEqual(payload["answerKey"]["q1"], "shed")

    def test_rejects_eval_and_non_json(self):
        with self.assertRaises(SourceRejected):
            extract_registered_object('global.__READING_EXAM_DATA__.register("x", {eval:"no"})')
        with self.assertRaises(SourceRejected):
            extract_registered_object('register("x", not-json)')

    def test_zip_roundtrip_and_slip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            exams = root / "assets" / "generated" / "reading-exams"
            notes = root / "assets" / "generated" / "reading-explanations"
            exams.mkdir(parents=True)
            notes.mkdir(parents=True)
            (exams / "sample-harbor.js").write_text(VALID, encoding="utf-8")
            (notes / "sample-harbor.js").write_text(
                'global.__READING_EXPLANATION_DATA__.register("sample-harbor", {"examId":"sample-harbor","passageNotes":[]});',
                encoding="utf-8",
            )
            output = root / "out.zip"
            report = convert(root, output)
            self.assertEqual(report["counts"]["exams"], 1)
            self.assertEqual(report["counts"]["explanations"], 1)
            with zipfile.ZipFile(output) as archive:
                self.assertIn("exams/sample-harbor.json", archive.namelist())


class MissingExplanationTests(unittest.TestCase):
    def test_missing_note_is_counted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            exams = root / "assets" / "generated" / "reading-exams"
            exams.mkdir(parents=True)
            (exams / "sample-orchard.js").write_text(
                'global.__READING_EXAM_DATA__.register("sample-orchard", {"examId":"sample-orchard","passage":{},"answerKey":{"q1":"A"},"questionOrder":["q1"]});',
                encoding="utf-8",
            )
            report = convert(root, root / "out.zip")
            self.assertEqual(report["counts"]["missingExplanations"], 1)
            self.assertEqual(report["missingExplanationIds"], ["sample-orchard"])
            with zipfile.ZipFile(root / "out.zip") as archive:
                stored = json.loads(archive.read("exams/sample-orchard.json"))
            self.assertEqual(stored["answerKey"]["q1"], "A")


if __name__ == "__main__":
    unittest.main()
