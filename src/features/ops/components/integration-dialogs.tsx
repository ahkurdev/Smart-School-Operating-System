"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { KeyRound, Webhook as WebhookIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createApiKeyAction, createWebhookAction, type IntegrationResult } from "@/features/ops/integration-actions";

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: "students.read", label: "Read students" },
  { value: "attendance.read", label: "Read attendance" },
  { value: "finance.read", label: "Read finance" },
  { value: "admissions.read", label: "Read admissions" },
  { value: "library.read", label: "Read library" },
  { value: "webhooks.manage", label: "Manage webhooks" },
];

const EVENT_OPTIONS = ["student.created", "student.enrolled", "attendance.recorded", "applicant.accepted", "payment.received", "invoice.created"];

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function SecretReveal({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <div className="space-y-2">
      <Alert>
        <AlertDescription>
          Copy this value now - it will not be shown again.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-sunken px-2 py-1.5 text-xs">{secret}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(secret);
            toast.success("Copied");
          }}
        >
          <Copy className="size-4" aria-hidden /> Copy
        </Button>
      </div>
      <Button type="button" size="sm" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<IntegrationResult | null, FormData>(createApiKeyAction, null);
  const [secret, setSecret] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      if (state.secret) setSecret(state.secret);
      else setOpen(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSecret(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <KeyRound className="size-4" aria-hidden /> New API key
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
          <DialogDescription>Grant an integration scoped, read-only access.</DialogDescription>
        </DialogHeader>
        {secret ? (
          <SecretReveal secret={secret} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            {state && !state.ok && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" name="name" required maxLength={120} placeholder="Reporting integration" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Scopes</legend>
              <div className="grid grid-cols-2 gap-2">
                {SCOPE_OPTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="scopes" value={s.value} className="size-4 rounded border-input" />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="key-rate">Rate limit (requests/hour)</Label>
              <Input id="key-rate" name="rateLimit" type="number" min={1} defaultValue={1000} />
            </div>
            <DialogFooter>
              <Submit label="Create key" pendingLabel="Creating…" />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CreateWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<IntegrationResult | null, FormData>(createWebhookAction, null);
  const [secret, setSecret] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      if (state.secret) setSecret(state.secret);
      else setOpen(false);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSecret(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <WebhookIcon className="size-4" aria-hidden /> New webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New webhook</DialogTitle>
          <DialogDescription>Receive signed event payloads at an https endpoint.</DialogDescription>
        </DialogHeader>
        {secret ? (
          <SecretReveal secret={secret} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            {state && !state.ok && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="hook-url">Endpoint URL</Label>
              <Input id="hook-url" name="url" type="url" required placeholder="https://example.com/hooks/school" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Events</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EVENT_OPTIONS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="events" value={e} className="size-4 rounded border-input" />
                    {e}
                  </label>
                ))}
              </div>
            </fieldset>
            <DialogFooter>
              <Submit label="Create webhook" pendingLabel="Creating…" />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
