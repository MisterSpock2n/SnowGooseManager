import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

type PdfEntry = {
  id: string
  entry_date: string
  entry_type: 'hourly' | 'overnight'
  work_type: 'cleaning' | 'maintenance' | 'it' | 'general' | null
  hours_worked: number | null
  room_revenue: number | null
  calculated_pay: number | null
  properties: { name: string } | { name: string }[] | null
}

type InvoicePdfDocumentProps = {
  employeeName: string
  startDate: string
  endDate: string
  generatedDate: string
  entries: PdfEntry[]
}

function getPropertyName(entry: PdfEntry) {
  if (Array.isArray(entry.properties)) return entry.properties[0]?.name ?? '—'
  return entry.properties?.name ?? '—'
}

function formatCurrency(amount: number | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingRight: 42,
    paddingBottom: 42,
    paddingLeft: 42,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 14,
    marginBottom: 18,
  },
  brand: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    color: '#4b5563',
  },
  metadata: {
    fontSize: 9,
    lineHeight: 1.55,
    textAlign: 'right',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 24,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
  },
  cell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    justifyContent: 'center',
  },
  headerCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  date: { width: '12%' },
  property: { width: '19%' },
  entryType: { width: '14%' },
  workType: { width: '14%' },
  hours: { width: '10%', textAlign: 'right' },
  revenue: { width: '15%', textAlign: 'right' },
  pay: { width: '16%', textAlign: 'right', borderRightWidth: 0 },
  totals: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  hoursBreakdown: {
    width: '58%',
    lineHeight: 1.7,
  },
  totalBox: {
    width: '42%',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 10,
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 7,
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
})

export default function InvoicePdfDocument({
  employeeName,
  startDate,
  endDate,
  generatedDate,
  entries,
}: InvoicePdfDocumentProps) {
  const totalPay = entries.reduce(
    (sum, entry) => sum + (entry.calculated_pay ?? 0),
    0
  )
  const totalHours = entries.reduce(
    (sum, entry) => sum + (entry.hours_worked ?? 0),
    0
  )
  const overnightCount = entries.filter(
    (entry) => entry.entry_type === 'overnight'
  ).length
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

  const generalHours = entries
    .filter((entry) => entry.work_type === 'general')
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Snow Goose Inn</Text>
            <Text style={styles.title}>Payroll Invoice</Text>
          </View>

          <View style={styles.metadata}>
            <Text>Employee: {employeeName}</Text>
            <Text>
              Period: {formatDate(startDate)} – {formatDate(endDate)}
            </Text>
            <Text>Generated: {generatedDate}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>GROSS PAY</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalPay)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TOTAL HOURS</Text>
            <Text style={styles.summaryValue}>{totalHours.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>OVERNIGHTS</Text>
            <Text style={styles.summaryValue}>{overnightCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>OVERNIGHT REVENUE</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(overnightRevenue)}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={[styles.cell, styles.date]}>
              <Text style={styles.headerCell}>Date</Text>
            </View>
            <View style={[styles.cell, styles.property]}>
              <Text style={styles.headerCell}>Property</Text>
            </View>
            <View style={[styles.cell, styles.entryType]}>
              <Text style={styles.headerCell}>Entry Type</Text>
            </View>
            <View style={[styles.cell, styles.workType]}>
              <Text style={styles.headerCell}>Work Type</Text>
            </View>
            <View style={[styles.cell, styles.hours]}>
              <Text style={styles.headerCell}>Hours</Text>
            </View>
            <View style={[styles.cell, styles.revenue]}>
              <Text style={styles.headerCell}>Revenue</Text>
            </View>
            <View style={[styles.cell, styles.pay]}>
              <Text style={styles.headerCell}>Pay</Text>
            </View>
          </View>

          {entries.map((entry) => (
            <View key={entry.id} style={styles.tableRow} wrap={false}>
              <View style={[styles.cell, styles.date]}>
                <Text>{formatDate(entry.entry_date)}</Text>
              </View>
              <View style={[styles.cell, styles.property]}>
                <Text>{getPropertyName(entry)}</Text>
              </View>
              <View style={[styles.cell, styles.entryType]}>
                <Text>
                  {entry.entry_type === 'overnight'
                    ? 'Overnight'
                    : 'Hourly'}
                </Text>
              </View>
              <View style={[styles.cell, styles.workType]}>
                <Text>
                  {entry.work_type
                    ? entry.work_type.charAt(0).toUpperCase() +
                      entry.work_type.slice(1)
                    : '—'}
                </Text>
              </View>
              <View style={[styles.cell, styles.hours]}>
                <Text>
                  {entry.hours_worked === null
                    ? '—'
                    : entry.hours_worked.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.cell, styles.revenue]}>
                <Text>
                  {entry.entry_type === 'overnight'
                    ? formatCurrency(entry.room_revenue)
                    : '—'}
                </Text>
              </View>
              <View style={[styles.cell, styles.pay]}>
                <Text>{formatCurrency(entry.calculated_pay)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <View style={styles.hoursBreakdown}>
            <Text>Cleaning hours: {cleaningHours.toFixed(2)}</Text>
            <Text>Maintenance hours: {maintenanceHours.toFixed(2)}</Text>
            <Text>IT hours: {itHours.toFixed(2)}</Text>
            <Text>General hours: {generalHours.toFixed(2)}</Text>
            <Text>Overnight stays: {overnightCount}</Text>
          </View>

          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total gross pay</Text>
              <Text style={styles.totalValue}>{formatCurrency(totalPay)}</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated on ${generatedDate} · Snow Goose Inn Payroll Invoice · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}