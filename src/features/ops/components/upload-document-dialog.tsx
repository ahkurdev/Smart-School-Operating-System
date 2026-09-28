"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createDocumentAction, type DataResult } from "@/features/ops/data-actions";

function Submit({ uploading }: { uploading: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || uploading;
  return (
    <Button type="submit" disabled={busy} aria-busy={busy}>
      {busy ? "Uploading…" : "Save document"}
    </Button>
  );
}

export function UploadDocumentDialog({ students }: { students: { id: string; name: string; studentNumber: string }[] }) {
  const [open, setOpen] = useState(false);
  const [uploading, startUpload] = useTransition();
  const [state, action] = useActionState<DataResult | null, FormData>(createDocumentAction, null);
  const fileIdRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // When the file input changes, upload it to /api/upload-temp and stash the id.
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileIdRef.current) fileIdRef.current.value = "";
    startUpload(async () => {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "document");
      const res = await fetch("/api/upload-temp", { method: "POST", body });
      const json = (await res.json()) as { fileId?: string; message?: string };
      if (!res.ok || !json.fileId) {
        toast.error(json.message ?? "Upload failed");
        if (e.target) e.target.value = "";
        return;
      }
      if (fileIdRef.current) fileIdRef.current.value = json.fileId;
      toast.success("File uploaded");
    });
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success("Document saved");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
  const errs = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="size-4" aria-hidden /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>JPEG, PNG, WebP, or PDF up to 10 MB. Access is enforced server-side.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="fileId" ref={fileIdRef} />
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <Input id="doc-file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={onFileChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" name="title" required maxLength={300} />
            {errs?.title && <p className="text-sm text-destructive">{errs.title}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-category">Category</Label>
              <Input id="doc-category" name="category" placeholder="Policy, Certificate…" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-access">Access level</Label>
              <select id="doc-access" name="accessLevel" className={sel} defaultValue="RESTRICTED">
                <option value="PUBLIC">Public</option>
                <option value="STAFF">Staff</option>
                <option value="RESTRICTED">Restricted (document.read)</option>
                <option value="PRIVATE">Private (uploader only)</option>
              </select>
            </div>
          </div>
          {students.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="doc-student">Link to student (optional)</Label>
              <select id="doc-student" name="studentId" className={sel} defaultValue="">
                <option value="">—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentNumber})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="doc-expires">Expires (optional)</Label>
            <Input id="doc-expires" name="expiresAt" type="date" />
          </div>
          <DialogFooter>
            <Submit uploading={uploading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
