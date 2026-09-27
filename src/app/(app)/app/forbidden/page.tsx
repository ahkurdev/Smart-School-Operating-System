import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown when an authenticated user reaches a page their role does not allow. */
export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-lg items-center justify-center py-16">
      <Card>
        <CardHeader>
          <ShieldAlert className="size-6 text-warning" aria-hidden />
          <CardTitle>You do not have access to this page</CardTitle>
          <CardDescription>
            Your account does not include the permission needed here. If you
            believe this is a mistake, ask your school administrator to review
            your role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/app">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
