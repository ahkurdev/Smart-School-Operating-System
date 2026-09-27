"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Monitor,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Settings,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/features/auth/actions";
import { switchTenantAction } from "@/features/tenants/actions";

export type TopbarUser = {
  fullName: string;
  email: string | null;
  isPlatform: boolean;
};

export type TenantsForSwitch = {
  tenantId: string;
  name: string;
  slug: string;
};

export function UserMenu({
  user,
  activeTenantId,
  tenants,
}: {
  user: TopbarUser;
  activeTenantId: string | null;
  tenants: TenantsForSwitch[];
}) {
  const { setTheme } = useTheme();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function switchTenant(tenantId: string) {
    startTransition(async () => {
      const res = await switchTenantAction(tenantId);
      if (res.ok) router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
            {initials || <UserIcon className="size-3.5" aria-hidden />}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.email ?? "No email on file"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {tenants.length > 1 ? (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch school
            </DropdownMenuLabel>
            {tenants.map((t) => (
              <DropdownMenuItem
                key={t.tenantId}
                disabled={pending}
                onSelect={() => switchTenant(t.tenantId)}
              >
                <span className="flex-1 truncate">{t.name}</span>
                {t.tenantId === activeTenantId ? (
                  <Check className="size-3.5 text-primary" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          <Sun className="size-4" aria-hidden /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          <Moon className="size-4" aria-hidden /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>
          <Monitor className="size-4" aria-hidden /> System
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile">
            <Settings className="size-4" aria-hidden /> Profile and settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logoutAction()}>
          <LogOut className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
