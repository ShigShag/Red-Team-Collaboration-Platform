#!/usr/bin/env python3
"""
Penetration Test Report Generator (Data-Driven)
Reads all variable content from report_data.json.
Layout and brand design are fixed; data is interchangeable.

Usage:
    python generate_report.py                          # uses ./report_data.json
    python generate_report.py /path/to/custom.json     # uses custom data file

Environment variables:
    EVIDENCE_DIR   Path to evidence images (default: ./evidence)
    OUTPUT_PATH    Output PDF path (default: ./pentest_report.pdf)
"""

import json
import sys
import os
import math
import re

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Flowable, Image as RLImage
)
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame, NextPageTemplate
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib import colors


# ═══════════════════════════════════════════════════════════════
# Markdown → ReportLab HTML converter
# ═══════════════════════════════════════════════════════════════
def md(text):
    """Convert a Markdown string to the subset of HTML that ReportLab understands.

    Supports:
        **bold**, *italic*, `inline code`, [text](url),
        newlines → <br/>, --- → horizontal rule marker.

    Anything already containing <b>, <i>, <br/> etc. passes through unchanged
    so existing HTML-formatted strings still work.
    """
    if text is None:
        return ""
    t = str(text)
    # Bold: **text** or __text__
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'__(.+?)__', r'<b>\1</b>', t)
    # Italic: *text* or _text_  (but not inside already-converted <b> tags)
    t = re.sub(r'(?<!\w)\*(?!\*)(.+?)(?<!\*)\*(?!\w)', r'<i>\1</i>', t)
    t = re.sub(r'(?<!\w)_(?!_)(.+?)(?<!_)_(?!\w)', r'<i>\1</i>', t)
    # Inline code: `code`
    t = re.sub(r'`([^`]+)`', r"<font face='Courier' size='9'>\1</font>", t)
    # Links: [text](url)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" color="#00A0F5">\1</a>', t)
    # Newlines to <br/>
    t = t.replace('\n', '<br/>')
    return t


# ═══════════════════════════════════════════════════════════════
# Load Data
# ═══════════════════════════════════════════════════════════════
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SCRIPT_DIR, "report_data.json")
with open(DATA_PATH, 'r') as f:
    D = json.load(f)

EVIDENCE_DIR = os.environ.get("EVIDENCE_DIR", os.path.join(SCRIPT_DIR, "evidence"))
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", os.path.join(SCRIPT_DIR, "pentest_report.pdf"))


# ═══════════════════════════════════════════════════════════════
# Bookmark Flowable
# ═══════════════════════════════════════════════════════════════
class Bookmark(Flowable):
    def __init__(self, key, title, level=0):
        Flowable.__init__(self)
        self.key = key; self.title = title; self.level = level
        self.width = 0; self.height = 0
    def draw(self):
        self.canv.bookmarkPage(self.key)
        self.canv.addOutlineEntry(self.title, self.key, level=self.level, closed=False)


# ═══════════════════════════════════════════════════════════════
# Brand Palette (change here to rebrand)
# ═══════════════════════════════════════════════════════════════
TK_BLUE        = HexColor("#00A0F5")
TK_BLUE_DARK   = HexColor("#006EB8")
TK_BLUE_DEEP   = HexColor("#003D6B")
TK_GREY        = HexColor("#4B5564")
TK_GREY_LIGHT  = HexColor("#6B7A8D")
TK_GREY_PALE   = HexColor("#E8ECF0")
TK_GREY_BORDER = HexColor("#B0BCC8")
TK_WHITE       = white

SEV_CRIT = HexColor("#C62828"); SEV_HIGH = HexColor("#D84315")
SEV_MED  = HexColor("#EF8C00"); SEV_LOW  = HexColor("#2E7D32"); SEV_INFO = TK_BLUE
SEV_CRIT_BG = HexColor("#FFCDD2"); SEV_HIGH_BG = HexColor("#FFCCBC")
SEV_MED_BG  = HexColor("#FFE0B2"); SEV_LOW_BG  = HexColor("#C8E6C9"); SEV_INFO_BG = HexColor("#BBDEFB")

SEV_COLOR = {"critical": SEV_CRIT, "high": SEV_HIGH, "medium": SEV_MED, "low": SEV_LOW, "info": SEV_INFO}
SEV_BG    = {"critical": SEV_CRIT_BG, "high": SEV_HIGH_BG, "medium": SEV_MED_BG, "low": SEV_LOW_BG, "info": SEV_INFO_BG}
def sev_color(s): return SEV_COLOR.get(s.lower(), SEV_INFO)
def sev_bg(s):    return SEV_BG.get(s.lower(), SEV_INFO_BG)

PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch
USABLE = PAGE_W - 2 * MARGIN


