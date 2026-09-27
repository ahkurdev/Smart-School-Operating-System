import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Analytics"
      permission="reporting.read"
      description="Attendance, academic, enrollment, and finance trends."
    />
  );
}
