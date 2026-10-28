import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import type { ReportCell, ReportColumn, ReportData } from "@/lib/types"

const number = new Intl.NumberFormat("es-AR")

export function formatCell(value: ReportCell | undefined, type: ReportColumn["type"]) {
  if (value === null || value === undefined || value === "") return "—"
  switch (type) {
    case "money":
      return formatMoney(Number(value))
    case "number":
      return number.format(Number(value))
    case "datetime":
      return formatDateTime(String(value))
    case "date":
      return formatDate(String(value))
    default:
      return String(value)
  }
}

export type ExportMeta = { period: string; generatedBy: string }

function fileName(report: ReportData, ext: string) {
  const slug = report.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
  const stamp = new Date().toISOString().slice(0, 10)
  return `luisao-${slug}-${stamp}.${ext}`
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Excel con tipos reales (números, fechas y moneda), no texto. */
export async function exportExcel(report: ReportData, meta: ExportMeta) {
  const { default: ExcelJS } = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  wb.creator = "LUISAO · Gestión"
  const ws = wb.addWorksheet(report.title.slice(0, 31))
  const cols = report.columns

  ws.addRow([`LUISAO · ${report.title}`]).font = { bold: true, size: 14 }
  ws.addRow([`${meta.period} · Generado el ${formatDateTime(new Date())} por ${meta.generatedBy}`]).font = {
    italic: true,
    color: { argb: "FF666666" },
  }
  ws.addRow([])

  const header = ws.addRow(cols.map((c) => c.label))
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F4A2E" } }
  })
  const headerRow = header.number

  for (const row of report.items) {
    ws.addRow(
      cols.map((c) => {
        const v = row[c.key]
        if (v === null || v === undefined) return null
        if (c.type === "date" || c.type === "datetime") {
          // Excel no tiene zona horaria: se guarda la hora local de Argentina tal cual.
          const d = new Date(String(v))
          return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        }
        return v
      })
    )
  }

  if (report.totals) {
    const totals = ws.addRow(cols.map((c, i) => (i === 0 ? "TOTAL" : (report.totals?.[c.key] ?? null))))
    totals.font = { bold: true }
    totals.eachCell((cell) => {
      cell.border = { top: { style: "thin" } }
    })
  }

  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    if (c.type === "money") col.numFmt = '"$" #,##0'
    if (c.type === "number") col.numFmt = "#,##0"
    if (c.type === "datetime") col.numFmt = "dd/mm/yyyy hh:mm"
    if (c.type === "date") col.numFmt = "dd/mm/yyyy"
    const longest = Math.max(
      c.label.length,
      ...report.items.slice(0, 500).map((r) => formatCell(r[c.key], c.type).length)
    )
    col.width = Math.min(45, Math.max(10, longest + 2))
  })
  ws.views = [{ state: "frozen", ySplit: headerRow }]
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: cols.length } }

  const buffer = await wb.xlsx.writeBuffer()
  download(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName(report, "xlsx")
  )
}

export async function exportPdf(report: ReportData, meta: ExportMeta) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const doc = new jsPDF({ orientation: report.columns.length > 6 ? "landscape" : "portrait", format: "a4" })
  const cols = report.columns
  const right = (c: ReportColumn) => c.type === "money" || c.type === "number"

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(`LUISAO · ${report.title}`, 14, 16)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text(
    `${meta.period} · ${report.total} registros · Generado el ${formatDateTime(new Date())} por ${meta.generatedBy}`,
    14,
    22
  )

  autoTable(doc, {
    startY: 27,
    head: [cols.map((c) => c.label)],
    body: report.items.map((row) => cols.map((c) => formatCell(row[c.key], c.type))),
    foot: report.totals
      ? [cols.map((c, i) => (i === 0 ? "TOTAL" : report.totals?.[c.key] != null ? formatCell(report.totals[c.key], c.type) : ""))]
      : undefined,
    showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [63, 74, 46] },
    footStyles: { fillColor: [230, 230, 220], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 246, 242] },
    columnStyles: Object.fromEntries(
      cols.map((c, i) => [i, { halign: right(c) ? "right" : "left" }] as const)
    ),
    didDrawPage: () => {
      const pages = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(
        `Página ${pages}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      )
    },
  })

  doc.save(fileName(report, "pdf"))
}
