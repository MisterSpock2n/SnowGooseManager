import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InventoryNav from '@/components/inventory/InventoryNav'
import StockBadge from '@/components/inventory/StockBadge'
import StockActions from '@/components/inventory/StockActions'
import ItemManage from './ItemManage'
import { TXN_LABELS, categoryInfo, fmtQty, plural, stockState, type InventoryItem, type TxnKind } from '@/lib/inventory'
import { formatDateTime } from '@/lib/maintenance'

type Txn = {
  id: string
  kind: TxnKind
  quantity: number
  quantity_delta: number | null
  quantity_after: number | null
  note: string | null
  created_by_name: string | null
  created_at: string
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ color: '#6b7280', fontSize: 14 }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) {
    redirect('/login')
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const email = String(claimsData.claims.email ?? '')

  const [{ data, error }, { data: txns }, { data: role }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id, name, category, unit, quantity_on_hand, reorder_level, reorder_quantity, storage_location, vendor, reorder_url, notes, active, last_counted_at, updated_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('inventory_transactions')
      .select('id, kind, quantity, quantity_delta, quantity_after, note, created_by_name, created_at')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('staff_roles').select('can_close_maf').ilike('email', email).maybeSingle(),
  ])

  if (error) return <p style={{ color: '#991b1b' }}>Could not load item: {error.message}</p>
  if (!data) notFound()
  const item = data as InventoryItem
  const s = stockState(item)
  const cat = categoryInfo(item.category)
  const history = (txns as Txn[] | null) ?? []

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link href="/inventory" style={{ fontSize: 14 }}>← Back to inventory</Link>
      <h1 style={{ fontSize: '2rem', margin: '8px 0' }}>{item.name}</h1>
      <InventoryNav />

      <div style={{ background: 'white', borderRadius: 12, padding: '8px 24px 16px', borderTop: `8px solid ${cat.color}` }}>
        <Row label="On hand">
          <strong style={{ fontSize: 22 }}>{s === 'uncounted' ? '—' : fmtQty(item.quantity_on_hand)}</strong> {plural(item.unit, Number(item.quantity_on_hand))}{' '}
          <StockBadge state={s} />
          {!item.active ? <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#4b5563', background: '#f3f4f6', padding: '2px 8px', borderRadius: 999 }}>Archived</span> : null}
        </Row>
        <Row label="Category">{cat.label}</Row>
        <Row label="Low-stock level">{Number(item.reorder_level) > 0 ? `${fmtQty(item.reorder_level)} ${plural(item.unit, Number(item.reorder_level))}` : <span style={{ color: '#9ca3af' }}>Not set (never flagged)</span>}</Row>
        <Row label="Usual order amount">{item.reorder_quantity ? `${fmtQty(item.reorder_quantity)} ${plural(item.unit, Number(item.reorder_quantity))}` : <span style={{ color: '#9ca3af' }}>—</span>}</Row>
        <Row label="Storage spot">{item.storage_location ?? <span style={{ color: '#9ca3af' }}>—</span>}</Row>
        <Row label="Where to buy">
          {item.vendor ?? <span style={{ color: '#9ca3af' }}>—</span>}
          {item.reorder_url ? (
            <>
              {' · '}
              <a href={item.reorder_url} target="_blank" rel="noreferrer">Reorder link</a>
            </>
          ) : null}
        </Row>
        {item.notes ? <Row label="Notes"><div style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</div></Row> : null}
        <Row label="Last counted">{item.last_counted_at ? formatDateTime(item.last_counted_at) : <span style={{ color: '#9ca3af' }}>Never</span>}</Row>
      </div>

      {item.active ? (
        <div style={{ marginTop: 16, background: 'white', borderRadius: 12, padding: 20, display: 'grid', gap: 10 }}>
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Log stock</h2>
          <StockActions itemId={item.id} itemName={item.name} unit={item.unit} onHand={Number(item.quantity_on_hand)} />
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <ItemManage item={item} canDelete={Boolean(role?.can_close_maf)} hasHistory={history.length > 0} />
      </div>

      <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>History</h2>
      <div style={{ background: 'white', borderRadius: 12, padding: '4px 20px' }}>
        {history.length === 0 ? <p style={{ color: '#6b7280' }}>No stock activity yet.</p> : null}
        {history.map((t) => {
          const delta = Number(t.quantity_delta ?? 0)
          return (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14, flexWrap: 'wrap' }}>
              <span>
                <strong>{TXN_LABELS[t.kind]}</strong>{' '}
                {t.kind === 'count' ? `${fmtQty(t.quantity)}` : fmtQty(t.quantity)} {plural(item.unit, Number(t.quantity))}
                {t.kind === 'count' ? (
                  <span style={{ color: delta === 0 ? '#6b7280' : delta > 0 ? '#166534' : '#991b1b' }}> ({delta > 0 ? '+' : ''}{fmtQty(delta)})</span>
                ) : null}
                <span style={{ color: '#6b7280' }}> → {fmtQty(t.quantity_after)} on hand</span>
                {t.note ? <span style={{ color: '#374151' }}> · {t.note}</span> : null}
                {t.created_by_name ? <span style={{ color: '#6b7280' }}> · by {t.created_by_name}</span> : null}
              </span>
              <span style={{ color: '#6b7280' }}>{formatDateTime(t.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
