import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requirePageActor } from "@/server/auth/guards";
import { can } from "@/server/policies";
import { listFacilities, listBookings } from "@/server/services/asset.service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateFacilityDialog, RequestBookingDialog } from "@/features/ops/components/facility-dialogs";

export const metadata: Metadata = { title: "Facilities" };

const statusVariant: Record<string, "warning" | "success" | "destructive" | "neutral" | "info"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "neutral",
  COMPLETED: "info",
};

export default async function FacilitiesPage() {
  const actor = await requirePageActor("facility.read");
  const canManage = can(actor, "facility.manage");
  const canBook = can(actor, "facility.book");

  const [facilities, bookings] = await Promise.all([listFacilities(actor), listBookings(actor)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facilities"
        description="Spaces, equipment rooms, and bookings."
        breadcrumbs={[{ label: "Facilities" }]}
        actions={
          <div className="flex gap-2">
            {canBook ? <RequestBookingDialog facilities={facilities.map((f) => ({ id: f.id, name: f.name }))} /> : null}
            {canManage ? <CreateFacilityDialog /> : null}
          </div>
        }
      />

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="spaces">Spaces</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          {bookings.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-6" aria-hidden />}
              title="No bookings"
              description={canBook ? "Book a facility to schedule a room or hall." : "No facility bookings yet."}
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <span className="font-medium">{b.facility?.name ?? b.room?.name ?? "Facility"}</span>
                    <span className="block text-sm text-muted-foreground">
                      {b.purpose} · {b.startAt.toLocaleString()} → {b.endAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <Badge variant={statusVariant[b.status] ?? "neutral"}>{b.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="spaces" className="mt-4">
          {facilities.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-6" aria-hidden />}
              title="No facilities defined"
              description={canManage ? "Add a facility to start accepting bookings." : "No facilities have been added yet."}
            />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {facilities.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <span className="font-medium">{f.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[f.type, f.location, f.capacity ? `seats ${f.capacity}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <Badge variant={f.isBookable ? "success" : "neutral"}>{f.isBookable ? "Bookable" : "Not bookable"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
