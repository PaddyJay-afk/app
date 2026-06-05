#!/usr/bin/env python3
"""Merge manually verified official payment details into the redacted creditor CSV.

This script does not scrape or guess payment details. Create a CSV with official details
confirmed from a statement or official creditor website, then merge by Creditor name.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import pandas as pd

MERGE_COLUMNS = [
    "Creditor", "Payment Mailing Address", "Check Payable To", "Phone Payment Number",
    "Customer Service Number", "Online Payment URL", "Verification Source", "Verification Status",
    "Can Parent Pay By Phone?", "Can Parent Mail Check?", "Recommended Payment Method", "Notes",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge official, manually verified creditor payment instructions.")
    parser.add_argument("--creditors", required=True, help="Existing redacted creditor CSV")
    parser.add_argument("--verified", required=True, help="Manual official-verification CSV")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    creditors = pd.read_csv(args.creditors).fillna("")
    verified = pd.read_csv(args.verified).fillna("")
    missing = [c for c in ["Creditor"] if c not in verified]
    if missing:
        raise SystemExit(f"Verified CSV missing columns: {missing}")
    for _, official in verified.iterrows():
        mask = creditors["Creditor"].astype(str).str.lower() == str(official["Creditor"]).lower()
        for col in MERGE_COLUMNS:
            if col in creditors.columns and col in verified.columns and str(official.get(col, "")).strip():
                creditors.loc[mask, col] = official[col]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    creditors.to_csv(args.out, index=False)
    print(f"Merged manually verified official details into {args.out}. No web scraping was performed.")

if __name__ == "__main__":
    main()
