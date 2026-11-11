import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryNav from '@/components/inventory/InventoryNav'
import ItemForm from '@/components/inventory/ItemForm'

export default async function NewInventoryItemPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }
  const { data: unitRows } = await supabase.from('inventory_items').select('unit')
  const unitsInUse = Array.from(new Set(((unitRows as { unit: string }[] | null) ?? []).map((r) => r.unit)))
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Add an Inventory Item</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Set a low-stock level so the item gets flagged when it&apos;s time to reorder.
      </p>
      <InventoryNav active="new" />
      <ItemForm unitsInUse={unitsInUse} />
    </div>
  )
}
