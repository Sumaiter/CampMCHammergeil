// PDF der Einkaufsliste (A4 hoch): Summe pro Artikel über alle Personen.
// jsPDF und jspdf-autotable werden erst beim Klick geladen, damit sie nicht im Haupt-Bundle landen.
import type { ShopListDetail } from '@/api/types'
import { grandTotal, parseServerDate, pdfFileName, totalsPerItem } from './listData'
import { formatPrice } from './price'

const money = (cents: number | null) => (cents === null ? '–' : formatPrice(cents))

const printedLabel = (printedAt: string) =>
  new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
    parseServerDate(printedAt),
  )

export async function downloadListPdf(list: ShopListDetail): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const margin = 15
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = margin
  // jspdf-autotable merkt sich die zuletzt gezeichnete Tabelle am Dokument
  const finalY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Einkaufsliste', margin, y + 6)
  y += 13
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Liste #${list.id} – gedruckt am ${printedLabel(list.printedAt)} Uhr`, margin, y)
  y += 8

  // Gesamt pro Artikel
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Gesamt pro Artikel', margin, y)
  y += 3
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Artikel', 'Menge', 'Einzelpreis', 'Summe']],
    body: totalsPerItem(list.orders).map((item) => [
      item.itemName,
      String(item.quantity),
      money(item.priceCents),
      money(item.totalCents),
    ]),
    columnStyles: {
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    headStyles: { fillColor: [30, 120, 90] },
    styles: { fontSize: 10 },
  })
  y = finalY() + 10

  // Gesamtsumme
  const { totalCents, unpricedCount } = grandTotal(list.orders)
  if (y > pageHeight - 30) {
    doc.addPage()
    y = margin
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`Gesamtsumme: ${money(totalCents)}`, margin, y)
  if (unpricedCount > 0) {
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(
      `${unpricedCount} ${unpricedCount === 1 ? 'Position' : 'Positionen'} ohne Preis (–), nicht in der Summe enthalten.`,
      margin,
      y,
    )
  }

  doc.save(pdfFileName(list.id, list.printedAt))
}
