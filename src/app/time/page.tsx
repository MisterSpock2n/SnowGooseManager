import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TimePageClient from './TimePageClient'

export default async function TimePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims) {
    redirect('/login')
  }

  return <TimePageClient />
}