'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import InvoiceFilePicker from '@/components/maintenance/InvoiceFilePicker'
import { notifyJon, todayLocal, uploadInvoiceFiles } from '@/lib/invoices'
import type { Assignee } from '@/lib/maintenance'

export type MafOption = { id: string; label: string; assignedTo: string; closed: boolean }

const OTHER = '__other__'
const fieldStyle = { display: 'grid', gap: 6 } as const
const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, background: 'white' } as const
const labelStyle = { fontWeight: 600, fontSize: 14 } as const
const optional = <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>

export default function NewInvoiceForm({
  vendors,
  mafs,
  presetMafId,
  loggedByName,
}: {
  vendors: Assignee[]
  mafs: MafOption[]
  presetMafId: string
  loggedByName: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const presetVendor = vendors.find((v) => v.id === mafs.find((m) => m.id === presetMafId)?.assignedTo)

  const [vendorChoice, setVendorChoice] = useState(presetVendor?.id ?? '')
  const [vendorName, setVendorName] = useState('')
  const [vendorPhone, setVendorPhone] = useState(presetVendor?.phone ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayLocal())
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')
  const [relatedMaf, setRelatedMaf] = useState(presetMafId)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function pickVendor(id: string) {
    setVendorChoice(id)
    const v = vendors.find((x) => x.id === id)
    if (v) {
      setVendorPhone(v.phone ?? '')
    } else {
      setVendorPhone('')
    }
  }

  function pickMaf(id: string) {
    setRelatedMaf(id)
    // If nothing picked yet, default the vendor to whoever the MAF is assigned to
    const m = mafs.find((x) => x.id === id)
    const v = vendors.find((x) => x.id === m?.assignedTo)
    if (v && !vendorChoice) pickVendor(v.id)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    const vendor = vendors.find((v) => v.id === vendorChoice)
    const name = vendor ? vendor.name : vendorName.trim()
    const amountNum = Number(amount)
    if (!name) return setMessage('Please choose who the invoice is from.')
    if (!vendorPhone.trim()) return setMessage('Please enter a phone number for the vendor.')
    if (!Number.isFinite(amountNum) || amountNum < 0) return setMessage('Please enter a valid amount.')
    if (!files.length) return setMessage('Please attach at least one photo or PDF of the invoice.')
    if (dueDate && dueDate < invoiceDate) return setMessage('The due date is before the invoice date.')

    setSaving(true)
    const { data, error } = await supabase
      .from('owner_invoices')
      .insert({
        vendor_id: vendor?.id ?? null,
        vendor_name: name,
        vendor_phone: vendorPhone.trim(),
        invoice_number: invoiceNumber.trim() || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        amount: Math.round(amountNum * 100) / 100,
        related_action_id: relatedMaf || null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single()

    if (error) {
      setSaving(false)
      setMessage(`Could not save the invoice: ${error.message}`)
      return
    }

    setMessage(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`)
    const { errors } = await uploadInvoiceFiles(supabase, data.id, files)
    if (errors.length) {
      // Hold the alert until the files are there; it can be sent from the invoice page
      router.push(`/maintenance/invoices/${data.id}?upload=failed`)
      router.refresh()
      return
    }

    setMessage('Uploading done. Emailing Jon…')
    const alert = await notifyJon(supabase, data.id)
    router.push(`/maintenance/invoices/${data.id}?created=1&alert=${alert.ok ? 'sent' : 'failed'}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18, background: 'white', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="vendor" style={labelStyle}>From (person / company)</label>
          <select id="vendor" value={vendorChoice} onChange={(e) => pickVendor(e.target.value)} required style={inputStyle}>
            <option value="" disabled>Who sent the bill?</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}{v.role_label ? ` — ${v.role_label}` : ''}</option>
            ))}
            <option value={OTHER}>Someone else…</option>
          </select>
          {vendorChoice === OTHER ? (
            <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor or company name" required aria-label="Vendor name" style={inputStyle} />
          ) : null}
        </div>
        <div style={fieldStyle}>
          <label htmlFor="phone" style={labelStyle}>Phone number</label>
          <input id="phone" type="tel" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="802-555-1234" required style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="amount" style={labelStyle}>Amount</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 11, color: '#6b7280' }}>$</span>
            <input id="amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ ...inputStyle, paddingLeft: 24, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={fieldStyle}>
          <label htmlFor="invoiceDate" style={labelStyle}>Invoice date</label>
          <input id="invoiceDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="dueDate" style={labelStyle}>Due date {optional}</label>
          <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="invoiceNumber" style={labelStyle}>Invoice # {optional}</label>
          <input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={fieldStyle}>
        <label htmlFor="relatedMaf" style={labelStyle}>Related MAF {optional}</label>
        <select id="relatedMaf" value={relatedMaf} onChange={(e) => pickMaf(e.target.value)} style={inputStyle}>
          <option value="">Not tied to a MAF</option>
          <optgroup label="Open MAFs">
            {mafs.filter((m) => !m.closed).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </optgroup>
          <optgroup label="Closed MAFs">
            {mafs.filter((m) => m.closed).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div style={fieldStyle}>
        <span style={labelStyle}>Invoice photos / PDF</span>
        <InvoiceFilePicker files={files} onChange={setFiles} />
      </div>

      <div style={fieldStyle}>
        <label htmlFor="notes" style={labelStyle}>Notes for Jon {optional}</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Anything Jon should know, e.g. what the work was, or if a check needs to go out by a certain day." style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />
      </div>

      <div style={{ fontSize: 14, color: '#6b7280' }}>Logged by {loggedByName}</div>

      {message ? (
        <div
          style={
            message.startsWith('Uploading')
              ? { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: '10px 14px', borderRadius: 8 }
              : { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8 }
          }
        >
          {message}
        </div>
      ) : null}

      <div>
        <button type="submit" disabled={saving} style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save invoice'}
        </button>
      </div>
    </form>
  )
}
