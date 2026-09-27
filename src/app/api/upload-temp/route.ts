import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/server/auth/context";
import { storeFile } from "@/server/services/file.service";
import { isAppError } from "@/server/errors";

/**
 * Generic authenticated upload endpoint (Phase 35 and beyond).
 *
 * Accepts a single file, runs it through `storeFile` (which enforces size,
 * MIME, extension and magic-byte checks and writes to the configured storage
 * provider) and returns the created file id. Kept to token-authenticated app
 * users; the caller then attaches the id to whatever entity it belongs to.
 */
export async function POST(request: NextRequest) {
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") ?? "upload");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(actor, {
      file: { name: file.name, type: file.type, size: file.size, bytes },
      purpose,
      isPublic: false,
    });
    return NextResponse.json({ fileId: stored.id });
  } catch (e) {
    if (isAppError(e)) {
      return NextResponse.json({ error: e.code, message: e.userMessage }, { status: e.status });
    }
    throw e;
  }
}
