import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryNav from '@/components/inventory/InventoryNav'
import ShoppingList, { type ShoppingItem } from './ShoppingList'
import { isLowOrOut, stockState, suggestedBuy, type InventoryItem } from '@/lib/inventory'
import { formatDateTime } from '@/lib/maintenance'

export default async function ShoppingListPage() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }
  const email = String(claimsData.claims.email ?? '')

  const [{ data, error }, { data: role }, { data: lastAlert }, { data: recipients }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id, name, category, unit, quantity_on_hand, reorder_level, reorder_quantity, storage_location, vendor, reorder_url, notes, active, last_counted_at, updated_at')
      .eq('active', true)
      .order('name'),
    supabase.from('staff_roles').select('can_close_maf').ilike('email', email).maybeSingle(),
    supabase.from('inventory_alert_log').select('sent_at, trigger').order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('staff_roles').select('display_name').eq('low_stock_alerts', true).order('display_name'),
  ])

  const items: ShoppingItem[] = ((data as InventoryItem[] | null) ?? [])
    .filter(isLowOrOut)
    .map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      unit: i.unit,
      onHand: Number(i.quantity_on_hand),
      reorderLevel: Number(i.reorder_level),
      buy: suggestedBuy(i),
      vendor: i.vendor,
      url: i.reorder_url,
      storage: i.storage_location,
      out: stockState(i) === 'out',
    }))

  const names = ((recipients as { display_name: string }[] | null) ?? []).map((r) => r.display_name)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Shopping List</h1>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#666' }}>
        Everything at or below its low-stock level. Tick items off as you shop, then log them as received when they&apos;re put away.
      </p>
      <div className="no-print">
        <InventoryNav active="shopping" />
      </div>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginBottom: 16 }}>
          Could not load inventory: {error.message}
        </div>
      ) : null}

      <ShoppingList
        items={items}
        canSendEmail={Boolean(role?.can_close_maf)}
        emailInfo={
          `Daily low-stock email goes to ${names.length ? names.join(' and ') : 'no one yet'} at 8 AM when something is low.` +
          (lastAlert?.sent_at ? ` Last sent ${formatDateTime(lastAlert.sent_at)}${lastAlert.trigger === 'manual' ? ' (on request)' : ''}.` : ' None sent yet.')
        }
      />

      <p className="no-print" style={{ fontSize: 13, color: '#6b7280', marginTop: 16 }}>
        Not seeing something? Items only show here after their first count, and only if they have a low-stock level. Set these on the item&apos;s page from the{' '}
        <Link href="/inventory">Stock</Link> list.
      </p>
    </div>
  )
}
