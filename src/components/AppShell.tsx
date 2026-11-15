'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import ThemeToggle from '@/components/ThemeToggle'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', section: 'dashboard', color: 'var(--dash)' },
  { href: '/time', label: 'Time', section: 'time', color: 'var(--time)' },
  { href: '/payroll', label: 'Payroll', section: 'payroll', color: 'var(--pay)' },
  { href: '/maintenance', label: 'Maint.', section: 'maintenance', color: 'var(--maint)' },
  { href: '/inventory', label: 'Inventory', section: 'inventory', color: 'var(--inv)' },
]

// Pages that show without the app frame (signed-out screens)
const BARE = ['/login', '/forgot-password', '/reset-password', '/auth']

export default function AppShell({ version, children }: { version: string; children: React.ReactNode }) {
  const pathname = usePathname() || '/'

  if (BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <div data-section="dashboard">{children}</div>
  }

  const current = NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))
  const section = current?.section ?? 'dashboard'

  return (
    <div className="app" data-section={section}>
      <Link href="/dashboard" className="elbow" aria-label="Snow Goose Operations, go to the dashboard">
        <span className="sub">Operations</span>
        <span className="brand">Snow Goose</span>
      </Link>
      <div className="topbar">
        <div className="bar a" aria-hidden="true" />
        <ThemeToggle />
        <div className="bar c" aria-hidden="true" />
      </div>
      <nav className="side" aria-label="Main">
        {NAV.map((n, i) => (
          <Link
            key={n.href}
            href={n.href}
            className="navbtn"
            style={{ '--nc': n.color } as React.CSSProperties}
            aria-current={current?.href === n.href ? 'page' : undefined}
          >
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            {n.label}
          </Link>
        ))}
        <div className="spacer">v{version}</div>
        <LogoutButton />
      </nav>
      <main className="app-main">{children}</main>
    </div>
  )
}
