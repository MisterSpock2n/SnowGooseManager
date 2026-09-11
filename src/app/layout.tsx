import React from 'react';
import LogoutButton from '@/components/LogoutButton'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', margin: 0, background: '#f5f7fb', color: '#1f2937' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
          <aside style={{ background: '#0f172a', color: 'white', padding: 24 }}>
            <h1 style={{ fontSize: 20, marginTop: 0 }}>Snow Goose Ops</h1>
            <nav style={{ display: 'grid', gap: 12 }}>
              <LogoutButton />
              <a href="/dashboard" style={{ color: 'white' }}>Dashboard</a>
              <a href="/time" style={{ color: 'white' }}>Time</a>
              <a href="/payroll" style={{ color: 'white' }}>Payroll</a>
              <a href="/inventory" style={{ color: 'white' }}>Inventory</a>
              <a href="/maintenance" style={{ color: 'white' }}>Maintenance</a>
            </nav>
          </aside>
          <main style={{ padding: 24 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
