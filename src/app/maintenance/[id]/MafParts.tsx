'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { CATEGORIES, fmtQty, plural, stockState, type InventoryCategory } from '@/lib/inventory'
import { formatDateTime } from '@/lib/maintenance'

export type PartItem = {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  quantity_on_hand: number
  reorder_level: number
  last_counted_at: string | null
}

export type PartTxn = {
  id: string
  item_id: string
  kind: 'received' | 'used' | 'count'
  quantity: number
  note: string | null
  created_by_name: string | null
  created_at: string
  inventory_items: { name: string; unit: string } | { name: string; unit: string }[] | null
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default function MafParts({
  actionId,
  mafNumber,
  items,
  txns,
  canLog,
}: {
  actionId: string
  mafNumber: string
  items: PartItem[]
  txns: PartTxn[]
  canLog: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(true)

  // Net amount used per item on this MAF (used minus anything put back)
  const summary = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; unit: string; net: number }>()
    for (const t of txns) {
      const info = one(t.inventory_items)
      const row = map.get(t.item_id) ?? { itemId: t.item_id, name: info?.name ?? 'Item', unit: info?.unit ?? 'each', net: 0 }
      if (t.kind === 'used') row.net += Number(t.quantity)
      if (t.kind === 'received') row.net -= Number(t.quantity)
      map.set(t.item_id, row)
    }
    return Array.from(map.values()).filter((r) => r.net > 0)
  }, [txns])

  const selected = items.find((i) => i.id === itemId)

  async function insert(payload: { item_id: string; kind: 'used' | 'received'; quantity: number; note: string }, key: string) {
    setBusy(key)
    setMessage('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert({ ...payload, related_action_id: actionId })
      .select('quantity_after')
      .single()
    setBusy(null)
    if (error) {
      setOk(false)
      setMessage(error.message)
      return null
    }
    return data
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = Number(qty)
    if (!selected) {
      setOk(false)
      setMessage('Pick the part that was used.')
      return
    }
    if (!Number.isFinite(n) || n <= 0) {
      setOk(false)
      setMessage('Enter an amount greater than zero.')
      return
    }
    const data = await insert(
      { item_id: selected.id, kind: 'used', quantity: Math.round(n * 100) / 100, note: note.trim() ? `${mafNumber}: ${note.trim()}` : `Used on ${mafNumber}` },
      'add'
    )
    if (!data) return
    setOk(true)
    setMessage(`Logged ${fmtQty(n)} ${plural(selected.unit, n)} of ${selected.name}. ${fmtQty(data.quantity_after)} left in stock.`)
    setItemId('')
    setQty('1')
    setNote('')
    setOpen(false)
    router.refresh()
  }

  async function putBack(row: { itemId: string; name: string; unit: string; net: number }) {
    const answer = window.prompt(`How many ${plural(row.unit, 2)} of ${row.name} are going back on the shelf?`, fmtQty(row.net))
    if (answer === null) return
    const n = Number(answer)
    if (!Number.isFinite(n) || n <= 0 || n > row.net) {
      setOk(false)
      setMessage(`Enter an amount between 0 and ${fmtQty(row.net)}.`)
      return
    }
    const data = await insert({ item_id: row.itemId, kind: 'received', quantity: Math.round(n * 100) / 100, note: `Put back from ${mafNumber}` }, row.itemId)
    if (!data) return
    setOk(true)
    setMessage(`Put back ${fmtQty(n)} ${plural(row.unit, n)} of ${row.name}.`)
    router.refresh()
  }

  const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, background: 'var(--panel)' } as const
  // Maintenance supplies first, since that's what most MAFs use
  const order: InventoryCategory[] = ['maintenance', 'cleaning', 'guest_room', 'breakfast_food']

  return (
    <div style={{ background: 'var(--panel)', borderRadius: 12, padding: 20, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Parts used</h2>
        {canLog ? (
          <button type="button" onClick={() => { setOpen(!open); setMessage('') }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: open ? 'var(--line)' : 'var(--panel)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            {open ? 'Cancel' : '+ Log a part used'}
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="Part" style={{ ...input, minWidth: 240, flex: 1 }} autoFocus>
            <option value="">Pick a part from inventory…</option>
            {order.map((c) => {
              const list = items.filter((i) => i.category === c)
              if (!list.length) return null
              return (
                <optgroup key={c} label={CATEGORIES.find((x) => x.value === c)?.label}>
                  {list.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({stockState(i) === 'uncounted' ? 'not counted yet' : `${fmtQty(i.quantity_on_hand)} on hand`})
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            Amount
            <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} style={{ ...input, width: 80 }} />
            <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{selected ? plural(selected.unit, Number(qty) || 0) : ''}</span>
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" style={{ ...input, width: 200 }} />
          <button type="submit" disabled={busy === 'add'} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 700, cursor: 'pointer' }}>
            {busy === 'add' ? 'Saving…' : 'Log part'}
          </button>
          <div style={{ width: '100%', fontSize: 12, color: 'var(--muted)' }}>
            This takes the amount out of inventory. Not listed? <Link href="/inventory/new">Add it to inventory</Link> first.
          </div>
        </form>
      ) : null}

      {message ? <div style={{ fontSize: 13, color: ok ? 'var(--ok)' : 'var(--bad)' }}>{message}</div> : null}

      {summary.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--muted)' }}>No parts logged for this MAF.</p>
      ) : (
        <div>
          {summary.map((r) => (
            <div key={r.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <span>
                <strong>{fmtQty(r.net)} {plural(r.unit, r.net)}</strong> · <Link href={`/inventory/${r.itemId}`}>{r.name}</Link>
              </span>
              {canLog ? (
                <button type="button" onClick={() => putBack(r)} disabled={busy === r.itemId} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 13, cursor: 'pointer' }}>
                  {busy === r.itemId ? 'Saving…' : 'Put back'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {txns.length ? (
        <details style={{ fontSize: 13, color: 'var(--muted)' }}>
          <summary style={{ cursor: 'pointer' }}>Parts log ({txns.length})</summary>
          {txns.map((t) => {
            const info = one(t.inventory_items)
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <span>
                  {t.kind === 'used' ? 'Used' : 'Put back'} {fmtQty(t.quantity)} {plural(info?.unit ?? 'each', Number(t.quantity))} {info?.name ?? ''}
                  {t.created_by_name ? <span style={{ color: 'var(--muted)' }}> · by {t.created_by_name}</span> : null}
                </span>
                <span style={{ color: 'var(--muted)' }}>{formatDateTime(t.created_at)}</span>
              </div>
            )
          })}
        </details>
      ) : null}
    </div>
  )
}
