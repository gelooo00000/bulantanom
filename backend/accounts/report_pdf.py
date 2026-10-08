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
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.doctemplate import PageTemplate

# Pulled from the BulanTanom palette so the document is recognisably the
# same product, but kept dark enough to stay legible in greyscale print.
BRAND = colors.HexColor("#1F5A32")
BRAND_LIGHT = colors.HexColor("#F1F6F2")
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
        "kicker": ParagraphStyle(
            "K", parent=base["Normal"], fontSize=7, leading=9, textColor=MUTED,
            fontName="Helvetica-Bold",
        ),
        "title": ParagraphStyle(
            "T", parent=base["Title"], fontSize=17, leading=21,
            textColor=BRAND, alignment=TA_LEFT, spaceBefore=1, spaceAfter=1,
        ),
        "meta": ParagraphStyle(
            "M", parent=base["Normal"], fontSize=8.5, leading=12, textColor=MUTED,
        ),
        "meta_r": ParagraphStyle(
            "MR", parent=base["Normal"], fontSize=8.5, leading=12, textColor=MUTED,
            alignment=TA_RIGHT,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontSize=11, leading=14,
            textColor=BRAND, spaceBefore=10, spaceAfter=5,
        ),
        "stat": ParagraphStyle(
            "S", parent=base["Normal"], fontSize=15, leading=18, fontName="Helvetica-Bold",
        ),
        "stat_label": ParagraphStyle(
            "SL", parent=base["Normal"], fontSize=7.5, leading=9.5, textColor=MUTED,
        ),
        "cell": ParagraphStyle(
            "C", parent=base["Normal"], fontSize=7.6, leading=9.6, textColor=INK,
        ),
        "head": ParagraphStyle(
            "HD", parent=base["Normal"], fontSize=7.6, leading=9.6,
            textColor=colors.white, fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "B", parent=base["Normal"], fontSize=8.5, leading=11.5, textColor=INK,
        ),
        "muted": ParagraphStyle(
            "MU", parent=base["Normal"], fontSize=8.5, leading=11.5, textColor=MUTED,
        ),
        "fine": ParagraphStyle(
            "F", parent=base["Normal"], fontSize=7, leading=9, textColor=MUTED,
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
        # No inner padding: tables are sized to `self.width`, so a padded
        # frame left them overhanging the text on both sides.
        frame = Frame(
            self.leftMargin, self.bottomMargin,
            self.width, self.height, id="body",
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
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
        canvas.restoreState()


class _NumberedCanvas(Canvas):
    """
    Holds every page until the end so "Page X of N" knows N. Counting during
    the build only ever knew the pages laid out so far, so page 2 of a
    two-page report printed "Page 2 of 1".
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            w, _ = self._pagesize
            self.setFont("Helvetica", 7)
            self.setFillColor(MUTED)
            self.drawRightString(w - 14 * mm, 10 * mm, f"Page {self._pageNumber} of {total}")
            super().showPage()
        super().save()


def _tone_for(text: str):
    """Risk wording in a cell ("High", "Medium", "Low") -> its print ink."""
    return TONE_COLORS.get(str(text).split(" ")[0].lower())


def _table(spec, styles, avail_width):
    columns = spec["columns"]
    keys = spec["keys"]
    rows = spec.get("rows", [])

    if not rows:
        return [Paragraph("No records for this period.", styles["muted"]), Spacer(1, 5)]

    # The risk column is printed in its level's colour, the fastest signal
    # on the page.
    tone_key = spec.get("tone_key")

    data = [[Paragraph(c, styles["head"]) for c in columns]]
    for r in rows:
        cells = []
        for k in keys:
            text = str(r.get(k, "") or "-")
            tone = _tone_for(text) if k == tone_key else None
            if tone:
                cells.append(Paragraph(
                    f"<b>{text}</b>",
                    ParagraphStyle(f"tone-{text}", parent=styles["cell"], textColor=tone),
                ))
            else:
                cells.append(Paragraph(text, styles["cell"]))
        data.append(cells)

    # Relative widths from the report keep short columns (dates, levels)
    # narrow and give the room to the text that needs it.
    weights = spec.get("widths") or [1] * len(columns)
    total = sum(weights)
    table = Table(
        data,
        colWidths=[avail_width * w / total for w in weights],
        repeatRows=1,  # header repeats when a table splits across pages
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_LIGHT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return [table, Spacer(1, 8)]


def _masthead(report, styles, width):
    """Title on the left, farm and period on the right, over a brand rule."""
    left = [
        Paragraph("BULANTANOM", styles["kicker"]),
        Paragraph(report["title"], styles["title"]),
        Paragraph(report["category"], styles["meta"]),
    ]
    right = [
        Paragraph(f"<b>{report['farm']['name']}</b>", styles["meta_r"]),
        Paragraph(report["farm"]["location"], styles["meta_r"]),
        Paragraph(f"<b>Period:</b> {report['period']['label']}", styles["meta_r"]),
        Paragraph(report["period"]["range"], styles["meta_r"]),
    ]
    head = Table([[left, right]], colWidths=[width * 0.56, width * 0.44])
    head.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, 0), 1.4, BRAND),
            ]
        )
    )
    return head


def _stat_cards(stats, styles, width):
    """Summary figures as cards with a top strip: one row of up to five, else rows of four."""
    per_row = len(stats) if len(stats) <= 5 else 4
    gap = 4 * mm
    card_w = (width - gap * (per_row - 1)) / per_row

    rows = []
    for start in range(0, len(stats), per_row):
        line = []
        for s in stats[start:start + per_row]:
            tone = TONE_COLORS.get(s.get("tone", ""))
            card = Table(
                [
                    [Paragraph(str(s["value"]), ParagraphStyle(
                        f"stat-{s['label']}", parent=styles["stat"], textColor=tone or INK,
                    ))],
                    [Paragraph(s["label"], styles["stat_label"])],
                ],
                colWidths=[card_w],
            )
            card.setStyle(
                TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
                        ("LINEABOVE", (0, 0), (-1, 0), 2.2, tone or BRAND),
                        ("LEFTPADDING", (0, 0), (-1, -1), 7),
                        ("TOPPADDING", (0, 0), (-1, 0), 6),
                        ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
                    ]
                )
            )
            line.append(card)
        line += [""] * (per_row - len(line))
        rows.append(line)

    # Each column but the last carries the gap as right padding.
    grid = Table(rows, colWidths=[card_w + gap] * (per_row - 1) + [card_w])
    grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), gap),
            ]
        )
    )
    return grid


def _signatures(report, styles, width):
    """Prepared by / Noted by lines, so the printout can be signed and filed."""
    name = report.get("prepared_by") or "&nbsp;"
    col = width * 0.4
    # The name sits on the signature line, the position under it.
    cells = [
        [Paragraph("Prepared by:", styles["muted"]), "", Paragraph("Noted by:", styles["muted"])],
        [Paragraph(f"<b>{name}</b>", styles["body"]), "", Paragraph("&nbsp;", styles["body"])],
        [Paragraph("LGU Agricultural Officer", styles["muted"]), "",
         Paragraph("Municipal Agriculturist", styles["muted"])],
    ]
    table = Table(
        cells,
        colWidths=[col, width - 2 * col, col],
        rowHeights=[None, 12 * mm, None],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 1), (-1, 1), "BOTTOM"),
                ("LINEBELOW", (0, 1), (0, 1), 0.6, INK),
                ("LINEBELOW", (2, 1), (2, 1), 0.6, INK),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]
        )
    )
    return KeepTogether([Spacer(1, 16), table])


def render(report: dict) -> bytes:
    """Builds the PDF and returns its bytes."""
    styles = _styles()

    # Reports are trimmed to fit portrait A4, which is what an office prints;
    # a table can still ask for landscape with `wide`.
    wide = any(t.get("wide") for t in report.get("tables", []))
    pagesize = landscape(A4) if wide else A4

    buffer = io.BytesIO()
    doc = _Doc(buffer, pagesize, report["title"], report["category"])

    story = [
        _masthead(report, styles, doc.width),
        Spacer(1, 8),
        Paragraph(report["description"], styles["muted"]),
        Spacer(1, 6),
    ]

    stats = report.get("stats", [])
    if stats:
        story.append(Paragraph("Summary", styles["h2"]))
        story += [_stat_cards(stats, styles, doc.width), Spacer(1, 2)]

    for spec in report.get("tables", []):
        story.append(Paragraph(spec["title"], styles["h2"]))
        story += _table(spec, styles, doc.width)

    if not stats and not report.get("tables"):
        story.append(Paragraph("No data available for this period.", styles["muted"]))

    story.append(_signatures(report, styles, doc.width))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"Generated {report['generated_at'][:16].replace('T', ' ')} from BulanTanom "
            "records. AI guidance is as stored at assessment time and does not replace "
            "an agricultural officer's judgement.",
            styles["fine"],
        )
    )

    doc.build(story, canvasmaker=_NumberedCanvas)
    return buffer.getvalue()
