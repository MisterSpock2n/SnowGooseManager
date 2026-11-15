import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPayrollPdf } from '@/lib/payroll-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user') ?? ''
  const startDate = searchParams.get('start') ?? ''
  const endDate = searchParams.get('end') ?? ''

  if (!userId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing user, start, or end invoice parameters.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pdf = await buildPayrollPdf(supabase, userId, startDate, endDate)
  if ('error' in pdf) return NextResponse.json({ error: pdf.error }, { status: 500 })

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
