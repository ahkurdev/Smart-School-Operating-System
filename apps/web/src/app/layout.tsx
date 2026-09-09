import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Smart School OS',
  description: 'Satu platform operasional digital sekolah',
  manifest: '/manifest.webmanifest',
  themeColor: '#1d4ed8',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SSOS',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
