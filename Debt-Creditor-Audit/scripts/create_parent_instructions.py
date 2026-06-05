#!/usr/bin/env python3
"""Create parent-friendly redacted payment instructions from creditor CSV."""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

FIELDS = [
    ("Creditor", "Creditor"), ("Balance", "Balance"), ("Minimum payment", "Minimum Payment"),
    ("Due date", "Due Date"), ("Best payment method", "Recommended Payment Method"),
    ("Phone number", "Phone Payment Number"), ("Mailing address", "Payment Mailing Address"),
    ("Check payable to", "Check Payable To"), ("Memo line", "Check Memo Line Required"),
    ("Information parents need", "Parent Needs This Info"),
    ("Whether Patrick needs to be present on the call", "Can Parent Pay By Phone?"),
    ("Warnings", "Notes"), ("Source confidence", "Confidence"),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Create redacted parent payment instructions in Markdown.")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    with Path(args.csv).open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    lines = ["# Parent Payment Instructions — REDACTED", "", "Use only official creditor phone numbers or addresses from statements or verified official websites. Do not send payment until account number, payee, and amount are confirmed.", ""]
    for row in rows:
        lines.append(f"## {row.get('Creditor') or 'Unknown creditor'}")
        lines.append("")
        for label, key in FIELDS:
            value = row.get(key) or "Needs manual confirmation"
            lines.append(f"- **{label}:** {value}")
        lines.extend([
            "- **Default safety warning:** Use the payment coupon if mailing a check. Confirm no fee applies before paying by phone. Parent may need account holder present for phone payment.",
            "",
        ])
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Created redacted parent instruction document at {out}.")

if __name__ == "__main__":
    main()
