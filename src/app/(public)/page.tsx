import Link from "next/link";
import { GraduationCap, CalendarCheck, ClipboardList, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Public marketing/entry page. Deliberately quiet and honest: no fake stats, no
 * fake testimonials, no logo bar (DESIGN.md forbidden patterns). It states what
 * the product is and routes to the two real entry points: sign in and apply.
 */
const capabilities = [
  {
    icon: ClipboardList,
    title: "Admissions that stay organised",
    body: "Publish intake periods, collect applications and documents, verify, and turn accepted applicants into enrolled students without re-typing anything.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance you can trust",
    body: "Students show a short-lived rotating QR; teachers scan and confirm. Old screenshots stop working, and every manual change is logged.",
  },
  {
    icon: GraduationCap,
    title: "Academics in one place",
    body: "Timetables, assignments, gradebooks, and report cards, with a published-grade workflow so results only reach families when they should.",
  },
  {
    icon: Users,
    title: "Built for many schools",
    body: "One deployment serves many schools, each with its own branding, calendar, language, and modules turned on or off.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-semibold">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            Smart School OS
          </Link>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/apply">Apply</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              School operations, in one system
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
              Run the whole school day from one place.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Smart School OS brings admissions, attendance, academics, and family
              communication together, so staff spend their time on students rather
              than on spreadsheets that disagree with each other.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/apply">
                  Start an application
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Staff and family sign in</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {capabilities.map((c) => (
              <Card key={c.title} className="border-border/80">
                <CardHeader className="gap-3">
                  <c.icon className="size-6 text-primary" aria-hidden />
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Smart School OS</p>
          <p>Multi-school school management platform.</p>
        </div>
      </footer>
    </div>
  );
}
