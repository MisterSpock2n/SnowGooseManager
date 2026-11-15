'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import AuthCard, { authButton, authInput } from '@/components/auth/AuthCard'

const MIN_LENGTH = 8

export default function ResetPasswordPage() {
  const [ready, setReady] = useState<'checking' | 'yes' | 'no'>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? '')
        setReady(data.user ? 'yes' : 'no')
      })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
    if (password !== confirm) return setError("The two passwords don't match.")
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(/different from the old/i.test(error.message) ? 'Pick a password different from your old one.' : error.message)
      return
    }
    setDone(true)
  }

  if (ready === 'checking') {
    return <AuthCard title="Set a new password" intro="Checking your reset link…">{null}</AuthCard>
  }

  if (ready === 'no') {
    return (
      <AuthCard title="Link expired" intro="This reset link has expired or was already used.">
        <Link href="/forgot-password" style={{ ...authButton, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Send a new link</Link>
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard title="Password updated" intro="Your new password is saved and you're signed in.">
        <Link href="/" style={{ ...authButton, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Go to the app</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Set a new password" intro={email ? `Choose a new password for ${email}.` : 'Choose a new password.'}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <label htmlFor="password">New password</label>
          <input id="password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus style={authInput} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>At least {MIN_LENGTH} characters.</span>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <label htmlFor="confirm">Confirm new password</label>
          <input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={authInput} />
        </div>
        <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
        </label>
        <button type="submit" disabled={loading} style={authButton}>
          {loading ? 'Saving…' : 'Save new password'}
        </button>
        {error ? <p style={{ color: 'var(--bad)', margin: 0 }}>{error}</p> : null}
      </form>
    </AuthCard>
  )
}
