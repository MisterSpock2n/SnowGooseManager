export type InventoryCategory = 'maintenance' | 'guest_room' | 'breakfast_food' | 'cleaning'
export type TxnKind = 'received' | 'used' | 'count'

export const CATEGORIES: { value: InventoryCategory; label: string; color: string }[] = [
  { value: 'maintenance', label: 'Maintenance supplies', color: '#475569' },
  { value: 'guest_room', label: 'Guest room supplies', color: '#0e7490' },
  { value: 'breakfast_food', label: 'Breakfast / food', color: '#b45309' },
  { value: 'cleaning', label: 'Cleaning / housekeeping', color: '#7c3aed' },
]

export function categoryInfo(c: string) {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[0]
}

// Main choices in the "Counted in" dropdown; anything else can be typed in with "Other…"
export const COMMON_UNITS = ['each', 'case', 'pack', 'jug', 'gallon', 'pound']

export const STORAGE_SUGGESTIONS = ['Laundry Room', 'Kitchen', 'Office', 'Breakfast Room', 'Basement', 'Garage', 'Main Floor North Hallway', 'Main Floor South Hallway', '2nd Floor North Hallway', '2nd Floor South Hallway']

export const TXN_LABELS: Record<TxnKind, string> = {
  received: 'Received',
  used: 'Used',
  count: 'Counted',
}

export type InventoryItem = {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  quantity_on_hand: number
  reorder_level: number
  reorder_quantity: number | null
  storage_location: string | null
  vendor: string | null
  reorder_url: string | null
  notes: string | null
  active: boolean
  last_counted_at: string | null
  updated_at: string
}

export type StockState = 'uncounted' | 'out' | 'low' | 'ok'

export function stockState(item: Pick<InventoryItem, 'quantity_on_hand' | 'reorder_level' | 'last_counted_at'>): StockState {
  if (!item.last_counted_at) return 'uncounted'
  const qty = Number(item.quantity_on_hand)
  if (qty <= 0) return 'out'
  if (Number(item.reorder_level) > 0 && qty <= Number(item.reorder_level)) return 'low'
  return 'ok'
}

export const STOCK_STYLES: Record<StockState, { label: string; bg: string; fg: string; bar: string }> = {
  uncounted: { label: 'Needs first count', bg: '#f1f5f9', fg: '#475569', bar: '#cbd5e1' },
  out: { label: 'Out of stock', bg: '#fee2e2', fg: '#991b1b', bar: '#D32F2F' },
  low: { label: 'Low', bg: '#ffedd5', fg: '#9a3412', bar: '#F57C00' },
  ok: { label: 'In stock', bg: '#dcfce7', fg: '#166534', bar: '#16a34a' },
}

export function fmtQty(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function plural(unit: string, n: number) {
  if (Number(n) === 1) return unit
  if (['each', 'lb', 'lbs', 'dozen', 'set'].includes(unit)) return unit
  if (/(s|x|ch|sh)$/.test(unit)) return `${unit}es`
  if (unit === 'loaf') return 'loaves'
  return `${unit}s`
}

export function isLowOrOut(item: Pick<InventoryItem, 'quantity_on_hand' | 'reorder_level' | 'last_counted_at'>) {
  const s = stockState(item)
  return s === 'low' || s === 'out'
}

// Usual order amount if set, otherwise enough to get back to about twice the low-stock level
export function suggestedBuy(item: Pick<InventoryItem, 'quantity_on_hand' | 'reorder_level' | 'reorder_quantity'>) {
  if (item.reorder_quantity) return Number(item.reorder_quantity)
  return Math.max(1, Math.ceil(Number(item.reorder_level) * 2 - Number(item.quantity_on_hand)))
}