# ═══════════════════════════════════════════════════════════════
# Styles
# ═══════════════════════════════════════════════════════════════
def get_styles():
    s = getSampleStyleSheet()
    defs = {
        'CoverLabel':   dict(fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=TK_BLUE, spaceAfter=2),
        'CoverMeta':    dict(fontName='Helvetica', fontSize=10, leading=14, textColor=TK_GREY),
        'H1':           dict(fontName='Helvetica-Bold', fontSize=20, leading=26, textColor=TK_BLUE_DEEP, spaceBefore=24, spaceAfter=4),
        'H2':           dict(fontName='Helvetica-Bold', fontSize=14, leading=19, textColor=TK_GREY, spaceBefore=16, spaceAfter=6),
        'H3':           dict(fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=TK_GREY, spaceBefore=14, spaceAfter=8),
        'Body':         dict(fontName='Helvetica', fontSize=10, leading=14.5, textColor=TK_GREY, alignment=TA_JUSTIFY, spaceBefore=2, spaceAfter=6),
        'CodeBlock':    dict(fontName='Courier', fontSize=8.5, leading=12, textColor=HexColor("#E0E0E0"), backColor=HexColor("#1E2A38"), borderPadding=(10,10,10,10), spaceBefore=12, spaceAfter=12, leftIndent=8, rightIndent=8),
        'TH':           dict(fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=TK_WHITE, alignment=TA_LEFT),
        'TD':           dict(fontName='Helvetica', fontSize=9, leading=12, textColor=TK_GREY, alignment=TA_LEFT),
        'Disclaimer':   dict(fontName='Helvetica-Oblique', fontSize=8.5, leading=12, textColor=TK_GREY_LIGHT, alignment=TA_JUSTIFY, spaceAfter=6),
        'Badge':        dict(fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=TK_WHITE, alignment=TA_CENTER),
        'EndNote':      dict(fontName='Helvetica-Oblique', fontSize=9, leading=13, textColor=TK_GREY_LIGHT, alignment=TA_CENTER),
        'Caption':      dict(fontName='Helvetica-Oblique', fontSize=9, leading=13, textColor=TK_GREY_LIGHT, alignment=TA_CENTER, spaceBefore=4, spaceAfter=12),
    }
    for name, kw in defs.items():
        s.add(ParagraphStyle(name, **kw))
    return s

ST = get_styles()


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════
def h1_block(text, key=None, level=0):
    el = []
    if key: el.append(Bookmark(key, text.replace('&amp;', '&'), level=level))
    el.append(Paragraph(text, ST['H1']))
    el.append(HRFlowable(width="100%", thickness=2.5, color=TK_BLUE, spaceBefore=0, spaceAfter=10))
    return el

def make_badge(text, color):
    fs = 8 if len(text) > 6 else 9
    sty = ParagraphStyle(f'b_{text}', fontName='Helvetica-Bold', fontSize=fs, leading=fs+3, textColor=TK_WHITE, alignment=TA_CENTER)
    t = Table([[Paragraph(f"<b>{text}</b>", sty)]], colWidths=[None], rowHeights=[17])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),color),('ALIGN',(0,0),(-1,-1),'CENTER'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),2),
        ('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4)]))
    return t

def make_table(headers, rows, cw=None):
    data = [[Paragraph(h, ST['TH']) for h in headers]]
    for r in rows: data.append([Paragraph(str(c), ST['TD']) for c in r])
    if cw is None: cw = [USABLE/len(headers)]*len(headers)
    t = Table(data, colWidths=cw, repeatRows=1)
    cmds = [('BACKGROUND',(0,0),(-1,0),TK_BLUE_DEEP),('TEXTCOLOR',(0,0),(-1,0),TK_WHITE),
        ('GRID',(0,0),(-1,-1),0.5,TK_GREY_BORDER),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]
    for i in range(2, len(data), 2): cmds.append(('BACKGROUND',(0,i),(-1,i),TK_GREY_PALE))
    t.setStyle(TableStyle(cmds))
    return t

def kv_table(pairs, kw=1.8*inch):
    if not pairs:
        pairs = [("—", "No data available")]
    data = [[Paragraph(f"<b>{k}</b>", ST['TD']), Paragraph(str(v), ST['TD'])] for k,v in pairs]
    t = Table(data, colWidths=[kw, USABLE-kw])
    t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.5,TK_GREY_BORDER),('BACKGROUND',(0,0),(0,-1),TK_GREY_PALE),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
        ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    return t

def evi_image(filename, caption, fig_num, max_width=USABLE):
    path = os.path.join(EVIDENCE_DIR, filename)
    if not os.path.exists(path):
        return [Paragraph(f"<i>[Image not found: {filename}]</i>", ST['Body'])]
    from PIL import Image as PILImage
    pil = PILImage.open(path); pw, ph = pil.size
    dw = min(max_width, USABLE); dh = dw * (ph/pw)
    # Cap height so tall images don't overflow the body frame
    MAX_H = PAGE_H - 1.3 * inch - 30  # frame height minus caption space
    if dh > MAX_H:
        dh = MAX_H; dw = dh * (pw/ph)
    img = RLImage(path, width=dw, height=dh); img.hAlign = 'CENTER'
    return [Spacer(1,6), img, Paragraph(f"<i>Figure {fig_num}: {caption}</i>", ST['Caption'])]

