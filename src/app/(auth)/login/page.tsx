import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { getActor } from "@/server/auth/context";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const actor = await getActor();
  if (actor) redirect("/app");
  const params = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the details your school provided, or your own account."
      footer={
        <p className="text-muted-foreground">
          New to a school using Smart School OS?{" "}
          <Link href="/apply" className="font-medium text-primary underline-offset-4 hover:underline">
            Start an application
          </Link>
          .
        </p>
      }
    >
      {params.reset ? (
        <p className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground">
          Your password was reset. Sign in with your new password.
        </p>
      ) : null}
      <LoginForm />
      <p className="mt-4 text-sm text-muted-foreground">
        Need an account?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
        .
      </p>
    </AuthShell>
  );
}
