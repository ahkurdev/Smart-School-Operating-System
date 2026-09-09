'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SearchPalette } from '@/components/search-palette'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students', label: 'Siswa' },
  { href: '/attendance', label: 'Absensi' },
  { href: '/command-center', label: 'Command Center' },
  { href: '/finance', label: 'Keuangan' },
  { href: '/timetable', label: 'Jadwal' },
  { href: '/announcements', label: 'Pengumuman' },
  { href: '/library', label: 'Perpustakaan' },
  { href: '/parent', label: 'Portal Ortu' },
  { href: '/ppdb', label: 'PPDB' },
  { href: '/grades', label: 'Nilai' },
  { href: '/student', label: 'Portal Siswa' },
  { href: '/lms', label: 'E-Learning' },
  { href: '/cbt', label: 'Ujian CBT' },
  { href: '/counseling', label: 'BK' },
  { href: '/assets', label: 'Aset' },
  { href: '/hr', label: 'Guru & Staf' },
  { href: '/ekskul', label: 'Ekskul' },
  { href: '/iot', label: 'IoT & Otomasi' },
  { href: '/site', label: 'Website' },
  { href: '/users', label: 'Pengguna' },
  { href: '/ppdb', label: 'PPDB' },
  { href: '/scholarship', label: 'Beasiswa' },
  { href: '/ops', label: 'UKS Kantin Bus' },
  { href: '/notifications', label: 'Notifikasi' },
  { href: '/audit', label: 'Audit Log' },
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
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-bold text-brand-700 md:hidden">SSOS</p>
          <div className="hidden md:block"><SearchPalette /></div>
          <nav className="flex gap-2 md:hidden" aria-label="Navigasi mobile">
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
