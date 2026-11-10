import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import PriorityBadge from '@/components/maintenance/PriorityBadge'
import { STATUS_LABELS, daysOpen, formatDateTime, isOverdue, one, priorityInfo, type MafStatus } from '@/lib/maintenance'

type MafDetail = {
  id: string
  maf_number: string
  description: string
  priority: number
  status: MafStatus
  room_out_of_service: boolean
  discovered_at: string
  initiated_by_name: string
  location_detail: string | null
  completion_notes: string | null
  completed_at: string | null
  verified_at: string | null
  cost: number | null
  maintenance_locations: { name: string } | { name: string }[] | null
  maintenance_assignees:
    | { name: string; kind: string; role_label: string | null; phone: string | null }
    | { name: string; kind: string; role_label: string | null; phone: string | null }[]
    | null
}

type EventRow = { id: string; event: string; from_value: string | null; to_value: string | null; created_at: string }

const EVENT_LABELS: Record<string, string> = {
  created: 'Created',
  status_changed: 'Status changed',
  reassigned: 'Reassigned',
  priority_changed: 'Priority changed',
  completed: 'Completed',
  reopened: 'Reopened',
  verified: 'Verified',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ color: '#6b7280', fontSize: 14 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}

export default async function MafDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const [{ data, error }, { data: events }] = await Promise.all([
    supabase
      .from('maintenance_actions')
      .select(
        `id, maf_number, description, priority, status, room_out_of_service, discovered_at,
         initiated_by_name, location_detail, completion_notes, completed_at, verified_at, cost,
         maintenance_locations(name),
         maintenance_assignees(name, kind, role_label, phone)`
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('maintenance_action_events')
      .select('id, event, from_value, to_value, created_at')
      .eq('action_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (error) {
    return <p style={{ color: '#991b1b' }}>Could not load MAF: {error.message}</p>
  }
  if (!data) notFound()

  const maf = data as MafDetail
  const p = priorityInfo(maf.priority)
  const assignee = one(maf.maintenance_assignees)
  const location = one(maf.maintenance_locations)?.name ?? '—'
  const overdue = maf.status !== 'completed' && maf.status !== 'cancelled' && isOverdue(maf.priority, maf.discovered_at)
  const age = daysOpen(maf.discovered_at)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link href="/maintenance" style={{ fontSize: 14 }}>← Back to open MAFs</Link>
      <h1 style={{ fontSize: '2rem', margin: '8px 0' }}>{maf.maf_number}</h1>
      <MaintenanceNav />

      <div style={{ background: 'white', borderRadius: 12, padding: '8px 24px 16px', borderTop: `8px solid ${p.color}` }}>
        <Row label="Priority">
          <PriorityBadge priority={maf.priority} showLabel /> <span style={{ color: '#6b7280', fontSize: 14 }}>· {p.description}</span>
        </Row>
        <Row label="Status">
          <strong>{STATUS_LABELS[maf.status]}</strong>
          {overdue ? <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>Overdue</span> : null}
          <span style={{ marginLeft: 10, color: '#6b7280', fontSize: 14 }}>{age === 0 ? 'Opened today' : `${age} day${age === 1 ? '' : 's'} open`}</span>
        </Row>
        <Row label="Location">
          {location}
          {maf.location_detail ? ` — ${maf.location_detail}` : ''}
          {maf.room_out_of_service ? (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>Room out of service</span>
          ) : null}
        </Row>
        <Row label="Assigned to">
          {assignee?.name ?? '—'}
          {assignee?.role_label ? <span style={{ color: '#6b7280' }}> — {assignee.role_label}</span> : null}
          {assignee?.phone ? <span style={{ color: '#6b7280' }}> · {assignee.phone}</span> : null}
          {assignee && assignee.kind !== 'staff' ? (
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Outside vendor — requires verified-by sign-off before closing.</div>
          ) : null}
        </Row>
        <Row label="Initiated by">{maf.initiated_by_name}</Row>
        <Row label="Discovered">{formatDateTime(maf.discovered_at)}</Row>
        <Row label="Discrepancy">
          <div style={{ whiteSpace: 'pre-wrap' }}>{maf.description}</div>
        </Row>
        <Row label="Corrective action / notes">
          {maf.completion_notes ? <div style={{ whiteSpace: 'pre-wrap' }}>{maf.completion_notes}</div> : <span style={{ color: '#9ca3af' }}>None yet</span>}
        </Row>
        {maf.completed_at ? <Row label="Completed">{formatDateTime(maf.completed_at)}</Row> : null}
        {maf.verified_at ? <Row label="Verified">{formatDateTime(maf.verified_at)}</Row> : null}
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: '12px 16px', borderRadius: 10, marginTop: 16, fontSize: 14 }}>
        Status changes, reassigning, and closing with completion notes are coming in the next build phase (1.5.0-b).
      </div>

      <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>History</h2>
      <div style={{ background: 'white', borderRadius: 12, padding: '4px 20px' }}>
        {((events as EventRow[] | null) ?? []).map((ev) => (
          <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
            <span>
              <strong>{EVENT_LABELS[ev.event] ?? ev.event}</strong>
              {ev.event === 'status_changed' && ev.from_value && ev.to_value
                ? ` — ${STATUS_LABELS[ev.from_value as MafStatus] ?? ev.from_value} → ${STATUS_LABELS[ev.to_value as MafStatus] ?? ev.to_value}`
                : ''}
            </span>
            <span style={{ color: '#6b7280' }}>{formatDateTime(ev.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
