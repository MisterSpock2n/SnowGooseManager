'use client'

import { useEffect, useMemo } from 'react'
import { ACCEPTED_INVOICE_FILES, MAX_INVOICE_FILES } from '@/lib/invoices'

function isPdf(f: File) {
  return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
}

export default function InvoiceFilePicker({
  files,
  onChange,
  inputId = 'invoiceFiles',
}: {
  files: File[]
  onChange: (files: File[]) => void
  inputId?: string
}) {
  const previews = useMemo(() => files.map((f) => (isPdf(f) ? null : URL.createObjectURL(f))), [files])

  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews])

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          width: 'fit-content',
          padding: '9px 14px',
          borderRadius: 8,
          border: '1px dashed #94a3b8',
          background: '#f8fafc',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        + Add invoice photo or PDF
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_INVOICE_FILES}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length) onChange([...files, ...picked].slice(0, MAX_INVOICE_FILES))
          e.target.value = ''
        }}
      />
      {files.length ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} style={{ position: 'relative' }}>
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i] as string} alt={f.name} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              ) : (
                <div
                  title={f.name}
                  style={{ width: 96, height: 96, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fef2f2', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 6, fontSize: 11, color: '#991b1b', overflow: 'hidden' }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>PDF</div>
                    <div style={{ wordBreak: 'break-all' }}>{f.name.slice(0, 28)}</div>
                  </div>
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 999, border: 'none', background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 700, lineHeight: '24px' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 13, color: '#6b7280' }}>Snap a photo of the paper invoice or attach the PDF. Up to {MAX_INVOICE_FILES} files.</span>
      )}
    </div>
  )
}
