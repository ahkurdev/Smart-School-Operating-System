import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Timetable" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Timetable"
      permission="timetable.read"
      description="Class and teacher scheduling with collision detection."
    />
  );
}
