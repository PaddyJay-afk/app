#!/usr/bin/env python3
"""Redact sensitive financial data from local text files."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ACCOUNT_RE = re.compile(r"(?<!\d)(?:\d[ -]?){9,19}(?!\d)")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
ROUTING_RE = re.compile(r"\b(?:routing|aba)\s*(?:number|#|no\.)?\s*[:#-]?\s*\d{9}\b", re.I)
PASSWORD_RE = re.compile(r"\b(password|passcode|pin|otp|2fa|verification code)\b\s*[:=]?\s*\S+", re.I)
URL_TOKEN_RE = re.compile(r"([?&](?:token|code|state|session|auth|key)=)[^\s&]+", re.I)


def mask_digits(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) < 9:
        return value
    return "****" + digits[-4:]


def redact_text(text: str) -> tuple[str, dict[str, int]]:
    counts = {"account_like_numbers": 0, "ssn": 0, "routing": 0, "password_markers": 0, "url_tokens": 0}

    def acct_sub(match: re.Match[str]) -> str:
        counts["account_like_numbers"] += 1
        return mask_digits(match.group(0))

    text = SSN_RE.sub(lambda _m: counts.__setitem__("ssn", counts["ssn"] + 1) or "[REDACTED SSN]", text)
    text = ROUTING_RE.sub(lambda _m: counts.__setitem__("routing", counts["routing"] + 1) or "[REDACTED ROUTING NUMBER]", text)
    text = PASSWORD_RE.sub(lambda _m: counts.__setitem__("password_markers", counts["password_markers"] + 1) or "Password found in source — do not expose", text)
    text = URL_TOKEN_RE.sub(lambda m: counts.__setitem__("url_tokens", counts["url_tokens"] + 1) or m.group(1) + "[REDACTED]", text)
    text = ACCOUNT_RE.sub(acct_sub, text)
    return text, counts


def redact_path(src: Path, dest: Path) -> dict[str, int]:
    text = src.read_text(errors="ignore")
    redacted, counts = redact_text(text)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(redacted, encoding="utf-8")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Redact sensitive values from text files without printing secrets.")
    parser.add_argument("--in", dest="input_path", required=True, help="Input file or folder")
    parser.add_argument("--out", dest="output_path", required=True, help="Output file or folder")
    parser.add_argument("--summary", default=None, help="Optional redacted JSON summary path")
    args = parser.parse_args()

    src = Path(args.input_path)
    out = Path(args.output_path)
    totals: dict[str, int] = {}
    files = [src] if src.is_file() else [p for p in src.rglob("*") if p.is_file() and p.suffix.lower() in {".txt", ".md", ".html", ".json"}]
    for file in files:
        target = out / file.relative_to(src) if src.is_dir() else out
        counts = redact_path(file, target)
        for key, value in counts.items():
            totals[key] = totals.get(key, 0) + value
    if args.summary:
        Path(args.summary).write_text(json.dumps({"files_redacted": len(files), "findings": totals}, indent=2), encoding="utf-8")
    print(f"Redacted {len(files)} file(s). Sensitive values were masked; full values were not printed.")


if __name__ == "__main__":
    main()
