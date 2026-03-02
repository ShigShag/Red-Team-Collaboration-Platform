# Penetration Test Report Generator

A data-driven PDF report generator for penetration tests. Edit `report_data.json` with your engagement data, run the script, get a branded PDF.

## Quick Start

```bash
pip install -r requirements.txt
python gen_evidence.py          # generate mock screenshots (or use your own)
python generate_report.py       # reads report_data.json → pentest_report.pdf
```

## How It Works

All variable content lives in **`report_data.json`**. The generator reads it and produces a PDF. Your collaboration platform only needs to output this JSON file.

```
report_data.json  ──→  generate_report.py  ──→  pentest_report.pdf
                              ↑
                       evidence/*.png
```

## Project Structure

```
├── generate_report.py       # PDF generator (reads JSON, produces PDF)
├── report_data.json         # All report data (edit this)
├── gen_evidence.py          # Mock screenshot generator (optional)
├── requirements.txt         # Python dependencies
├── evidence/                # Evidence images referenced by findings
│   ├── vuln001_sqli_burp.png
│   ├── vuln002_idor_response.png
│   └── ...
└── pentest_report.pdf       # Generated output
```

## What Goes in report_data.json

| Section | Key Fields |
|---|---|
| `project` | id, title, subtitle, report_date, version, classification |
| `client` | name, short_name |
| `testing_firm` | name, short_name |
| `engagement` | type, dates, summary paragraphs, methodology notes |
| `testers` | name, role, certifications, email, phone |
| `client_contacts` | name, role, department, email, phone |
| `escalation_contacts` | label, detail |
| `revision_history` | version, date, author, description |
| `distribution_list` | name, organization, role |
| `target_assets` | id, name, type, address, env |
| `findings[]` | id, title, severity, cvss_score, cvss_vector, status, description, impact, evidence, remediation |
| `attack_narrative` | phase, tactic, technique, target, outcome |
| `recommendations` | num, title, rationale, effort |
| `tools` | name, version, purpose |
| `evidence_log` | id, finding, type, filename, timestamp |

### Adding a Finding

Add an object to the `findings` array. The generator handles numbering, TOC entries, bookmarks, severity colors, and the summary table automatically.

```json
{
  "id": "VULN-006",
  "title": "Weak Password Policy",
  "severity": "Low",
  "cvss_score": "3.7",
  "cvss_vector": "AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
  "status": "Open",
  "discovered": "2026-02-03",
  "owasp": "A07:2021 — Identification and Authentication Failures",
  "affected_asset": "AST-004 — https://auth.apexfs.com",
  "description": "Password policy allows 6-character passwords without complexity requirements.",
  "impact_technical": "Passwords vulnerable to brute-force and dictionary attacks.",
  "impact_business": "Account takeover risk for users with weak passwords.",
  "evidence_request": "POST /auth/register\n{\"password\": \"abc123\"}",
  "evidence_response": "HTTP/1.1 201 Created",
  "evidence_image": "vuln006_weak_password.png",
  "evidence_caption": "Successful registration with a 6-character password.",
  "remediation_short": "Enforce minimum 12 characters with complexity requirements.",
  "remediation_long": "Implement NIST SP 800-63B guidelines. Add breached password checking."
}
```

Optional fields: `owasp`, `mitre`, `impact_technical`, `impact_business`, `evidence_request`, `evidence_response`, `evidence_image`, `evidence_caption`. Omit any you don't need.

## Integration with Your Platform

Your collaboration platform needs to:

1. **Produce `report_data.json`** — serialize your engagement data into this format
2. **Place evidence images** in the `evidence/` directory
3. **Run the generator**:

```bash
# Custom paths via CLI arg and env vars
EVIDENCE_DIR=/path/to/images OUTPUT_PATH=/path/to/output.pdf python generate_report.py /path/to/data.json
```

The generator accepts:
- **Argument 1**: path to JSON file (default: `./report_data.json`)
- **`EVIDENCE_DIR`**: path to evidence images (default: `./evidence`)
- **`OUTPUT_PATH`**: output PDF path (default: `./pentest_report.pdf`)

## Markdown in JSON Fields

All text fields in `report_data.json` support Markdown. The generator converts it to ReportLab's HTML at render time. No preprocessing needed on your platform side.

Supported syntax:

| Markdown | Renders as |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | inline monospace |
| `[text](url)` | clickable link |
| newlines | line breaks |

Example — this JSON field:

```json
"description": "The `/v2/transactions` endpoint is vulnerable to **SQL injection** via the `account_id` parameter."
```

renders as: The `/v2/transactions` endpoint is vulnerable to **SQL injection** via the `account_id` parameter.

Fields that already contain HTML tags (`<b>`, `<i>`, etc.) pass through unchanged, so existing data still works.

## Changing the Brand

All colors are at the top of `generate_report.py`:

```python
TK_BLUE        = HexColor("#00A0F5")   # Primary
TK_BLUE_DEEP   = HexColor("#003D6B")   # Headings
TK_GREY        = HexColor("#4B5564")   # Body text
SEV_CRIT       = HexColor("#C62828")   # Critical findings
# ...
```

## Requirements

- Python 3.8+
- `reportlab` — PDF generation
- `Pillow` — evidence screenshots (only needed if generating mock images)
