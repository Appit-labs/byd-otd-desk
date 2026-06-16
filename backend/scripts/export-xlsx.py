#!/usr/bin/env python3
"""Generate professional XLSX export for BYD OTD Desk tracker data."""
import sys, json, io, os
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_xlsx(data: list[dict], period: str, logo_path: str | None = None) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "OTD Requests"

    # ── Colors (BYD brand) ──
    DARK = "1a1a2e"
    ACCENT_RED = "e94560"
    ACCENT_BLUE = "00C2FF"
    WHITE = "FFFFFF"
    LIGHT_GRAY = "F5F6FA"
    BORDER_GRAY = "D1D5DB"
    TEXT_DARK = "1F2937"

    dark_fill = PatternFill("solid", fgColor=DARK)
    accent_fill = PatternFill("solid", fgColor=ACCENT_RED)
    stripe_fill = PatternFill("solid", fgColor=LIGHT_GRAY)
    white_fill = PatternFill("solid", fgColor=WHITE)

    header_font = Font(name="Calibri", size=11, bold=True, color=WHITE)
    title_font = Font(name="Calibri", size=16, bold=True, color=DARK)
    subtitle_font = Font(name="Calibri", size=10, color="6B7280")
    data_font = Font(name="Calibri", size=10, color=TEXT_DARK)
    accent_font = Font(name="Calibri", size=8, bold=True, color=WHITE)

    thin_border = Border(
        left=Side(style="thin", color=BORDER_GRAY),
        right=Side(style="thin", color=BORDER_GRAY),
        top=Side(style="thin", color=BORDER_GRAY),
        bottom=Side(style="thin", color=BORDER_GRAY),
    )
    header_border = Border(
        left=Side(style="thin", color=DARK),
        right=Side(style="thin", color=DARK),
        top=Side(style="thin", color=DARK),
        bottom=Side(style="thin", color=ACCENT_RED),
    )

    headers = [
        "Request #", "Chassis (VIN)", "Type", "Brand", "Model", "Variant",
        "Ext. Color", "Int. Color", "Location", "Showroom",
        "Customer", "Phone", "Consultant", "Sales Type",
        "Acc.", "GPS", "Promise Date", "Status",
        "Storage", "Received", "Mech. Check", "PDI",
        "To Acc.", "Accessories", "Final Insp.", "FI Outcome",
        "GPS Done", "Registered", "Delivered", "Created", "Remarks",
    ]

    # ── Row 1: Logo + Title ──
    if logo_path and os.path.exists(logo_path):
        from openpyxl.drawing.image import Image as XLImage
        img = XLImage(logo_path)
        img.width = 180
        img.height = 36
        ws.add_image(img, "A1")

    ws.merge_cells("A2:AE2")
    ws["A2"] = "BYD OTD Desk — Order to Delivery Tracker"
    ws["A2"].font = title_font
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[2].height = 28

    ws.merge_cells("A3:AE3")
    period_label = {"week": "This Week", "month": "This Month", "year": "This Year", "all": "All Time"}
    ws["A3"] = f"Exported: {period_label.get(period, period)} | Date: {datetime.now().strftime('%d %B %Y, %H:%M')} | Total: {len(data)} requests"
    ws["A3"].font = subtitle_font
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[3].height = 22

    # ── Row 5: Header ──
    HEADER_ROW = 5
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=HEADER_ROW, column=col, value=h)
        cell.font = header_font
        cell.fill = dark_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = header_border
    ws.row_dimensions[HEADER_ROW].height = 36

    # ── Data rows ──
    for i, req in enumerate(data):
        row = HEADER_ROW + 1 + i
        values = [
            req.get("requestNumber", ""),
            req.get("chassisNumber", ""),
            req.get("requestType", ""),
            req.get("brand", ""),
            req.get("model", ""),
            req.get("variant", ""),
            req.get("exteriorColor", ""),
            req.get("interiorColor", ""),
            req.get("vehicleLocation", ""),
            req.get("showroom", ""),
            req.get("customerName", ""),
            req.get("customerPhone", ""),
            req.get("salesConsultant", ""),
            req.get("salesType", ""),
            req.get("hasAccessories", "No"),
            req.get("hasGps", "No"),
            req.get("promiseDate", ""),
            req.get("status", ""),
            req.get("storageAt", ""),
            req.get("vehicleReceivedAt", ""),
            req.get("mechanicalCheckAt", ""),
            req.get("pdiAt", ""),
            req.get("sentToAccessoriesAt", ""),
            req.get("accessoriesAt", ""),
            req.get("finalInspectionAt", ""),
            req.get("finalInspectionOutcome", ""),
            req.get("gpsConfirmedAt", ""),
            req.get("registeredAt", ""),
            req.get("deliveredAt", ""),
            req.get("createdAt", ""),
            req.get("remarks", ""),
        ]
        fill = stripe_fill if i % 2 == 0 else white_fill
        for col, val in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=val)
            cell.font = data_font
            cell.fill = fill
            cell.alignment = Alignment(vertical="center")
            cell.border = thin_border
            # Status badge coloring
            if col == 18:
                status = str(val).lower()
                if status == "active":
                    cell.font = Font(name="Calibri", size=10, bold=True, color="059669")
                elif "cancelled" in status:
                    cell.font = Font(name="Calibri", size=10, bold=True, color="DC2626")
                elif "archived" in status:
                    cell.font = Font(name="Calibri", size=10, bold=True, color="6B7280")

    # ── Column widths ──
    col_widths = {
        1: 16, 2: 20, 3: 10, 4: 10, 5: 12, 6: 10,
        7: 12, 8: 12, 9: 16, 10: 18,
        11: 18, 12: 14, 13: 16, 14: 12,
        15: 7, 16: 7, 17: 14, 18: 12,
        19: 14, 20: 14, 21: 14, 22: 14,
        23: 14, 24: 14, 25: 14, 26: 16,
        27: 14, 28: 14, 29: 14, 30: 14, 31: 24,
    }
    for col, width in col_widths.items():
        ws.column_dimensions[get_column_letter(col)].width = width

    # ── Freeze panes ──
    ws.freeze_panes = f"A{HEADER_ROW + 1}"

    # ── Auto-filter ──
    last_col = get_column_letter(len(headers))
    ws.auto_filter.ref = f"A{HEADER_ROW}:{last_col}{HEADER_ROW + len(data)}"

    # ── Footer ──
    footer_row = HEADER_ROW + len(data) + 2
    ws.merge_cells(f"A{footer_row}:{last_col}{footer_row}")
    ws[f"A{footer_row}"] = f"BYD OTD Desk — Confidential | Generated {datetime.now().strftime('%d/%m/%Y %H:%M')} | {len(data)} requests"
    ws[f"A{footer_row}"].font = Font(name="Calibri", size=8, color="9CA3AF")
    ws[f"A{footer_row}"].alignment = Alignment(horizontal="center")

    # ── Print setup ──
    ws.sheet_properties.pageSetUpPr = None
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = f"1:{HEADER_ROW}"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


if __name__ == "__main__":
    input_data = json.loads(sys.stdin.read())
    period = input_data.get("period", "all")
    records = input_data.get("data", [])
    logo = input_data.get("logoPath")
    xlsx_bytes = build_xlsx(records, period, logo)
    sys.stdout.buffer.write(xlsx_bytes)
