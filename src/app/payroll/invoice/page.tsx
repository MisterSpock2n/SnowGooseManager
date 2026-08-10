import Link from 'next/link'
import InvoiceActions from './InvoiceActions'
import { createClient } from '@/lib/supabase/server'




type SearchParams = Promise<{
  user?: string
  start?: string
  end?: string
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function PayrollInvoicePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams

  const userId = params.user ?? ''
  const startDate = params.start ?? ''
  const endDate = params.end ?? ''

  if (!userId || !startDate || !endDate) {
    return (
      <main className="p-6">
        <h1 className="mb-4 text-2xl font-semibold">Invoice Preview</h1>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          Missing required invoice parameters.
        </div>
      </main>
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
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
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: true })

  if (error) {
    return (
      <main className="p-6">
        <h1 className="mb-4 text-2xl font-semibold">Invoice Preview</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Error loading invoice data: {error.message}
        </div>
      </main>
    )
  }


  const entries = (data ?? []) as PayrollEntry[]
  const employeeName = entries[0] ? getUserName(entries[0]) : 'Employee'

  const totalPay = entries.reduce((sum, entry) => sum + (entry.calculated_pay ?? 0), 0)
  const totalHours = entries.reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0)
  const overnightCount = entries.filter((entry) => entry.entry_type === 'overnight').length
  const overnightRevenue = entries.reduce(
    (sum, entry) => sum + (entry.room_revenue ?? 0),
    0
  )

  const cleaningHours = entries
    .filter((entry) => entry.work_type === 'cleaning')
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0)

  const maintenanceHours = entries
    .filter((entry) => entry.work_type === 'maintenance')
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0)

  const itHours = entries
    .filter((entry) => entry.work_type === 'it')
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0)

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3">
  <Link
    href={`/payroll?start=${startDate}&end=${endDate}&user=${userId}`}
    className="inline-flex rounded-md border px-4 py-2 text-sm"
  >
    Back to Payroll
  </Link>

  <InvoiceActions />
</div>
          <div>
            <h1 className="text-2xl font-semibold">Invoice Preview</h1>
            <p className="mt-1 text-sm text-gray-600">
              Payroll invoice for {employeeName}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/payroll?start=${startDate}&end=${endDate}&user=${userId}`}
              className="inline-flex rounded-md border px-4 py-2 text-sm"
            >
              Back to Payroll
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 border-b pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Snow Goose Inn</h2>
              <p className="mt-1 text-sm text-gray-600">Payroll Invoice</p>
            </div>

            <div className="text-sm text-gray-700">
              <div><span className="font-medium">Employee:</span> {employeeName}</div>
              <div><span className="font-medium">Period:</span> {formatDate(startDate)} - {formatDate(endDate)}</div>
              <div>
                <span className="font-medium">Generated:</span>{' '}
                {new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date())}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Gross pay</div>
              <div className="mt-2 text-xl font-semibold">{formatCurrency(totalPay)}</div>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Total hours</div>
              <div className="mt-2 text-xl font-semibold">{totalHours.toFixed(2)}</div>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Overnights</div>
              <div className="mt-2 text-xl font-semibold">{overnightCount}</div>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Overnight revenue</div>
              <div className="mt-2 text-xl font-semibold">
                {formatCurrency(overnightRevenue)}
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Entry Type</th>
                  <th className="px-4 py-3 font-medium">Work Type</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Pay</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(entry.entry_date)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-4 border-t pt-6 md:grid-cols-2">
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex justify-between gap-4">
                <span>Cleaning hours</span>
                <span className="font-medium">{cleaningHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Maintenance hours</span>
                <span className="font-medium">{maintenanceHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>IT hours</span>
                <span className="font-medium">{itHours.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Overnight stays</span>
                <span className="font-medium">{overnightCount}</span>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Total gross pay</span>
                <span className="text-lg font-semibold">{formatCurrency(totalPay)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}