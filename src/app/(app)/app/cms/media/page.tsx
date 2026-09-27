import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Media" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Media"
      permission="media.read"
      description="Uploaded images, videos, and documents."
    />
  );
}
