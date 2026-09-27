import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Library" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Library"
      permission="library.read"
      description="Catalogue, copies, loans, and reservations."
    />
  );
}
