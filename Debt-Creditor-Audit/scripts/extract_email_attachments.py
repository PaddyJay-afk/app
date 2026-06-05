#!/usr/bin/env python3
"""Extract matching attachments from local .eml/.mbox exports; no live email login."""
from __future__ import annotations

import argparse
import email
import json
import mailbox
import re
import shutil
from datetime import datetime, timedelta, timezone
from email.message import Message
from email.utils import parsedate_to_datetime
from pathlib import Path

ATTACHMENT_TERMS = ["statement", "bill", "invoice", "account", "payment", "credit", "card", "loan", "payoff", "balance", "pdf", "screenshot", "bank", "union", "servicer", "collections"]
SUBJECT_TERMS = ATTACHMENT_TERMS + ["debt", "creditor", "minimum payment", "autopay", "past due", "due date"]
ACCOUNT_RE = re.compile(r"(?<!\d)(?:\d[ -]?){9,19}(?!\d)")


def mask(text: str | None) -> str:
    if not text:
        return ""
    return ACCOUNT_RE.sub(lambda m: "****" + re.sub(r"\D", "", m.group(0))[-4:], text)


def msg_date(msg: Message) -> datetime | None:
    try:
        dt = parsedate_to_datetime(msg.get("date"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def iter_messages(source: Path):
    if source.is_file() and source.suffix.lower() == ".eml":
        yield email.message_from_bytes(source.read_bytes()), source
    elif source.is_file() and source.suffix.lower() == ".mbox":
        for msg in mailbox.mbox(source):
            yield msg, source
    elif source.is_dir():
        for path in source.rglob("*"):
            if path.suffix.lower() in {".eml", ".mbox"}:
                yield from iter_messages(path)


def filename_matches(name: str) -> bool:
    lower = name.lower()
    return any(term in lower for term in ATTACHMENT_TERMS)


def subject_matches(subject: str) -> bool:
    lower = subject.lower()
    return any(term in lower for term in SUBJECT_TERMS)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract statement-like attachments from exported email files.")
    parser.add_argument("--source", required=True, help="Folder/file containing .eml or .mbox exports")
    parser.add_argument("--out", default="attachments", help="Attachment output folder")
    parser.add_argument("--metadata", default="redacted_working/email_attachment_metadata.json", help="Redacted metadata JSON")
    parser.add_argument("--to", default="Tom Bolton", help="Recipient display/name/email filter")
    parser.add_argument("--days", type=int, default=14, help="Only include messages newer than this many days when dates are available")
    args = parser.parse_args()

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    records = []
    for msg, source_file in iter_messages(Path(args.source)):
        to_header = msg.get("to", "")
        subject = msg.get("subject", "")
        dt = msg_date(msg)
        if args.to.lower() not in to_header.lower():
            continue
        if dt and dt < cutoff:
            continue
        if not subject_matches(subject):
            # still allow statement-like attachment names below
            pass
        for part in msg.walk():
            filename = part.get_filename()
            if not filename or not filename_matches(filename):
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
            dest = out / f"{len(records)+1:04d}_{safe_name}"
            dest.write_bytes(payload)
            records.append({
                "saved_attachment": str(dest),
                "source_export": str(source_file),
                "source_email_subject": mask(subject),
                "source_date": dt.isoformat() if dt else "unknown",
                "to_header_redacted": mask(to_header),
                "matched_filename": mask(filename),
                "review_question": "Confirm this attachment belongs to Patrick Bolton and is safe to parse.",
            })
    Path(args.metadata).parent.mkdir(parents=True, exist_ok=True)
    Path(args.metadata).write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Extracted {len(records)} matching attachment(s). Metadata is redacted; full account values were not printed.")

if __name__ == "__main__":
    main()