def finding_header(title, sev_label, sc, cvss):
    bg = {SEV_CRIT:HexColor("#B71C1C"),SEV_HIGH:HexColor("#BF360C"),SEV_MED:HexColor("#E65100"),
          SEV_LOW:HexColor("#1B5E20"),SEV_INFO:TK_BLUE_DARK}.get(sc, TK_GREY)
    bs = ParagraphStyle(f'fb_{sev_label}',fontName='Helvetica-Bold',fontSize=10,leading=13,textColor=TK_WHITE,alignment=TA_CENTER)
    ts = ParagraphStyle(f'ft_{title[:8]}',fontName='Helvetica-Bold',fontSize=13,leading=17,textColor=TK_WHITE)
    cs = ParagraphStyle(f'fc_{cvss}',fontName='Helvetica-Bold',fontSize=11,leading=14,textColor=TK_WHITE,alignment=TA_RIGHT)
    t = Table([[Paragraph(f"<b>{sev_label}</b>",bs),Paragraph(title,ts),Paragraph(f"CVSS {cvss}",cs)]],
        colWidths=[1.1*inch,USABLE-2.1*inch,1.0*inch],rowHeights=[32])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),bg),('BACKGROUND',(0,0),(0,0),sc),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    return [Spacer(1,16), t, Spacer(1,8)]


# ═══════════════════════════════════════════════════════════════
# Page Templates
# ═══════════════════════════════════════════════════════════════
def draw_cover(c, doc):
    c.saveState()
    split_x = PAGE_W * 0.58; right_w = PAGE_W - split_x; bh = 0.35*inch
    c.setFillColor(TK_WHITE); c.rect(0,bh,split_x,PAGE_H-bh,fill=1,stroke=0)
    c.setFillColor(TK_BLUE); c.rect(0,bh,6,PAGE_H-bh,fill=1,stroke=0)
    c.setFillColor(TK_BLUE_DEEP); c.rect(split_x,bh,right_w,PAGE_H-bh,fill=1,stroke=0)
    c.setFillColor(TK_BLUE_DARK); c.circle(PAGE_W-0.8*inch,bh+1.6*inch,2.2*inch,fill=1,stroke=0)
    c.setFillColor(TK_BLUE); c.circle(PAGE_W-1.5*inch,PAGE_H-2.2*inch,1.5*inch,fill=1,stroke=0)
    c.setFillColor(HexColor("#33B5FF")); c.circle(split_x+0.9*inch,PAGE_H-4.5*inch,0.6*inch,fill=1,stroke=0)
    c.setStrokeColor(HexColor("#0080D0")); c.setLineWidth(2)
    c.circle(PAGE_W+0.5*inch,PAGE_H*0.5,2.8*inch,fill=0,stroke=1)
    c.setStrokeColor(HexColor("#4DB8FF")); c.setLineWidth(1.5)
    c.circle(split_x+1.2*inch,bh+4.0*inch,1.8*inch,fill=0,stroke=1)
    c.saveState()
    p = c.beginPath(); p.rect(split_x,bh,right_w,PAGE_H-bh); c.clipPath(p,stroke=0)
    c.setStrokeColor(HexColor("#004A7A")); c.setLineWidth(0.3)
    for i in range(-500,1200,18): c.line(split_x+i,bh,split_x+i-(PAGE_H-bh),PAGE_H)
    c.restoreState()
    # Right panel text from JSON
    c.setFillColor(TK_WHITE); c.setFont('Helvetica-Bold',9)
    c.drawString(split_x+24, PAGE_H-40, D["project"]["classification"])
    c.setFillColor(TK_BLUE); c.roundRect(split_x+20,PAGE_H-62,130,20,3,fill=1,stroke=0)
    c.setFillColor(TK_WHITE); c.setFont('Helvetica-Bold',8)
    c.drawString(split_x+30, PAGE_H-57, f"PROJECT: {D['project']['id']}")
    c.setFillColor(HexColor("#A0C8E8")); c.setFont('Helvetica',10)
    c.drawString(split_x+24, bh+0.55*inch, D["project"]["report_date"])
    c.setFont('Helvetica',9)
    c.drawString(split_x+24, bh+0.30*inch, f"Version {D['project']['version']}")
    c.setFillColor(TK_BLUE); c.rect(0,0,PAGE_W,bh,fill=1,stroke=0)
    c.restoreState()

