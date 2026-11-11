'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { CATEGORIES, COMMON_UNITS, STORAGE_SUGGESTIONS, type InventoryCategory, type InventoryItem } from '@/lib/inventory'

const fieldStyle = { display: 'grid', gap: 6 } as const
const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, background: 'white' } as const
const labelStyle = { fontWeight: 600, fontSize: 14 } as const
const optional = <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>

export default function ItemForm({ item, onDone }: { item?: InventoryItem; onDone?: () => void }) {
  const router = useRouter()
  const isEdit = Boolean(item)
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<InventoryCategory | ''>(item?.category ?? '')
  const [unit, setUnit] = useState(item?.unit ?? 'each')
  const [startQty, setStartQty] = useState('')
  const [reorderLevel, setReorderLevel] = useState(item ? String(item.reorder_level) : '')
  const [reorderQty, setReorderQty] = useState(item?.reorder_quantity != null ? String(item.reorder_quantity) : '')
  const [storage, setStorage] = useState(item?.storage_location ?? '')
  const [vendor, setVendor] = useState(item?.vendor ?? '')
  const [url, setUrl] = useState(item?.reorder_url ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')
    if (!category) return setMessage('Please choose a category.')
    const level = reorderLevel === '' ? 0 : Number(reorderLevel)
    const rq = reorderQty === '' ? null : Number(reorderQty)
    const sq = startQty === '' ? null : Number(startQty)
    if (!Number.isFinite(level) || level < 0) return setMessage('Low-stock level must be zero or more.')
    if (rq !== null && (!Number.isFinite(rq) || rq <= 0)) return setMessage('Usual order amount must be more than zero.')
    if (sq !== null && (!Number.isFinite(sq) || sq < 0)) return setMessage('Starting count must be zero or more.')
    let cleanUrl = url.trim()
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`

    const fields = {
      name: name.trim(),
      category,
      unit: unit.trim() || 'each',
      reorder_level: level,
      reorder_quantity: rq,
      storage_location: storage.trim() || null,
      vendor: vendor.trim() || null,
      reorder_url: cleanUrl || null,
      notes: notes.trim() || null,
    }

    setSaving(true)
    const supabase = createClient()
    if (isEdit && item) {
      const { error } = await supabase.from('inventory_items').update(fields).eq('id', item.id)
      setSaving(false)
      if (error) return setMessage(error.message.includes('duplicate') ? 'Another item in this category already has that name.' : `Could not save: ${error.message}`)
      onDone?.()
      router.refresh()
      return
    }

    const { data, error } = await supabase.from('inventory_items').insert(fields).select('id').single()
    if (error) {
      setSaving(false)
      return setMessage(error.message.includes('duplicate') ? 'An item with that name already exists in this category.' : `Could not add item: ${error.message}`)
    }
    if (sq !== null) {
      await supabase.from('inventory_transactions').insert({ item_id: data.id, kind: 'count', quantity: Math.round(sq * 100) / 100, note: 'Starting count' })
    }
    router.push(`/inventory?added=${encodeURIComponent(fields.name)}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, background: 'white', borderRadius: 12, padding: 24 }}>
      <datalist id="unitOptions">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="storageOptions">
        {STORAGE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="itemName" style={labelStyle}>Item name</label>
          <input id="itemName" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. LED bulbs (A19)" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="category" style={labelStyle}>Category</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)} required style={inputStyle}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="unit" style={labelStyle}>Counted in</label>
          <input id="unit" list="unitOptions" value={unit} onChange={(e) => setUnit(e.target.value)} required placeholder="each, box, case…" style={inputStyle} />
        </div>
        {!isEdit ? (
          <div style={fieldStyle}>
            <label htmlFor="startQty" style={labelStyle}>On hand now {optional}</label>
            <input id="startQty" type="number" inputMode="decimal" min="0" step="any" value={startQty} onChange={(e) => setStartQty(e.target.value)} style={inputStyle} />
          </div>
        ) : null}
        <div style={fieldStyle}>
          <label htmlFor="reorderLevel" style={labelStyle}>Low-stock level</label>
          <input id="reorderLevel" type="number" inputMode="decimal" min="0" step="any" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="0 = never flag" style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="reorderQty" style={labelStyle}>Usual order amount {optional}</label>
          <input id="reorderQty" type="number" inputMode="decimal" min="0" step="any" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="storage" style={labelStyle}>Storage spot {optional}</label>
          <input id="storage" list="storageOptions" value={storage} onChange={(e) => setStorage(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="vendor" style={labelStyle}>Where to buy {optional}</label>
          <input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Costco, Home Depot, Amazon" style={inputStyle} />
        </div>
      </div>

      <div style={fieldStyle}>
        <label htmlFor="reorderUrl" style={labelStyle}>Reorder link {optional}</label>
        <input id="reorderUrl" type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste the product page" style={inputStyle} />
      </div>

      <div style={fieldStyle}>
        <label htmlFor="itemNotes" style={labelStyle}>Notes {optional}</label>
        <textarea id="itemNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Brand, size, part number…" style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />
      </div>

      {message ? <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8 }}>{message}</div> : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving} style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
        </button>
        {isEdit ? (
          <button type="button" onClick={onDone} style={{ padding: '12px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
