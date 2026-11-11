import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MaintenanceNav from '@/components/maintenance/MaintenanceNav'
import NewInvoiceForm, { type MafOption } from './NewInvoiceForm'
import { one, type Assignee } from '@/lib/maintenance'

type MafRow = {
  id: string
  maf_number: string
  description: string
  status: string
  assigned_to: string
  maintenance_locations: { name: string } | { name: string }[] | null
}

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ maf?: string }> }) {
  const { maf } = await searchParams
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const email = String(claimsData.claims.email ?? '')

  const [{ data: assignees }, { data: mafs }, { data: role }] = await Promise.all([
    supabase.from('maintenance_assignees').select('id, name, kind, role_label, phone').eq('active', true).neq('kind', 'staff').order('sort_order'),
    supabase
      .from('maintenance_actions')
      .select('id, maf_number, description, status, assigned_to, maintenance_locations(name)')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase.from('staff_roles').select('display_name').ilike('email', email).maybeSingle(),
  ])

  const mafOptions: MafOption[] = ((mafs as MafRow[] | null) ?? []).map((m) => ({
    id: m.id,
    label: `${m.maf_number} · ${one(m.maintenance_locations)?.name ?? '—'} · ${m.description.slice(0, 60)}${m.description.length > 60 ? '…' : ''}`,
    assignedTo: m.assigned_to,
    closed: m.status === 'completed' || m.status === 'cancelled',
  }))

  const presetMaf = maf && mafOptions.some((m) => m.id === maf) ? maf : ''

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Log an Invoice for Jon</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Upload the bill so Jon can see it from anywhere. Jon gets an email alert at info@snowgooseinn.com as soon as it&apos;s saved.
      </p>
      <MaintenanceNav active="invoices" />
      <NewInvoiceForm
        vendors={(assignees as Assignee[] | null) ?? []}
        mafs={mafOptions}
        presetMafId={presetMaf}
        loggedByName={role?.display_name ?? email}
      />
    </div>
  )
}
