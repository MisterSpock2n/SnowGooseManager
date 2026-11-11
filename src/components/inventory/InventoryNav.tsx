import Link from 'next/link'

type Tab = 'stock' | 'new' | 'shopping' | 'count'

const tabs: { key: Tab; label: string; href: string | null }[] = [
  { key: 'stock', label: 'Stock', href: '/inventory' },
  { key: 'new', label: 'Add item', href: '/inventory/new' },
  { key: 'shopping', label: 'Shopping list', href: null },
  { key: 'count', label: 'Count sheet', href: null },
]

export default function InventoryNav({ active }: { active?: Tab }) {
  return (
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const base = { padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid #d1d5db' } as const
        if (!tab.href) {
          return (
            <span key={tab.key} title="Coming in a later build phase" style={{ ...base, color: '#9ca3af', background: '#f3f4f6', cursor: 'not-allowed' }}>
              {tab.label} (soon)
            </span>
          )
        }
        return (
          <Link key={tab.key} href={tab.href} style={{ ...base, background: isActive ? '#0f172a' : 'white', color: isActive ? 'white' : '#0f172a', borderColor: isActive ? '#0f172a' : '#d1d5db' }}>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
