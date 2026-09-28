"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { School } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { switchTenantAction } from "@/features/tenants/actions";

/**
 * Shown when an authenticated user has no *active* school selected (e.g. a
 * platform/support account, or a user whose membership spans several schools but
 * none is chosen yet). Instead of failing, we let them pick one — the choice is
 * verified server-side by `switchTenantAction`.
 */
export function SchoolPicker({
  tenants,
  isPlatform,
}: {
  tenants: { tenantId: string; name: string; slug: string }[];
  isPlatform: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function choose(tenantId: string) {
    setPending(tenantId);
    const res = await switchTenantAction(tenantId);
    if (res.ok) {
      toast.success("School selected");
      router.push("/app");
      router.refresh();
    } else {
      setPending(null);
      toast.error("You do not have access to that school.");
    }
  }

  if (tenants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="size-5" aria-hidden /> No school assigned yet
          </CardTitle>
          <CardDescription>
            {isPlatform
              ? "You are signed in as a platform administrator. Open a school from the platform console, or create one."
              : "Your account is not linked to any school. Ask an administrator to add you to a school."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Once you belong to a school, its dashboard will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <School className="size-5" aria-hidden /> Choose a school
        </CardTitle>
        <CardDescription>Select which school you want to work in right now.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          {tenants.map((t) => (
            <li key={t.tenantId}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start px-4 py-3 text-left"
                disabled={pending !== null}
                aria-busy={pending === t.tenantId}
                onClick={() => choose(t.tenantId)}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.slug}</span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
