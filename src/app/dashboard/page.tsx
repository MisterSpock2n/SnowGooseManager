import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRoomRevenueForDate } from '@/lib/thinkreservations'
import { OPEN_STATUSES, isOverdue, one, priorityInfo } from '@/lib/maintenance'
import { stockState, type InventoryItem } from '@/lib/inventory'
import { currency, isPastDue } from '@/lib/invoices'

export const dynamic = 'force-dynamic'

const TZ = 'America/New_York'

function todayInNY() {
  // YYYY-MM-DD for today at the inn
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function shortDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

function longDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

function money0(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type EntryRow = {
  entry_type: 'hourly' | 'overnight'
  hours_worked: number | null
  room_revenue: number | null
  calculated_pay: number | null
  user_id: string
  users: { full_name: string | null } | { full_name: string | null }[] | null
}

type MafRow = {
  id: string
  maf_number: string | null
  description: string | null
  priority: number
  status: string
  room_out_of_service: boolean | null
  discovered_at: string
  maintenance_locations: { name: string } | { name: string }[] | null
}

type InvoiceRow = { amount: number; due_date: string | null; status: string }

function Panel({ title, section, children }: { title: string; section: string; children: React.ReactNode }) {
  return (
    <section className="panel" data-section={section} aria-label={title}>
      <div className="panel-head">
        <span className="cap">{title}</span>
        <span className="rule" />
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}

async function TonightRevenue({ date }: { date: string }) {
  let result: Awaited<ReturnType<typeof getRoomRevenueForDate>>
  try {
    result = await getRoomRevenueForDate(date)
  } catch {
    result = { ok: false, status: 502, error: 'Could not reach ThinkReservations.' }
  }
  if (!result.ok) {
    return (
      <div>
        <div className="label">Room revenue tonight</div>
        <p className="err" style={{ margin: '6px 0 0' }}>{result.error}</p>
      </div>
    )
  }
  return (
    <div className="mini two">
      <div>
        <div className="label">Room revenue tonight</div>
        <div className="kpi">{money0(result.revenue)}</div>
        <div className="meta">From ThinkReservations, before taxes</div>
      </div>
      <div>
        <div className="label">Reservations</div>
        <div className="kpi">{result.reservations}</div>
        <div className="meta">Staying tonight</div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claims?.claims) redirect('/login')

  const today = todayInNY()
  const monthStart = `${today.slice(0, 8)}01`

  const [entriesRes, mafsRes, itemsRes, invoicesRes] = await Promise.all([
    supabase
      .from('time_entries')
      .select('entry_type, hours_worked, room_revenue, calculated_pay, user_id, users ( full_name )')
      .gte('entry_date', monthStart)
      .lte('entry_date', today),
    supabase
      .from('maintenance_actions')
      .select('id, maf_number, description, priority, status, room_out_of_service, discovered_at, maintenance_locations(name)')
      .in('status', OPEN_STATUSES)
      .order('priority', { ascending: true })
      .order('discovered_at', { ascending: true }),
    supabase.from('inventory_items').select('quantity_on_hand, reorder_level, last_counted_at, active'),
    supabase.from('owner_invoices').select('amount, due_date, status').in('status', ['new', 'seen', 'disputed']),
  ])

  // Pay period (this month so far)
  const entries = (entriesRes.data as EntryRow[] | null) ?? []
  const payTotal = entries.reduce((s, e) => s + Number(e.calculated_pay ?? 0), 0)
  const byUser = new Map<string, { id: string; name: string; hours: number; overnights: number; pay: number }>()
  let overnightRevenue = 0
  for (const e of entries) {
    const name = one(e.users)?.full_name ?? 'Unknown'
    const u = byUser.get(e.user_id) ?? { id: e.user_id, name, hours: 0, overnights: 0, pay: 0 }
    if (e.entry_type === 'hourly') u.hours += Number(e.hours_worked ?? 0)
    if (e.entry_type === 'overnight') {
      u.overnights += 1
      overnightRevenue += Number(e.room_revenue ?? 0)
    }
    u.pay += Number(e.calculated_pay ?? 0)
    byUser.set(e.user_id, u)
  }
  const people = Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Maintenance
  const mafs = (mafsRes.data as MafRow[] | null) ?? []
  const toVerify = mafs.filter((m) => m.status === 'awaiting_verification').length
  const overdue = mafs.filter((m) => isOverdue(m.priority, m.discovered_at)).length
  const outOfService = mafs.filter((m) => m.room_out_of_service).length
  const topMafs = mafs.slice(0, 4)

  // Inventory
  const items = ((itemsRes.data as (Pick<InventoryItem, 'quantity_on_hand' | 'reorder_level' | 'last_counted_at'> & { active: boolean })[] | null) ?? []).filter((i) => i.active)
  const lowOrOut = items.filter((i) => ['low', 'out'].includes(stockState(i))).length
  const uncounted = items.filter((i) => stockState(i) === 'uncounted').length
  const counted = items.length - uncounted
  const countedPct = items.length ? Math.round((counted / items.length) * 100) : 0

  // Owner invoices
  const unpaid = (invoicesRes.data as InvoiceRow[] | null) ?? []
  const unpaidTotal = unpaid.reduce((s, r) => s + Number(r.amount), 0)
  const newInvoices = unpaid.filter((r) => r.status === 'new').length
  const pastDue = unpaid.filter((r) => isPastDue(r.due_date, r.status)).length

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="stardate">{longDate(today)}</div>
      </div>

      <div className="grid g-2-1">
        <Panel title="Tonight" section="time">
          <div className="tonight">
            <div className="info">
              <Suspense
                fallback={
                  <div>
                    <div className="label">Room revenue tonight</div>
                    <div className="meta" style={{ marginTop: 6 }}>Checking ThinkReservations…</div>
                  </div>
                }
              >
                <TonightRevenue date={today} />
              </Suspense>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <span>Rooms out of service</span>
            <span className="v" style={{ color: outOfService ? 'var(--bad)' : 'var(--ok)' }}>{outOfService}</span>
          </div>
          <div className="btns">
            <Link href="/time" className="lbtn">Log overnight</Link>
          </div>
        </Panel>

        <Panel title="Pay period" section="payroll">
          <div className="label">{shortDate(monthStart)} – {shortDate(today)} total</div>
          <div className="kpi" style={{ margin: '4px 0 8px' }}>{currency.format(payTotal)}</div>
          {entriesRes.error ? (
            <p className="err">Could not load time entries: {entriesRes.error.message}</p>
          ) : people.length === 0 ? (
            <p className="empty">No time logged yet this month.</p>
          ) : (
            <div>
              {people.map((p) => (
                <div className="row" key={p.id}>
                  <span>
                    <Link href={`/payroll/invoice?user=${p.id}&start=${monthStart}&end=${today}`} title={`Invoice preview for ${p.name}`}>
                      {p.name}
                    </Link>
                    <span className="meta">
                      {' · '}
                      {[p.hours ? `${p.hours.toFixed(1)} h` : null, p.overnights ? `${p.overnights} overnight${p.overnights === 1 ? '' : 's'}` : null]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </span>
                  <span className="v">{currency.format(p.pay)}</span>
                </div>
              ))}
              {overnightRevenue > 0 && (
                <div className="row">
                  <span>Overnight room revenue</span>
                  <span className="v">{money0(overnightRevenue)}</span>
                </div>
              )}
            </div>
          )}
          <div className="btns">
            <Link href={`/payroll?start=${monthStart}&end=${today}`} className="lbtn">Open payroll</Link>
          </div>
        </Panel>
      </div>

      <div className="grid g-3" style={{ marginTop: 14 }}>
        <Panel title="Maintenance" section="maintenance">
          <div className="mini">
            <div>
              <div className="label">Open MAFs</div>
              <div className="kpi">{mafs.length}</div>
            </div>
            <div>
              <div className="label">To verify</div>
              <div className="kpi">{toVerify}</div>
            </div>
            <div>
              <div className="label">Overdue</div>
              <div className="kpi" style={overdue ? { color: 'var(--bad)' } : undefined}>{overdue}</div>
            </div>
          </div>
          {mafsRes.error ? (
            <p className="err">Could not load MAFs: {mafsRes.error.message}</p>
          ) : topMafs.length === 0 ? (
            <p className="empty">Nothing open. Nice.</p>
          ) : (
            <ul className="list" style={{ marginTop: 10 }}>
              {topMafs.map((m) => {
                const p = priorityInfo(m.priority)
                const loc = one(m.maintenance_locations)?.name
                return (
                  <li key={m.id}>
                    <span className="code">{(m.maf_number ?? '').split('-').pop()}</span>
                    <Link href={`/maintenance/${m.id}`}>
                      {m.description ?? 'Untitled'}
                      {loc ? <span className="meta"> · {loc}</span> : null}
                    </Link>
                    <span
                      style={{ background: p.color, color: p.text, borderRadius: 999, padding: '2px 9px', fontSize: 13, fontWeight: 600 }}
                      title={p.label}
                    >
                      {p.short}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="btns">
            <Link href="/maintenance/new" className="lbtn">New MAF</Link>
            <Link href="/maintenance" className="lbtn ghost">All open</Link>
          </div>
        </Panel>

        <Panel title="Inventory" section="inventory">
          <div className="mini two">
            <div>
              <div className="label">Low or out</div>
              <div className="kpi">{lowOrOut}</div>
            </div>
            <div>
              <div className="label">Need first count</div>
              <div className="kpi">{uncounted}</div>
            </div>
          </div>
          {itemsRes.error ? (
            <p className="err">Could not load inventory: {itemsRes.error.message}</p>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="row" style={{ paddingTop: 0 }}>
                <span>Counted so far</span>
                <span className="v">{counted} of {items.length}</span>
              </div>
              <div className="bar-meter" role="img" aria-label={`${countedPct}% of items counted`}>
                <i style={{ width: `${countedPct}%` }} />
              </div>
            </div>
          )}
          <div className="btns">
            <Link href="/inventory/count" className="lbtn">Count sheet</Link>
            <Link href="/inventory/shopping" className="lbtn ghost">Shopping list</Link>
          </div>
        </Panel>

        <Panel title="Invoices for Jon" section="dashboard">
          <div className="mini two">
            <div>
              <div className="label">New</div>
              <div className="kpi">{newInvoices}</div>
            </div>
            <div>
              <div className="label">Unpaid</div>
              <div className="kpi">{money0(unpaidTotal)}</div>
            </div>
          </div>
          {invoicesRes.error ? (
            <p className="err">Could not load invoices: {invoicesRes.error.message}</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="row">
                <span>Unpaid invoices</span>
                <span className="v">{unpaid.length}</span>
              </div>
              <div className="row">
                <span>Past due</span>
                <span className="v" style={pastDue ? { color: 'var(--bad)' } : undefined}>{pastDue}</span>
              </div>
            </div>
          )}
          <div className="btns">
            <Link href="/maintenance/invoices" className="lbtn">Open invoices</Link>
          </div>
        </Panel>
      </div>

      <div className="quick">
        <Link href="/time" className="lbtn" style={{ background: 'var(--time)' }}>Log time</Link>
        <Link href="/payroll" className="lbtn" style={{ background: 'var(--pay)' }}>Payroll</Link>
        <Link href="/maintenance/new" className="lbtn" style={{ background: 'var(--maint)' }}>Report a problem</Link>
        <Link href="/inventory" className="lbtn" style={{ background: 'var(--inv)' }}>Received / used</Link>
      </div>
    </div>
  )
}
