import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Announcements" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Announcements"
      permission="announcement.read"
      description="School-wide and targeted announcements."
    />
  );
}
