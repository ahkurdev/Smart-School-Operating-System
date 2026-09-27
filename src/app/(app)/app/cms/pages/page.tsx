import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Pages" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Pages"
      permission="cms.read"
      description="Public website pages built from content blocks."
    />
  );
}
