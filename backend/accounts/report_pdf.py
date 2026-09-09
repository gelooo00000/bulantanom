"""
PDF rendering for LGU reports.

A real PDF built with ReportLab from the same dict the API returns, not a
screenshot of the page: the text is selectable, the tables paginate, and the
output is identical whether the officer's dashboard was in Light or Dark Mode.
Print styling is fixed and light because a PDF is printed on white paper.

Nothing here queries Gemini or invents a value. Where the report dict says a
reading is unavailable, that is what the page says.
"""

from __future__ import annotations

import io

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.doctemplate import PageTemplate

# Pulled from the BulanTanom palette so the document is recognisably the
# same product, but kept dark enough to stay legible in greyscale print.
BRAND = colors.HexColor("#1F5A32")
BRAND_LIGHT = colors.HexColor("#E8F1EA")
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#5A5A5A")
RULE = colors.HexColor("#C9D6CD")

TONE_COLORS = {
    "high": colors.HexColor("#9B2C2C"),
    "medium": colors.HexColor("#8A5A00"),
    "low": colors.HexColor("#1F5A32"),
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "T", parent=base["Title"], fontSize=17, leading=21,
            textColor=BRAND, alignment=TA_LEFT, spaceAfter=2,
        ),
        "meta": ParagraphStyle(
            "M", parent=base["Normal"], fontSize=8.5, leading=12, textColor=MUTED,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontSize=11, leading=14,
            textColor=BRAND, spaceBefore=10, spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "H3", parent=base["Heading3"], fontSize=9.5, leading=12,
            textColor=INK, spaceBefore=7, spaceAfter=2,
        ),
        "cell": ParagraphStyle(
            "C", parent=base["Normal"], fontSize=7.2, leading=9, textColor=INK,
        ),
        "head": ParagraphStyle(
            "HD", parent=base["Normal"], fontSize=7.4, leading=9,
            textColor=colors.white, fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "B", parent=base["Normal"], fontSize=8.5, leading=11.5, textColor=INK,
        ),
        "muted": ParagraphStyle(
            "MU", parent=base["Normal"], fontSize=8.5, leading=11.5, textColor=MUTED,
        ),
    }


class _Doc(BaseDocTemplate):
    """Adds the running header rule and 'Page X of Y' to every page."""

    def __init__(self, buffer, pagesize, title, subtitle):
        super().__init__(
            buffer,
            pagesize=pagesize,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
            title=title,
            author="BulanTanom",
            subject=subtitle,
        )
        frame = Frame(
            self.leftMargin, self.bottomMargin,
            self.width, self.height, id="body",
        )
        self.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=self._chrome)])
        self._title = title

    def _chrome(self, canvas, doc):
        canvas.saveState()
        w, h = doc.pagesize

        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(BRAND)
        canvas.drawString(doc.leftMargin, h - 10 * mm, "BulanTanom")
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(w - doc.rightMargin, h - 10 * mm, self._title)
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(doc.leftMargin, h - 12 * mm, w - doc.rightMargin, h - 12 * mm)

        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(
            doc.leftMargin, 10 * mm,
            "Layuan Nature Integrated Farm - generated from BulanTanom records",
        )
        # Two-pass page count, so "of N" is correct rather than guessed.
        canvas.drawRightString(
            w - doc.rightMargin, 10 * mm, f"Page {doc.page} of {getattr(doc, '_pageCount', doc.page)}"
        )
        canvas.restoreState()

    def afterFlowable(self, flowable):
        self._pageCount = self.page


def _table(spec, styles, avail_width):
    columns = spec["columns"]
    keys = spec["keys"]
    rows = spec.get("rows", [])

    if not rows:
        return [Paragraph("No records for this period.", styles["muted"]), Spacer(1, 5)]

    data = [[Paragraph(c, styles["head"]) for c in columns]]
    for r in rows:
        data.append([Paragraph(str(r.get(k, "") or "-"), styles["cell"]) for k in keys])

    col_width = avail_width / len(columns)
    table = Table(
        data,
        colWidths=[col_width] * len(columns),
        repeatRows=1,  # header repeats when a table splits across pages
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, RULE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_LIGHT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return [table, Spacer(1, 8)]


def render(report: dict) -> bytes:
    """Builds the PDF and returns its bytes."""
    styles = _styles()

    # Wide tables get landscape so columns stay readable instead of being
    # crushed; narrow reports stay portrait, which is what an office prints.
    wide = any(t.get("wide") for t in report.get("tables", []))
    pagesize = landscape(A4) if wide else A4

    buffer = io.BytesIO()
    doc = _Doc(buffer, pagesize, report["title"], report["category"])

    story = [
        Paragraph(report["title"], styles["title"]),
        Paragraph(report["category"], styles["meta"]),
        Spacer(1, 6),
    ]

    meta = [
        f"<b>Farm:</b> {report['farm']['name']} - {report['farm']['location']}",
        f"<b>Period:</b> {report['period']['label']} ({report['period']['range']})",
        f"<b>Generated:</b> {report['generated_at'][:19].replace('T', ' ')}",
    ]
    for line in meta:
        story.append(Paragraph(line, styles["meta"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(report["description"], styles["body"]))
    story.append(Spacer(1, 8))

    stats = report.get("stats", [])
    if stats:
        story.append(Paragraph("Summary", styles["h2"]))
        cells = [
            [Paragraph(f"<b>{s['value']}</b><br/><font size=7>{s['label']}</font>", styles["cell"])
             for s in stats]
        ]
        stat_table = Table(cells, colWidths=[doc.width / len(stats)] * len(stats))
        style = [
            ("BOX", (0, 0), (-1, -1), 0.4, RULE),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
            ("BACKGROUND", (0, 0), (-1, -1), BRAND_LIGHT),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]
        for i, s in enumerate(stats):
            tone = TONE_COLORS.get(s.get("tone", ""))
            if tone:
                style.append(("TEXTCOLOR", (i, 0), (i, 0), tone))
        stat_table.setStyle(TableStyle(style))
        story += [stat_table, Spacer(1, 10)]

    for spec in report.get("tables", []):
        story.append(Paragraph(spec["title"], styles["h2"]))
        story += _table(spec, styles, doc.width)

    details = report.get("details", [])
    if details:
        story.append(PageBreak())
        story.append(Paragraph("Soil Recommendation Details", styles["h2"]))
        for d in details:
            story.append(Paragraph(d["heading"], styles["h3"]))
            if not d["analysed"]:
                story.append(Paragraph(d["unavailable"], styles["muted"]))
            else:
                for section in d["sections"]:
                    text = section["text"] or "None recorded"
                    story.append(
                        Paragraph(f"<b>{section['label']}:</b> {text}", styles["body"])
                    )
            story.append(Spacer(1, 6))

    if not stats and not report.get("tables"):
        story.append(Paragraph("No data available for this period.", styles["muted"]))

    # Built twice: the first pass discovers the real page count so the footer
    # can say "of N" instead of guessing.
    doc.multiBuild(story)
    return buffer.getvalue()
