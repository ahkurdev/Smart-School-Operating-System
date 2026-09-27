import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { getActor } from "@/server/auth/context";
import { getStorage } from "@/server/storage";

/**
 * Authorised file access. Files are stored provider-agnostically; this route is
 * the single door: it checks the actor is signed in and that the file belongs to
 * their tenant before streaming or redirecting. No public bucket paths leak.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
    select: { id: true, tenantId: true, key: true, mimeType: true, fileName: true, size: true, isPublic: true },
  });
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Tenant isolation: a member of another tenant may never read this file.
  if (file.tenantId && file.tenantId !== actor.tenantId && !actor.isPlatform) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const storage = getStorage();
  const url = await storage.getUrl(file.key);
  if (url) {
    return NextResponse.redirect(url);
  }
  const bytes = await storage.get(file.key);
  if (!bytes) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType ?? "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
    },
  });
}
