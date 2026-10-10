// PDF der Einkaufsliste (A4 hoch). jsPDF und jspdf-autotable werden erst beim Klick geladen,
// damit sie nicht im Haupt-Bundle landen.
import type { ShopListDetail } from '@/api/types'
import {
  grandTotal,
  groupByRecipient,
  lineTotal,
  orderedByHint,
  parseServerDate,
  pdfFileName,
  totalsPerItem,
} from './listData'
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

  const head = [['Artikel', 'Menge', 'Einzelpreis', 'Summe']]
  const columnStyles = {
    1: { halign: 'right' as const, cellWidth: 20 },
    2: { halign: 'right' as const, cellWidth: 32 },
    3: { halign: 'right' as const, cellWidth: 32 },
  }
  const headStyles = { fillColor: [30, 120, 90] as [number, number, number] }

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

  const heading = (text: string) => {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(text, margin, y)
    y += 3
  }

  // 1) Gesamt pro Artikel
  heading('Gesamt pro Artikel')
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head,
    body: totalsPerItem(list.orders).map((item) => [
      item.itemName,
      String(item.quantity),
      money(item.priceCents),
      money(item.totalCents),
    ]),
    columnStyles,
    headStyles,
    styles: { fontSize: 10 },
  })
  y = finalY() + 10

  // 2) Pro Person
  for (const person of groupByRecipient(list.orders)) {
    heading(person.username)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head,
      body: person.orders.map((order) => {
        const by = orderedByHint(order)
        return [
          by ? `${order.itemName}\nbestellt von ${by}` : order.itemName,
          String(order.quantity),
          money(order.priceCents),
          money(lineTotal(order)),
        ]
      }),
      foot: [
        [
          person.unpricedCount > 0 ? `${person.unpricedCount}x ohne Preis (nicht enthalten)` : '',
          '',
          'Summe',
          money(person.totalCents),
        ],
      ],
      columnStyles,
      headStyles,
      footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
      showFoot: 'lastPage',
      styles: { fontSize: 10 },
    })
    y = finalY() + 10
  }

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
