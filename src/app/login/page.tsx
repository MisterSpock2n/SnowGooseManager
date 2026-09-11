'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
          background: 'white',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Sign in</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Sign in to access Snow Goose operations.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#111827',
              color: 'white',
              border: 'none',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          {message ? <p style={{ color: '#b91c1c' }}>{message}</p> : null}
        </form>
      </div>
    </main>
  )
}