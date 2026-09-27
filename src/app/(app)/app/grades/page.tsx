import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Grades" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Grades"
      permission="grade.read"
      description="Assessments, gradebook, and report cards."
    />
  );
}
