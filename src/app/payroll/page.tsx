import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'


type SearchParams = Promise<{
  start?: string
  end?: string
  user?: string
}>

type PayrollEntry = {
  id: string
  entry_date: string
  entry_type: 'hourly' | 'overnight'
  work_type: 'cleaning' | 'maintenance' | 'it' | 'general' | null
  hours_worked: number | null
  room_revenue: number | null
  calculated_pay: number | null
  notes: string | null
  property_id: string
  user_id: string
  properties: { name: string } | { name: string }[] | null
  users: { full_name: string | null } | { full_name: string | null }[] | null
}

function getPropertyName(entry: PayrollEntry) {
  if (Array.isArray(entry.properties)) return entry.properties[0]?.name ?? '—'
  return entry.properties?.name ?? '—'
}

function getUserName(entry: PayrollEntry) {
  if (Array.isArray(entry.users)) return entry.users[0]?.full_name ?? '—'
  return entry.users?.full_name ?? '—'
}

function formatCurrency(amount: number | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0)
}

function formatHours(hours: number | null) {
  if (hours === null || hours === undefined) return '—'
  return hours.toFixed(2)
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const defaultStart = firstOfMonth.toISOString().split('T')[0]
  const defaultEnd = today.toISOString().split('T')[0]

  const startDate = params.start || defaultStart
  const endDate = params.end || defaultEnd
  const selectedUserId = params.user || ''

  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
  await supabase.auth.getClaims()

if (claimsError || !claimsData?.claims) {
  redirect('/login')
} 

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name', { ascending: true })

  if (usersError) {
    return (
      <main className="p-6">
        <h1 className="mb-4 text-2xl font-semibold">Payroll</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Error loading users: {usersError.message}
        </div>
      </main>
    )
  }

  let query = supabase
    .from('time_entries')
    .select(`
      id,
      entry_date,
      entry_type,
      work_type,
      hours_worked,
      room_revenue,
      calculated_pay,
      notes,
      property_id,
      user_id,
      properties ( name ),
      users ( full_name )
    `)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true })

  if (selectedUserId) {
    query = query.eq('user_id', selectedUserId)
  }

  const { data, error } = await query

  if (error) {
    return (
      <main className="p-6">
        <h1 className="mb-4 text-2xl font-semibold">Payroll</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Error loading payroll data: {error.message}
        </div>
      </main>
    )
  }

  const entries = (data ?? []) as PayrollEntry[]
  const users = usersData ?? []

  const totalGrossPay = entries.reduce((sum, entry) => sum + (entry.calculated_pay ?? 0), 0)
  const totalHours = entries.reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0)
  const overnightCount = entries.filter((entry) => entry.entry_type === 'overnight').length
  const totalEntries = entries.length

  const groupedByUser = entries.reduce<
    Record<
      string,
      {
        userName: string
        totalHours: number
        overnightCount: number
        totalPay: number
      }
    >
  >((acc, entry) => {
    const key = entry.user_id

    if (!acc[key]) {
      acc[key] = {
        userName: getUserName(entry),
        totalHours: 0,
        overnightCount: 0,
        totalPay: 0,
      }
    }

    acc[key].totalHours += entry.hours_worked ?? 0
    acc[key].totalPay += entry.calculated_pay ?? 0

    if (entry.entry_type === 'overnight') {
      acc[key].overnightCount += 1
    }

    return acc
  }, {})

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review payroll totals by date range and employee.
        </p>
      </div>

      <form className="grid gap-4 rounded-xl border p-4 md:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="start" className="text-sm font-medium">
            Start date
          </label>
          <input
            id="start"
            name="start"
            type="date"
            defaultValue={startDate}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="end" className="text-sm font-medium">
            End date
          </label>
          <input
            id="end"
            name="end"
            type="date"
            defaultValue={endDate}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="user" className="text-sm font-medium">
            Employee
          </label>
          <select
            id="user"
            name="user"
            defaultValue={selectedUserId}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">All employees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? 'Unnamed User'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-white"
          >
            Run Payroll
          </button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">Total gross pay</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCurrency(totalGrossPay)}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">Total hours</div>
          <div className="mt-2 text-2xl font-semibold">{totalHours.toFixed(2)}</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">Overnight stays</div>
          <div className="mt-2 text-2xl font-semibold">{overnightCount}</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-gray-500">Total entries</div>
          <div className="mt-2 text-2xl font-semibold">{totalEntries}</div>
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Payroll entries</h2>
        </div>

        {entries.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            No payroll entries found for this date range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Entry Type</th>
                  <th className="px-4 py-3 font-medium">Work Type</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Pay</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t align-top">
                    <td className="px-4 py-3">{entry.entry_date}</td>
                    <td className="px-4 py-3">{getUserName(entry)}</td>
                    <td className="px-4 py-3">{getPropertyName(entry)}</td>
                    <td className="px-4 py-3 capitalize">{entry.entry_type}</td>
                    <td className="px-4 py-3 capitalize">{entry.work_type ?? '—'}</td>
                    <td className="px-4 py-3">{formatHours(entry.hours_worked)}</td>
                    <td className="px-4 py-3">
                      {entry.entry_type === 'overnight'
                        ? formatCurrency(entry.room_revenue)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(entry.calculated_pay)}
                    </td>
                    <td className="max-w-xs px-4 py-3">{entry.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Totals by employee</h2>
        </div>

        {Object.keys(groupedByUser).length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No employee totals yet.</div>
        ) : (
          <div className="divide-y">
            {Object.entries(groupedByUser).map(([userId, group]) => (
              <div
                key={userId}
                className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">{group.userName}</div>
                  <div className="text-sm text-gray-600">
                    Hours: {group.totalHours.toFixed(2)} · Overnights: {group.overnightCount}
                  </div>
                </div>
                <div className="text-lg font-semibold">
                  {formatCurrency(group.totalPay)}
                </div>
                <Link
                  href={`/payroll/invoice?user=${userId}&start=${startDate}&end=${endDate}`}
                  className="inline-flex rounded-md border px-3 py-2 text-sm"
                >
                  View Invoice
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}