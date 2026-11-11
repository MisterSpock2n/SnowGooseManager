import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import InvoiceStatusBadge from '@/components/maintenance/InvoiceStatusBadge'
import { INVOICE_STATUSES, currency, formatDate, isPastDue, type InvoiceStatus } from '@/lib/invoices'
import { one } from '@/lib/maintenance'

type SearchParams = Promise<{ view?: string; q?: string; vendor?: string }>

type InvoiceRow = {
  id: string
  vendor_name: string
  vendor_phone: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  amount: number
  status: InvoiceStatus
  notes: string | null
  logged_by_name: string | null
  paid_at: string | null
  notify_status: string
  created_at: string
  maintenance_actions: { id: string; maf_number: string } | { id: string; maf_number: string }[] | null
  owner_invoice_files: { id: string }[] | null
}

const VIEWS: { key: string; label: string; statuses: InvoiceStatus[] }[] = [
  { key: 'unpaid', label: 'Unpaid', statuses: ['new', 'seen', 'disputed'] },
  ...INVOICE_STATUSES.map((s) => ({ key: s.value, label: s.label, statuses: [s.value] })),
  { key: 'all', label: 'All', statuses: ['new', 'seen', 'paid', 'disputed'] },
]

function searchTerms(q: string) {
  return q
    .replace(/["\\(),*%_]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
}

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const view = VIEWS.find((v) => v.key === params.view) ?? VIEWS[0]
  const terms = searchTerms(params.q ?? '')

  let query = supabase
    .from('owner_invoices')
    .select(
      `id, vendor_name, vendor_phone, invoice_number, invoice_date, due_date, amount, status, notes,
       logged_by_name, paid_at, notify_status, created_at,
       maintenance_actions(id, maf_number),
       owner_invoice_files(id)`
    )
    .in('status', view.statuses)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)

  for (const t of terms) {
    const v = `"%${t}%"`
    query = query.or(`vendor_name.ilike.${v},invoice_number.ilike.${v},notes.ilike.${v},vendor_phone.ilike.${v}`)
  }
  if (params.vendor) query = query.eq('vendor_name', params.vendor)

  const [{ data, error }, { data: unpaidRows }, { data: vendorRows }] = await Promise.all([
    query,
    supabase.from('owner_invoices').select('amount, due_date, status').in('status', ['new', 'seen', 'disputed']),
    supabase.from('owner_invoices').select('vendor_name').order('vendor_name'),
  ])

  const invoices = (data as InvoiceRow[] | null) ?? []
  const unpaid = (unpaidRows as { amount: number; due_date: string | null; status: string }[] | null) ?? []
  const unpaidTotal = unpaid.reduce((sum, r) => sum + Number(r.amount), 0)
  const pastDue = unpaid.filter((r) => isPastDue(r.due_date, r.status))
  const newCount = unpaid.filter((r) => r.status === 'new').length
  const vendorNames = Array.from(new Set(((vendorRows as { vendor_name: string }[] | null) ?? []).map((r) => r.vendor_name)))
  const shownTotal = invoices.reduce((sum, r) => sum + Number(r.amount), 0)

  const card = { background: 'white', borderRadius: 12, padding: '14px 18px', display: 'grid', gap: 4 } as const

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Invoices for Jon</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Bills logged by the team for Jon to review and pay.
      </p>

      <MaintenanceNav active="invoices" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={card}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Unpaid total</span>
          <strong style={{ fontSize: 22 }}>{currency.format(unpaidTotal)}</strong>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{unpaid.length} invoice{unpaid.length === 1 ? '' : 's'}</span>
        </div>
        <div style={card}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>New (not yet seen)</span>
          <strong style={{ fontSize: 22 }}>{newCount}</strong>
        </div>
        <div style={{ ...card, borderLeft: pastDue.length ? '6px solid #dc2626' : undefined }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Past due</span>
          <strong style={{ fontSize: 22, color: pastDue.length ? '#991b1b' : undefined }}>{pastDue.length}</strong>
          {pastDue.length ? <span style={{ fontSize: 13, color: '#991b1b' }}>{currency.format(pastDue.reduce((s, r) => s + Number(r.amount), 0))}</span> : null}
        </div>
        <Link href="/maintenance/invoices/new" style={{ ...card, background: '#0f172a', color: 'white', textDecoration: 'none', placeContent: 'center', textAlign: 'center' }}>
          <strong style={{ fontSize: 17 }}>+ Log an invoice</strong>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {VIEWS.map((v) => {
          const active = v.key === view.key
          const qs = new URLSearchParams()
          if (v.key !== 'unpaid') qs.set('view', v.key)
          if (params.q) qs.set('q', params.q)
          if (params.vendor) qs.set('vendor', params.vendor)
          const s = qs.toString()
          return (
            <Link
              key={v.key}
              href={`/maintenance/invoices${s ? `?${s}` : ''}`}
              style={{ padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #d1d5db', background: active ? '#0f172a' : 'white', color: active ? 'white' : '#0f172a' }}
            >
              {v.label}
            </Link>
          )
        })}
      </div>

      <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'white', padding: 12, borderRadius: 10, marginBottom: 14 }}>
        {view.key !== 'unpaid' ? <input type="hidden" name="view" value={view.key} /> : null}
        <input type="search" name="q" defaultValue={params.q ?? ''} placeholder="Search vendor, invoice #, notes…" aria-label="Search invoices" style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }} />
        <select name="vendor" defaultValue={params.vendor ?? ''} aria-label="Vendor" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' }}>
          <option value="">All vendors</option>
          {vendorNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Search</button>
        {params.q || params.vendor ? <Link href={`/maintenance/invoices${view.key !== 'unpaid' ? `?view=${view.key}` : ''}`} style={{ alignSelf: 'center', fontSize: 14 }}>Clear</Link> : null}
      </form>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          Could not load invoices: {error.message}
        </div>
      ) : null}

      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 10 }}>
        {invoices.length} invoice{invoices.length === 1 ? '' : 's'} · {currency.format(shownTotal)}
      </div>

      {invoices.length === 0 && !error ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280' }}>
          {terms.length || params.vendor ? 'No invoices match this search.' : view.key === 'unpaid' ? 'Nothing waiting on Jon right now.' : 'No invoices here yet.'}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {invoices.map((inv) => {
          const maf = one(inv.maintenance_actions)
          const files = inv.owner_invoice_files?.length ?? 0
          const late = isPastDue(inv.due_date, inv.status)
          return (
            <Link
              key={inv.id}
              href={`/maintenance/invoices/${inv.id}`}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', background: 'white', borderRadius: 12, padding: '14px 16px', textDecoration: 'none', color: 'inherit', borderLeft: `8px solid ${late ? '#dc2626' : inv.status === 'paid' ? '#16a34a' : inv.status === 'disputed' ? '#f87171' : inv.status === 'seen' ? '#f59e0b' : '#3b82f6'}` }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>{inv.vendor_name}</strong>
                  <InvoiceStatusBadge status={inv.status} />
                  {late ? <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>Past due</span> : null}
                  {maf ? <span style={{ fontSize: 12, color: '#374151', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>{maf.maf_number}</span> : null}
                  {inv.notify_status === 'failed' ? <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fff1f2', border: '1px solid #fecaca', padding: '1px 8px', borderRadius: 999 }}>Alert failed</span> : null}
                  {inv.notify_status === 'pending' && inv.status === 'new' ? <span style={{ fontSize: 12, color: '#6b7280', border: '1px solid #e5e7eb', padding: '1px 8px', borderRadius: 999 }}>Alert not sent</span> : null}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {inv.invoice_number ? `#${inv.invoice_number} · ` : ''}Dated {formatDate(inv.invoice_date)}
                  {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ''}
                  {` · ${files} file${files === 1 ? '' : 's'}`}
                  {inv.logged_by_name ? ` · Logged by ${inv.logged_by_name}` : ''}
                </div>
                {inv.notes ? <div style={{ fontSize: 14, color: '#374151' }}>{inv.notes.slice(0, 140)}{inv.notes.length > 140 ? '…' : ''}</div> : null}
              </div>
              <strong style={{ fontSize: 18 }}>{currency.format(Number(inv.amount))}</strong>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
