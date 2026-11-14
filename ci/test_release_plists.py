#!/usr/bin/env python3
"""Offline unit tests for CI key preparation and release plist/asset verification."""

from __future__ import annotations

import base64
import json
import plistlib
import tempfile
import unittest
from pathlib import Path
import sys

CI_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CI_DIR.parent
sys.path.insert(0, str(CI_DIR))

import prepare_apple_key  # noqa: E402
import verify_release  # noqa: E402


class PrepareAppleKeyTests(unittest.TestCase):
    def test_accepts_literal_escaped_and_base64_pem(self) -> None:
        sample_pem = "-----BEGIN PRIVATE KEY-----\nABC123\n-----END PRIVATE KEY-----"
        self.assertEqual(
            prepare_apple_key.normalize_private_key(sample_pem),
            sample_pem + "\n",
        )
        escaped = sample_pem.replace("\n", "\\n")
        self.assertEqual(
            prepare_apple_key.normalize_private_key(escaped),
            sample_pem + "\n",
        )
        encoded = base64.b64encode(sample_pem.encode("utf-8")).decode("ascii")
        self.assertEqual(
            prepare_apple_key.normalize_private_key(encoded),
            sample_pem + "\n",
        )

    def test_build_key_json_contains_expected_fields(self) -> None:
        raw = prepare_apple_key.build_key_json("KEY123", "ISSUER456", "-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n")
        data = json.loads(raw)
        self.assertEqual(data["key_id"], "KEY123")
        self.assertEqual(data["issuer_id"], "ISSUER456")
        self.assertFalse(data["in_house"])


class VerifyReleaseTests(unittest.TestCase):
    def test_verify_info_plist_accepts_valid_metadata(self) -> None:
        info = {
            "CFBundleIdentifier": "com.rookiei1.ieltspractice",
            "CFBundleDisplayName": "雅思练习",
            "UIDeviceFamily": [1],
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42",
        }
        verify_release.verify_info_plist(info, expected_version="1.0.0", expected_build="42")

    def test_verify_info_plist_rejects_wrong_bundle_or_family(self) -> None:
        with self.assertRaises(ValueError):
            verify_release.verify_info_plist(
                {
                    "CFBundleIdentifier": "com.example.wrong",
                    "CFBundleDisplayName": "雅思练习",
                    "UIDeviceFamily": [1],
                    "CFBundleShortVersionString": "1.0.0",
                    "CFBundleVersion": "1",
                }
            )
        with self.assertRaises(ValueError):
            verify_release.verify_info_plist(
                {
                    "CFBundleIdentifier": "com.rookiei1.ieltspractice",
                    "CFBundleDisplayName": "雅思练习",
                    "UIDeviceFamily": [2],
                    "CFBundleShortVersionString": "1.0.0",
                    "CFBundleVersion": "1",
                }
            )

    def test_verify_entitlements_rejects_debug_get_task_allow(self) -> None:
        verify_release.verify_entitlements(
            {
                "application-identifier": "NGV55K28X8.com.rookiei1.ieltspractice",
                "com.apple.developer.team-identifier": "NGV55K28X8",
                "get-task-allow": False,
            }
        )
        with self.assertRaises(ValueError):
            verify_release.verify_entitlements(
                {
                    "application-identifier": "NGV55K28X8.com.rookiei1.ieltspractice",
                    "com.apple.developer.team-identifier": "NGV55K28X8",
                    "get-task-allow": True,
                }
            )

    def test_verify_web_assets_checks_required_files_and_branding(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            app_dir = Path(tmp) / "App.app"
            for rel in verify_release.REQUIRED_WEB_FILES:
                target = app_dir / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("<html><title>雅思练习</title></html>", encoding="utf-8")
            verify_release.verify_web_assets(app_dir)

            (app_dir / "public/index.html").write_text("ZYZ author", encoding="utf-8")
            with self.assertRaises(ValueError):
                verify_release.verify_web_assets(app_dir)

    def test_project_config_matches_expected_release_identity(self) -> None:
        cap_cfg = json.loads((PROJECT_ROOT / "capacitor.config.json").read_text(encoding="utf-8"))
        self.assertEqual(cap_cfg["appId"], verify_release.EXPECTED_BUNDLE_ID)
        self.assertEqual(cap_cfg["appName"], verify_release.EXPECTED_DISPLAY_NAME)

        info_plist = plistlib.loads((PROJECT_ROOT / "ios/App/App/Info.plist").read_bytes())
        self.assertEqual(info_plist["CFBundleDisplayName"], verify_release.EXPECTED_DISPLAY_NAME)

        pbxproj = (PROJECT_ROOT / "ios/App/App.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
        self.assertIn(f"PRODUCT_BUNDLE_IDENTIFIER = {verify_release.EXPECTED_BUNDLE_ID};", pbxproj)
        self.assertIn(f"IELTS_TEAM = {verify_release.EXPECTED_TEAM_ID};", pbxproj)
        self.assertIn('IELTS_CODE_SIGN_STYLE = Automatic;', pbxproj)


if __name__ == "__main__":
    unittest.main(verbosity=2)
