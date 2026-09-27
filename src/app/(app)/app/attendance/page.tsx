import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Attendance" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Attendance"
      permission="attendance.read"
      description="Sessions, QR check-in, and attendance records."
    />
  );
}
