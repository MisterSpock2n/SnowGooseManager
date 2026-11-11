'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import ItemForm from '@/components/inventory/ItemForm'
import type { InventoryItem } from '@/lib/inventory'

const btn = (fg: string) => ({ padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: fg, fontWeight: 700, cursor: 'pointer' }) as const

export default function ItemManage({ item, canDelete, hasHistory }: { item: InventoryItem; canDelete: boolean; hasHistory: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function setActive(active: boolean) {
    setBusy(true)
    const { error } = await createClient().from('inventory_items').update({ active }).eq('id', item.id)
    setBusy(false)
    if (error) return setMessage(error.message)
    router.refresh()
  }

  async function remove() {
    if (!window.confirm(`Delete ${item.name}${hasHistory ? ' and its stock history' : ''}? Archiving keeps the history instead.`)) return
    setBusy(true)
    const { error } = await createClient().from('inventory_items').delete().eq('id', item.id)
    if (error) {
      setBusy(false)
      return setMessage(error.message)
    }
    router.push('/inventory')
    router.refresh()
  }

  if (editing) return <ItemForm item={item} onDone={() => setEditing(false)} />

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setEditing(true)} style={btn('#0f172a')}>Edit item</button>
        {item.active ? (
          <button type="button" disabled={busy} onClick={() => setActive(false)} style={btn('#4b5563')}>Archive (no longer stocked)</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => setActive(true)} style={btn('#166534')}>Restore item</button>
        )}
        {canDelete ? <button type="button" disabled={busy} onClick={remove} style={btn('#991b1b')}>Delete</button> : null}
      </div>
      {message ? <div style={{ color: '#991b1b', fontSize: 14 }}>{message}</div> : null}
    </div>
  )
}
