import Link from "next/link";
import { GraduationCap } from "lucide-react";

/**
 * Split layout for authentication screens: a branded panel on the left (desktop)
 * and the form on the right. Mobile collapses to the form only, with the brand
 * mark on top. This is the "working face" - quiet, legible, no decoration.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <GraduationCap className="size-6" aria-hidden />
          Smart School OS
        </Link>
        <div className="max-w-sm space-y-4">
          <p className="font-display text-2xl leading-snug text-balance">
            One system for the whole school day.
          </p>
          <p className="text-sm leading-relaxed text-primary-foreground/80">
            Admissions, attendance, academics, and family communication, kept in
            one place and in step with each other.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          Multi-school. Configurable. Built for real school operations.
        </p>
      </aside>

      {/* Form panel */}
      <main
        id="main-content"
        className="flex items-center justify-center bg-background px-4 py-10 sm:px-8"
      >
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 font-display text-lg font-semibold text-foreground lg:hidden"
          >
            <GraduationCap className="size-5 text-primary" aria-hidden />
            Smart School OS
          </Link>
          <header className="mb-6 space-y-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </header>
          {children}
          {footer ? <div className="mt-6 text-sm">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
