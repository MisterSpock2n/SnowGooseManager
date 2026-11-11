import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryNav from '@/components/inventory/InventoryNav'
import StockBadge from '@/components/inventory/StockBadge'
import StockActions from '@/components/inventory/StockActions'
import { CATEGORIES, STOCK_STYLES, fmtQty, plural, stockState, type InventoryItem } from '@/lib/inventory'

type SearchParams = Promise<{ cat?: string; view?: string; q?: string; loc?: string; added?: string }>

const VIEWS = [
  { key: 'all', label: 'All items' },
  { key: 'low', label: 'Low / out' },
  { key: 'uncounted', label: 'Needs first count' },
  { key: 'archived', label: 'Archived' },
]

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const view = VIEWS.find((v) => v.key === params.view)?.key ?? 'all'
  const cat = CATEGORIES.find((c) => c.value === params.cat)?.value

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, quantity_on_hand, reorder_level, reorder_quantity, storage_location, vendor, reorder_url, notes, active, last_counted_at, updated_at')
    .order('name')

  const all = (data as InventoryItem[] | null) ?? []
  const active = all.filter((i) => i.active)
  const lowCount = active.filter((i) => ['low', 'out'].includes(stockState(i))).length
  const uncountedCount = active.filter((i) => stockState(i) === 'uncounted').length
  const locations = Array.from(new Set(active.map((i) => i.storage_location).filter(Boolean) as string[])).sort()

  const q = (params.q ?? '').trim().toLowerCase()
  const items = (view === 'archived' ? all.filter((i) => !i.active) : active).filter((i) => {
    const s = stockState(i)
    if (view === 'low' && s !== 'low' && s !== 'out') return false
    if (view === 'uncounted' && s !== 'uncounted') return false
    if (cat && i.category !== cat) return false
    if (params.loc && i.storage_location !== params.loc) return false
    if (q && ![i.name, i.vendor, i.storage_location, i.notes].some((f) => f?.toLowerCase().includes(q))) return false
    return true
  })

  const href = (patch: Record<string, string | undefined>) => {
    const next = { view: view === 'all' ? undefined : view, cat, q: params.q, loc: params.loc, ...patch }
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString()
    return `/inventory${qs ? `?${qs}` : ''}`
  }

  const pill = (active: boolean) =>
    ({ padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #d1d5db', background: active ? '#0f172a' : 'white', color: active ? 'white' : '#0f172a' }) as const
  const card = { background: 'white', borderRadius: 12, padding: '14px 18px', display: 'grid', gap: 4, textDecoration: 'none', color: 'inherit' } as const

  return (
    <div style={{ maxWidth: 1150, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Inventory</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Track maintenance, guest room, breakfast, and cleaning supplies. Log what comes in, what gets used, and do a count to correct totals.
      </p>
      <InventoryNav active="stock" />

      {params.added ? (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>
          Added {params.added}.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Link href={href({ view: 'low' })} style={{ ...card, borderLeft: lowCount ? `6px solid ${STOCK_STYLES.low.bar}` : undefined }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Low or out of stock</span>
          <strong style={{ fontSize: 22, color: lowCount ? '#9a3412' : undefined }}>{lowCount}</strong>
        </Link>
        <Link href={href({ view: 'uncounted' })} style={card}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Needs first count</span>
          <strong style={{ fontSize: 22 }}>{uncountedCount}</strong>
        </Link>
        <div style={card}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Active items</span>
          <strong style={{ fontSize: 22 }}>{active.length}</strong>
        </div>
        <Link href="/inventory/new" style={{ ...card, background: '#0f172a', color: 'white', placeContent: 'center', textAlign: 'center' }}>
          <strong style={{ fontSize: 17 }}>+ Add an item</strong>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {VIEWS.map((v) => (
          <Link key={v.key} href={href({ view: v.key === 'all' ? undefined : v.key })} style={pill(view === v.key)}>
            {v.label}
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Link href={href({ cat: undefined })} style={pill(!cat)}>All categories</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.value} href={href({ cat: c.value })} style={pill(cat === c.value)}>{c.label}</Link>
        ))}
      </div>

      <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'white', padding: 12, borderRadius: 10, marginBottom: 14 }}>
        {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
        {cat ? <input type="hidden" name="cat" value={cat} /> : null}
        <input type="search" name="q" defaultValue={params.q ?? ''} placeholder="Search items, vendors, notes…" aria-label="Search inventory" style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }} />
        <select name="loc" defaultValue={params.loc ?? ''} aria-label="Storage location" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' }}>
          <option value="">All storage spots</option>
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Search</button>
        {params.q || params.loc ? <Link href={href({ q: undefined, loc: undefined })} style={{ alignSelf: 'center', fontSize: 14 }}>Clear</Link> : null}
      </form>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          Could not load inventory: {error.message}
        </div>
      ) : null}

      {items.length === 0 && !error ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280' }}>
          {view === 'low' ? 'Nothing is low right now.' : view === 'uncounted' ? 'Every item has been counted.' : 'No items match.'}
        </div>
      ) : null}

      {CATEGORIES.filter((c) => !cat || c.value === cat).map((c) => {
        const list = items.filter((i) => i.category === c.value)
        if (!list.length) return null
        return (
          <section key={c.value} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color, display: 'inline-block' }} />
              {c.label} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 14 }}>({list.length})</span>
            </h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {list.map((i) => {
                const s = stockState(i)
                return (
                  <div key={i.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) auto', gap: 12, alignItems: 'center', background: 'white', borderRadius: 10, padding: '10px 14px', borderLeft: `6px solid ${STOCK_STYLES[s].bar}` }}>
                    <div style={{ display: 'grid', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link href={`/inventory/${i.id}`} style={{ fontWeight: 700, color: '#0f172a' }}>{i.name}</Link>
                        <StockBadge state={s} />
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        <strong style={{ color: '#111827', fontSize: 15 }}>{s === 'uncounted' ? '—' : fmtQty(i.quantity_on_hand)}</strong> {plural(i.unit, Number(i.quantity_on_hand))} on hand
                        {Number(i.reorder_level) > 0 ? ` · reorder at ${fmtQty(i.reorder_level)}` : ''}
                        {i.storage_location ? ` · ${i.storage_location}` : ''}
                        {i.vendor ? ` · ${i.vendor}` : ''}
                      </div>
                    </div>
                    {i.active ? <StockActions itemId={i.id} itemName={i.name} unit={i.unit} onHand={Number(i.quantity_on_hand)} compact /> : <span style={{ fontSize: 13, color: '#6b7280' }}>Archived</span>}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
