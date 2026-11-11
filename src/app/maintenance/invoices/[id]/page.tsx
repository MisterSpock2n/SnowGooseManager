import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import InvoiceStatusBadge from '@/components/maintenance/InvoiceStatusBadge'
import InvoiceActions from './InvoiceActions'
import InvoiceFiles, { type InvoiceFileItem } from './InvoiceFiles'
import { INVOICE_BUCKET, currency, formatDate, isPastDue, type InvoiceStatus } from '@/lib/invoices'
import { formatDateTime, one } from '@/lib/maintenance'

export type InvoiceDetail = {
  id: string
  vendor_name: string
  vendor_phone: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  amount: number
  status: InvoiceStatus
  notes: string | null
  logged_by: string
  logged_by_name: string | null
  seen_at: string | null
  seen_by_name: string | null
  paid_at: string | null
  paid_by_name: string | null
  paid_note: string | null
  status_changed_at: string | null
  status_changed_by_name: string | null
  notified_at: string | null
  notify_status: 'pending' | 'sent' | 'failed'
  created_at: string
  related_action_id: string | null
  maintenance_actions: { id: string; maf_number: string; description: string } | { id: string; maf_number: string; description: string }[] | null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ color: '#6b7280', fontSize: 14 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; upload?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const email = String(claimsData.claims.email ?? '')
  const currentUserId = String(claimsData.claims.sub ?? '')

  const select = `id, vendor_name, vendor_phone, invoice_number, invoice_date, due_date, amount, status, notes,
    logged_by, logged_by_name, seen_at, seen_by_name, paid_at, paid_by_name, paid_note,
    status_changed_at, status_changed_by_name, notified_at, notify_status, created_at, related_action_id,
    maintenance_actions(id, maf_number, description)`

  const [{ data, error }, { data: role }, { data: fileRows }] = await Promise.all([
    supabase.from('owner_invoices').select(select).eq('id', id).maybeSingle(),
    supabase.from('staff_roles').select('role, can_close_maf').ilike('email', email).maybeSingle(),
    supabase
      .from('owner_invoice_files')
      .select('id, storage_path, content_type, file_name, uploaded_by, uploaded_by_name, created_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (error) return <p style={{ color: '#991b1b' }}>Could not load invoice: {error.message}</p>
  if (!data) notFound()

  let inv = data as InvoiceDetail

  // When Jon opens a new invoice, mark it as seen automatically
  if (role?.role === 'owner' && inv.status === 'new') {
    const { data: updated } = await supabase.from('owner_invoices').update({ status: 'seen' }).eq('id', id).select(select).maybeSingle()
    if (updated) inv = updated as InvoiceDetail
  }

  const raw = (fileRows as Omit<InvoiceFileItem, 'url'>[] | null) ?? []
  let files: InvoiceFileItem[] = raw.map((f) => ({ ...f, url: null }))
  if (raw.length) {
    const { data: signed } = await supabase.storage.from(INVOICE_BUCKET).createSignedUrls(raw.map((f) => f.storage_path), 60 * 60)
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    files = raw.map((f) => ({ ...f, url: byPath.get(f.storage_path) ?? null }))
  }

  const canManage = Boolean(role?.can_close_maf)
  const canEdit = canManage || inv.logged_by === currentUserId
  const maf = one(inv.maintenance_actions)
  const late = isPastDue(inv.due_date, inv.status)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link href="/maintenance/invoices" style={{ fontSize: 14 }}>← Back to invoices</Link>
      <h1 style={{ fontSize: '2rem', margin: '8px 0' }}>
        {inv.vendor_name} · {currency.format(Number(inv.amount))}
      </h1>
      <MaintenanceNav active="invoices" />

      {sp.created ? (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>
          Invoice saved for Jon.
        </div>
      ) : null}
      {sp.upload === 'failed' ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>
          The invoice was saved, but some files didn&apos;t upload. Please add them again below.
        </div>
      ) : null}

      <div style={{ background: 'white', borderRadius: 12, padding: '8px 24px 16px' }}>
        <Row label="Status">
          <InvoiceStatusBadge status={inv.status} />
          {late ? <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>Past due</span> : null}
          {inv.status_changed_by_name ? (
            <span style={{ marginLeft: 10, color: '#6b7280', fontSize: 14 }}>
              by {inv.status_changed_by_name} · {formatDateTime(inv.status_changed_at)}
            </span>
          ) : null}
        </Row>
        <Row label="From">
          {inv.vendor_name} <span style={{ color: '#6b7280' }}>· <a href={`tel:${inv.vendor_phone.replace(/[^0-9+]/g, '')}`}>{inv.vendor_phone}</a></span>
        </Row>
        <Row label="Amount"><strong>{currency.format(Number(inv.amount))}</strong></Row>
        <Row label="Invoice #">{inv.invoice_number ?? <span style={{ color: '#9ca3af' }}>—</span>}</Row>
        <Row label="Invoice date">{formatDate(inv.invoice_date)}</Row>
        <Row label="Due date">{inv.due_date ? formatDate(inv.due_date) : <span style={{ color: '#9ca3af' }}>—</span>}</Row>
        <Row label="Related MAF">
          {maf ? (
            <Link href={`/maintenance/${maf.id}`}>
              {maf.maf_number} — {maf.description.slice(0, 80)}{maf.description.length > 80 ? '…' : ''}
            </Link>
          ) : (
            <span style={{ color: '#9ca3af' }}>None</span>
          )}
        </Row>
        <Row label="Notes for Jon">
          {inv.notes ? <div style={{ whiteSpace: 'pre-wrap' }}>{inv.notes}</div> : <span style={{ color: '#9ca3af' }}>None</span>}
        </Row>
        <Row label="Logged by">
          {inv.logged_by_name ?? '—'} <span style={{ color: '#6b7280' }}>· {formatDateTime(inv.created_at)}</span>
        </Row>
        {inv.seen_at ? (
          <Row label="Seen">
            {inv.seen_by_name ?? '—'} <span style={{ color: '#6b7280' }}>· {formatDateTime(inv.seen_at)}</span>
          </Row>
        ) : null}
        {inv.paid_at ? (
          <Row label="Paid">
            {inv.paid_by_name ?? '—'} <span style={{ color: '#6b7280' }}>· {formatDateTime(inv.paid_at)}</span>
            {inv.paid_note ? <div style={{ fontSize: 14, marginTop: 4 }}>{inv.paid_note}</div> : null}
          </Row>
        ) : null}
        <Row label="Email alert to Jon">
          {inv.notify_status === 'sent' ? (
            <span>Notified Jon on {formatDateTime(inv.notified_at)}</span>
          ) : inv.notify_status === 'failed' ? (
            <span style={{ color: '#991b1b' }}>Alert failed to send</span>
          ) : (
            <span style={{ color: '#6b7280' }}>Not sent. Email alerts are coming in the next update (1.5.4).</span>
          )}
        </Row>
      </div>

      <div style={{ marginTop: 16 }}>
        <InvoiceFiles invoiceId={inv.id} files={files} canManage={canManage} currentUserId={currentUserId} />
      </div>

      {canEdit ? (
        <div style={{ marginTop: 16 }}>
          <InvoiceActions invoice={inv} canManage={canManage} />
        </div>
      ) : null}
    </div>
  )
}
