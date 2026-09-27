import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Assets" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Assets"
      permission="asset.read"
      description="School assets, facilities, and maintenance."
    />
  );
}
