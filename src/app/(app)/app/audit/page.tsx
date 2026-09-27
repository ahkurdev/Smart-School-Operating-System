import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Audit log"
      permission="audit.read"
      description="Immutable record of meaningful changes."
    />
  );
}