def draw_body(c, doc):
    c.saveState()
    c.setStrokeColor(TK_BLUE); c.setLineWidth(1.5)
    c.line(MARGIN,PAGE_H-0.5*inch,PAGE_W-MARGIN,PAGE_H-0.5*inch)
    c.setFont('Helvetica',7.5); c.setFillColor(TK_GREY_LIGHT)
    c.drawString(MARGIN, PAGE_H-0.44*inch, f"{D['project']['classification']}  \u2014  {D['client']['name']}")
    c.drawRightString(PAGE_W-MARGIN, PAGE_H-0.44*inch, D["project"]["report_date"])
    c.setFillColor(TK_BLUE); c.rect(MARGIN-4,PAGE_H-0.5*inch-2,8,5.5,fill=1,stroke=0)
    c.setStrokeColor(TK_GREY_BORDER); c.setLineWidth(0.5)
    c.line(MARGIN,0.52*inch,PAGE_W-MARGIN,0.52*inch)
    c.setFont('Helvetica',7.5); c.setFillColor(TK_GREY_LIGHT)
    c.drawString(MARGIN, 0.36*inch, f"{D['testing_firm']['short_name']}  |  v{D['project']['version'].split()[0]}")
    c.setFillColor(TK_BLUE); c.drawRightString(PAGE_W-MARGIN, 0.36*inch, f"Page {doc.page}")
    c.restoreState()


