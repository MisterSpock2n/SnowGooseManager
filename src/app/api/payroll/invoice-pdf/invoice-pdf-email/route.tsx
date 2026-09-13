import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePdfDocument from '@/app/payroll/invoice/InvoicePdfDocument'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
  if (Array.isArray(entry.users)) {
    return entry.users[0]?.full_name ?? 'Employee'
  }

  return entry.users?.full_name ?? 'Employee'
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const expectedAuthorization = `Bearer ${process.env.INVOICE_EMAIL_PDF_SECRET}`

  if (!process.env.INVOICE_EMAIL_PDF_SECRET || authorization !== expectedAuthorization) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user') ?? ''
  const startDate = searchParams.get('start') ?? ''
  const endDate = searchParams.get('end') ?? ''

  if (!userId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing user, start, or end invoice parameters.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

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

  if (error) {
    return NextResponse.json(
      { error: `Could not load invoice data: ${error.message}` },
      { status: 500 }
    )
  }

  const entries = (data ?? []) as PayrollEntry[]
  const employeeName = entries[0] ? getUserName(entries[0]) : 'Employee'

  const generatedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  const pdfBuffer = await renderToBuffer(
    <InvoicePdfDocument
      employeeName={employeeName}
      startDate={startDate}
      endDate={endDate}
      generatedDate={generatedDate}
      entries={entries}
    />
  )

  const filename = `snow-goose-payroll-${sanitizeFileName(
    employeeName
  )}-${startDate}-to-${endDate}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Invoice-Filename': filename,
    },
  })
}