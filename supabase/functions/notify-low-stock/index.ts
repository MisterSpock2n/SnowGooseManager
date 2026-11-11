// Snow Goose App 1.6.1: daily low-stock email to staff who have low_stock_alerts on (Nick and Rhiannon).
// Called once a day by pg_cron (x-cron-secret header) or on demand by a manager from the Shopping list page.
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://snowgoose.warpninedesigns.com'
const FROM = 'Snow Goose Inventory <inventory@notifications.warpninedesigns.com>'
const REMIND_AFTER_DAYS = 3 // if nothing changed, re-send at most every 3 days

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: 'Maintenance supplies',
  guest_room: 'Guest room supplies',
  breakfast_food: 'Breakfast / food',
  cleaning: 'Cleaning / housekeeping',
}

type Item = {
  id: string
  name: string
  category: string
  unit: string
  quantity_on_hand: number
  reorder_level: number
  reorder_quantity: number | null
  vendor: string | null
  reorder_url: string | null
  storage_location: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function qty(n: number) {
  const v = Number(n)
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function suggested(i: Item) {
  if (i.reorder_quantity) return Number(i.reorder_quantity)
  return Math.max(1, Math.ceil(Number(i.reorder_level) * 2 - Number(i.quantity_on_hand)))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Supabase configuration is incomplete.' }, 500)
  const admin = createClient(supabaseUrl, serviceKey)

  // Who is calling: the daily schedule (shared secret) or a signed-in manager
  let trigger: 'schedule' | 'manual'
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret) {
    const { data: expected } = await admin.rpc('low_stock_cron_secret')
    if (!expected || cronSecret !== expected) return json({ error: 'Unauthorized' }, 401)
    trigger = 'schedule'
  } else {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401)
    const { data: isManager } = await userClient.rpc('can_close_maf')
    if (!isManager) return json({ error: 'Only Nick, Rhiannon or Jon can send the low-stock email.' }, 403)
    trigger = 'manual'
  }

  const { data: rows, error: itemsError } = await admin
    .from('inventory_items')
    .select('id, name, category, unit, quantity_on_hand, reorder_level, reorder_quantity, vendor, reorder_url, storage_location, last_counted_at')
    .eq('active', true)
    .not('last_counted_at', 'is', null)
    .order('name')
  if (itemsError) return json({ error: `Could not load inventory: ${itemsError.message}` }, 500)

  const low = ((rows ?? []) as (Item & { last_counted_at: string })[]).filter(
    (i) => Number(i.quantity_on_hand) <= 0 || (Number(i.reorder_level) > 0 && Number(i.quantity_on_hand) <= Number(i.reorder_level))
  )
  if (!low.length) return json({ success: true, sent: false, reason: 'Nothing is low right now.' })

  const { data: last } = await admin.from('inventory_alert_log').select('item_ids, sent_at').order('sent_at', { ascending: false }).limit(1).maybeSingle()
  const lastIds = new Set<string>((last?.item_ids as string[] | null) ?? [])
  const newIds = low.filter((i) => !lastIds.has(i.id)).map((i) => i.id)
  const sameList = newIds.length === 0 && lastIds.size === low.length
  const ageDays = last?.sent_at ? (Date.now() - new Date(last.sent_at).getTime()) / 86_400_000 : Infinity
  if (trigger === 'schedule' && sameList && ageDays < REMIND_AFTER_DAYS) {
    return json({ success: true, sent: false, reason: 'Same low list as the last email; reminder not due yet.' })
  }

  const { data: recipients } = await admin.from('staff_roles').select('email').eq('low_stock_alerts', true)
  const to = ((recipients ?? []) as { email: string }[]).map((r) => r.email)
  if (!to.length) return json({ error: 'No one is set to receive low-stock emails.' }, 500)
  if (!resendApiKey) return json({ error: 'Email service configuration is incomplete.' }, 500)

  // Group by where to buy
  const groups = new Map<string, typeof low>()
  for (const i of low) {
    const key = i.vendor?.trim() || 'No store set'
    groups.set(key, [...(groups.get(key) ?? []), i])
  }
  const groupNames = Array.from(groups.keys()).sort((a, b) => (a === 'No store set' ? 1 : b === 'No store set' ? -1 : a.localeCompare(b)))
  const outCount = low.filter((i) => Number(i.quantity_on_hand) <= 0).length
  const newSet = new Set(newIds)

  const htmlGroups = groupNames
    .map((g) => {
      const list = groups.get(g)!
      const rowsHtml = list
        .map((i) => {
          const out = Number(i.quantity_on_hand) <= 0
          const badge = out
            ? '<span style="background:#fee2e2;color:#991b1b;font-weight:bold;font-size:12px;padding:1px 6px;border-radius:999px">OUT</span>'
            : '<span style="background:#ffedd5;color:#9a3412;font-weight:bold;font-size:12px;padding:1px 6px;border-radius:999px">LOW</span>'
          const isNew = newSet.has(i.id) && lastIds.size ? ' <span style="color:#1d4ed8;font-size:12px;font-weight:bold">NEW</span>' : ''
          const name = i.reorder_url ? `<a href="${esc(i.reorder_url)}">${esc(i.name)}</a>` : esc(i.name)
          return `<tr>
            <td style="padding:6px 10px 6px 0">${badge} ${name}${isNew}<div style="color:#6b7280;font-size:12px">${esc(CATEGORY_LABELS[i.category] ?? i.category)}${i.storage_location ? ` · ${esc(i.storage_location)}` : ''}</div></td>
            <td style="padding:6px 10px;white-space:nowrap">${esc(qty(i.quantity_on_hand))} ${esc(i.unit)} left</td>
            <td style="padding:6px 0;white-space:nowrap"><strong>Buy ${esc(qty(suggested(i)))}</strong></td>
          </tr>`
        })
        .join('')
      return `<h3 style="margin:18px 0 6px;font-size:16px">${esc(g)}</h3><table style="border-collapse:collapse;font-size:14px;width:100%">${rowsHtml}</table>`
    })
    .join('')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111827">
    <p><strong>${low.length} item${low.length === 1 ? '' : 's'}</strong> ${low.length === 1 ? 'is' : 'are'} low${outCount ? `, including <strong style="color:#991b1b">${outCount} out of stock</strong>` : ''}.</p>
    ${htmlGroups}
    <p style="margin:22px 0">
      <a href="${APP_URL}/inventory/shopping" style="background:#0f172a;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Open the shopping list</a>
    </p>
    <p style="color:#6b7280;font-size:13px">Sent automatically by the Snow Goose operations app${trigger === 'manual' ? ' (sent on request)' : ''}. "Buy" amounts use each item's usual order amount, or enough to get back to about twice its low-stock level.</p>
  </div>`

  const text = [
    `${low.length} item(s) are low${outCount ? `, ${outCount} out of stock` : ''}.`,
    ...groupNames.flatMap((g) => [
      '',
      g,
      ...groups.get(g)!.map((i) => `- ${i.name}: ${qty(i.quantity_on_hand)} ${i.unit} left, buy ${qty(suggested(i))}${newSet.has(i.id) && lastIds.size ? ' (new)' : ''}`),
    ]),
    '',
    `Shopping list: ${APP_URL}/inventory/shopping`,
  ].join('\n')

  const subject = `Snow Goose low stock: ${low.length} item${low.length === 1 ? '' : 's'}${outCount ? ` (${outCount} out)` : ''}`

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  })
  let resendData: { id?: string; message?: string; name?: string } = {}
  try {
    resendData = await resendResponse.json()
  } catch {
    // ignore
  }
  if (!resendResponse.ok) {
    const detail = resendData.message || resendData.name || `HTTP ${resendResponse.status}`
    return json({ error: 'The email service could not send the low-stock email.', detail }, 502)
  }

  await admin.from('inventory_alert_log').insert({ item_ids: low.map((i) => i.id), recipients: to, email_id: resendData.id ?? null, trigger })
  return json({ success: true, sent: true, count: low.length, emailId: resendData.id })
})
