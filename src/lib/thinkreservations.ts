// ThinkReservations External API (https://developers.thinkreservations.com).
// Server-only: uses a Restricted API Key bound to the Snow Goose Inn hotel.

const API_BASE = 'https://api.thinkreservations.com'

type LineItem = {
  id?: string
  billingDate?: string | null
  billingType?: string | null
  description?: string | null
  amount?: number | null
  actualAmount?: number | null
  canceled?: boolean | null
}

type Booking = {
  id?: string
  startDate?: string | null
  endDate?: string | null
  status?: string | null
  canceledAt?: string | null
  lineItems?: LineItem[] | null
}

type Reservation = {
  id?: string
  confirmationId?: string | null
  status?: string | null
  canceledAt?: string | null
  bookings?: Booking[] | null
  lineItems?: LineItem[] | null
}

type ReservationPage = {
  content?: Reservation[]
  last?: boolean
  totalPages?: number
}

export type RoomRevenueResult =
  | { ok: true; date: string; revenue: number; reservations: number; lineItems: number }
  | { ok: false; status: number; error: string }

function day(value: string | null | undefined) {
  return (value ?? '').slice(0, 10)
}

function itemAmount(item: LineItem) {
  const value = item.actualAmount ?? item.amount ?? 0
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

// Room revenue for one night: every non-canceled charge billed on that date,
// before taxes (taxes are itemized separately and not included in the amounts).
// Each room's total for the night is floored at 0, so a discount or credit can
// never make a room count as negative revenue.
export function sumRevenueForDate(reservations: Reservation[], date: string) {
  const seen = new Set<string>()
  let revenue = 0
  let reservationCount = 0
  let itemCount = 0

  const addRoom = (items: LineItem[]) => {
    let roomTotal = 0
    let counted = 0
    for (const item of items) {
      if (item.canceled) continue
      if (day(item.billingDate) !== date) continue
      if (item.id) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
      }
      roomTotal += itemAmount(item)
      counted += 1
    }
    revenue += Math.max(0, roomTotal)
    itemCount += counted
    return counted > 0
  }

  for (const reservation of reservations) {
    if (reservation.canceledAt) continue
    let counted = false
    for (const booking of reservation.bookings ?? []) {
      if (booking.canceledAt || booking.status === 'canceled' || booking.status === 'cancelled') continue
      if (addRoom(booking.lineItems ?? [])) counted = true
    }
    // Charges on the reservation itself (not tied to one room) are treated as one more "room".
    if (addRoom(reservation.lineItems ?? [])) counted = true
    if (counted) reservationCount += 1
  }

  return { revenue: Math.max(0, Math.round(revenue * 100) / 100), reservations: reservationCount, lineItems: itemCount }
}

export async function getRoomRevenueForDate(date: string): Promise<RoomRevenueResult> {
  const apiKey = process.env.THINKRESERVATIONS_API_KEY
  const hotelId = process.env.THINKRESERVATIONS_HOTEL_ID
  if (!apiKey || !hotelId) {
    return { ok: false, status: 500, error: 'ThinkReservations is not set up yet (missing API key or hotel ID).' }
  }

  const all: Reservation[] = []
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      stay_on_start_date: date,
      stay_on_end_date: date,
      page: String(page),
      size: '100',
    })
    const res = await fetch(`${API_BASE}/v1/hotels/${encodeURIComponent(hotelId)}/reservations?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 502, error: 'ThinkReservations rejected the API key. It may have expired or been revoked.' }
    }
    if (!res.ok) {
      return { ok: false, status: 502, error: `ThinkReservations returned an error (${res.status}).` }
    }
    const body = (await res.json()) as ReservationPage
    all.push(...(body.content ?? []))
    if (body.last !== false || (body.content ?? []).length === 0) break
  }

  return { ok: true, date, ...sumRevenueForDate(all, date) }
}
