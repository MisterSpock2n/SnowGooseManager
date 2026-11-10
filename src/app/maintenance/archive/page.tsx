import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import PriorityBadge from '@/components/maintenance/PriorityBadge'
import { PRIORITIES, STATUS_LABELS, formatDateTime, one, priorityInfo, type Assignee, type Location, type MafStatus } from '@/lib/maintenance'

type SearchParams = Promise<{
  q?: string
  status?: string
  assigned?: string
  location?: string
  priority?: string
  closedBy?: string
  from?: string
  to?: string
}>

type ArchivedMaf = {
  id: string
  maf_number: string
  description: string
  completion_notes: string | null
  priority: number
  status: MafStatus
  location_detail: string | null
  completed_at: string | null
  completed_by_name: string | null
  verified_by_name: string | null
  cost: number | null
  maintenance_locations: { name: string } | { name: string }[] | null
  maintenance_assignees: { name: string } | { name: string }[] | null
  maintenance_photos: { id: string }[] | null
}

const RESULT_LIMIT = 200
const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' } as const

// Words to match; quotes and PostgREST control characters are removed
function searchTerms(q: string) {
  return q
    .replace(/["\\(),*%_]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function snippet(text: string | null, terms: string[], max = 160) {
  if (!text) return ''
  const lower = text.toLowerCase()
  const hit = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  const start = hit !== undefined && hit > 60 ? hit - 60 : 0
  const out = text.slice(start, start + max)
  return `${start > 0 ? '…' : ''}${out}${start + max < text.length ? '…' : ''}`
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || !text) return <>{text}</>
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} style={{ background: '#fef08a', padding: 0 }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default async function MaintenanceArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const [{ data: assignees }, { data: locations }, { data: roles }] = await Promise.all([
    supabase.from('maintenance_assignees').select('id, name, kind, role_label, phone').order('sort_order'),
    supabase.from('maintenance_locations').select('id, name, kind').order('sort_order'),
    supabase.from('staff_roles').select('display_name').eq('can_close_maf', true).order('display_name'),
  ])

  const terms = searchTerms(params.q ?? '')
  const statuses: MafStatus[] = params.status === 'completed' ? ['completed'] : params.status === 'cancelled' ? ['cancelled'] : ['completed', 'cancelled']

  let query = supabase
    .from('maintenance_actions')
    .select(
      `id, maf_number, description, completion_notes, priority, status, location_detail,
       completed_at, completed_by_name, verified_by_name, cost,
       maintenance_locations(name),
       maintenance_assignees(name),
       maintenance_photos(id)`,
      { count: 'exact' }
    )
    .in('status', statuses)
    .order('completed_at', { ascending: false })
    .limit(RESULT_LIMIT)

  // Every word must appear in at least one of the text fields
  for (const t of terms) {
    const v = `"%${t}%"`
    query = query.or(`maf_number.ilike.${v},description.ilike.${v},completion_notes.ilike.${v},location_detail.ilike.${v}`)
  }
  if (params.assigned) query = query.eq('assigned_to', params.assigned)
  if (params.location) query = query.eq('location_id', Number(params.location))
  if (params.priority) query = query.eq('priority', Number(params.priority))
  if (params.closedBy) query = query.eq('completed_by_name', params.closedBy)
  if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) query = query.gte('completed_at', `${params.from}T00:00:00-05:00`)
  if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) query = query.lte('completed_at', `${params.to}T23:59:59.999-05:00`)

  const { data, error, count } = await query
  const mafs = (data as ArchivedMaf[] | null) ?? []
  const hasFilters = Boolean(params.q || params.status || params.assigned || params.location || params.priority || params.closedBy || params.from || params.to)
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Maintenance Archive</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Closed MAFs. Search descriptions and completion notes for part numbers, vendors, or past fixes.
      </p>

      <MaintenanceNav active="archive" />

      <form method="get" style={{ display: 'grid', gap: 10, background: 'white', padding: 14, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search e.g. water heater, part number, Gered…"
            aria-label="Search archive"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
          />
          <button type="submit" style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            Search
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select name="status" defaultValue={params.status ?? ''} style={selectStyle} aria-label="Status">
            <option value="">Completed &amp; cancelled</option>
            <option value="completed">Completed only</option>
            <option value="cancelled">Cancelled only</option>
          </select>
          <select name="location" defaultValue={params.location ?? ''} style={selectStyle} aria-label="Location">
            <option value="">All locations</option>
            {((locations as Location[] | null) ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select name="assigned" defaultValue={params.assigned ?? ''} style={selectStyle} aria-label="Assigned to">
            <option value="">All assignees</option>
            {((assignees as Assignee[] | null) ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select name="closedBy" defaultValue={params.closedBy ?? ''} style={selectStyle} aria-label="Closed by">
            <option value="">Closed by anyone</option>
            {((roles as { display_name: string }[] | null) ?? []).map((r) => (
              <option key={r.display_name} value={r.display_name}>{r.display_name}</option>
            ))}
          </select>
          <select name="priority" defaultValue={params.priority ?? ''} style={selectStyle} aria-label="Priority">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.short} · {p.label}</option>
            ))}
          </select>
          <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
            Closed from
            <input type="date" name="from" defaultValue={params.from ?? ''} style={selectStyle} />
          </label>
          <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
            to
            <input type="date" name="to" defaultValue={params.to ?? ''} style={selectStyle} />
          </label>
          {hasFilters ? <Link href="/maintenance/archive" style={{ fontSize: 14 }}>Clear</Link> : null}
        </div>
      </form>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          Could not load the archive: {error.message}
        </div>
      ) : null}

      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 10 }}>
        {count ?? mafs.length} closed MAF{(count ?? mafs.length) === 1 ? '' : 's'}
        {count && count > RESULT_LIMIT ? ` — showing the ${RESULT_LIMIT} most recent; narrow your search to see older ones` : ''}
      </div>

      {mafs.length === 0 && !error ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280' }}>
          {hasFilters ? 'No closed MAFs match this search.' : 'No closed MAFs yet. Completed and cancelled MAFs will show up here.'}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {mafs.map((maf) => {
          const p = priorityInfo(maf.priority)
          const loc = one(maf.maintenance_locations)?.name ?? '—'
          const assignee = one(maf.maintenance_assignees)?.name ?? '—'
          const photoCount = maf.maintenance_photos?.length ?? 0
          const notes = snippet(maf.completion_notes, terms)
          return (
            <Link
              key={maf.id}
              href={`/maintenance/${maf.id}`}
              style={{ display: 'grid', gap: 6, background: 'white', borderRadius: 12, padding: '14px 16px', borderLeft: `8px solid ${maf.status === 'cancelled' ? '#9ca3af' : p.color}`, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <PriorityBadge priority={maf.priority} />
                <strong>
                  <Highlight text={maf.maf_number} terms={terms} />
                </strong>
                <span style={{ color: '#374151' }}>
                  {loc}
                  {maf.location_detail ? <> — <Highlight text={maf.location_detail} terms={terms} /></> : null}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: maf.status === 'completed' ? '#dcfce7' : '#f3f4f6',
                    color: maf.status === 'completed' ? '#166534' : '#4b5563',
                  }}
                >
                  {STATUS_LABELS[maf.status]}
                </span>
                {photoCount ? <span style={{ fontSize: 12, color: '#6b7280' }}>{photoCount} photo{photoCount === 1 ? '' : 's'}</span> : null}
              </div>
              <div style={{ color: '#1f2937' }}>
                <Highlight text={snippet(maf.description, terms)} terms={terms} />
              </div>
              {notes ? (
                <div style={{ fontSize: 14, color: '#374151', background: '#f8fafc', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ fontWeight: 600 }}>Notes: </span>
                  <Highlight text={notes} terms={terms} />
                </div>
              ) : null}
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                Assigned to {assignee} · {maf.status === 'cancelled' ? 'Cancelled' : 'Completed'} by {maf.completed_by_name ?? '—'} on {formatDateTime(maf.completed_at)}
                {maf.verified_by_name ? ` · Verified by ${maf.verified_by_name}` : ''}
                {maf.cost !== null ? ` · ${currency.format(maf.cost)}` : ''}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
