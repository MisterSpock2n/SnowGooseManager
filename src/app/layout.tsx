import React from 'react'
import type { Metadata, Viewport } from 'next'
import { Antonio } from 'next/font/google'
import AppShell from '@/components/AppShell'
import { version } from '../../package.json'
import './globals.css'

const antonio = Antonio({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-antonio', display: 'swap' })

export const metadata: Metadata = {
  title: 'Snow Goose Ops',
  description: 'Snow Goose Inn operations: time, payroll, maintenance and inventory',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#efece4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="day" className={antonio.variable}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppShell version={version}>{children}</AppShell>
      </body>
    </html>
  )
}
