# Debt Creditor Audit — Secure Local Workflow

This folder is a local-only workflow for finding creditor, lender, utility, medical, collection, subscription, and recurring payment obligations from email exports and local files.

## Security rules

- Keep raw statements, screenshots, exports, credentials, and generated private spreadsheets out of Git.
- The project `.gitignore` excludes `raw_sources/`, `attachments/`, `parsed_text/`, `output/`, `logs/`, `.env`, document exports, databases, tokens, and credentials.
- Scripts mask likely account numbers by default and should not print full account numbers.
- Do not upload statements or financial documents to third-party services.
- iPhone Notes are only supported when you manually provide a safe export (`.txt`, `.pdf`, `.csv`, `.html`, or copied note folder).
- If a full account number is needed for payment, fill it manually from the original statement or use a separate encrypted local file that is never committed.

## Folder layout

- `raw_sources/` — place local email exports, PDFs, screenshots, note exports, and statements here. Gitignored.
- `attachments/` — extracted email attachments. Gitignored.
- `parsed_text/` — local OCR/text extraction output. Gitignored.
- `redacted_working/` — redacted intermediate JSON/CSV/TXT files that are safer to inspect.
- `output/` — final redacted Excel/CSV/parent documents. Gitignored by default because financial summaries can still be private.
- `scripts/` — deterministic local Python scripts.
- `logs/` — redacted logs only. Gitignored.

## Recommended first run on Windows

Open PowerShell, then adapt this location to your laptop:

```powershell
cd C:\Users\<me>\Debt-Creditor-Audit
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install pandas openpyxl python-docx pypdf pillow
```

Optional local OCR requires installing Tesseract separately, then `pip install pytesseract`.

## Safe email workflow

Live Gmail, Outlook, Microsoft Graph, or Apple Mail access requires explicit authorization. Without that authorization, export locally first:

1. Export recent sent mail to Tom Bolton from the last 7–14 days as `.eml` files or an `.mbox` archive.
2. Put the export in `raw_sources/email_exports/`.
3. Run `extract_email_attachments.py` to copy matching attachments into `attachments/` and create redacted metadata.
4. Expand to older sent mail and incoming creditor mail only after reviewing the first pass.

Suggested searches in your mail app before export:

- `to:(Tom Bolton) newer_than:14d (statement OR debt OR creditor OR payoff OR balance OR account OR bill OR payment OR loan OR "credit card" OR "credit union" OR "due date" OR "minimum payment" OR autopay OR ACH OR "past due" OR collection)`
- Attachment filename terms: `statement`, `bill`, `invoice`, `account`, `payment`, `credit`, `card`, `loan`, `payoff`, `balance`, `pdf`, `screenshot`, `bank`, `union`, `servicer`, `collections`.

## Pipeline

Run from the project folder:

```powershell
python scripts/setup_project.py
python scripts/extract_email_attachments.py --source raw_sources\email_exports --days 14 --to "Tom Bolton"
python scripts/scan_files.py --roots raw_sources attachments --out redacted_working\file_candidates.json
python scripts/parse_statements_local.py --roots raw_sources attachments --out parsed_text
python scripts/redact_sensitive.py --in parsed_text --out redacted_working\redacted_text
python scripts/build_creditor_table.py --input redacted_working --out redacted_working\creditors_redacted.csv
python scripts/create_excel_output.py --csv redacted_working\creditors_redacted.csv --out output\Debt_Creditor_Master_REDACTED.xlsx
python scripts/create_parent_instructions.py --csv redacted_working\creditors_redacted.csv --out output\Parent_Payment_Instructions_REDACTED.md
```

`verify_official_payment_info.py` is intentionally manual-first: add official creditor URLs and verified payment details to a local CSV only after checking official creditor pages or the statement itself.

## Manual review queue

Any row is marked for manual review when payment address, payee line, phone number, due date, creditor confidence, collection/servicer status, or parent-payment authorization is unclear. Do not send money until the row is verified from the statement or an official creditor website.

## Files safe to share

Only share redacted outputs after reviewing them manually. Never email or upload `raw_sources/`, `attachments/`, `parsed_text/`, `.env`, credentials, browser exports, local databases, or unredacted spreadsheets.
