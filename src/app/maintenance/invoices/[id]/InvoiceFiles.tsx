'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import InvoiceFilePicker from '@/components/maintenance/InvoiceFilePicker'
import { INVOICE_BUCKET, uploadInvoiceFiles } from '@/lib/invoices'
import { formatDateTime } from '@/lib/maintenance'

export type InvoiceFileItem = {
  id: string
  storage_path: string
  content_type: string | null
  file_name: string | null
  uploaded_by: string
  uploaded_by_name: string | null
  created_at: string
  url: string | null
}

function isPdf(f: InvoiceFileItem) {
  return f.content_type === 'application/pdf' || f.storage_path.endsWith('.pdf')
}

export default function InvoiceFiles({
  invoiceId,
  files,
  canManage,
  currentUserId,
}: {
  invoiceId: string
  files: InvoiceFileItem[]
  canManage: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [picked, setPicked] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [viewing, setViewing] = useState<InvoiceFileItem | null>(null)

  async function handleUpload() {
    if (!picked.length) return
    setBusy(true)
    setMessage('')
    const { uploaded, errors } = await uploadInvoiceFiles(supabase, invoiceId, picked)
    setBusy(false)
    setPicked([])
    setMessage(errors.length ? `Uploaded ${uploaded}. Problems: ${errors.join('; ')}` : `Uploaded ${uploaded} file${uploaded === 1 ? '' : 's'}.`)
    router.refresh()
  }

  async function handleDelete(f: InvoiceFileItem) {
    if (!window.confirm('Delete this file from the invoice?')) return
    setBusy(true)
    const { error } = await supabase.from('owner_invoice_files').delete().eq('id', f.id)
    if (!error) await supabase.storage.from(INVOICE_BUCKET).remove([f.storage_path])
    setBusy(false)
    setViewing(null)
    setMessage(error ? `Could not delete: ${error.message}` : 'File deleted.')
    router.refresh()
  }

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, display: 'grid', gap: 16 }}>
      <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Invoice files</h2>
      {files.length === 0 ? <p style={{ margin: 0, color: '#991b1b' }}>No files attached yet. Please add a photo or PDF of the invoice.</p> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {files.map((f) =>
          isPdf(f) ? (
            <div key={f.id} style={{ width: 140, display: 'grid', gap: 6 }}>
              <a
                href={f.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                style={{ height: 140, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fef2f2', display: 'grid', placeItems: 'center', textDecoration: 'none', color: '#991b1b', fontWeight: 800, fontSize: 20 }}
              >
                PDF
              </a>
              <div style={{ fontSize: 12, color: '#374151', wordBreak: 'break-all' }}>{f.file_name ?? 'Invoice PDF'}</div>
              {canManage || f.uploaded_by === currentUserId ? (
                <button type="button" onClick={() => handleDelete(f)} disabled={busy} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: 'white', color: '#991b1b', cursor: 'pointer', width: 'fit-content' }}>
                  Delete
                </button>
              ) : null}
            </div>
          ) : (
            <button key={f.id} type="button" onClick={() => setViewing(f)} aria-label="View invoice image" style={{ padding: 0, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', cursor: 'zoom-in' }}>
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.file_name ?? 'Invoice image'} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              ) : (
                <div style={{ width: 140, height: 140, display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 12 }}>Unavailable</div>
              )}
            </button>
          )
        )}
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, display: 'grid', gap: 10 }}>
        <InvoiceFilePicker files={picked} onChange={setPicked} inputId="moreInvoiceFiles" />
        {picked.length ? (
          <div>
            <button type="button" onClick={handleUpload} disabled={busy} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Uploading…' : `Upload ${picked.length} file${picked.length === 1 ? '' : 's'}`}
            </button>
          </div>
        ) : null}
        {message ? <div style={{ fontSize: 14, color: '#374151' }}>{message}</div> : null}
      </div>

      {viewing ? (
        <div role="dialog" aria-modal="true" onClick={() => setViewing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', display: 'grid', gap: 10 }}>
            {viewing.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.url} alt="Full-size invoice" style={{ maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: 'white', fontSize: 14 }}>
              <span>{viewing.uploaded_by_name ?? 'Unknown'} · {formatDateTime(viewing.created_at)}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {viewing.url ? <a href={viewing.url} target="_blank" rel="noreferrer" style={{ color: 'white' }}>Open full size</a> : null}
                {canManage || viewing.uploaded_by === currentUserId ? (
                  <button type="button" onClick={() => handleDelete(viewing)} disabled={busy} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>Delete</button>
                ) : null}
                <button type="button" onClick={() => setViewing(null)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'white', color: '#0f172a', cursor: 'pointer' }}>Close</button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
