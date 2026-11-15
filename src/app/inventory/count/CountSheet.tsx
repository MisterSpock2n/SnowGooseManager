'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { CATEGORIES, categoryInfo, fmtQty, plural, stockState, type InventoryItem } from '@/lib/inventory'

const DRAFT_KEY = 'sg-count-sheet-draft'
const NO_SPOT = 'No storage spot set'

export default function CountSheet({ items }: { items: InventoryItem[] }) {
  const router = useRouter()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [spot, setSpot] = useState('')
  const [cat, setCat] = useState('')
  const [onlyUncounted, setOnlyUncounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(true)

  // Keep typed counts on this device so a refresh or a dropped connection doesn't lose them
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}')
      const valid = new Set(items.map((i) => i.id))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts(Object.fromEntries(Object.entries(saved).filter(([k, v]) => valid.has(k) && typeof v === 'string')) as Record<string, string>)
    } catch {}
    setLoaded(true)
  }, [items])

  useEffect(() => {
    if (loaded) localStorage.setItem(DRAFT_KEY, JSON.stringify(counts))
  }, [counts, loaded])

  const entered = Object.entries(counts).filter(([, v]) => v.trim() !== '')

  useEffect(() => {
    if (!entered.length) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [entered.length])

  const spots = useMemo(
    () => Array.from(new Set(items.map((i) => i.storage_location || NO_SPOT))).sort((a, b) => (a === NO_SPOT ? 1 : b === NO_SPOT ? -1 : a.localeCompare(b))),
    [items]
  )

  const visible = items.filter((i) => {
    if (spot && (i.storage_location || NO_SPOT) !== spot) return false
    if (cat && i.category !== cat) return false
    if (onlyUncounted && stockState(i) !== 'uncounted') return false
    return true
  })

  const groups = spots
    .map((s) => ({ spot: s, list: visible.filter((i) => (i.storage_location || NO_SPOT) === s) }))
    .filter((g) => g.list.length)

  const invalid = entered.filter(([, v]) => !Number.isFinite(Number(v)) || Number(v) < 0)

  async function save() {
    if (!entered.length) return
    if (invalid.length) {
      setOk(false)
      setMessage('Some counts are not valid numbers. Fix the lines marked in red.')
      return
    }
    setBusy(true)
    setMessage('')
    const supabase = createClient()
    const rows = entered.map(([item_id, v]) => ({ item_id, kind: 'count' as const, quantity: Math.round(Number(v) * 100) / 100, note: 'Count sheet' }))
    // One insert, so either every count saves or none do
    const { error } = await supabase.from('inventory_transactions').insert(rows)
    setBusy(false)
    if (error) {
      setOk(false)
      setMessage(`Nothing was saved: ${error.message}`)
      return
    }
    const changed = entered.filter(([id, v]) => {
      const it = items.find((i) => i.id === id)
      return it && (stockState(it) === 'uncounted' || Number(it.quantity_on_hand) !== Number(v))
    }).length
    setOk(true)
    setMessage(`Saved ${rows.length} count${rows.length === 1 ? '' : 's'} (${changed} changed).`)
    setCounts({})
    localStorage.removeItem(DRAFT_KEY)
    router.refresh()
  }

  function clearAll() {
    if (entered.length && !window.confirm(`Clear ${entered.length} typed count${entered.length === 1 ? '' : 's'} without saving?`)) return
    setCounts({})
    setMessage('')
  }

  const select = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', fontSize: 14 } as const
  const btn = (primary: boolean) =>
    ({ padding: '9px 16px', borderRadius: 8, border: primary ? 'none' : '1px solid #d1d5db', background: primary ? '#0f172a' : 'white', color: primary ? 'white' : '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: 14 }) as const

  return (
    <div>
      <style>{`
        @media print {
          .no-print, aside { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .count-row { break-inside: avoid; }
          .count-input { border: none !important; border-bottom: 1px solid #000 !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: 12, borderRadius: 10, marginBottom: 14 }}>
        <select value={spot} onChange={(e) => setSpot(e.target.value)} aria-label="Storage spot" style={select}>
          <option value="">All storage spots</option>
          {spots.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" style={select}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={onlyUncounted} onChange={(e) => setOnlyUncounted(e.target.checked)} /> Only items never counted
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => window.print()} style={btn(false)}>Print sheet</button>
      </div>

      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '10px 12px', borderRadius: 10, marginBottom: 14 }}>
        <strong>{entered.length} counted</strong>
        <span style={{ color: '#6b7280', fontSize: 14 }}>of {visible.length} shown</span>
        <span style={{ flex: 1 }} />
        {entered.length ? <button type="button" onClick={clearAll} style={btn(false)}>Clear</button> : null}
        <button type="button" onClick={save} disabled={busy || !entered.length} style={{ ...btn(true), opacity: entered.length ? 1 : 0.5 }}>
          {busy ? 'Saving…' : `Save counts${entered.length ? ` (${entered.length})` : ''}`}
        </button>
        {message ? <div style={{ width: '100%', fontSize: 14, color: ok ? '#166534' : '#991b1b' }}>{message}</div> : null}
      </div>

      {groups.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280' }}>No items match.</div>
      ) : null}

      {groups.map((g) => (
        <section key={g.spot} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 8px' }}>
            {g.spot} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 14 }}>({g.list.length})</span>
          </h2>
          <div style={{ background: 'white', borderRadius: 12, padding: '4px 16px' }}>
            {g.list.map((i) => {
              const s = stockState(i)
              const v = counts[i.id] ?? ''
              const n = Number(v)
              const bad = v.trim() !== '' && (!Number.isFinite(n) || n < 0)
              const diff = v.trim() !== '' && !bad && s !== 'uncounted' ? n - Number(i.quantity_on_hand) : null
              return (
                <div key={i.id} className="count-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: categoryInfo(i.category).color, display: 'inline-block', marginRight: 6 }} />
                      {i.name}
                    </span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      {s === 'uncounted' ? 'Never counted' : `App says ${fmtQty(i.quantity_on_hand)} ${plural(i.unit, Number(i.quantity_on_hand))}`}
                      {diff !== null && diff !== 0 ? (
                        <strong style={{ marginLeft: 6, color: diff > 0 ? '#166534' : '#991b1b' }}>
                          ({diff > 0 ? '+' : ''}{fmtQty(diff)})
                        </strong>
                      ) : null}
                      {diff === 0 ? <span style={{ marginLeft: 6, color: '#166534' }}>matches</span> : null}
                    </span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <input
                      className="count-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={v}
                      aria-label={`Count for ${i.name}`}
                      onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value }))}
                      style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: `1px solid ${bad ? '#dc2626' : '#d1d5db'}`, fontSize: 16 }}
                    />
                    <span style={{ color: '#6b7280', minWidth: 60 }}>{plural(i.unit, 2)}</span>
                  </label>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
