'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PhotoPicker from '@/components/maintenance/PhotoPicker'
import { PHOTO_BUCKET, uploadMafPhotos } from '@/lib/photos'
import { formatDateTime } from '@/lib/maintenance'

export type PhotoItem = {
  id: string
  storage_path: string
  kind: 'before' | 'after'
  uploaded_by: string
  uploaded_by_name: string | null
  created_at: string
  url: string | null
}

export default function MafPhotos({
  actionId,
  photos,
  canManage,
  currentUserId,
  defaultKind,
}: {
  actionId: string
  photos: PhotoItem[]
  canManage: boolean
  currentUserId: string
  defaultKind: 'before' | 'after'
}) {
  const router = useRouter()
  const supabase = createClient()
  const [files, setFiles] = useState<File[]>([])
  const [kind, setKind] = useState<'before' | 'after'>(defaultKind)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [viewing, setViewing] = useState<PhotoItem | null>(null)

  async function handleUpload() {
    if (!files.length) return
    setBusy(true)
    setMessage('')
    const { uploaded, errors } = await uploadMafPhotos(supabase, actionId, files, kind)
    setBusy(false)
    setFiles([])
    setMessage(errors.length ? `Uploaded ${uploaded}. Problems: ${errors.join('; ')}` : `Uploaded ${uploaded} photo${uploaded === 1 ? '' : 's'}.`)
    router.refresh()
  }

  async function handleDelete(photo: PhotoItem) {
    if (!window.confirm('Delete this photo?')) return
    setBusy(true)
    const { error } = await supabase.from('maintenance_photos').delete().eq('id', photo.id)
    if (!error) await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
    setBusy(false)
    setViewing(null)
    setMessage(error ? `Could not delete: ${error.message}` : 'Photo deleted.')
    router.refresh()
  }

  const groups: { key: 'before' | 'after'; label: string }[] = [
    { key: 'before', label: 'Issue photos' },
    { key: 'after', label: 'Completed work photos' },
  ]

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, display: 'grid', gap: 16 }}>
      <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Photos</h2>

      {photos.length === 0 ? <p style={{ margin: 0, color: '#6b7280' }}>No photos yet.</p> : null}

      {groups.map((g) => {
        const list = photos.filter((p) => p.kind === g.key)
        if (!list.length) return null
        return (
          <div key={g.key} style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.label}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setViewing(p)}
                  style={{ padding: 0, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', cursor: 'zoom-in' }}
                  aria-label="View photo"
                >
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={`${g.label} uploaded by ${p.uploaded_by_name ?? 'unknown'}`} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  ) : (
                    <div style={{ width: 120, height: 120, display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 12 }}>Unavailable</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="photoKind" style={{ fontWeight: 600, fontSize: 14 }}>Add as</label>
          <select id="photoKind" value={kind} onChange={(e) => setKind(e.target.value as 'before' | 'after')} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}>
            <option value="before">Issue photo</option>
            <option value="after">Completed work photo</option>
          </select>
        </div>
        <PhotoPicker files={files} onChange={setFiles} inputId="detailPhotos" />
        {files.length ? (
          <div>
            <button type="button" onClick={handleUpload} disabled={busy} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Uploading…' : `Upload ${files.length} photo${files.length === 1 ? '' : 's'}`}
            </button>
          </div>
        ) : null}
        {message ? <div style={{ fontSize: 14, color: '#374151' }}>{message}</div> : null}
      </div>

      {viewing ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', display: 'grid', gap: 10 }}>
            {viewing.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.url} alt="Full-size MAF photo" style={{ maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, color: 'white', fontSize: 14 }}>
              <span>
                {viewing.uploaded_by_name ?? 'Unknown'} · {formatDateTime(viewing.created_at)}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {viewing.url ? (
                  <a href={viewing.url} target="_blank" rel="noreferrer" style={{ color: 'white' }}>Open full size</a>
                ) : null}
                {canManage || viewing.uploaded_by === currentUserId ? (
                  <button type="button" onClick={() => handleDelete(viewing)} disabled={busy} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>
                    Delete
                  </button>
                ) : null}
                <button type="button" onClick={() => setViewing(null)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'white', color: '#0f172a', cursor: 'pointer' }}>
                  Close
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
