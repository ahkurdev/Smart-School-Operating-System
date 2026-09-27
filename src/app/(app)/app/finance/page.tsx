import type { Metadata } from "next";
import { PhaseStubPage } from "@/components/shared/phase-stub-page";

export const metadata: Metadata = { title: "Finance" };

export default function Page() {
  return (
    <PhaseStubPage
      title="Finance"
      permission="finance.read"
      description="Fees, invoices, payments, and scholarships."
    />
  );
}
