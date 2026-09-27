"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavGroup } from "@/components/layout/nav-config";

/**
 * Admin sidebar. Grouped by domain, permission-filtered upstream (the server
 * passes only the groups the actor may see). On desktop it is a fixed rail; on
 * mobile it opens in a sheet.
 */

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Sections">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar({ groups, tenantName }: { groups: NavGroup[]; tenantName: string }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <GraduationCap className="size-6 shrink-0 text-primary" aria-hidden />
        <span className="truncate font-display text-sm font-semibold" title={tenantName}>
          {tenantName}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <NavLinks groups={groups} />
      </ScrollArea>
    </aside>
  );
}

/** Mobile-only trigger that opens the navigation in a sheet. */
export function AppSidebarMobile({ groups, tenantName }: { groups: NavGroup[]; tenantName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <span className="inline-flex items-center gap-2 font-display text-sm font-semibold">
            <GraduationCap className="size-5 text-primary" aria-hidden />
            {tenantName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
