'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { fmtQty, plural, type TxnKind } from '@/lib/inventory'

const KIND_UI: Record<TxnKind, { label: string; verb: string; bg: string; fg: string; prompt: string }> = {
  received: { label: '+ Received', verb: 'Add', bg: '#16a34a', fg: 'white', prompt: 'How many came in?' },
  used: { label: '− Used', verb: 'Remove', bg: '#0f172a', fg: 'white', prompt: 'How many were used?' },
  count: { label: 'Count', verb: 'Set count', bg: 'white', fg: '#0f172a', prompt: 'How many are on hand now?' },
}

export default function StockActions({
  itemId,
  itemName,
  unit,
  onHand,
  compact = false,
}: {
  itemId: string
  itemName: string
  unit: string
  onHand: number
  compact?: boolean
}) {
  const router = useRouter()
  const [kind, setKind] = useState<TxnKind | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(true)

  function open(k: TxnKind) {
    setKind(k)
    setQty(k === 'count' ? fmtQty(onHand) : '1')
    setNote('')
    setMessage('')
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!kind) return
    const n = Number(qty)
    if (!Number.isFinite(n) || n < 0 || (kind !== 'count' && n <= 0)) {
      setOk(false)
      setMessage('Enter a number greater than zero.')
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert({ item_id: itemId, kind, quantity: Math.round(n * 100) / 100, note: note.trim() || null })
      .select('quantity_after')
      .single()
    setBusy(false)
    if (error) {
      setOk(false)
      setMessage(error.message)
      return
    }
    setOk(true)
    setMessage(`${itemName}: now ${fmtQty(data.quantity_after)} ${plural(unit, Number(data.quantity_after))}`)
    setKind(null)
    router.refresh()
  }

  const btn = (k: TxnKind) => {
    const u = KIND_UI[k]
    return (
      <button
        key={k}
        type="button"
        onClick={() => (kind === k ? setKind(null) : open(k))}
        style={{ padding: compact ? '5px 10px' : '8px 14px', borderRadius: 8, border: u.bg === 'white' ? '1px solid #d1d5db' : 'none', background: kind === k ? '#e2e8f0' : u.bg, color: kind === k ? '#0f172a' : u.fg, fontWeight: 700, fontSize: compact ? 13 : 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {u.label}
      </button>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: compact ? 'end' : 'start' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: compact ? 'flex-end' : 'flex-start' }}>
        {(['received', 'used', 'count'] as TxnKind[]).map(btn)}
      </div>
      {kind ? (
        <form onSubmit={submit} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            {KIND_UI[kind].prompt}{' '}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
              style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
            />{' '}
            <span style={{ fontWeight: 400, color: '#6b7280' }}>{plural(unit, Number(qty) || 0)}</span>
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" style={{ width: compact ? 140 : 220, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />
          <button type="submit" disabled={busy} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      ) : null}
      {message ? <span style={{ fontSize: 12, color: ok ? '#166534' : '#991b1b' }}>{message}</span> : null}
    </div>
  )
}
