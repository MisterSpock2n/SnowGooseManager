'use client'

import { createClient } from '@/lib/supabase-browser'

export default function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    window.location.replace('/login')
  }

  return (
    <button type="button" onClick={handleLogout} className="navbtn logout">
      Log out
    </button>
  )
}
