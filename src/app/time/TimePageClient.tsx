'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Property = {
  id: string
  name: string
}

type UserRow = {
  id: string
  full_name: string
}

type TimeEntry = {
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

export default function TimePage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [propertyId, setPropertyId] = useState('')
  const [userId, setUserId] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [entryType, setEntryType] = useState<'hourly' | 'overnight'>('hourly')
  const [workType, setWorkType] = useState<'cleaning' | 'maintenance' | 'it' | 'general'>('cleaning')
  const [hoursWorked, setHoursWorked] = useState('1')
  const [rateApplied, setRateApplied] = useState('40')
  const [overnightBasePay, setOvernightBasePay] = useState('250')
  const [roomRevenue, setRoomRevenue] = useState('0')
  const [overnightCommissionRate, setOvernightCommissionRate] = useState('0.10')
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

  async function loadReferenceData() {
    const [{ data: propertyData, error: propertyError }, { data: userData, error: userError }] =
      await Promise.all([
        supabase.from('properties').select('id, name').order('name'),
        supabase.from('users').select('id, full_name').order('full_name'),
      ])

    if (propertyError) {
      setMessage(`Could not load properties: ${propertyError.message}`)
      return
    }

    if (userError) {
      setMessage(`Could not load users: ${userError.message}`)
      return
    }

    const safeProperties = propertyData ?? []
    const safeUsers = userData ?? []

    setProperties(safeProperties)
    setUsers(safeUsers)

    if (!propertyId && safeProperties.length > 0) {
      setPropertyId(safeProperties[0].id)
    }

    if (!userId && safeUsers.length > 0) {
      setUserId(safeUsers[0].id)
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
    async function init() {
      await loadReferenceData()
      await loadEntries()
    }
    init()
  }, [])

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
      <p style={{ marginBottom: '24px', color: '#666' }}>
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
              <input
                type="number"
                min="0"
                step="0.01"
                value={roomRevenue}
                onChange={(e) => setRoomRevenue(e.target.value)}
                required
              />
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
            background: '#f4f4f5',
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
            background: '#111827',
            color: 'white',
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
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '16px 20  px',
                background: entry.entry_type === 'overnight' ? '#fff7ed' : '#f8fafc',
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
        border: '1px solid #dc2626',
        background: 'white',
        color: '#dc2626',
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
