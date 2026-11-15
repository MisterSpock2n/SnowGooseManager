export const authInput = { padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: 15 } as const
export const authButton = { padding: '12px 16px', borderRadius: '8px', background: '#111827', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' } as const

export default function AuthCard({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', background: 'white' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>{title}</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>{intro}</p>
        {children}
      </div>
    </main>
  )
}
