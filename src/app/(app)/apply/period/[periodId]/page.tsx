import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { getPublicPeriod, listMyApplications } from "@/server/services/admission.service";
import { prisma } from "@/server/db/client";
import { requireTenantId } from "@/server/db/tenant";
import { ApplicantProfileForm } from "@/features/admissions/components/applicant-profile-form";
import { StartApplication } from "@/features/admissions/components/start-application";

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPeriodPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const actor = await requirePageActor();
  const tenantId = requireTenantId(actor);

  const period = await getPublicPeriod(tenantId, periodId).catch(() => null);
  if (!period) notFound();

  const applicant = await prisma.applicant.findFirst({ where: { tenantId, userId: actor.userId } });
  const existing = await listMyApplications(actor);
  const alreadyApplied = existing.some((a) => a.period.name === period.name);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/apply" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to admissions
      </Link>

      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{period.name}</h1>
        <p className="text-muted-foreground">
          Closes {new Date(period.closeAt).toLocaleDateString()}
          {period.description ? ` · ${period.description}` : ""}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-medium">1. Your profile</h2>
        <ApplicantProfileForm
          initial={{
            fullName: applicant?.fullName ?? "",
            email: applicant?.email ?? "",
            phone: applicant?.phone ?? "",
            birthDate: applicant?.birthDate ? new Date(applicant.birthDate).toISOString().slice(0, 10) : "",
            gender: applicant?.gender ?? "",
            previousSchool: applicant?.previousSchool ?? "",
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">2. Start your application</h2>
        {alreadyApplied ? (
          <p className="text-sm text-muted-foreground">
            You already have an application for this period. See it on the{" "}
            <Link href="/apply" className="text-primary hover:underline">
              admissions page
            </Link>
            .
          </p>
        ) : (
          <StartApplication
            periodId={period.id}
            tracks={period.tracks.map((t) => ({ id: t.id, name: t.name, requiresTest: t.requiresTest, requiresInterview: t.requiresInterview }))}
            needsProfile={!applicant}
          />
        )}
      </section>
    </div>
  );
}
