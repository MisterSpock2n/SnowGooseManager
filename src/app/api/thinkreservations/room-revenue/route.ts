import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRoomRevenueForDate } from '@/lib/thinkreservations'

export const runtime = 'nodejs'

// GET /api/thinkreservations/room-revenue?date=YYYY-MM-DD
// Signed-in staff only. Returns the night's room revenue (everything billed that date, before taxes).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) {
    return NextResponse.json({ error: 'Your sign-in has expired. Sign in again and retry.' }, { status: 401 })
  }

  const date = request.nextUrl.searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return NextResponse.json({ error: 'Pick a valid date.' }, { status: 400 })
  }

  try {
    const result = await getRoomRevenueForDate(date)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Could not reach ThinkReservations. Try again or enter the amount by hand.' }, { status: 502 })
  }
}
