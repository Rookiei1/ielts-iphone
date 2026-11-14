#!/usr/bin/env python3
"""Write App Store Connect API key JSON and .p8 file into RUNNER_TEMP safely."""

from __future__ import annotations

import base64
import binascii
import json
import os
import stat
from pathlib import Path


def normalize_private_key(raw: str) -> str:
    text = raw.strip().replace("\\n", "\n")
    if "BEGIN PRIVATE KEY" in text:
        return text if text.endswith("\n") else text + "\n"
    try:
        decoded = base64.b64decode(text, validate=True).decode("utf-8").strip()
    except (binascii.Error, UnicodeDecodeError) as exc:
        raise ValueError("ASC_PRIVATE_KEY is neither a PEM key nor valid base64 PEM") from exc
    if "BEGIN PRIVATE KEY" not in decoded:
        raise ValueError("Decoded ASC_PRIVATE_KEY does not look like a PEM private key")
    return decoded if decoded.endswith("\n") else decoded + "\n"


def write_secret_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    try:
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass


def build_key_json(key_id: str, issuer_id: str, key_pem: str) -> str:
    payload = {
        "key_id": key_id.strip(),
        "issuer_id": issuer_id.strip(),
        "key": key_pem,
        "in_house": False,
    }
    return json.dumps(payload, indent=2) + "\n"


def main() -> int:
    key_id = os.environ.get("ASC_KEY_ID", "").strip()
    issuer_id = os.environ.get("ASC_ISSUER_ID", "").strip()
    raw_key = os.environ.get("ASC_PRIVATE_KEY", "")
    if not key_id or not issuer_id or not raw_key.strip():
        raise SystemExit("Missing one of ASC_KEY_ID, ASC_ISSUER_ID, or ASC_PRIVATE_KEY")

    temp_dir = Path(os.environ.get("RUNNER_TEMP", "/tmp"))
    pem = normalize_private_key(raw_key)

    p8_path = temp_dir / f"AuthKey_{key_id}.p8"
    json_path = temp_dir / "asc_api_key.json"
    write_secret_file(p8_path, pem)
    write_secret_file(json_path, build_key_json(key_id, issuer_id, pem))

    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        with open(github_env, "a", encoding="utf-8") as fh:
            fh.write(f"ASC_KEY_FILEPATH={json_path}\n")
            fh.write(f"ASC_P8_PATH={p8_path}\n")
    print(f"Prepared App Store Connect API key metadata at {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
