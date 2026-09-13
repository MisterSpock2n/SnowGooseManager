'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

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

  const downloadUrl =
    `/api/payroll/invoice-pdf?user=${encodeURIComponent(userId)}` +
    `&start=${encodeURIComponent(startDate)}` +
    `&end=${encodeURIComponent(endDate)}`

  async function handleEmailPdf() {
    const confirmed = window.confirm(
      'Email this payroll invoice to info@snowgooseinn.com?'
    )

    if (!confirmed) return

    setSending(true)
    setMessage('')

    const supabase = createClient()

    const { data, error } = await supabase.functions.invoke(
      'send-payroll-invoice',
      {
        body: {
          userId,
          startDate,
          endDate,
        },
      }
    )

    if (error) {
      setMessage(`Could not send invoice: ${error.message}`)
      setSending(false)
      return
    }

    if (!data?.success) {
      setMessage(data?.error ?? 'Could not send invoice.')
      setSending(false)
      return
    }

    setMessage('Invoice emailed to info@snowgooseinn.com.')
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
        <p className="w-full text-sm text-gray-600">{message}</p>
      ) : null}
    </div>
  )
}