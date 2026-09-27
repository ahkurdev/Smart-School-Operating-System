import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "AI Assistant" };

export default function Page() {
  return (
    <PhaseStubPage
      title="AI Assistant"
      permission="ai.use"
      description="Permission-aware assistant with audited tool access."
    />
  );
}
