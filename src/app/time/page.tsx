import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TimePageClient, { type Property, type TimeEntry, type UserRow } from './TimePageClient'

export const dynamic = 'force-dynamic'

export default async function TimePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login')
  }

  const [propertiesRes, usersRes, entriesRes] = await Promise.all([
    supabase.from('properties').select('id, name').order('name'),
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase
      .from('time_entries')
      .select('id, entry_date, entry_type, work_type, hours_worked, calculated_pay, notes, property_id, user_id, properties(name), users(full_name)')
      .order('entry_date', { ascending: false })
      .limit(20),
  ])

  const loadError = propertiesRes.error
    ? `Could not load properties: ${propertiesRes.error.message}`
    : usersRes.error
      ? `Could not load users: ${usersRes.error.message}`
      : entriesRes.error
        ? `Could not load time entries: ${entriesRes.error.message}`
        : ''

  return (
    <TimePageClient
      initialProperties={(propertiesRes.data as Property[] | null) ?? []}
      initialUsers={(usersRes.data as UserRow[] | null) ?? []}
      initialEntries={(entriesRes.data as TimeEntry[] | null) ?? []}
      loadError={loadError}
    />
  )
}
