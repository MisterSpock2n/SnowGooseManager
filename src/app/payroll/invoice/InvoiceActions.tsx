'use client'

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
  const downloadUrl =
    `/api/payroll/invoice-pdf?user=${encodeURIComponent(userId)}` +
    `&start=${encodeURIComponent(startDate)}` +
    `&end=${encodeURIComponent(endDate)}`

  return (
    <div className="flex flex-wrap gap-3">
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
    </div>
  )
}