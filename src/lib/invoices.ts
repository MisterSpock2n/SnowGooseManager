import type { SupabaseClient } from '@supabase/supabase-js'
import { resizeImage } from '@/lib/photos'

export const INVOICE_BUCKET = 'owner-invoices'

export type InvoiceStatus = 'new' | 'seen' | 'paid' | 'disputed'

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string; bg: string; fg: string }[] = [
  { value: 'new', label: 'New', bg: '#dbeafe', fg: '#1e3a8a' },
  { value: 'seen', label: 'Seen by Jon', bg: '#fef3c7', fg: '#92400e' },
  { value: 'paid', label: 'Paid', bg: '#dcfce7', fg: '#166534' },
  { value: 'disputed', label: 'Disputed', bg: '#fee2e2', fg: '#991b1b' },
]

export function invoiceStatusInfo(s: string) {
  return INVOICE_STATUSES.find((x) => x.value === s) ?? INVOICE_STATUSES[0]
}

export const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatDate(value: string | null) {
  if (!value) return '—'
  // Plain dates (YYYY-MM-DD) are shown as-is, without timezone shifting
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function todayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function isPastDue(dueDate: string | null, status: string) {
  if (!dueDate || status === 'paid') return false
  return dueDate < todayLocal()
}

export const ACCEPTED_INVOICE_FILES = 'image/*,application/pdf'
export const MAX_INVOICE_FILES = 10

export async function uploadInvoiceFiles(
  supabase: SupabaseClient,
  invoiceId: string,
  files: File[]
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = []
  let uploaded = 0
  for (const file of files) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const { blob, ext, type } = isPdf ? { blob: file as Blob, ext: 'pdf', type: 'application/pdf' } : await resizeImage(file)
    const path = `${invoiceId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(INVOICE_BUCKET).upload(path, blob, { contentType: type, upsert: false })
    if (upErr) {
      errors.push(`${file.name}: ${upErr.message}`)
      continue
    }
    const { error: rowErr } = await supabase
      .from('owner_invoice_files')
      .insert({ invoice_id: invoiceId, storage_path: path, content_type: type, file_name: file.name })
    if (rowErr) {
      await supabase.storage.from(INVOICE_BUCKET).remove([path])
      errors.push(`${file.name}: ${rowErr.message}`)
      continue
    }
    uploaded++
  }
  return { uploaded, errors }
}
