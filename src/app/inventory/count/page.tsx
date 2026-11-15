import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryNav from '@/components/inventory/InventoryNav'
import CountSheet from './CountSheet'
import type { InventoryItem } from '@/lib/inventory'

export default async function CountSheetPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, category, unit, quantity_on_hand, reorder_level, reorder_quantity, storage_location, vendor, reorder_url, notes, active, last_counted_at, updated_at')
    .eq('active', true)
    .order('name')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="no-print">
        <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Count sheet</h1>
        <p style={{ marginTop: 0, marginBottom: 20, color: 'var(--muted)' }}>
          Walk a storage spot and type what is on the shelf. Leave a line blank to skip it. Nothing changes until you press Save counts.
        </p>
        <InventoryNav active="count" />
      </div>
      {error ? (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-line)', color: 'var(--bad)', padding: '12px 16px', borderRadius: 10 }}>
          Could not load inventory: {error.message}
        </div>
      ) : (
        <CountSheet items={(data as InventoryItem[] | null) ?? []} />
      )}
    </div>
  )
}
