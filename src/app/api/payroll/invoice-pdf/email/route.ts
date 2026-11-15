import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPayrollPdf, validInvoiceParams } from '@/lib/payroll-pdf'

export const runtime = 'nodejs'

// Email PDF: builds the same PDF as Download PDF for the signed-in user,
// then hands it to the email-payroll-invoice Edge Function, which sends it through Resend.
// The function never calls back into the app, so it works the same on preview and live sites.
export async function POST(request: NextRequest) {
  let body: { userId?: string; startDate?: string; endDate?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const userId = body.userId ?? ''
  const startDate = body.startDate ?? ''
  const endDate = body.endDate ?? ''
  if (!validInvoiceParams(userId, startDate, endDate)) {
    return NextResponse.json({ error: 'Missing or invalid employee or dates.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (claimsError || !claimsData?.claims || !accessToken) {
    return NextResponse.json({ error: 'Your sign-in has expired. Sign in again and retry.' }, { status: 401 })
  }

  const pdf = await buildPayrollPdf(supabase, userId, startDate, endDate)
  if ('error' in pdf) return NextResponse.json({ error: pdf.error }, { status: 500 })
  if (pdf.entryCount === 0) {
    return NextResponse.json({ error: 'There are no time entries in this period, so nothing was sent.' }, { status: 400 })
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-payroll-invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      employeeName: pdf.employeeName,
      filename: pdf.filename,
      pdfBase64: Buffer.from(pdf.buffer).toString('base64'),
    }),
  })

  let result: { success?: boolean; error?: string; emailId?: string; sentTo?: string } = {}
  try {
    result = await res.json()
  } catch {}
  if (!res.ok || !result.success) {
    return NextResponse.json({ error: result.error ?? `Email service returned ${res.status}.` }, { status: 502 })
  }
  return NextResponse.json({ success: true, emailId: result.emailId, sentTo: result.sentTo })
}
