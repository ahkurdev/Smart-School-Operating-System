'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students', label: 'Siswa' },
  { href: '/attendance', label: 'Absensi' },
  { href: '/command-center', label: 'Command Center' },
  { href: '/finance', label: 'Keuangan' },
  { href: '/timetable', label: 'Jadwal' },
  { href: '/announcements', label: 'Pengumuman' },
  { href: '/library', label: 'Perpustakaan' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="px-4 py-5">
          <p className="text-sm font-bold text-brand-700">Smart School OS</p>
        </div>
        <nav className="space-y-1 px-2" aria-label="Navigasi utama">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <p className="text-sm font-bold text-brand-700">SSOS</p>
          <nav className="flex gap-2" aria-label="Navigasi mobile">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded px-2 py-1 text-xs text-slate-600">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
