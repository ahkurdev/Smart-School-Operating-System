import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Admission periods" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Admission periods"
      permission="admission.manage"
      description="Opening periods, tracks, and quotas."
    />
  );
}
