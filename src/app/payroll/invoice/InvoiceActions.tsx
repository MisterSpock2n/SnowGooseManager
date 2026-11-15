'use client'

import { useState } from 'react'

type InvoiceActionsProps = {
  userId: string
  startDate: string
  endDate: string
}

export default function InvoiceActions({
  userId,
  startDate,
  endDate,
}: InvoiceActionsProps) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [ok, setOk] = useState(true)

  const downloadUrl =
    `/api/payroll/invoice-pdf?user=${encodeURIComponent(userId)}` +
    `&start=${encodeURIComponent(startDate)}` +
    `&end=${encodeURIComponent(endDate)}`

  async function handleEmailPdf() {
    const confirmed = window.confirm('Email this payroll invoice to info@snowgooseinn.com?')
    if (!confirmed) return

    setSending(true)
    setMessage('')
    setOk(true)

    try {
      const res = await fetch('/api/payroll/invoice-pdf/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, startDate, endDate }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        setOk(false)
        setMessage(`Not sent: ${data?.error ?? `the server returned ${res.status}`}. You can still use Download PDF and email it yourself.`)
      } else {
        setMessage(`Invoice emailed to ${data.sentTo ?? 'info@snowgooseinn.com'}.`)
      }
    } catch {
      setOk(false)
      setMessage('Not sent: could not reach the server. Check the connection and try again.')
    }
    setSending(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex rounded-md border px-4 py-2 text-sm"
      >
        Print / Save as PDF
      </button>

      <a
        href={downloadUrl}
        className="inline-flex rounded-md bg-black px-4 py-2 text-sm text-white"
      >
        Download PDF
      </a>

      <button
        type="button"
        onClick={handleEmailPdf}
        disabled={sending}
        className="inline-flex rounded-md border border-blue-700 px-4 py-2 text-sm text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Email PDF'}
      </button>

      {message ? (
        <p className={`w-full text-sm ${ok ? 'text-green-700' : 'text-red-700'}`}>{message}</p>
      ) : null}
    </div>
  )
}