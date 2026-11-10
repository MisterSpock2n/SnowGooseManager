'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PrioritySelect from '@/components/maintenance/PrioritySelect'
import { OPEN_STATUSES, STATUS_LABELS, type Assignee, type MafStatus, type Priority } from '@/lib/maintenance'

type Props = {
  mafId: string
  mafNumber: string
  status: MafStatus
  priority: Priority
  assignedTo: string
  completionNotes: string | null
  cost: number | null
  isVendor: boolean
  canClose: boolean
  currentUserId: string
  assignees: Assignee[]
}

const card = { background: 'white', borderRadius: 12, padding: 20, display: 'grid', gap: 14 } as const
const input = { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, background: 'white' } as const
const label = { fontWeight: 600, fontSize: 14 } as const
const primary = { padding: '11px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' } as const
const secondary = { padding: '11px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#0f172a', fontWeight: 600, fontSize: 15, cursor: 'pointer' } as const

export default function MafActions(props: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isClosed = props.status === 'completed' || props.status === 'cancelled'

  const [status, setStatus] = useState<MafStatus>(isClosed ? 'open' : props.status)
  const [priority, setPriority] = useState<Priority>(props.priority)
  const [assignedTo, setAssignedTo] = useState(props.assignedTo)
  const [notes, setNotes] = useState(props.completionNotes ?? '')
  const [cost, setCost] = useState(props.cost !== null ? String(props.cost) : '')
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const staff = props.assignees.filter((a) => a.kind === 'staff')
  const outside = props.assignees.filter((a) => a.kind !== 'staff')
  const selectedIsVendor = props.assignees.find((a) => a.id === assignedTo)?.kind !== 'staff'

  async function save(update: Record<string, unknown>, success: string) {
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.from('maintenance_actions').update(update).eq('id', props.mafId)
    setBusy(false)
    if (error) {
      setMessage({ kind: 'error', text: error.message })
      return false
    }
    setMessage({ kind: 'ok', text: success })
    router.refresh()
    return true
  }

  function costValue() {
    if (!cost.trim()) return null
    const n = Number(cost)
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : null
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    await save(
      { status, priority, assigned_to: assignedTo, completion_notes: notes.trim() || null, cost: costValue() },
      'MAF updated.'
    )
  }

  async function handleComplete() {
    if (selectedIsVendor && !verified) {
      setMessage({ kind: 'error', text: 'Check the verified-by sign-off before closing outside-vendor work.' })
      return
    }
    if (!window.confirm(`Close ${props.mafNumber} as Completed?`)) return
    const update: Record<string, unknown> = {
      status: 'completed',
      priority,
      assigned_to: assignedTo,
      completion_notes: notes.trim() || null,
      cost: costValue(),
    }
    if (selectedIsVendor) update.verified_by = props.currentUserId
    await save(update, `${props.mafNumber} closed.`)
  }

  async function handleCancel() {
    const reason = window.prompt(`Cancel ${props.mafNumber}? Add a short reason (e.g. duplicate, not needed):`)
    if (reason === null) return
    const combined = [notes.trim(), reason.trim() ? `Cancelled: ${reason.trim()}` : 'Cancelled'].filter(Boolean).join('\n')
    await save({ status: 'cancelled', completion_notes: combined }, `${props.mafNumber} cancelled.`)
  }

  async function handleReopen() {
    if (!window.confirm(`Reopen ${props.mafNumber}? It will move back to the Open MAFs list.`)) return
    await save({ status: 'open', verified_by: null }, `${props.mafNumber} reopened.`)
  }

  async function handleSaveClosedNotes() {
    await save({ completion_notes: notes.trim() || null, cost: costValue() }, 'Notes saved.')
  }

  const feedback = message ? (
    <div
      style={{
        background: message.kind === 'ok' ? '#ecfdf5' : '#fef2f2',
        border: `1px solid ${message.kind === 'ok' ? '#a7f3d0' : '#fecaca'}`,
        color: message.kind === 'ok' ? '#065f46' : '#991b1b',
        padding: '10px 14px',
        borderRadius: 8,
      }}
    >
      {message.text}
    </div>
  ) : null

  const notesField = (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor="notes" style={label}>
        Corrective action / completion notes <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
      </label>
      <textarea
        id="notes"
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Part numbers ordered, steps taken, vendor used, warranty info — searchable in the Archive."
        style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }}
      />
    </div>
  )

  const costField = (
    <div style={{ display: 'grid', gap: 6, maxWidth: 220 }}>
      <label htmlFor="cost" style={label}>
        Cost <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
      </label>
      <input id="cost" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" style={input} />
    </div>
  )

  if (isClosed) {
    return (
      <div style={card}>
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>This MAF is {STATUS_LABELS[props.status].toLowerCase()}</h2>
        {props.canClose ? (
          <>
            {notesField}
            {costField}
            {feedback}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSaveClosedNotes} disabled={busy} style={primary}>Save notes</button>
              <button type="button" onClick={handleReopen} disabled={busy} style={secondary}>Reopen MAF</button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: '#6b7280' }}>Only Nick, Rhiannon, or Jon can edit or reopen a closed MAF.</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleUpdate} style={card}>
      <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Work this MAF</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="status" style={label}>Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as MafStatus)} style={input}>
            {OPEN_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="assigned" style={label}>Assigned to</label>
          <select id="assigned" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={input}>
            <optgroup label="Snow Goose staff">
              {staff.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.role_label ? ` — ${a.role_label}` : ''}</option>
              ))}
            </optgroup>
            <optgroup label="Outside help">
              {outside.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.role_label ? ` — ${a.role_label}` : ''}{a.phone ? ` · ${a.phone}` : ''}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={label}>Priority</span>
        <PrioritySelect value={priority} onChange={setPriority} />
      </div>

      {notesField}
      {costField}

      <div>
        <button type="submit" disabled={busy} style={secondary}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'grid', gap: 12 }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>Close out</h3>
        {props.canClose ? (
          <>
            {selectedIsVendor ? (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', padding: 12, borderRadius: 8 }}>
                <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  <strong>Verified by me:</strong> I checked the outside vendor&apos;s work and it was completed satisfactorily.
                </span>
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleComplete} disabled={busy || (selectedIsVendor && !verified)} style={{ ...primary, background: '#15803d', opacity: selectedIsVendor && !verified ? 0.5 : 1 }}>
                Close as Completed
              </button>
              <button type="button" onClick={handleCancel} disabled={busy} style={secondary}>Cancel MAF</button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            Only Nick, Rhiannon, or Jon can close this MAF.
            {props.isVendor ? ' Set the status to Awaiting Verification when the vendor is done.' : ''}
          </p>
        )}
      </div>

      {feedback}
    </form>
  )
}
