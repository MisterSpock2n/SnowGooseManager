'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PrioritySelect from '@/components/maintenance/PrioritySelect'
import type { Assignee, Location, Priority } from '@/lib/maintenance'

function nowForInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const fieldStyle = { display: 'grid', gap: 6 } as const
const inputStyle = { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, background: 'white' } as const
const labelStyle = { fontWeight: 600, fontSize: 14 } as const

export default function NewMafForm({
  assignees,
  locations,
  initiatedByName,
}: {
  assignees: Assignee[]
  locations: Location[]
  initiatedByName: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [locationId, setLocationId] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [description, setDescription] = useState('')
  const [roomOutOfService, setRoomOutOfService] = useState(false)
  const [discoveredAt, setDiscoveredAt] = useState(nowForInput())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const staff = assignees.filter((a) => a.kind === 'staff')
  const outside = assignees.filter((a) => a.kind !== 'staff')
  const selectedAssignee = useMemo(() => assignees.find((a) => a.id === assignedTo), [assignees, assignedTo])
  const selectedLocation = locations.find((l) => String(l.id) === locationId)
  const guestRooms = locations.filter((l) => l.kind === 'guest_room')
  const otherAreas = locations.filter((l) => l.kind !== 'guest_room')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')

    if (!priority) {
      setMessage('Please choose a priority.')
      return
    }
    if (selectedLocation?.name === 'Other' && !locationDetail.trim()) {
      setMessage('Please describe the location when "Other" is selected.')
      return
    }

    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setSaving(false)
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('maintenance_actions')
      .insert({
        location_id: Number(locationId),
        location_detail: locationDetail.trim() || null,
        assigned_to: assignedTo,
        priority,
        description: description.trim(),
        room_out_of_service: roomOutOfService,
        discovered_at: new Date(discoveredAt).toISOString(),
        initiated_by: userData.user.id,
        initiated_by_name: initiatedByName,
      })
      .select('maf_number')
      .single()

    if (error) {
      setMessage(`Could not create MAF: ${error.message}`)
      setSaving(false)
      return
    }

    router.push(`/maintenance?created=${encodeURIComponent(data.maf_number)}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18, background: 'white', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>Initiated by</span>
          <div style={{ ...inputStyle, background: '#f3f4f6', color: '#374151' }}>{initiatedByName}</div>
        </div>
        <div style={fieldStyle}>
          <label htmlFor="discovered" style={labelStyle}>Date / time discovered</label>
          <input id="discovered" type="datetime-local" value={discoveredAt} onChange={(e) => setDiscoveredAt(e.target.value)} required style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="location" style={labelStyle}>Location</label>
          <select id="location" value={locationId} onChange={(e) => setLocationId(e.target.value)} required style={inputStyle}>
            <option value="" disabled>Select a location</option>
            <optgroup label="Guest rooms">
              {guestRooms.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </optgroup>
            <optgroup label="Other areas">
              {otherAreas.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div style={fieldStyle}>
          <label htmlFor="locationDetail" style={labelStyle}>
            Location detail {selectedLocation?.name === 'Other' ? '' : <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>}
          </label>
          <input
            id="locationDetail"
            value={locationDetail}
            onChange={(e) => setLocationDetail(e.target.value)}
            placeholder="e.g. bathroom sink, north window"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldStyle}>
          <label htmlFor="assigned" style={labelStyle}>Assigned to</label>
          <select id="assigned" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required style={inputStyle}>
            <option value="" disabled>Who should take care of this?</option>
            <optgroup label="Snow Goose staff">
              {staff.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.role_label ? ` — ${a.role_label}` : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Outside help">
              {outside.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.role_label ? ` — ${a.role_label}` : ''}
                </option>
              ))}
            </optgroup>
          </select>
          {selectedAssignee && selectedAssignee.kind !== 'staff' ? (
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {selectedAssignee.phone ? `Phone: ${selectedAssignee.phone}. ` : ''}
              Outside-vendor work needs a verified-by sign-off from Nick, Rhiannon, or Jon before it can be closed.
            </span>
          ) : null}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Priority</span>
          <PrioritySelect value={priority} onChange={setPriority} />
        </div>
      </div>

      <div style={fieldStyle}>
        <label htmlFor="description" style={labelStyle}>Discrepancy — describe the issue</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={6}
          placeholder="What's wrong, what you noticed, and anything you already tried."
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </div>

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
        <input type="checkbox" checked={roomOutOfService} onChange={(e) => setRoomOutOfService(e.target.checked)} />
        This issue puts the room out of service (can&apos;t be sold until fixed)
      </label>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, color: '#6b7280', fontSize: 14 }}>
        Completion notes (part numbers, steps taken, vendor details) are added by whoever closes the MAF, from its detail page.
      </div>

      {message ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8 }}>{message}</div>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, fontSize: 15, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Creating…' : 'Create MAF'}
        </button>
      </div>
    </form>
  )
}
