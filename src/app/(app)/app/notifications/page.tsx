import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Notifications"
      permission="notification.manage"
      description="Delivery channels and notification templates."
    />
  );
}
