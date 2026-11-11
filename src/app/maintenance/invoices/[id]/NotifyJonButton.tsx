'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { notifyJon } from '@/lib/invoices'

export default function NotifyJonButton({
  invoiceId,
  status,
  canManage,
  hasFiles,
}: {
  invoiceId: string
  status: 'pending' | 'sent' | 'failed'
  canManage: boolean
  hasFiles: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(true)

  // After a successful alert, only managers can send it again
  if (status === 'sent' && !canManage) return null

  const label = status === 'sent' ? 'Send alert again' : status === 'failed' ? 'Resend alert' : 'Send alert to Jon'

  async function send() {
    if (status === 'sent' && !window.confirm('Jon was already emailed about this invoice. Send another alert?')) return
    if (!hasFiles && !window.confirm('No invoice files are attached yet. Send the alert anyway?')) return
    setBusy(true)
    setMessage('')
    const result = await notifyJon(createClient(), invoiceId, status === 'sent')
    setBusy(false)
    setOk(result.ok)
    setMessage(result.message)
    router.refresh()
  }

  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        style={{ width: 'fit-content', padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: status === 'sent' ? 'white' : '#0f172a', color: status === 'sent' ? '#0f172a' : 'white', fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer' }}
      >
        {busy ? 'Sending…' : label}
      </button>
      {message ? <span style={{ fontSize: 13, color: ok ? '#166534' : '#991b1b' }}>{message}</span> : null}
    </div>
  )
}
