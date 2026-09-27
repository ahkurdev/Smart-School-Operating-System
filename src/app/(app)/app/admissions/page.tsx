import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Applicants" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Applicants"
      permission="admission.read"
      description="Admission applications and their status."
    />
  );
}
