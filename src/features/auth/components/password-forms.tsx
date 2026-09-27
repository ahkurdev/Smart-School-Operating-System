"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  forgotPasswordAction,
  resetPasswordAction,
  type ActionState,
} from "@/features/auth/actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    forgotPasswordAction,
    undefined,
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.ok ? (
        <Alert variant="success" role="status">
          <AlertDescription>
            If an account exists for that email, a reset link is on its way. Check
            your inbox and spam folder.
          </AlertDescription>
        </Alert>
      ) : null}
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Submit label="Send reset link" pendingLabel="Sending..." />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    resetPasswordAction,
    undefined,
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 10 characters, mixing letters, numbers, or symbols.
        </p>
      </div>
      <Submit label="Set new password" pendingLabel="Saving..." />
    </form>
  );
}
