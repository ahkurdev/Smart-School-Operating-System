import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Integrations"
      permission="apikey.manage"
      description="API keys, webhooks, and external integrations."
    />
  );
}
