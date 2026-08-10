'use client'

export default function InvoiceActions() {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex rounded-md bg-black px-4 py-2 text-sm text-white"
      >
        Download PDF
      </button>
    </div>
  )
}