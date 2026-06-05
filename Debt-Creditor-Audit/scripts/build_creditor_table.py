#!/usr/bin/env python3
"""Build a redacted creditor table from redacted text files and candidate metadata."""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

COLUMNS = ["Priority","Creditor","Servicer","Debt Type","Balance","Minimum Payment","Due Date","Statement Date","Account Name","Masked Account Number","Full Account Number Found? yes/no","Payment Mailing Address","Check Payable To","Check Memo Line Required","Payment Coupon Required? yes/no/unknown","Phone Payment Number","Customer Service Number","Online Payment URL","Can Parent Pay By Phone?","Can Parent Mail Check?","Parent Needs This Info","Recommended Payment Method","Exact Parent Instructions","Source Document","Source Email Subject","Source Date","Verification Source","Verification Status","Confidence","Notes"]
CREDITOR_HINT_RE = re.compile(r"(?:creditor|lender|pay to(?: the order of)?|make checks payable to|statement from)[:\s]+([A-Z][A-Za-z0-9 &.,'-]{2,80})", re.I)
BALANCE_RE = re.compile(r"(?:new balance|current balance|statement balance|balance)\s*[:$ ]+(-?\$?\d[\d,]*(?:\.\d{2})?)", re.I)
MIN_RE = re.compile(r"(?:minimum payment(?: due)?|minimum due)\s*[:$ ]+(-?\$?\d[\d,]*(?:\.\d{2})?)", re.I)
DUE_RE = re.compile(r"(?:payment due date|due date|payment due)\s*[: ]+([A-Za-z]+ \d{1,2}, \d{4}|\d{1,2}/\d{1,2}/\d{2,4})", re.I)
STMT_RE = re.compile(r"(?:statement date|closing date)\s*[: ]+([A-Za-z]+ \d{1,2}, \d{4}|\d{1,2}/\d{1,2}/\d{2,4})", re.I)
MASK_RE = re.compile(r"(?:\*{2,}|ending in|account ending)\s*\d{4}", re.I)
PHONE_RE = re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b")
URL_RE = re.compile(r'https?://[^\s)>"\']+', re.I)


def first(pattern: re.Pattern[str], text: str) -> str:
    m = pattern.search(text)
    return m.group(1).strip() if m else ""


def infer_debt_type(text: str) -> str:
    lower = text.lower()
    for label, terms in [("Credit card", ["credit card", "card ending", "apr"]), ("Auto loan", ["auto loan", "vehicle"]), ("Personal loan", ["personal loan"]), ("Medical bill", ["medical", "patient"]), ("Collections", ["collection"]), ("Utility", ["utility", "electric", "water", "gas bill"]), ("Subscription", ["subscription"]), ("Credit union loan", ["credit union", "member number"]), ("Insurance", ["insurance", "premium"])]:
        if any(term in lower for term in terms):
            return label
    return "Other recurring payment"


def row_for_file(path: Path) -> dict[str, str] | None:
    text = path.read_text(errors="ignore")
    lower = text.lower()
    if not any(term in lower for term in ["payment due", "minimum payment", "statement balance", "new balance", "make checks payable", "account ending", "payoff"]):
        return None
    phones = PHONE_RE.findall(text)
    urls = URL_RE.findall(text)
    creditor = first(CREDITOR_HINT_RE, text) or path.stem[:80]
    masked = MASK_RE.search(text)
    confidence = "Medium" if first(BALANCE_RE, text) or first(DUE_RE, text) else "Low"
    notes = []
    if confidence == "Low":
        notes.append("Needs manual confirmation; limited fields extracted.")
    if "collection" in lower:
        notes.append("Collection/servicer row requires extra verification before payment.")
    return {
        "Priority": "Review",
        "Creditor": creditor,
        "Servicer": "",
        "Debt Type": infer_debt_type(text),
        "Balance": first(BALANCE_RE, text),
        "Minimum Payment": first(MIN_RE, text),
        "Due Date": first(DUE_RE, text),
        "Statement Date": first(STMT_RE, text),
        "Account Name": "Patrick Bolton (confirm from statement)",
        "Masked Account Number": masked.group(0) if masked else "[FULL ACCOUNT NUMBER REQUIRED — FILL MANUALLY FROM STATEMENT]",
        "Full Account Number Found? yes/no": "unknown; source was redacted before table build",
        "Payment Mailing Address": "",
        "Check Payable To": creditor,
        "Check Memo Line Required": "[FULL ACCOUNT NUMBER REQUIRED — use statement/payment coupon; do not expose in AI logs]",
        "Payment Coupon Required? yes/no/unknown": "unknown",
        "Phone Payment Number": phones[0] if phones else "",
        "Customer Service Number": phones[1] if len(phones) > 1 else (phones[0] if phones else ""),
        "Online Payment URL": urls[0] if urls else "",
        "Can Parent Pay By Phone?": "Unknown — parent may need account holder present or authorization",
        "Can Parent Mail Check?": "Likely if statement coupon/payee/address are verified",
        "Parent Needs This Info": "Full name, billing ZIP, masked account placeholder/full account from statement, payment amount, payment coupon if mailing",
        "Recommended Payment Method": "Needs manual confirmation",
        "Exact Parent Instructions": "Do not send payment until account number, payee, amount, and address/phone are confirmed from statement or official creditor website.",
        "Source Document": str(path),
        "Source Email Subject": "",
        "Source Date": "",
        "Verification Source": "Local redacted source text",
        "Verification Status": "Needs manual confirmation",
        "Confidence": confidence,
        "Notes": " ".join(notes),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create redacted creditor CSV from redacted text.")
    parser.add_argument("--input", required=True, help="Folder containing redacted text files")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    rows = []
    for path in Path(args.input).rglob("*"):
        if path.is_file() and path.suffix.lower() in {".txt", ".md", ".html"}:
            row = row_for_file(path)
            if row:
                rows.append(row)
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader(); writer.writerows(rows)
    print(f"Wrote {len(rows)} redacted creditor row(s) to {out}.")

if __name__ == "__main__":
    main()
