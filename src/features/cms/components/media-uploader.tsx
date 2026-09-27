"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadMediaAction, type UploadResult } from "@/features/cms/upload-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      <Upload className="size-4" aria-hidden /> {pending ? "Uploading…" : "Upload"}
    </Button>
  );
}

export function MediaUploader() {
  const [state, action] = useActionState<UploadResult | null, FormData>(uploadMediaAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    if (state?.ok) {
      toast.success("File uploaded");
      formRef.current?.reset();
      setName("");
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-xl border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="file">File (JPEG, PNG, WebP or PDF)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            onChange={(e) => setName(e.target.files?.[0]?.name ?? "")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alt">Alt text (accessibility)</Label>
          <Input id="alt" name="alt" placeholder="Describe the image" maxLength={200} disabled={!name} />
        </div>
      </div>
      <Submit />
    </form>
  );
}
