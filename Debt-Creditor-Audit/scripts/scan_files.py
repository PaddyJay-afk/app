#!/usr/bin/env python3
"""Scan local filenames and safe text snippets for creditor candidates."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

KEYWORDS = [
    "statement", "bill", "invoice", "account", "payment", "credit", "card", "loan", "payoff", "balance",
    "bank", "union", "servicer", "collections", "minimum payment", "payment due", "autopay", "past due",
    "credit card statement", "loan payment", "electronic statement", "estatement", "billing statement",
]
TEXT_SUFFIXES = {".txt", ".md", ".html", ".csv", ".json"}
DOC_SUFFIXES = TEXT_SUFFIXES | {".pdf", ".png", ".jpg", ".jpeg", ".heic", ".tif", ".tiff", ".eml", ".mbox"}
ACCOUNT_RE = re.compile(r"(?<!\d)(?:\d[ -]?){9,19}(?!\d)")


def safe_snippet(text: str, term: str, width: int = 80) -> str:
    idx = text.lower().find(term.lower())
    if idx < 0:
        return ""
    snippet = text[max(0, idx - width): idx + len(term) + width]
    return ACCOUNT_RE.sub(lambda m: "****" + re.sub(r"\D", "", m.group(0))[-4:], snippet).replace("\n", " ")


def inspect_file(path: Path) -> dict | None:
    lower_name = path.name.lower()
    hits = sorted({kw for kw in KEYWORDS if kw in lower_name})
    snippets = []
    if path.suffix.lower() in TEXT_SUFFIXES:
        text = path.read_text(errors="ignore")[:250_000]
        for kw in KEYWORDS:
            if kw in text.lower():
                hits.append(kw)
                if len(snippets) < 3:
                    snippets.append(safe_snippet(text, kw))
    if not hits:
        return None
    stat = path.stat()
    return {
        "path": str(path),
        "suffix": path.suffix.lower(),
        "modified_utc": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "size_bytes": stat.st_size,
        "keyword_hits": sorted(set(hits)),
        "redacted_snippets": snippets,
        "review_question": "Review this source for creditor/payment details; confirm it belongs to Patrick Bolton before processing." ,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Find candidate local creditor files without printing sensitive content.")
    parser.add_argument("--roots", nargs="+", required=True, help="Folders to scan")
    parser.add_argument("--out", required=True, help="Redacted JSON output path")
    args = parser.parse_args()
    findings = []
    for root_arg in args.roots:
        root = Path(root_arg)
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in DOC_SUFFIXES:
                item = inspect_file(path)
                if item:
                    findings.append(item)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(findings, indent=2), encoding="utf-8")
    print(f"Wrote {len(findings)} redacted candidate record(s) to {out}.")

if __name__ == "__main__":
    main()
