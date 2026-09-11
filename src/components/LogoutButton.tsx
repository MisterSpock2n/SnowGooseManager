'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    window.location.replace('/login')
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        background: 'white',
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  )
}