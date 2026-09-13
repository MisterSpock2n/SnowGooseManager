const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://snowgoose.warpninedesigns.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const APP_URL = 'https://snowgoose.warpninedesigns.com'
const RECIPIENT = 'info@snowgooseinn.com'
const FROM = 'Snow Goose Payroll <payroll@notifications.warpninedesigns.com>'
const REPLY_TO = 'SasquatchCleaningService@gmail.com'

type EmailInvoiceRequest = {
  userId?: string
  startDate?: string
  endDate?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { userId, startDate, endDate }: EmailInvoiceRequest =
    await request.json()

  if (!userId || !startDate || !endDate) {
    return json(
      { error: 'Missing userId, startDate, or endDate.' },
      400
    )
  }

  const invoicePdfSecret = Deno.env.get('INVOICE_EMAIL_PDF_SECRET')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

  if (!invoicePdfSecret || !resendApiKey) {
    return json(
      { error: 'Email service configuration is incomplete.' },
      500
    )
  }

  const pdfUrl = new URL('/api/payroll/invoice-pdf-email', APP_URL)
  pdfUrl.searchParams.set('user', userId)
  pdfUrl.searchParams.set('start', startDate)
  pdfUrl.searchParams.set('end', endDate)

  const pdfResponse = await fetch(pdfUrl, {
    headers: {
      Authorization: `Bearer ${invoicePdfSecret}`,
    },
  })

  if (!pdfResponse.ok) {
    const detail = await pdfResponse.text()
    return json(
      {
        error: 'Could not generate the invoice PDF.',
        detail,
      },
      502
    )
  }

  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())
  let binary = ''

for (const byte of pdfBytes) {
  binary += String.fromCharCode(byte)
}

const base64Pdf = btoa(binary)

  const filename =
    pdfResponse.headers.get('x-invoice-filename') ??
    `snow-goose-payroll-${startDate}-to-${endDate}.pdf`

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [RECIPIENT],
      reply_to: REPLY_TO,
      subject: `Payroll invoice: ${startDate} to ${endDate}`,
      html: `
        <p>Hello,</p>
        <p>Attached is the Snow Goose Inn payroll invoice for the period
        <strong>${startDate}</strong> through <strong>${endDate}</strong>.</p>
        <p>This invoice was generated from the Snow Goose operations app.</p>
      `,
      attachments: [
        {
          filename,
          content: base64Pdf,
        },
      ],
    }),
  })

  const resendData = await resendResponse.json()

  if (!resendResponse.ok) {
    return json(
      {
        error: 'Resend could not send the payroll invoice.',
        detail: resendData,
      },
      502
    )
  }

  return json({
    success: true,
    emailId: resendData.id,
  })
})