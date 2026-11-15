// Snow Goose App 1.7.0: email a payroll invoice PDF.
// The app builds the PDF (same file as Download PDF) and posts it here with the signed-in user's token.
// This function only checks the caller and the file, then sends it through Resend.
// It never calls back into the app, which is what caused the old send-payroll-invoice 502.
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const RECIPIENT = 'info@snowgooseinn.com'
const FROM = 'Snow Goose Payroll <payroll@notifications.warpninedesigns.com>'
const REPLY_TO = 'SasquatchCleaningService@gmail.com'
const MAX_PDF_BYTES = 5 * 1024 * 1024
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day)))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase configuration is incomplete.' }, 500)
  if (!resendApiKey) return json({ error: 'The email service key (RESEND_API_KEY) is not set.' }, 500)

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401)

  let body: { startDate?: string; endDate?: string; employeeName?: string; filename?: string; pdfBase64?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  const { startDate = '', endDate = '', employeeName = 'Employee', pdfBase64 = '' } = body
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return json({ error: 'Missing or invalid dates.' }, 400)

  let pdfBytes: Uint8Array
  try {
    pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))
  } catch {
    return json({ error: 'The invoice file could not be read.' }, 400)
  }
  const isPdf = pdfBytes.length > 4 && String.fromCharCode(...pdfBytes.slice(0, 5)) === '%PDF-'
  if (!isPdf) return json({ error: 'The invoice file is not a PDF.' }, 400)
  if (pdfBytes.length > MAX_PDF_BYTES) return json({ error: 'The invoice PDF is too large to email.' }, 400)

  const filename = /^[a-z0-9-]+\.pdf$/.test(body.filename ?? '') ? body.filename! : `snow-goose-payroll-${startDate}-to-${endDate}.pdf`
  const sender = String(userData.user.user_metadata?.full_name ?? userData.user.email ?? 'the Snow Goose app')

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [RECIPIENT],
      reply_to: REPLY_TO,
      subject: `Payroll invoice: ${employeeName}, ${fmtDate(startDate)} to ${fmtDate(endDate)}`,
      html: `
        <p>Hello,</p>
        <p>Attached is the Snow Goose Inn payroll invoice for <strong>${esc(employeeName)}</strong>
        for <strong>${esc(fmtDate(startDate))}</strong> through <strong>${esc(fmtDate(endDate))}</strong>.</p>
        <p style="color:#6b7280;font-size:13px">Sent by ${esc(sender)} from the Snow Goose operations app.</p>
      `,
      attachments: [{ filename, content: pdfBase64 }],
    }),
  })

  let resendData: { id?: string; message?: string } = {}
  try {
    resendData = await resendResponse.json()
  } catch {}
  if (!resendResponse.ok) {
    return json({ error: `The email service refused the message: ${resendData.message ?? resendResponse.status}` }, 502)
  }

  return json({ success: true, emailId: resendData.id, sentTo: RECIPIENT })
})
