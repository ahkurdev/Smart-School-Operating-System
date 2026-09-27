import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "News" };

export default function Page() {
  return (
    <PhaseStubPage
      title="News"
      permission="cms.read"
      description="News posts and articles for the public site."
    />
  );
}
