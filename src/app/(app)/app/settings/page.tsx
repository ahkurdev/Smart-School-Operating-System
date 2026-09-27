import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Settings"
      permission="setting.read"
      description="School profile, features, academic system, and QR policy."
    />
  );
}
