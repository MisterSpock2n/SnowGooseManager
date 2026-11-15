'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export type Property = {
  id: string
  name: string
}

export type UserRow = {
  id: string
  full_name: string
}

export type TimeEntry = {
  id: string
  entry_date: string
  entry_type: 'hourly' | 'overnight'
  work_type: 'cleaning' | 'maintenance' | 'it' | 'general' | null
  hours_worked: number | null
  calculated_pay: number
  notes: string | null
  property_id: string
  user_id: string
  properties: { name: string } | { name: string }[] | null
  users: { full_name: string | null } | { full_name: string | null }[] | null
}

function localToday() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

// Lists are loaded on the server (see page.tsx) so the form never comes up empty
// while the browser is still picking up the sign-in.
export default function TimePage({
  initialProperties,
  initialUsers,
  initialEntries,
  loadError,
}: {
  initialProperties: Property[]
  initialUsers: UserRow[]
  initialEntries: TimeEntry[]
  loadError: string
}) {
  const [properties] = useState<Property[]>(initialProperties)
  const [users] = useState<UserRow[]>(initialUsers)
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(loadError)

  const [propertyId, setPropertyId] = useState(initialProperties[0]?.id ?? '')
  const [userId, setUserId] = useState(initialUsers[0]?.id ?? '')
  const [entryDate, setEntryDate] = useState(localToday)
  const [entryType, setEntryType] = useState<'hourly' | 'overnight'>('hourly')
  const [workType, setWorkType] = useState<'cleaning' | 'maintenance' | 'it' | 'general'>('cleaning')
  const [hoursWorked, setHoursWorked] = useState('1')
  const [rateApplied, setRateApplied] = useState('40')
  const [overnightBasePay, setOvernightBasePay] = useState('250')
  const [roomRevenue, setRoomRevenue] = useState('0')
  const [overnightCommissionRate, setOvernightCommissionRate] = useState('0.10')
  const [revenueLookup, setRevenueLookup] = useState<{ loading: boolean; message: string; error: boolean }>({
    loading: false,
    message: '',
    error: false,
  })
  const [notes, setNotes] = useState('')

  const calculatedPay = useMemo(() => {
    if (entryType === 'hourly') {
      const hours = Number(hoursWorked || 0)
      const rate = Number(rateApplied || 0)
      return Number((hours * rate).toFixed(2))
    }

    const base = Number(overnightBasePay || 0)
    const revenue = Number(roomRevenue || 0)
    const commission = Number(overnightCommissionRate || 0)
    return Number((base + revenue * commission).toFixed(2))
  }, [entryType, hoursWorked, rateApplied, overnightBasePay, roomRevenue, overnightCommissionRate])

  const supabase = createClient()

  async function fetchRoomRevenue() {
    setRevenueLookup({ loading: true, message: '', error: false })
    try {
      const res = await fetch(`/api/thinkreservations/room-revenue?date=${encodeURIComponent(entryDate)}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRevenueLookup({ loading: false, message: body.error ?? 'Could not get room revenue.', error: true })
        return
      }
      setRoomRevenue(String(body.revenue))
      const count = body.reservations === 1 ? '1 reservation' : `${body.reservations} reservations`
      setRevenueLookup({
        loading: false,
        message: `From ThinkReservations for ${entryDate}: ${count}, before taxes. You can still edit the amount.`,
        error: false,
      })
    } catch {
      setRevenueLookup({ loading: false, message: 'Could not reach ThinkReservations. Enter the amount by hand.', error: true })
    }
  }

  async function loadEntries() {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      id,
      entry_date,
      entry_type,
      work_type,
      hours_worked,
      calculated_pay,
      notes,
      property_id,
      user_id,
      properties(name),
      users(full_name)
    `)
    .order('entry_date', { ascending: false })
    .limit(20)

  if (error) {
    setMessage(`Could not load time entries: ${error.message}`)
    return
  }
  setEntries((data as TimeEntry[]) ?? [])
}


  useEffect(() => {
  if (entryType !== 'hourly') return

  if (workType === 'it') {
    setRateApplied('75')
  } else if (workType === 'general') {
    setRateApplied('25')
  } else {
    setRateApplied('40')
  }
}, [entryType, workType])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    let payload: {
  property_id: string
  user_id: string
  entry_date: string
  entry_type: 'hourly' | 'overnight'
  work_type: 'cleaning' | 'maintenance' | 'it' | 'general' | null
  hours_worked: number | null
  rate_applied: number | null
  overnight_base_pay: number | null
  room_revenue: number | null
  overnight_commission_rate: number | null
  calculated_pay: number
  notes: string | null
}

if (entryType === 'hourly') {
  payload = {
    property_id: propertyId,
    user_id: userId,
    entry_date: entryDate,
    entry_type: 'hourly',
    work_type: workType,
    hours_worked: Number(hoursWorked),
    rate_applied: Number(rateApplied),
    overnight_base_pay: null,
    room_revenue: null,
    overnight_commission_rate: null,
    calculated_pay: calculatedPay,
    notes: notes || null,
  }
} else {
  payload = {
    property_id: propertyId,
    user_id: userId,
    entry_date: entryDate,
    entry_type: 'overnight',
    work_type: null,
    hours_worked: null,
    rate_applied: null,
    overnight_base_pay: Number(overnightBasePay),
    room_revenue: Number(roomRevenue),
    overnight_commission_rate: Number(overnightCommissionRate),
    calculated_pay: calculatedPay,
    notes: notes || null,
  }
}

    const { error } = await supabase.from('time_entries').insert(payload)

    if (error) {
      setMessage(`Could not save time entry: ${error.message}`)
      setLoading(false)
      return
    }

    setMessage('Time entry saved.')
    setNotes('')
    if (entryType === 'hourly') {
      setHoursWorked('1')
    } else {
      setRoomRevenue('0')
    }

    await loadEntries()
    setLoading(false)
  }

  async function handleDeleteEntry(entryId: string) {
  const confirmed = window.confirm('Delete this time entry?')
  if (!confirmed) return

  setLoading(true)
  setMessage('')

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    setMessage(`Could not delete time entry: ${error.message}`)
    setLoading(false)
    return
  }

  setMessage('Time entry deleted.')
  await loadEntries()
  setLoading(false)
}

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Time Entry</h1>
      <p style={{ marginBottom: '24px', color: 'var(--muted)' }}>
        Log hourly work and overnight pay entries for Snow Goose payroll.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <label>Property</label>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label>User</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label>Entry date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label>Entry type</label>
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as 'hourly' | 'overnight')}
          >
            <option value="hourly">Hourly</option>
            <option value="overnight">Overnight</option>
          </select>
        </div>

        {entryType === 'hourly' ? (
          <>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label>Work type</label>
              <select
                value={workType}
                onChange={(e) =>
                  setWorkType(e.target.value as 'cleaning' | 'maintenance' | 'it' | 'general')
                }
              >
                <option value="cleaning">Cleaning</option>
                <option value="maintenance">Maintenance</option>
                <option value="it">IT</option>
                <option value="general">General</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label>Hours worked</label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label>Rate applied</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rateApplied}
                onChange={(e) => setRateApplied(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label>Overnight base pay</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={overnightBasePay}
                onChange={(e) => setOvernightBasePay(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label>Room revenue</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomRevenue}
                  onChange={(e) => setRoomRevenue(e.target.value)}
                  required
                  style={{ flex: '1 1 140px' }}
                />
                <button type="button" onClick={fetchRoomRevenue} disabled={revenueLookup.loading || !entryDate}>
                  {revenueLookup.loading ? 'Getting revenue...' : 'Get from ThinkReservations'}
                </button>
              </div>
              {revenueLookup.message ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: revenueLookup.error ? 'var(--bad)' : 'var(--muted)' }}>
                  {revenueLookup.message}
                </p>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label>Commission rate</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={overnightCommissionRate}
                onChange={(e) => setOvernightCommissionRate(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <div style={{ display: 'grid', gap: '8px' }}>
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        </div>

        <div
          style={{
            padding: '12px 16px',
            background: 'var(--panel-2)',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          Calculated pay: ${calculatedPay.toFixed(2)}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 'none',
          }}
        >
          {loading ? 'Saving...' : 'Save time entry'}
        </button>

        {message ? <p>{message}</p> : null}
      </form>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Recent entries</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '16px 20  px',
                background: entry.entry_type === 'overnight' ? 'var(--warn-bg)' : 'var(--panel-2)',
                lineHeight: '1.5'
              }}
            >

              <div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  }}
>
  <div>
    <strong>Date:</strong> {entry.entry_date}
  </div>

  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    }}
  >
    <div>
      <strong>Type:</strong>{' '}
      {entry.entry_type === 'overnight' ? 'Overnight stay' : 'Hourly work'}
    </div>

    <button
      type="button"
      onClick={() => handleDeleteEntry(entry.id)}
      disabled={loading}
      style={{
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px solid var(--bad)',
        background: 'var(--panel)',
        color: 'var(--bad)',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      Delete
    </button>
  </div>
</div>

  <div><strong>Property:</strong> {Array.isArray(entry.properties) ? entry.properties[0]?.name : entry.properties?.name ?? '—'}</div>
<div><strong>User:</strong> {Array.isArray(entry.users) ? entry.users[0]?.full_name : entry.users?.full_name ?? '—'}</div>

  {entry.entry_type === 'hourly' ? (
    <>
      <div><strong>Work type:</strong> {entry.work_type ?? '—'}</div>
      <div><strong>Hours:</strong> {entry.hours_worked ?? '—'}</div>
      <div><strong>Pay:</strong> ${Number(entry.calculated_pay).toFixed(2)}</div>
    </>
  ) : (
    <>
      <div><strong>Overnight payout:</strong> ${Number(entry.calculated_pay).toFixed(2)}</div>
      <div><strong>Work type:</strong> Overnight</div>
    </>
  )}
  <div><strong>Notes:</strong> {entry.notes ?? '—'}</div>
               
  </div>
          ))}

          {entries.length === 0 ? <p>No entries yet.</p> : null}
        </div>
      </section>
    </div>
  )
}
