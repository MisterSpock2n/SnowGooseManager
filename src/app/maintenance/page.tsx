import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import PriorityBadge from '@/components/maintenance/PriorityBadge'
import {
  OPEN_STATUSES,
  PRIORITIES,
  STATUS_LABELS,
  daysOpen,
  isOverdue,
  one,
  priorityInfo,
  type Assignee,
  type Location,
  type MafStatus,
} from '@/lib/maintenance'

type SearchParams = Promise<{
  assigned?: string
  priority?: string
  location?: string
  status?: string
  oos?: string
  created?: string
}>

type OpenMaf = {
  id: string
  maf_number: string
  description: string
  priority: number
  status: MafStatus
  room_out_of_service: boolean
  discovered_at: string
  initiated_by_name: string
  location_detail: string | null
  maintenance_locations: { name: string } | { name: string }[] | null
  maintenance_assignees: { name: string; kind: string } | { name: string; kind: string }[] | null
}

const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' } as const

export default async function MaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const [{ data: assignees }, { data: locations }] = await Promise.all([
    supabase.from('maintenance_assignees').select('id, name, kind, role_label, phone').eq('active', true).order('sort_order'),
    supabase.from('maintenance_locations').select('id, name, kind').eq('active', true).order('sort_order'),
  ])

  let query = supabase
    .from('maintenance_actions')
    .select(
      `id, maf_number, description, priority, status, room_out_of_service, discovered_at,
       initiated_by_name, location_detail,
       maintenance_locations(name),
       maintenance_assignees(name, kind)`
    )
    .in('status', params.status && OPEN_STATUSES.includes(params.status as MafStatus) ? [params.status] : OPEN_STATUSES)
    .order('priority', { ascending: true })
    .order('discovered_at', { ascending: true })

  if (params.assigned) query = query.eq('assigned_to', params.assigned)
  if (params.priority) query = query.eq('priority', Number(params.priority))
  if (params.location) query = query.eq('location_id', Number(params.location))
  if (params.oos === '1') query = query.eq('room_out_of_service', true)

  const { data, error } = await query
  const mafs = (data as OpenMaf[] | null) ?? []
  const now = new Date()

  const counts = PRIORITIES.map((p) => ({ ...p, count: mafs.filter((m) => m.priority === p.value).length }))
  const overdueCount = mafs.filter((m) => isOverdue(m.priority, m.discovered_at, now)).length
  const oosCount = mafs.filter((m) => m.room_out_of_service).length
  const hasFilters = Boolean(params.assigned || params.priority || params.location || params.status || params.oos)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Maintenance</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Open Maintenance Action Forms (MAFs), most urgent first.
      </p>

      <MaintenanceNav active="open" />

      {params.created ? (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          {params.created} was created.
        </div>
      ) : null}

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          Could not load MAFs: {error.message}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {counts.map((p) => (
          <div key={p.value} style={{ background: 'white', borderRadius: 10, padding: '10px 14px', borderLeft: `6px solid ${p.color}`, minWidth: 110 }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{p.short} · {p.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{p.count}</div>
          </div>
        ))}
        <div style={{ background: 'white', borderRadius: 10, padding: '10px 14px', minWidth: 110 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Overdue</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: overdueCount ? '#b91c1c' : undefined }}>{overdueCount}</div>
        </div>
        <div style={{ background: 'white', borderRadius: 10, padding: '10px 14px', minWidth: 110 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Rooms out of service</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{oosCount}</div>
        </div>
      </div>

      <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: 12, borderRadius: 10, marginBottom: 16 }}>
        <select name="assigned" defaultValue={params.assigned ?? ''} style={selectStyle} aria-label="Assigned to">
          <option value="">All assignees</option>
          {((assignees as Assignee[] | null) ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select name="priority" defaultValue={params.priority ?? ''} style={selectStyle} aria-label="Priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.short} · {p.label}</option>
          ))}
        </select>
        <select name="location" defaultValue={params.location ?? ''} style={selectStyle} aria-label="Location">
          <option value="">All locations</option>
          {((locations as Location[] | null) ?? []).map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} style={selectStyle} aria-label="Status">
          <option value="">All open statuses</option>
          {OPEN_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" name="oos" value="1" defaultChecked={params.oos === '1'} />
          Rooms out of service only
        </label>
        <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
          Filter
        </button>
        {hasFilters ? <Link href="/maintenance" style={{ fontSize: 14 }}>Clear</Link> : null}
      </form>

      {mafs.length === 0 && !error ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280' }}>
          {hasFilters ? 'No open MAFs match these filters.' : 'No open MAFs. Nice work.'}{' '}
          <Link href="/maintenance/new">Create a MAF</Link>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {mafs.map((maf) => {
          const p = priorityInfo(maf.priority)
          const loc = one(maf.maintenance_locations)?.name ?? '—'
          const assignee = one(maf.maintenance_assignees)
          const overdue = isOverdue(maf.priority, maf.discovered_at, now)
          const age = daysOpen(maf.discovered_at, now)
          return (
            <Link
              key={maf.id}
              href={`/maintenance/${maf.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 16,
                alignItems: 'center',
                background: 'white',
                borderRadius: 12,
                padding: '14px 16px',
                borderLeft: `8px solid ${p.color}`,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <PriorityBadge priority={maf.priority} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <strong>{maf.maf_number}</strong>
                  <span style={{ color: '#374151' }}>
                    {loc}
                    {maf.location_detail ? ` — ${maf.location_detail}` : ''}
                  </span>
                  {maf.room_out_of_service ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>
                      Room out of service
                    </span>
                  ) : null}
                  {overdue ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 999 }}>
                      Overdue
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: 4, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {maf.description}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
                  Assigned to {assignee?.name ?? '—'} · Initiated by {maf.initiated_by_name}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#374151' }}>
                <div style={{ fontWeight: 600 }}>{STATUS_LABELS[maf.status]}</div>
                <div style={{ color: '#6b7280' }}>{age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'} open`}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
