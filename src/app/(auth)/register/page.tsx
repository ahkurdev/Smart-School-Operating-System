import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getActor } from "@/server/auth/context";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const actor = await getActor();
  if (actor) redirect("/app");

  return (
    <AuthShell
      title="Create your account"
      subtitle="A general account. Your school links it to your role and records."
      footer={
        <p className="text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
          .
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
