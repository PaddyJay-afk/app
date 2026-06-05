#!/usr/bin/env python3
"""Create the secure local folder structure and protective .gitignore."""
from pathlib import Path

DIRS = ["raw_sources", "attachments", "parsed_text", "redacted_working", "output", "scripts", "logs"]
GITIGNORE = """# Raw/private financial data - never commit
.env
*.env
raw_sources/**
attachments/**
parsed_text/**
output/**
logs/**
!raw_sources/.gitkeep
!attachments/.gitkeep
!parsed_text/.gitkeep
!output/.gitkeep
!logs/.gitkeep
!redacted_working/.gitkeep
credentials*.json
token*.json
*.sqlite
*.db
*.key
*.pem
*.p12
*.pfx
cookies*.txt
*.pdf
*.png
*.jpg
*.jpeg
*.heic
*.tiff
*.mbox
*.eml
*.msg
*.pst
*.ost
*.xlsx
*.xls
*.csv
*.docx
*.zip
*.7z
*.rar
__pycache__/
*.py[cod]
.venv/
venv/
.pytest_cache/
"""

def main() -> None:
    root = Path(__file__).resolve().parents[1]
    for name in DIRS:
        path = root / name
        path.mkdir(parents=True, exist_ok=True)
        (path / ".gitkeep").touch(exist_ok=True)
    gi = root / ".gitignore"
    if not gi.exists() or "raw_sources/**" not in gi.read_text(errors="ignore"):
        gi.write_text(GITIGNORE, encoding="utf-8")
    print(f"Secure project folders are ready at {root}. Raw and output folders are gitignored.")

if __name__ == "__main__":
    main()
