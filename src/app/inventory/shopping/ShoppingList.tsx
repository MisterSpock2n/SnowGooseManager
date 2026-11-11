'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import StockActions from '@/components/inventory/StockActions'
import { CATEGORIES, categoryInfo, fmtQty, plural, type InventoryCategory } from '@/lib/inventory'

export type ShoppingItem = {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  onHand: number
  reorderLevel: number
  buy: number
  vendor: string | null
  url: string | null
  storage: string | null
  out: boolean
}

const STORAGE_KEY = 'snowgoose.shopping.checked'
const NO_STORE = 'No store set'

export default function ShoppingList({ items, canSendEmail, emailInfo }: { items: ShoppingItem[]; canSendEmail: boolean; emailInfo: string }) {
  const [groupBy, setGroupBy] = useState<'store' | 'category'>('store')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Remember ticked items on this device while shopping
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
      const ids = new Set(items.map((i) => i.id))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecked(new Set(saved.filter((id) => ids.has(id))))
    } catch {
      // ignore bad saved data
    }
  }, [items])

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  function clearChecks() {
    setChecked(new Set())
    localStorage.removeItem(STORAGE_KEY)
  }

  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    for (const i of items) {
      const key = groupBy === 'store' ? i.vendor?.trim() || NO_STORE : i.category
      map.set(key, [...(map.get(key) ?? []), i])
    }
    const keys = Array.from(map.keys())
    if (groupBy === 'store') keys.sort((a, b) => (a === NO_STORE ? 1 : b === NO_STORE ? -1 : a.localeCompare(b)))
    else keys.sort((a, b) => CATEGORIES.findIndex((c) => c.value === a) - CATEGORIES.findIndex((c) => c.value === b))
    return keys.map((k) => ({ key: k, label: groupBy === 'store' ? k : categoryInfo(k).label, items: map.get(k)! }))
  }, [items, groupBy])

  async function copyList() {
    const text = groups
      .map((g) => [g.label, ...g.items.map((i) => `- ${i.name}: buy ${fmtQty(i.buy)} ${plural(i.unit, i.buy)} (${fmtQty(i.onHand)} left)`)].join('\n'))
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(`Snow Goose shopping list\n\n${text}`)
      setMessage('Copied. Paste it into a text or note.')
    } catch {
      setMessage('Could not copy on this device.')
    }
  }

  async function sendEmail() {
    if (!window.confirm('Email the current low-stock list now?')) return
    setSending(true)
    setMessage('')
    const { data, error } = await createClient().functions.invoke('notify-low-stock', { body: { trigger: 'manual' } })
    setSending(false)
    if (error) {
      let detail = error.message
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        try {
          const b = await ctx.json()
          detail = [b?.error, b?.detail].filter(Boolean).join(' — ') || detail
        } catch {
          // keep generic
        }
      }
      return setMessage(`Could not send: ${detail}`)
    }
    setMessage(data?.sent ? 'Low-stock email sent.' : data?.reason ?? 'Nothing to send.')
  }

  const btn = { padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#0f172a', fontWeight: 700, fontSize: 14, cursor: 'pointer' } as const
  const outCount = items.filter((i) => i.out).length

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style>{`@media print { .no-print { display: none !important; } aside { display: none !important; } main { padding: 0 !important; } }`}</style>

      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: 12, borderRadius: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Group by</span>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'store' | 'category')} aria-label="Group by" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' }}>
          <option value="store">Where to buy</option>
          <option value="category">Category</option>
        </select>
        <button type="button" onClick={() => window.print()} style={btn}>Print</button>
        <button type="button" onClick={copyList} disabled={!items.length} style={btn}>Copy list</button>
        {checked.size ? <button type="button" onClick={clearChecks} style={btn}>Clear {checked.size} tick{checked.size === 1 ? '' : 's'}</button> : null}
        {canSendEmail ? (
          <button type="button" onClick={sendEmail} disabled={sending || !items.length} style={{ ...btn, background: '#0f172a', color: 'white', border: 'none' }}>
            {sending ? 'Sending…' : 'Email list now'}
          </button>
        ) : null}
        {message ? <span style={{ fontSize: 13, color: '#374151' }}>{message}</span> : null}
      </div>
      <div className="no-print" style={{ fontSize: 13, color: '#6b7280' }}>{emailInfo}</div>

      <div style={{ fontSize: 15 }}>
        <strong>{items.length}</strong> item{items.length === 1 ? '' : 's'} to buy{outCount ? <> · <strong style={{ color: '#991b1b' }}>{outCount} out of stock</strong></> : null}
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280' }}>Nothing is low right now.</div>
      ) : null}

      {groups.map((g) => (
        <section key={g.key} style={{ background: 'white', borderRadius: 12, padding: '12px 18px', breakInside: 'avoid' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '4px 0 8px' }}>
            {g.label} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 14 }}>({g.items.length})</span>
          </h2>
          {g.items.map((i) => {
            const done = checked.has(i.id)
            return (
              <div key={i.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                <input type="checkbox" checked={done} onChange={() => toggle(i.id)} aria-label={`Got ${i.name}`} style={{ width: 20, height: 20 }} />
                <div style={{ opacity: done ? 0.5 : 1, textDecoration: done ? 'line-through' : 'none' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href={`/inventory/${i.id}`} style={{ fontWeight: 700, color: '#0f172a' }}>{i.name}</Link>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: i.out ? '#fee2e2' : '#ffedd5', color: i.out ? '#991b1b' : '#9a3412' }}>{i.out ? 'Out' : 'Low'}</span>
                    {i.url ? <a className="no-print" href={i.url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Reorder link</a> : null}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {fmtQty(i.onHand)} {plural(i.unit, i.onHand)} left · low at {fmtQty(i.reorderLevel)}
                    {groupBy === 'store' ? ` · ${categoryInfo(i.category).label}` : i.vendor ? ` · ${i.vendor}` : ''}
                    {i.storage ? ` · ${i.storage}` : ''}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                  <strong style={{ whiteSpace: 'nowrap' }}>Buy {fmtQty(i.buy)} {plural(i.unit, i.buy)}</strong>
                  <div className="no-print">
                    <StockActions itemId={i.id} itemName={i.name} unit={i.unit} onHand={i.onHand} compact />
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
