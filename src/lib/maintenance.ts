export type MafStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_parts'
  | 'awaiting_vendor'
  | 'awaiting_verification'
  | 'completed'
  | 'cancelled'

export type Priority = 1 | 2 | 3 | 4 | 5

export const PRIORITIES: {
  value: Priority
  label: string
  short: string
  description: string
  color: string
  text: string
  responseDays: number | null
}[] = [
  { value: 1, short: 'P1', label: 'Emergency / Safety', description: 'Immediately, same day', color: '#D32F2F', text: '#FFFFFF', responseDays: 1 },
  { value: 2, short: 'P2', label: 'Urgent / Guest-impacting', description: 'Within 24–48 hours', color: '#F57C00', text: '#FFFFFF', responseDays: 2 },
  { value: 3, short: 'P3', label: 'Important', description: 'Within 1 week', color: '#FFB300', text: '#1F1F1F', responseDays: 7 },
  { value: 4, short: 'P4', label: 'Routine', description: 'Within 30 days', color: '#FDD835', text: '#1F1F1F', responseDays: 30 },
  { value: 5, short: 'P5', label: 'Low / Cosmetic', description: 'When convenient', color: '#C0CA33', text: '#1F1F1F', responseDays: null },
]

export function priorityInfo(p: number) {
  return PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[4]
}

export const STATUS_LABELS: Record<MafStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  awaiting_parts: 'Awaiting Parts',
  awaiting_vendor: 'Awaiting Vendor',
  awaiting_verification: 'Awaiting Verification',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const OPEN_STATUSES: MafStatus[] = [
  'open',
  'in_progress',
  'awaiting_parts',
  'awaiting_vendor',
  'awaiting_verification',
]

export const ASSIGNEE_GROUP_LABELS: Record<string, string> = {
  staff: 'Snow Goose staff',
  plumber: 'Outside help',
  electrician: 'Outside help',
  handyman: 'Outside help',
  other: 'Outside help',
}

export function daysOpen(discoveredAt: string, now = new Date()) {
  const ms = now.getTime() - new Date(discoveredAt).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function isOverdue(priority: number, discoveredAt: string, now = new Date()) {
  const days = priorityInfo(priority).responseDays
  if (days === null) return false
  return now.getTime() - new Date(discoveredAt).getTime() > days * 86_400_000
}

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

// Supabase returns joined rows as an object or a one-item array depending on the relationship
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export type Assignee = {
  id: string
  name: string
  kind: 'staff' | 'plumber' | 'electrician' | 'handyman' | 'other'
  role_label: string | null
  phone: string | null
}

export type Location = {
  id: number
  name: string
  kind: string
}
