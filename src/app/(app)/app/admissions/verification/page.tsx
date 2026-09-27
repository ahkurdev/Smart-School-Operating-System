import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Verification" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Verification"
      permission="admission.verify"
      description="Review and verify submitted applications."
    />
  );
}
