// Snow Goose App 1.5.4: email Jon when an invoice is logged.
// Plain HTML email with a link to the invoice in the app plus time-limited links to the files.
// No PDF generation, so it stays independent of the payroll email troubleshooting.
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://snowgoose.warpninedesigns.com'
const RECIPIENT = 'info@snowgooseinn.com' // Jon only, no CC
const FROM = 'Snow Goose Maintenance <maintenance@notifications.warpninedesigns.com>'
const BUCKET = 'owner-invoices'
const LINK_SECONDS = 60 * 60 * 24 * 7 // file links work for 7 days

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

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function fmtDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day)))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Supabase configuration is incomplete.' }, 500)

  // Acts as the signed-in user, so normal access rules apply
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401)

  let body: { invoiceId?: string; resend?: boolean }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  const invoiceId = body.invoiceId ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return json({ error: 'Missing or invalid invoiceId.' }, 400)

  const { data: inv, error: invError } = await userClient
    .from('owner_invoices')
    .select(
      `id, vendor_name, vendor_phone, invoice_number, invoice_date, due_date, amount, notes,
       logged_by_name, notify_status, created_at, maintenance_actions(maf_number, description)`
    )
    .eq('id', invoiceId)
    .maybeSingle()
  if (invError) return json({ error: `Could not load invoice: ${invError.message}` }, 500)
  if (!inv) return json({ error: 'Invoice not found.' }, 404)

  // Sending again after a successful alert is limited to Nick, Rhiannon and Jon
  if (inv.notify_status === 'sent') {
    if (!body.resend) return json({ success: true, skipped: true, reason: 'Jon was already notified.' })
    const { data: isManager } = await userClient.rpc('can_close_maf')
    if (!isManager) return json({ error: 'Only Nick, Rhiannon or Jon can resend an alert.' }, 403)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  async function record(status: 'sent' | 'failed', error: string | null) {
    await admin
      .from('owner_invoices')
      .update({
        notify_status: status,
        notify_error: error ? error.slice(0, 500) : null,
        ...(status === 'sent' ? { notified_at: new Date().toISOString() } : {}),
      })
      .eq('id', invoiceId)
  }

  if (!resendApiKey) {
    await record('failed', 'RESEND_API_KEY is not set')
    return json({ error: 'Email service configuration is incomplete.' }, 500)
  }

  const { data: files } = await userClient
    .from('owner_invoice_files')
    .select('storage_path, file_name, content_type')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })

  const fileList = (files ?? []) as { storage_path: string; file_name: string | null; content_type: string | null }[]
  let fileLinks: { name: string; url: string }[] = []
  if (fileList.length) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(fileList.map((f) => f.storage_path), LINK_SECONDS)
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    fileLinks = fileList
      .map((f, i) => ({
        name: f.file_name || (f.content_type === 'application/pdf' ? `Invoice PDF ${i + 1}` : `Invoice photo ${i + 1}`),
        url: byPath.get(f.storage_path) ?? '',
      }))
      .filter((f) => f.url)
  }

  const maf = Array.isArray(inv.maintenance_actions) ? inv.maintenance_actions[0] : inv.maintenance_actions
  const amount = money.format(Number(inv.amount))
  const appLink = `${APP_URL}/maintenance/invoices/${invoiceId}`
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;color:#111827">${value}</td></tr>`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#111827">
    <p>Hi Jon,</p>
    <p>${esc(inv.logged_by_name ?? 'The team')} logged a new invoice for the Snow Goose Inn.</p>
    <table style="border-collapse:collapse;font-size:15px">
      ${row('From', `<strong>${esc(inv.vendor_name)}</strong>`)}
      ${row('Phone', `<a href="tel:${esc(String(inv.vendor_phone).replace(/[^0-9+]/g, ''))}">${esc(inv.vendor_phone)}</a>`)}
      ${row('Amount', `<strong>${esc(amount)}</strong>`)}
      ${inv.invoice_number ? row('Invoice #', esc(inv.invoice_number)) : ''}
      ${row('Invoice date', esc(fmtDate(inv.invoice_date)))}
      ${row('Due date', esc(fmtDate(inv.due_date)))}
      ${maf ? row('Related MAF', `${esc(maf.maf_number)} — ${esc(String(maf.description).slice(0, 120))}`) : ''}
      ${inv.notes ? row('Notes', esc(inv.notes).replace(/\n/g, '<br>')) : ''}
      ${row('Logged by', esc(inv.logged_by_name ?? '—'))}
    </table>
    <p style="margin:20px 0">
      <a href="${esc(appLink)}" style="background:#0f172a;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">View invoice in the Snow Goose app</a>
    </p>
    ${
      fileLinks.length
        ? `<p style="margin-bottom:6px"><strong>Invoice files</strong> (links work for 7 days):</p><ul style="margin-top:0">${fileLinks
            .map((f) => `<li><a href="${esc(f.url)}">${esc(f.name)}</a></li>`)
            .join('')}</ul>`
        : '<p style="color:#991b1b">No files were attached yet.</p>'
    }
    <p style="color:#6b7280;font-size:13px">Sent automatically by the Snow Goose operations app. Reply to this email to reach ${esc(inv.logged_by_name ?? 'the person who logged it')}.</p>
  </div>`

  const text = [
    `Hi Jon,`,
    ``,
    `${inv.logged_by_name ?? 'The team'} logged a new invoice for the Snow Goose Inn.`,
    `From: ${inv.vendor_name} (${inv.vendor_phone})`,
    `Amount: ${amount}`,
    inv.invoice_number ? `Invoice #: ${inv.invoice_number}` : '',
    `Invoice date: ${fmtDate(inv.invoice_date)}`,
    `Due date: ${fmtDate(inv.due_date)}`,
    maf ? `Related MAF: ${maf.maf_number}` : '',
    inv.notes ? `Notes: ${inv.notes}` : '',
    ``,
    `View it in the app: ${appLink}`,
    ...fileLinks.map((f) => `${f.name}: ${f.url}`),
  ]
    .filter((l) => l !== '')
    .join('\n')

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [RECIPIENT],
      ...(userData.user.email ? { reply_to: userData.user.email } : {}),
      subject: `New invoice for Snow Goose: ${inv.vendor_name} — ${amount}`,
      html,
      text,
    }),
  })

  let resendData: { id?: string; message?: string; name?: string } = {}
  try {
    resendData = await resendResponse.json()
  } catch {
    // ignore non-JSON responses
  }

  if (!resendResponse.ok) {
    const detail = resendData.message || resendData.name || `HTTP ${resendResponse.status}`
    await record('failed', `Resend: ${detail}`)
    return json({ error: 'The email service could not send the alert.', detail }, 502)
  }

  await record('sent', null)
  return json({ success: true, emailId: resendData.id })
})
