import { invoiceStatusInfo } from '@/lib/invoices'

export default function InvoiceStatusBadge({ status }: { status: string }) {
  const s = invoiceStatusInfo(status)
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}
