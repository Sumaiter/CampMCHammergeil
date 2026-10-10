import { describe, expect, it } from 'vitest'
import { parseServerDate } from './date'
import { pdfFileName } from './pdf'

describe('pdfFileName', () => {
  it('nutzt lokale Zeit und die Listen-ID', () => {
    const printedAt = '2026-10-10 08:05:00'
    const d = parseServerDate(printedAt)
    const p = (n: number) => String(n).padStart(2, '0')
    const expected = `einkaufsliste-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-7.pdf`
    expect(pdfFileName(7, printedAt)).toBe(expected)
    expect(pdfFileName(7, printedAt)).toMatch(/^einkaufsliste-\d{4}-\d{2}-\d{2}-\d{4}-7\.pdf$/)
  })
})
