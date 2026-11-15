'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import AuthCard, { authButton, authInput } from '@/components/auth/AuthCard'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpired(new URLSearchParams(window.location.search).has('expired'))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    setLoading(false)
    // Rate limits are worth showing; "no such user" is never revealed by Supabase
    if (error && /rate|too many|seconds/i.test(error.message)) {
      setError('Too many reset requests. Wait a few minutes and try again.')
      return
    }
    if (error) {
      setError(`Could not send the reset email: ${error.message}`)
      return
    }
    setSent(true)
  }

  return (
    <AuthCard title="Forgot password" intro="Enter the email you sign in with and we'll send you a link to set a new password.">
      {sent ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 14px', borderRadius: 8 }}>
            If <strong>{email.trim()}</strong> has an account, a reset link is on its way. Check your inbox (and spam folder). The link works once and expires in about an hour.
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Open the link on this device for the smoothest reset.</p>
          <Link href="/login" style={{ fontSize: 14 }}>← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          {expired ? (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
              That reset link expired or was already used. Send yourself a new one.
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: '8px' }}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus style={authInput} />
          </div>
          <button type="submit" disabled={loading} style={authButton}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          {error ? <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}
          <Link href="/login" style={{ fontSize: 14 }}>← Back to sign in</Link>
        </form>
      )}
    </AuthCard>
  )
}