# ═══════════════════════════════════════════════════════════════
# Build
# ═══════════════════════════════════════════════════════════════
def build():
    doc = BaseDocTemplate(OUTPUT_PATH, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=0.65*inch, bottomMargin=0.65*inch,
        title=f"Penetration Test Report \u2014 {D['client']['short_name']}",
        author=D["testing_firm"]["name"])
    cover_frame = Frame(0.6*inch, 0.7*inch, PAGE_W*0.58-1.2*inch, PAGE_H-1.6*inch, id='cover')
    body_frame = Frame(MARGIN, 0.65*inch, USABLE, PAGE_H-1.3*inch, id='body')
    doc.addPageTemplates([PageTemplate(id='Cover',frames=[cover_frame],onPage=draw_cover),
                          PageTemplate(id='Body',frames=[body_frame],onPage=draw_body)])

    story = []
    P = D["project"]; CL = D["client"]; TF = D["testing_firm"]; EG = D["engagement"]
    findings = [f for f in D["findings"] if f.get("included", True)]

    # ── COVER ──
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("PENETRATION TEST", ST['CoverLabel']))
    story.append(Spacer(1, 6))
    ts = ParagraphStyle('CTD', fontName='Helvetica-Bold', fontSize=32, leading=38, textColor=TK_BLUE_DEEP, spaceAfter=4)
    story.append(Paragraph(P["title"].replace(" ", "<br/>", 1), ts))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="35%", thickness=3, color=TK_BLUE, hAlign='LEFT', spaceAfter=14))
    ss = ParagraphStyle('CS', fontName='Helvetica', fontSize=12, leading=16, textColor=TK_GREY_LIGHT)
    story.append(Paragraph(CL["name"], ss))
    story.append(Paragraph(P["subtitle"].replace("&","&amp;"), ss))
    story.append(Spacer(1, 24))
    lead = D["testers"][0]
    for lbl, val in [("Lead Tester", f"{lead['name']}, {lead['certifications']}"),
                     ("Prepared by", TF["name"]), ("Classification", P["classification"])]:
        story.append(Paragraph(f"<font color='#00A0F5'><b>{lbl}</b></font>&nbsp;&nbsp;&nbsp;&nbsp;{val}", ST['CoverMeta']))
        story.append(Spacer(1, 2))
    story.append(NextPageTemplate('Body'))
    story.append(PageBreak())

    # ── Dynamic section numbering ──
    disabled = D.get("disabled_sections", {})
    sn = 1  # running chapter counter

    # ── DOCUMENT CONTROL ──
    sn_doc = sn; sn += 1
    story.extend(h1_block(f"{sn_doc}. Document Control", key="sec_doc"))
    story.append(Paragraph("<b>Revision History</b>", ST['H3']))
    story.append(make_table(["Version","Date","Author","Description"],
        [[r["version"],r["date"],r["author"],r["description"]] for r in D["revision_history"]],
        cw=[0.7*inch,1.0*inch,1.4*inch,USABLE-3.1*inch]))
    story.append(Spacer(1,10))
    story.append(Paragraph("<b>Distribution List</b>", ST['H3']))
    story.append(make_table(["Recipient","Organization","Role"],
        [[r["name"],r["organization"],r["role"]] for r in D["distribution_list"]],
        cw=[1.6*inch,2.2*inch,USABLE-3.8*inch]))
    story.append(Spacer(1,10))
    story.append(Paragraph("<b>Disclaimer</b>", ST['H3']))
    story.append(Paragraph(
        f"This report is provided on a confidential basis to {CL['name']} and contains "
        "information about security vulnerabilities discovered during authorized testing. The findings and "
        "recommendations herein are based on the state of the assessed systems at the time of testing and do "
        "not constitute a guarantee of security. Unauthorized distribution, reproduction, or use of this "
        f"document is strictly prohibited. {TF['name']} accepts no liability for actions taken or "
        "not taken based on the contents of this report.", ST['Disclaimer']))
    story.append(PageBreak())

    # ── CONTACT INFORMATION ──
    sn_contact = sn; sn += 1
    story.extend(h1_block(f"{sn_contact}. Contact Information", key="sec_contact"))
    story.append(Paragraph("<b>Testing Team</b>", ST['H3'])); story.append(Spacer(1,4))
    story.append(make_table(["Name","Role","Certifications","Email","Phone"],
        [[t["name"],t["role"],t["certifications"],t["email"],t["phone"]] for t in D["testers"]],
        cw=[1.15*inch,0.9*inch,1.2*inch,2.1*inch,USABLE-5.35*inch]))
    story.append(Spacer(1,14))
    story.append(Paragraph("<b>Client Contacts</b>", ST['H3'])); story.append(Spacer(1,4))
    story.append(make_table(["Name","Role","Department","Email","Phone"],
        [[c["name"],c["role"],c["department"],c["email"],c["phone"]] for c in D["client_contacts"]],
        cw=[1.15*inch,1.05*inch,1.2*inch,1.85*inch,USABLE-5.25*inch]))
    story.append(Spacer(1,14))
    story.append(PageBreak())

    # ── TABLE OF CONTENTS (auto-built with dynamic numbering) ──
    story.extend(h1_block("Table of Contents")); story.append(Spacer(1,10))
    toc_sn = 1; toc = []
    # Doc Control
    toc.append((0,f"{toc_sn}.","Document Control","sec_doc")); toc_sn += 1
    # Contact Info
    toc.append((0,f"{toc_sn}.","Contact Information","sec_contact")); toc_sn += 1
    # Exec Summary
    sn_exec_toc = toc_sn; toc_sn += 1
    toc.append((0,f"{sn_exec_toc}.","Executive Summary","sec_exec"))
    toc.append((1,f"{sn_exec_toc}.1","Engagement Overview","sec_exec_1"))
    toc.append((1,f"{sn_exec_toc}.2","Key Findings Narrative","sec_exec_2"))
    # Scope & Methodology
    sn_scope_toc = toc_sn; toc_sn += 1
    toc.append((0,f"{sn_scope_toc}.","Project Scope &amp; Methodology","sec_scope"))
    toc.append((1,f"{sn_scope_toc}.1","Rules of Engagement","sec_scope_1"))
    toc.append((1,f"{sn_scope_toc}.2","Target Assets","sec_scope_2"))
    toc.append((1,f"{sn_scope_toc}.3","Methodology","sec_scope_3"))
    # Findings
    sn_find_toc = toc_sn; toc_sn += 1
    toc.append((0,f"{sn_find_toc}.","Findings","sec_find"))
    toc.append((1,f"{sn_find_toc}.1","Vulnerability Summary Table","sec_find_1"))
    for i, fd in enumerate(findings):
        toc.append((1, f"{sn_find_toc}.{i+2}", f"{fd['id']}: {fd['title']}", f"sec_find_{i+2}"))
    # Optional sections
    if not disabled.get("attack_narrative"):
        toc.append((0,f"{toc_sn}.","Attack Narrative","sec_attack")); toc_sn += 1
    if not disabled.get("recommendations"):
        toc.append((0,f"{toc_sn}.","Strategic Recommendations","sec_recommend")); toc_sn += 1
    toc_apx = ord('A')
    if not disabled.get("appendix_tools"):
        toc.append((0,f"{toc_sn}.",f"Appendix {chr(toc_apx)} \u2014 Tools &amp; Environment","sec_tools")); toc_sn += 1; toc_apx += 1
    if not disabled.get("appendix_evidence"):
        toc.append((0,f"{toc_sn}.",f"Appendix {chr(toc_apx)} \u2014 Evidence Log","sec_evidence")); toc_sn += 1; toc_apx += 1
    toc.append((0,f"{toc_sn}.",f"Appendix {chr(toc_apx)} \u2014 Severity Rating Definitions","sec_severity"))
    td = []
    for lv, num, title, anc in toc:
        lt = f'<a href="#{anc}" color="#003D6B">{title}</a>' if lv==0 else f'<a href="#{anc}" color="#4B5564">{title}</a>'
        if lv == 0:
            td.append([Paragraph(f"<b><font color='#00A0F5'>{num}</font></b>",
                ParagraphStyle(f'tn0_{anc}',fontName='Helvetica-Bold',fontSize=12,leading=18,textColor=TK_BLUE)),
                Paragraph(f"<b>{lt}</b>",ParagraphStyle(f'tt0_{anc}',fontName='Helvetica-Bold',fontSize=12,leading=18,textColor=TK_BLUE_DEEP))])
        else:
            td.append([Paragraph(f"<font color='#6B7A8D'>{num}</font>",
                ParagraphStyle(f'tn1_{anc}',fontName='Helvetica',fontSize=10.5,leading=16,textColor=TK_GREY_LIGHT)),
                Paragraph(lt,ParagraphStyle(f'tt1_{anc}',fontName='Helvetica',fontSize=10.5,leading=16,textColor=TK_GREY))])
    tt = Table(td, colWidths=[0.55*inch, USABLE-0.55*inch])
    tc = [('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(0,-1),0),('RIGHTPADDING',(0,0),(-1,-1),4),
          ('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]
    for i,(lv,_,_,_) in enumerate(toc):
        if lv==0 and i>0: tc+=[('LINEABOVE',(0,i),(-1,i),0.5,TK_GREY_PALE),('TOPPADDING',(0,i),(-1,i),8)]
        if lv==1: tc.append(('LEFTPADDING',(0,i),(0,i),16))
    tt.setStyle(TableStyle(tc)); story.append(tt); story.append(PageBreak())

    # ── EXECUTIVE SUMMARY ──
    sn_exec = sn; sn += 1
    story.extend(h1_block(f"{sn_exec}. Executive Summary", key="sec_exec"))
    story.append(Bookmark("sec_exec_1","Engagement Overview",level=1))
    story.append(Paragraph(f"<b>{sn_exec}.1 Engagement Overview</b>", ST['H2']))
    story.append(Paragraph(md(EG["summary_overview"]), ST['Body']))
    story.append(Paragraph(md(EG["summary_objective"]), ST['Body']))
    story.append(Bookmark("sec_exec_2","Key Findings Narrative",level=1))
    story.append(Paragraph(f"<b>{sn_exec}.2 Key Findings Narrative</b>", ST['H2']))
    nar = md(EG["summary_narrative"]).replace("HIGH RISK","<font color='#D84315'>HIGH RISK</font>")
    story.append(Paragraph(nar, ST['Body']))
    story.append(Paragraph(md(EG["summary_detail"]), ST['Body']))
    story.append(Paragraph(md(EG["summary_conclusion"]), ST['Body']))
    story.append(PageBreak())

    # ── SCOPE & METHODOLOGY ──
    sn_scope = sn; sn += 1
    story.extend(h1_block(f"{sn_scope}. Project Scope &amp; Methodology", key="sec_scope"))
    story.append(Bookmark("sec_scope_1","Rules of Engagement",level=1))
    story.append(Paragraph(f"<b>{sn_scope}.1 Rules of Engagement</b>", ST['H2'])); story.append(Spacer(1,4))
    # Build ROE pairs based on enabled fields
    enabled = D.get("enabled_roe_fields", {})
    roe_pairs = []
    if enabled.get("authorization_date", True):
        roe_pairs.append(("Authorization Date", EG["authorization_date"]))
    if enabled.get("authorization_doc", True):
        roe_pairs.append(("Authorization Document", EG["authorization_doc"]))
    if enabled.get("testing_window", True):
        roe_pairs.append(("Testing Window", f"{EG['start_date']} — {EG['end_date']}"))
    if enabled.get("testing_hours", True):
        roe_pairs.append(("Testing Hours", EG["testing_hours"]))
    if enabled.get("type", True):
        roe_pairs.append(("Testing Approach", EG["type"]))
    if enabled.get("perspective", True):
        roe_pairs.append(("Perspective", EG["perspective"]))
    if D["client_contacts"]:
        cc0 = D["client_contacts"][0]
        roe_pairs.append(("Contact", f"{cc0['name']}, {cc0['role']} — {cc0['phone']}"))
    if enabled.get("data_handling", True):
        roe_pairs.append(("Data Handling", EG["data_handling"]))
    if enabled.get("out_of_scope", True):
        roe_pairs.append(("Out-of-Scope", EG["out_of_scope"]))

    story.append(kv_table(roe_pairs))
    story.append(Spacer(1,10))
    story.append(Bookmark("sec_scope_2","Target Assets",level=1))
    story.append(Paragraph(f"<b>{sn_scope}.2 Target Assets</b>", ST['H2'])); story.append(Spacer(1,4))
    story.append(make_table(["Asset ID","Name","Type","Address","Env"],
        [[a["id"],a["name"],a["type"],a["address"],a["env"]] for a in D["target_assets"]],
        cw=[0.75*inch,1.5*inch,0.85*inch,2.15*inch,USABLE-5.25*inch]))
    story.append(Spacer(1,10))
    story.append(Bookmark("sec_scope_3","Methodology",level=1))
    story.append(Paragraph(f"<b>{sn_scope}.3 Methodology</b>", ST['H2']))
    story.append(Paragraph(md(EG["methodology_notes"]), ST['Body']))
    methodology_phases = EG.get("methodology_phases", "")
    if methodology_phases and methodology_phases.strip():
        for para in methodology_phases.strip().split("\n\n"):
            para = para.strip()
            if para:
                story.append(Paragraph(md(para), ST['Body']))
    else:
        for t,d in [("Phase 1 \u2014 Reconnaissance:","Passive and active information gathering, OSINT, DNS enumeration, service fingerprinting, technology stack identification."),
            ("Phase 2 \u2014 Vulnerability Analysis:","Automated scanning with Burp Suite and Nuclei, manual validation, business logic analysis, authentication and authorization testing."),
            ("Phase 3 \u2014 Exploitation:","Controlled exploitation of confirmed vulnerabilities, privilege escalation, lateral movement simulation, data access verification."),
            ("Phase 4 \u2014 Post-Exploitation:","Persistence analysis, data exfiltration simulation, impact assessment, attack chain documentation."),
            ("Phase 5 \u2014 Reporting:","Finding documentation, evidence compilation, remediation guidance, risk rating assignment.")]:
            story.append(Paragraph(f"<b>{t}</b> {d}", ST['Body']))
    story.append(PageBreak())

    # ── FINDINGS (dynamic) ──
    sn_find = sn; sn += 1
    story.extend(h1_block(f"{sn_find}. Findings", key="sec_find"))
    story.append(Bookmark("sec_find_1","Vulnerability Summary Table",level=1))
    story.append(Paragraph(f"<b>{sn_find}.1 Vulnerability Summary Table</b>", ST['H2'])); story.append(Spacer(1,4))
    vs_cw = [0.8*inch, USABLE-3.35*inch, 1.15*inch, 0.6*inch, 0.8*inch]
    vs_data = [[Paragraph(h,ST['TH']) for h in ["ID","Title","Severity","CVSS","Status"]]]
    for fd in findings:
        sc = sev_color(fd["severity"])
        vs_data.append([Paragraph(f"<b>{fd['id']}</b>",ST['TD']), Paragraph(f"{fd['id']}: {fd['title']}",ST['TD']),
            make_badge(fd["severity"].upper(),sc), Paragraph(f"<b>{fd['cvss_score']}</b>",ST['TD']),
            Paragraph(fd["status"],ST['TD'])])
    vt = Table(vs_data, colWidths=vs_cw, repeatRows=1)
    vc = [('BACKGROUND',(0,0),(-1,0),TK_BLUE_DEEP),('TEXTCOLOR',(0,0),(-1,0),TK_WHITE),
        ('GRID',(0,0),(-1,-1),0.5,TK_GREY_BORDER),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]
    for i,fd in enumerate(findings):
        r = i+1; vc.append(('BACKGROUND',(0,r),(-1,r),sev_bg(fd["severity"])))
        vc.append(('LINEBEFOREDECOR',(0,r),(0,r),5,sev_color(fd["severity"])))
    vt.setStyle(TableStyle(vc)); story.append(vt); story.append(PageBreak())

    # Individual findings
    fig_counter = 0
    for i, fd in enumerate(findings):
        fsn = f"{sn_find}.{i+2}"; fsk = f"sec_find_{i+2}"; sc = sev_color(fd["severity"])
        story.append(Bookmark(fsk, f"{fd['id']}: {fd['title']}", level=1))
        story.extend(finding_header(f"{fsn} \u2014 {fd['id']}: {fd['title']}", fd["severity"].upper(), sc, fd["cvss_score"]))
        story.append(Paragraph("<b>Severity Metadata</b>", ST['H3']))
        meta = [("Finding ID",fd["id"]),("Severity",fd["severity"].upper()),
                ("CVSS v3.1",f"{fd['cvss_score']} ({fd['severity']}) \u2014 {fd['cvss_vector']}")]
        if fd.get("owasp"): meta.append(("OWASP Category",fd["owasp"]))
        if fd.get("mitre"): meta.append(("MITRE ATT&CK",fd["mitre"]))
        meta += [("Affected Asset",fd["affected_asset"]),("Status",fd["status"])]
        if fd.get("discovered"): meta.append(("Discovered",fd["discovered"]))
        story.append(kv_table(meta))
        story.append(Paragraph("<b>Description</b>",ST['H3']))
        story.append(Paragraph(md(fd["description"]),ST['Body']))
        if fd.get("impact_technical") or fd.get("impact_business"):
            story.append(Paragraph("<b>Impact Assessment</b>",ST['H3']))
            if fd.get("impact_technical"): story.append(Paragraph(f"<b>Technical Impact:</b> {md(fd['impact_technical'])}",ST['Body']))
            if fd.get("impact_business"): story.append(Paragraph(f"<b>Business Risk:</b> {md(fd['impact_business'])}",ST['Body']))
        story.append(Paragraph("<b>Evidence and Proof of Concept</b>",ST['H3']))
        if fd.get("evidence_request"):
            ereq = fd["evidence_request"].replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\n","<br/>")
            story.append(Paragraph(ereq, ST['CodeBlock']))
        if fd.get("evidence_response"):
            story.append(Paragraph("<b>Server Response:</b>",ST['H3']))
            eresp = fd["evidence_response"].replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\n","<br/>")
            story.append(Paragraph(eresp, ST['CodeBlock']))
        if fd.get("evidence_images"):
            for ei in fd["evidence_images"]:
                fig_counter += 1
                cap = ei.get("caption") or f"Evidence for {fd['id']}"
                story.extend(evi_image(ei["filename"], cap, fig_counter))
        elif fd.get("evidence_image"):
            fig_counter += 1
            story.extend(evi_image(fd["evidence_image"], fd.get("evidence_caption",f"Evidence for {fd['id']}"), fig_counter))
        story.append(Paragraph("<b>Remediation</b>",ST['H3']))
        if fd.get("remediation_short"): story.append(Paragraph(f"<b>Short-Term:</b> {md(fd['remediation_short'])}",ST['Body']))
        if fd.get("remediation_long"): story.append(Paragraph(f"<b>Long-Term:</b> {md(fd['remediation_long'])}",ST['Body']))
        story.append(PageBreak())

    # ── ATTACK NARRATIVE (optional) ──
    if not disabled.get("attack_narrative"):
        sn_attack = sn; sn += 1
        story.extend(h1_block(f"{sn_attack}. Attack Narrative", key="sec_attack"))
        story.append(Paragraph("End-to-end attack chain from initial reconnaissance through data exfiltration:",ST['Body']))
        story.append(Spacer(1,4))
        story.append(make_table(["Phase","ATT&CK Tactic","Technique","Target","Outcome"],
            [[a["phase"],a["tactic"],a["technique"],a["target"],a["outcome"]] for a in D["attack_narrative"]],
            cw=[0.5*inch,1.2*inch,1.5*inch,1.25*inch,USABLE-4.45*inch]))
        story.append(PageBreak())

    # ── RECOMMENDATIONS (optional) ──
    if not disabled.get("recommendations"):
        sn_rec = sn; sn += 1
        story.extend(h1_block(f"{sn_rec}. Strategic Recommendations", key="sec_recommend"))
        story.append(Paragraph("Systemic improvements beyond individual finding remediations:",ST['Body']))
        story.append(Spacer(1,4))
        story.append(make_table(["#","Recommendation","Rationale","Effort"],
            [[r["num"],r["title"],r["rationale"],r["effort"]] for r in D["recommendations"]],
            cw=[0.35*inch,2.4*inch,2.5*inch,USABLE-5.25*inch]))
        story.append(PageBreak())

    # ── APPENDICES ──
    apx = ord('A')
    if not disabled.get("appendix_tools"):
        sn_tools = sn; sn += 1
        story.extend(h1_block(f"{sn_tools}. Appendix {chr(apx)} \u2014 Tools &amp; Environment", key="sec_tools"))
        story.append(Spacer(1,4))
        story.append(make_table(["Tool","Version","Purpose"],
            [[t["name"],t["version"],t["purpose"]] for t in D["tools"]],
            cw=[1.9*inch,0.9*inch,USABLE-2.8*inch]))
        story.append(Spacer(1,12)); story.append(Paragraph("<b>Testing Environment</b>",ST['H3']))
        te = D["testing_environment"]
        story.append(kv_table([("Platform",te["platform"]),("Source IPs",te["source_ips"]),("VPN",te["vpn"])]))
        story.append(PageBreak())
        apx += 1

    if not disabled.get("appendix_evidence"):
        sn_evi = sn; sn += 1
        story.extend(h1_block(f"{sn_evi}. Appendix {chr(apx)} \u2014 Evidence Log", key="sec_evidence"))
        story.append(Paragraph("All evidence is stored in the secure repository and available upon request.",ST['Body']))
        story.append(Spacer(1,4))
        story.append(make_table(["Evidence ID","Finding","Type","Filename","Timestamp"],
            [[e["id"],e["finding"],e["type"],e["filename"],e["timestamp"]] for e in D["evidence_log"]],
            cw=[0.8*inch,0.8*inch,1.15*inch,1.9*inch,USABLE-4.65*inch]))
        story.append(PageBreak())
        apx += 1

    sn_sev = sn; sn += 1
    story.extend(h1_block(f"{sn_sev}. Appendix {chr(apx)} \u2014 Severity Rating Definitions", key="sec_severity"))
    story.append(Paragraph("CVSS v3.1 maintained by FIRST.org is used for quantitative severity scoring.",ST['Body']))
    story.append(Spacer(1,4))
    story.append(make_table(["Severity (CVSS)","Definition"],[
        ["Critical (9.0\u201310.0)","Trivial exploitation; full system compromise or mass data breach with no mitigating controls."],
        ["High (7.0\u20138.9)","Reliable exploitation; significant unauthorized access or privilege escalation. Weak or absent controls."],
        ["Medium (4.0\u20136.9)","Requires specific conditions or elevated privileges. Partially mitigated by existing controls."],
        ["Low (0.1\u20133.9)","Difficult exploitation or minimal impact. May contribute to attack chains."],
        ["Info (0.0)","No direct exploitability. Best practice deviations or security hygiene observations."]],
        cw=[1.4*inch,USABLE-1.4*inch]))

    story.append(Spacer(1,36))
    story.append(HRFlowable(width="100%",thickness=1,color=TK_GREY_BORDER,spaceAfter=12))
    story.append(Paragraph(f"<i>End of Report \u2014 {TF['name']} \u2014 {P['report_date']} \u2014 v{P['version'].split()[0]}</i>",ST['EndNote']))
    story.append(Paragraph(f"<i>{P['classification']} \u2014 {CL['name']}</i>",ST['EndNote']))

    doc.build(story)
    return OUTPUT_PATH

if __name__ == "__main__":
    p = build()
    print(f"Generated: {p}")
