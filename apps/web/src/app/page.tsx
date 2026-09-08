import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold text-slate-900">Smart School OS</h1>
      <p className="max-w-md text-center text-slate-600">
        Satu platform terpadu untuk operasional digital sekolah.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Masuk
        </Link>
      </div>
    </main>
  )
}
