#!/usr/bin/env python3
"""Extract text locally from PDFs, images, and text-like files into parsed_text/."""
from __future__ import annotations

import argparse
from pathlib import Path

TEXT_SUFFIXES = {".txt", ".md", ".html", ".csv"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}


def pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return "[pypdf not installed; install locally with: pip install pypdf]"
    try:
        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        return f"[PDF text extraction failed locally: {type(exc).__name__}]"


def image_text(path: Path) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return "[Local OCR dependencies not installed; install Pillow/pytesseract and Tesseract if OCR is needed]"
    try:
        return pytesseract.image_to_string(Image.open(path))
    except Exception as exc:
        return f"[Local OCR failed: {type(exc).__name__}]"


def extract(path: Path) -> str | None:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return pdf_text(path)
    if suffix in IMAGE_SUFFIXES:
        return image_text(path)
    if suffix in TEXT_SUFFIXES:
        return path.read_text(errors="ignore")
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Local-only statement text extraction. Does not upload files.")
    parser.add_argument("--roots", nargs="+", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out_root = Path(args.out); out_root.mkdir(parents=True, exist_ok=True)
    count = 0
    for root_arg in args.roots:
        root = Path(root_arg)
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            text = extract(path)
            if text is None:
                continue
            rel = path.relative_to(root)
            dest = out_root / root.name / rel.with_suffix(rel.suffix + ".txt")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text, encoding="utf-8", errors="ignore")
            count += 1
    print(f"Extracted local text for {count} file(s) into {out_root}. Run redact_sensitive.py before inspecting content.")

if __name__ == "__main__":
    main()
