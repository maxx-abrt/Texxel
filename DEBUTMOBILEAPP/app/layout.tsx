import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AccentProvider } from '@/components/accent-provider'
import { DeviceShell } from '@/components/device-shell'
import './globals.css'

const _geistSans = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Texxel — Calm mobile workspace',
  description:
    'A mobile workspace app concept: projects, tasks, schedule, inbox and an AI assistant in a warm paper interface.',
  generator: 'v0.app',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Texxel' },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  colorScheme: 'light dark',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#faf6f2' }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="overflow-hidden antialiased md:overflow-auto">
        <AccentProvider>
          <DeviceShell>{children}</DeviceShell>
        </AccentProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
