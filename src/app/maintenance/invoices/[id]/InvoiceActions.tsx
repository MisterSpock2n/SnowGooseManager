'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { INVOICE_BUCKET, type InvoiceStatus } from '@/lib/invoices'
import type { InvoiceDetail } from './page'

const inputStyle = { padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, background: 'white' } as const
const labelStyle = { fontWeight: 600, fontSize: 14 } as const
const btn = (bg: string, fg = 'white') =>
  ({ padding: '10px 16px', borderRadius: 8, border: bg === 'white' ? '1px solid #d1d5db' : 'none', background: bg, color: fg, fontWeight: 700, cursor: 'pointer' }) as const

export default function InvoiceActions({ invoice, canManage }: { invoice: InvoiceDetail; canManage: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [paying, setPaying] = useState(false)
  const [paidNote, setPaidNote] = useState('')
  const [editing, setEditing] = useState(false)

  const [phone, setPhone] = useState(invoice.vendor_phone)
  const [amount, setAmount] = useState(String(invoice.amount))
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number ?? '')
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date)
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '')
  const [notes, setNotes] = useState(invoice.notes ?? '')

  async function setStatus(status: InvoiceStatus, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('owner_invoices').update({ status, ...extra }).eq('id', invoice.id)
    setBusy(false)
    if (error) return setMessage(`Could not update: ${error.message}`)
    setPaying(false)
    router.refresh()
  }

  async function saveEdits(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const amountNum = Number(amount)
    if (!phone.trim()) return setMessage('Phone number is required.')
    if (!Number.isFinite(amountNum) || amountNum < 0) return setMessage('Please enter a valid amount.')
    if (dueDate && dueDate < invoiceDate) return setMessage('The due date is before the invoice date.')
    setBusy(true)
    setMessage('')
    const { error } = await supabase
      .from('owner_invoices')
      .update({
        vendor_phone: phone.trim(),
        amount: Math.round(amountNum * 100) / 100,
        invoice_number: invoiceNumber.trim() || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      })
      .eq('id', invoice.id)
    setBusy(false)
    if (error) return setMessage(`Could not save: ${error.message}`)
    setEditing(false)
    router.refresh()
  }

  async function deleteInvoice() {
    if (!window.confirm(`Delete this ${invoice.vendor_name} invoice and its files? This can't be undone.`)) return
    setBusy(true)
    const { data: files } = await supabase.from('owner_invoice_files').select('storage_path').eq('invoice_id', invoice.id)
    const { error } = await supabase.from('owner_invoices').delete().eq('id', invoice.id)
    if (error) {
      setBusy(false)
      return setMessage(`Could not delete: ${error.message}`)
    }
    const paths = ((files as { storage_path: string }[] | null) ?? []).map((f) => f.storage_path)
    if (paths.length) await supabase.storage.from(INVOICE_BUCKET).remove(paths)
    router.push('/maintenance/invoices')
    router.refresh()
  }

  const s = invoice.status

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, display: 'grid', gap: 16 }}>
      <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Actions</h2>

      {canManage ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {s === 'new' ? <button type="button" disabled={busy} onClick={() => setStatus('seen')} style={btn('#f59e0b', '#1f1f1f')}>Mark seen</button> : null}
            {s !== 'paid' ? <button type="button" disabled={busy} onClick={() => setPaying(true)} style={btn('#16a34a')}>Mark paid</button> : null}
            {s === 'new' || s === 'seen' ? <button type="button" disabled={busy} onClick={() => setStatus('disputed')} style={btn('white', '#991b1b')}>Dispute</button> : null}
            {s === 'disputed' ? <button type="button" disabled={busy} onClick={() => setStatus('seen')} style={btn('white', '#0f172a')}>Resolve dispute</button> : null}
            {s === 'paid' ? <button type="button" disabled={busy} onClick={() => setStatus('seen')} style={btn('white', '#0f172a')}>Undo paid</button> : null}
          </div>
          {paying ? (
            <div style={{ display: 'grid', gap: 8, background: '#f0fdf4', borderRadius: 8, padding: 12 }}>
              <label htmlFor="paidNote" style={labelStyle}>Payment note <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional, e.g. check # or card)</span></label>
              <input id="paidNote" value={paidNote} onChange={(e) => setPaidNote(e.target.value)} style={inputStyle} placeholder="Check #1042" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => setStatus('paid', { paid_note: paidNote.trim() || null })} style={btn('#16a34a')}>Confirm paid</button>
                <button type="button" onClick={() => setPaying(false)} style={btn('white', '#0f172a')}>Cancel</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>Nick, Rhiannon or Jon can mark this invoice seen, paid or disputed.</p>
      )}

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
        {!editing ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setEditing(true)} style={btn('white', '#0f172a')}>Edit details</button>
            {canManage ? <button type="button" disabled={busy} onClick={deleteInvoice} style={btn('white', '#991b1b')}>Delete invoice</button> : null}
          </div>
        ) : (
          <form onSubmit={saveEdits} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} required /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>Amount</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} required /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>Invoice #</span><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={inputStyle} /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>Invoice date</span><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={inputStyle} required /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>Due date</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></label>
            </div>
            <label style={{ display: 'grid', gap: 6 }}><span style={labelStyle}>Notes for Jon</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={busy} style={btn('#0f172a')}>{busy ? 'Saving…' : 'Save changes'}</button>
              <button type="button" onClick={() => setEditing(false)} style={btn('white', '#0f172a')}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {message ? <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8 }}>{message}</div> : null}
    </div>
  )
}
