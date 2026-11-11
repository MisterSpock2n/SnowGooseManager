import { STOCK_STYLES, type StockState } from '@/lib/inventory'

export default function StockBadge({ state }: { state: StockState }) {
  const s = STOCK_STYLES[state]
  return <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>{s.label}</span>
}
