import Link from 'next/link'

type Tab = 'stock' | 'new' | 'shopping' | 'count'

const tabs: { key: Tab; label: string; href: string | null }[] = [
  { key: 'stock', label: 'Stock', href: '/inventory' },
  { key: 'new', label: 'Add item', href: '/inventory/new' },
  { key: 'shopping', label: 'Shopping list', href: '/inventory/shopping' },
  { key: 'count', label: 'Count sheet', href: '/inventory/count' },
]

export default function InventoryNav({ active }: { active?: Tab }) {
  return (
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const base = { padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--line)' } as const
        if (!tab.href) {
          return (
            <span key={tab.key} title="Coming in a later build phase" style={{ ...base, color: 'var(--muted)', background: 'var(--panel-2)', cursor: 'not-allowed' }}>
              {tab.label} (soon)
            </span>
          )
        }
        return (
          <Link key={tab.key} href={tab.href} style={{ ...base, background: isActive ? 'var(--accent)' : 'var(--panel)', color: isActive ? 'var(--on-accent)' : 'var(--text)', borderColor: isActive ? 'var(--accent)' : 'var(--line)' }}>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
