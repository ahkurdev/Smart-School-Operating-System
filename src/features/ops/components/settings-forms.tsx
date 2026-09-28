"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSchoolProfileAction, upsertRetentionPolicyAction, applyRetentionAction, type SettingsResult } from "@/features/ops/settings-actions";

const FEATURES: { key: string; label: string; hint: string }[] = [
  { key: "admissions", label: "Admissions (PPDB)", hint: "Online application portal" },
  { key: "library", label: "Library", hint: "Catalog, loans and reservations" },
  { key: "finance", label: "Finance", hint: "Invoices, payments and billing" },
  { key: "ai", label: "AI assistant", hint: "Permission-aware school assistant" },
  { key: "counseling", label: "Counseling", hint: "Restricted wellbeing records" },
  { key: "discipline", label: "Discipline", hint: "Incident tracking" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function SchoolProfileForm({
  defaults,
  flags,
}: {
  defaults: { name: string; timezone: string; locale: string; currency: string; gradeLabel: string; classLabel: string; studentIdLabel: string };
  flags: Record<string, boolean>;
}) {
  const [state, action] = useActionState<SettingsResult | null, FormData>(updateSchoolProfileAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      toast.success("School settings saved");
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>School profile</CardTitle>
        <CardDescription>Name, locale and the labels used for grades, classes and student IDs.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-5">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="s-name">School name</Label>
              <Input id="s-name" name="name" defaultValue={defaults.name} required aria-invalid={!!fieldErrors?.name} />
              {fieldErrors?.name ? <p className="text-sm text-destructive">{fieldErrors.name}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-tz">Timezone</Label>
              <Input id="s-tz" name="timezone" defaultValue={defaults.timezone} required placeholder="Asia/Jakarta" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-locale">Locale</Label>
              <Input id="s-locale" name="locale" defaultValue={defaults.locale} required placeholder="id-ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-currency">Currency</Label>
              <Input id="s-currency" name="currency" defaultValue={defaults.currency} required placeholder="IDR" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-grade">Grade label</Label>
              <Input id="s-grade" name="gradeLabel" defaultValue={defaults.gradeLabel} placeholder="Grade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-class">Class label</Label>
              <Input id="s-class" name="classLabel" defaultValue={defaults.classLabel} placeholder="Class" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-sid">Student ID label</Label>
              <Input id="s-sid" name="studentIdLabel" defaultValue={defaults.studentIdLabel} placeholder="Student ID" />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Modules</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <label key={f.key} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" name={`flag_${f.key}`} defaultChecked={flags[f.key] !== false} className="mt-0.5 size-4 rounded border-input" />
                  <span>
                    <span className="block font-medium">{f.label}</span>
                    <span className="block text-muted-foreground">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Submit label="Save settings" />
        </form>
      </CardContent>
    </Card>
  );
}

export function RetentionPolicyForm({ entities }: { entities: string[] }) {
  const [state, action] = useActionState<SettingsResult | null, FormData>(upsertRetentionPolicyAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      toast.success("Retention policy saved");
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="r-entity">Data</Label>
        <select id="r-entity" name="entity" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" required>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-days">Keep for (days)</Label>
        <Input id="r-days" name="retentionDays" type="number" min={1} defaultValue={365} className="w-32" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-action">Action</Label>
        <select id="r-action" name="action" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="delete">
          <option value="delete">Delete</option>
          <option value="anonymize">Anonymise</option>
          <option value="archive">Archive</option>
        </select>
      </div>
      <Submit label="Save policy" />
    </form>
  );
}

export function ApplyRetentionButton() {
  const [state, setState] = useState<SettingsResult | null>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          setPending(true);
          const result = await applyRetentionAction();
          setPending(false);
          setState(result);
          if (result.ok) {
            toast.success(result.summary ?? "Retention applied");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        }}
      >
        {pending ? "Applying…" : "Apply retention now"}
      </Button>
      {state && !state.ok ? <span className="text-sm text-destructive">{state.error}</span> : null}
    </div>
  );
}
