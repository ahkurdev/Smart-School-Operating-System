"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createLibraryItemAction, type LibraryResult } from "@/features/library/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Adding…" : "Add to catalog"}
    </Button>
  );
}

export function CreateLibraryItemDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("PHYSICAL");
  const [state, action] = useActionState<LibraryResult | null, FormData>(createLibraryItemAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Item added to the catalog");
      setOpen(false);
      router.refresh();
    } else if (state && !state.ok) {
      const res = state;
      toast.error(res.error);
      void res.fieldErrors;
    }
  }, [state, router]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  const sel = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden /> New item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New library item</DialogTitle>
          <DialogDescription>Add a book, digital resource, or reference to the catalog.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={300} aria-invalid={!!fieldErrors?.title} />
            {fieldErrors?.title && <p className="text-sm text-destructive">{fieldErrors.title}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input id="author" name="author" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input id="publisher" name="publisher" maxLength={200} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" min={1000} max={2200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" name="isbn" maxLength={40} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" maxLength={120} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" className={sel} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="PHYSICAL">Physical</option>
                <option value="EBOOK">E-book</option>
                <option value="DOCUMENT">Document</option>
                <option value="LINK">External link</option>
              </select>
            </div>
            {type === "PHYSICAL" ? (
              <div className="space-y-2">
                <Label htmlFor="copyCount">Copies</Label>
                <Input id="copyCount" name="copyCount" type="number" min={0} max={500} defaultValue={1} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="externalUrl">External URL</Label>
                <Input id="externalUrl" name="externalUrl" type="url" placeholder="https://…" />
                {fieldErrors?.externalUrl && <p className="text-sm text-destructive">{fieldErrors.externalUrl}</p>}
              </div>
            )}
          </div>
          {type !== "PHYSICAL" && (
            <div className="space-y-2">
              <Label htmlFor="accessLevel">Access level</Label>
              <select id="accessLevel" name="accessLevel" className={sel} defaultValue="student">
                <option value="public">Public</option>
                <option value="student">Students</option>
                <option value="staff">Staff</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} maxLength={4000} />
          </div>
          <DialogFooter>
            <Submit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
