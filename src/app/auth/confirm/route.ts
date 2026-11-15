import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Where the password-reset email link lands. Signs the person in for this one reset, then sends them on.
// Handles both link styles: ?code= (Supabase's default email) and ?token_hash=&type= (custom email template).
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const nextParam = url.searchParams.get('next') ?? '/reset-password'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/reset-password'

  const supabase = await createClient()
  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }

  if (!ok) {
    return NextResponse.redirect(new URL('/forgot-password?expired=1', url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
