import Link from 'next/link'

type Tab = 'open' | 'new' | 'archive' | 'invoices'

const tabs: { key: Tab; label: string; href: string | null }[] = [
  { key: 'open', label: 'Open MAFs', href: '/maintenance' },
  { key: 'new', label: 'New MAF', href: '/maintenance/new' },
  { key: 'archive', label: 'Archive', href: '/maintenance/archive' },
  { key: 'invoices', label: 'Invoices for Jon', href: '/maintenance/invoices' },
]

export default function MaintenanceNav({ active }: { active?: Tab }) {
  return (
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const base = {
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          border: '1px solid #d1d5db',
        } as const
        if (!tab.href) {
          return (
            <span key={tab.key} title="Coming in a later build phase" style={{ ...base, color: '#9ca3af', background: '#f3f4f6', cursor: 'not-allowed' }}>
              {tab.label} (soon)
            </span>
          )
        }
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              ...base,
              background: isActive ? '#0f172a' : 'white',
              color: isActive ? 'white' : '#0f172a',
              borderColor: isActive ? '#0f172a' : '#d1d5db',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
