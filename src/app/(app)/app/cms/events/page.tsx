import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Events" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Events"
      permission="cms.read"
      description="School events published to the calendar and site."
    />
  );
}
