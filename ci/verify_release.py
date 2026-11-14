#!/usr/bin/env python3
"""Verify built iOS .xcarchive and .ipa bundle metadata, web assets, and signing."""

from __future__ import annotations

import argparse
import os
import plistlib
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

EXPECTED_BUNDLE_ID = "com.rookiei1.ieltspractice"
EXPECTED_TEAM_ID = "NGV55K28X8"
EXPECTED_DISPLAY_NAME = "雅思练习"
FORBIDDEN_TEXTS = ("ZYZ", "Salloway", "#license-modal")
REQUIRED_WEB_FILES = (
    Path("public/index.html"),
    Path("public/ios/bank.js"),
    Path("public/ios/iphone-bridge.js"),
    Path("public/ios/iphone.css"),
)


def parse_plist_bytes(raw: bytes) -> dict:
    return plistlib.loads(raw)


def verify_info_plist(
    info: dict,
    expected_bundle_id: str = EXPECTED_BUNDLE_ID,
    expected_display_name: str = EXPECTED_DISPLAY_NAME,
    expected_version: str | None = None,
    expected_build: str | None = None,
) -> None:
    bundle_id = info.get("CFBundleIdentifier")
    if bundle_id != expected_bundle_id:
        raise ValueError(f"CFBundleIdentifier {bundle_id!r} != {expected_bundle_id!r}")

    display_name = info.get("CFBundleDisplayName") or info.get("CFBundleName")
    if display_name != expected_display_name:
        raise ValueError(f"Display name {display_name!r} != {expected_display_name!r}")

    families = info.get("UIDeviceFamily") or []
    if 1 not in families:
        raise ValueError(f"UIDeviceFamily {families!r} does not target iPhone (1)")

    short_version = str(info.get("CFBundleShortVersionString", ""))
    build_version = str(info.get("CFBundleVersion", ""))
    if not short_version or not build_version:
        raise ValueError("Missing CFBundleShortVersionString or CFBundleVersion")
    if expected_version and short_version != expected_version:
        raise ValueError(f"CFBundleShortVersionString {short_version!r} != {expected_version!r}")
    if expected_build and build_version != str(expected_build):
        raise ValueError(f"CFBundleVersion {build_version!r} != {expected_build!r}")


def verify_entitlements(
    entitlements: dict,
    expected_bundle_id: str = EXPECTED_BUNDLE_ID,
    expected_team: str = EXPECTED_TEAM_ID,
) -> None:
    expected_app_id = f"{expected_team}.{expected_bundle_id}"
    app_id = entitlements.get("application-identifier")
    team_id = entitlements.get("com.apple.developer.team-identifier")
    if app_id != expected_app_id:
        raise ValueError(f"application-identifier {app_id!r} != {expected_app_id!r}")
    if team_id != expected_team:
        raise ValueError(f"team-identifier {team_id!r} != {expected_team!r}")
    if entitlements.get("get-task-allow") is True:
        raise ValueError("Release entitlements must not enable get-task-allow")


def verify_web_assets(app_dir: Path) -> None:
    for rel in REQUIRED_WEB_FILES:
        target = app_dir / rel
        if not target.is_file() or target.stat().st_size == 0:
            raise ValueError(f"Missing or empty web asset inside app bundle: {target}")
    index_html = (app_dir / "public/index.html").read_text(encoding="utf-8", errors="replace")
    for token in FORBIDDEN_TEXTS:
        if token in index_html:
            raise ValueError(f"Forbidden upstream text {token!r} found in packaged public/index.html")


def extract_xml_plist(output: bytes) -> dict:
    start = output.find(b"<?xml")
    if start < 0:
        start = output.find(b"<plist")
    if start < 0:
        raise ValueError("Output did not contain XML plist data")
    return parse_plist_bytes(output[start:])


def run_checked(cmd: list[str]) -> bytes:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(
            f"Command {' '.join(cmd)} failed ({proc.returncode}): "
            f"{proc.stderr.decode('utf-8', errors='replace')}"
        )
    return proc.stdout


def verify_app_bundle(
    app_dir: Path,
    expected_version: str | None = None,
    expected_build: str | None = None,
) -> None:
    info_path = app_dir / "Info.plist"
    if not info_path.is_file():
        raise ValueError(f"Missing Info.plist in {app_dir}")
    info = parse_plist_bytes(info_path.read_bytes())
    verify_info_plist(
        info,
        expected_version=expected_version,
        expected_build=expected_build,
    )
    verify_web_assets(app_dir)

    profile_path = app_dir / "embedded.mobileprovision"
    if not profile_path.is_file():
        raise ValueError(f"Missing embedded.mobileprovision in {app_dir}")

    run_checked(["codesign", "-vv", "--deep", "--strict", str(app_dir)])
    ent_raw = run_checked(["codesign", "-d", "--entitlements", "-", "--xml", str(app_dir)])
    entitlements = extract_xml_plist(ent_raw)
    verify_entitlements(entitlements)


def find_single_app(parent: Path) -> Path:
    apps = sorted(parent.glob("*.app"))
    if len(apps) != 1:
        raise ValueError(f"Expected 1 .app in {parent}, found {apps}")
    return apps[0]


def verify_archive_and_ipa(
    archive_path: Path,
    ipa_path: Path,
    expected_version: str | None = None,
    expected_build: str | None = None,
) -> None:
    archive_app = find_single_app(archive_path / "Products" / "Applications")
    verify_app_bundle(archive_app, expected_version=expected_version, expected_build=expected_build)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        with zipfile.ZipFile(ipa_path, "r") as zf:
            zf.extractall(tmp_dir)
        ipa_app = find_single_app(tmp_dir / "Payload")
        verify_app_bundle(ipa_app, expected_version=expected_version, expected_build=expected_build)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify iOS archive and IPA for IELTS Practice.")
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--ipa", required=True, type=Path)
    parser.add_argument("--version", default=None)
    parser.add_argument("--build", default=None)
    args = parser.parse_args()

    verify_archive_and_ipa(
        args.archive,
        args.ipa,
        expected_version=args.version,
        expected_build=args.build,
    )
    print(f"Verified archive ({args.archive}) and IPA ({args.ipa}) OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
