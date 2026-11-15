import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import InvoicePdfDocument from '@/app/payroll/invoice/InvoicePdfDocument'

type PayrollEntry = {
  id: string
  entry_date: string
  entry_type: 'hourly' | 'overnight'
  work_type: 'cleaning' | 'maintenance' | 'it' | 'general' | null
  hours_worked: number | null
  room_revenue: number | null
  calculated_pay: number | null
  properties: { name: string } | { name: string }[] | null
  users: { full_name: string | null } | { full_name: string | null }[] | null
}

function getUserName(entry: PayrollEntry) {
  if (Array.isArray(entry.users)) return entry.users[0]?.full_name ?? 'Employee'
  return entry.users?.full_name ?? 'Employee'
}

function sanitizeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validInvoiceParams(userId: string, startDate: string, endDate: string) {
  return /^[0-9a-f-]{36}$/i.test(userId) && DATE_RE.test(startDate) && DATE_RE.test(endDate) && startDate <= endDate
}

// Builds the payroll invoice PDF as the signed-in user (normal access rules apply).
// Shared by the Download PDF and Email PDF routes so both always produce the same file.
export async function buildPayrollPdf(supabase: SupabaseClient, userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      id,
      entry_date,
      entry_type,
      work_type,
      hours_worked,
      room_revenue,
      calculated_pay,
      properties ( name ),
      users ( full_name )
    `)
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true })

  if (error) return { error: `Could not load invoice data: ${error.message}` } as const

  const entries = (data ?? []) as PayrollEntry[]
  const employeeName = entries[0] ? getUserName(entries[0]) : 'Employee'
  const generatedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())

  const buffer = await renderToBuffer(
    <InvoicePdfDocument employeeName={employeeName} startDate={startDate} endDate={endDate} generatedDate={generatedDate} entries={entries} />
  )
  const filename = `snow-goose-payroll-${sanitizeFileName(employeeName)}-${startDate}-to-${endDate}.pdf`
  return { buffer, filename, employeeName, entryCount: entries.length } as const
}
