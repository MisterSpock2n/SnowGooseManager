import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import NewMafForm from './NewMafForm'
import type { Assignee, Location } from '@/lib/maintenance'

export default async function NewMafPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const email = String(claimsData.claims.email ?? '')

  const [{ data: assignees }, { data: locations }, { data: role }] = await Promise.all([
    supabase.from('maintenance_assignees').select('id, name, kind, role_label, phone').eq('active', true).order('sort_order'),
    supabase.from('maintenance_locations').select('id, name, kind').eq('active', true).order('sort_order'),
    supabase.from('staff_roles').select('display_name').ilike('email', email).maybeSingle(),
  ])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>New Maintenance Action Form</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Report an issue so it can be assigned, tracked, and closed out.
      </p>
      <MaintenanceNav active="new" />
      <NewMafForm
        assignees={(assignees as Assignee[] | null) ?? []}
        locations={(locations as Location[] | null) ?? []}
        initiatedByName={role?.display_name ?? email}
      />
    </div>
  )
}
