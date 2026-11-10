'use client'

import { useEffect, useMemo } from 'react'

export default function PhotoPicker({
  files,
  onChange,
  inputId = 'photos',
}: {
  files: File[]
  onChange: (files: File[]) => void
  inputId?: string
}) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])

  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

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
        + Add photos
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length) onChange([...files, ...picked].slice(0, 10))
          e.target.value = ''
        }}
      />
      {files.length ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {previews.map((src, i) => (
            <div key={src} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={files[i]?.name ?? 'Selected photo'} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <button
                type="button"
                aria-label={`Remove ${files[i]?.name ?? 'photo'}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                style={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: 'none',
                  background: '#0f172a',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 700,
                  lineHeight: '24px',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 13, color: '#6b7280' }}>Up to 10 photos. Large phone photos are shrunk automatically.</span>
      )}
    </div>
  )
}
