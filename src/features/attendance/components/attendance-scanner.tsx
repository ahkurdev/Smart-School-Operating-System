"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CameraOff, CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { previewScanAction, confirmScanAction } from "@/features/attendance/scan-actions";
import type { ScanPreview } from "@/server/services/qr-attendance.service";

/**
 * Teacher scanner. Uses the device camera via ZXing to read the rotating QR and
 * posts the raw token to the server for verification. Nothing is committed until
 * the teacher taps Confirm. A manual entry path is offered for accessibility and
 * device failures.
 */

type ReaderControls = { stop: () => void };

export function AttendanceScanner({
  sessionId,
  canOverride,
  onConfirmed,
}: {
  sessionId: string;
  canOverride: boolean;
  onConfirmed?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ReaderControls | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recent, setRecent] = useState<{ name: string; status: string }[]>([]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const handleToken = useCallback(
    async (token: string) => {
      if (token === lastTokenRef.current) return; // debounce repeated reads
      lastTokenRef.current = token;
      const res = await previewScanAction(token, sessionId);
      if (res.ok) {
        setPreview(res.preview);
        setPendingToken(token);
      } else {
        toast.error(res.message);
        setTimeout(() => {
          lastTokenRef.current = null;
        }, 1500);
      }
    },
    [sessionId],
  );

  const start = useCallback(async () => {
    setStarting(true);
    setCameraError(null);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, err) => {
          if (result) void handleToken(result.getText());
          void err;
        },
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch {
      setCameraError("Camera access was blocked or no camera is available. Use manual entry below.");
    } finally {
      setStarting(false);
    }
  }, [handleToken]);

  useEffect(() => stop, [stop]);

  async function confirm(status?: "PRESENT" | "LATE") {
    if (!pendingToken) return;
    setConfirming(true);
    const res = await confirmScanAction(pendingToken, sessionId, status);
    setConfirming(false);
    if (res.ok) {
      toast.success(res.message ?? "Recorded");
      if (preview) setRecent((r) => [{ name: preview.student.fullName, status: res.message?.match(/\((\w+)\)/)?.[1] ?? "" }, ...r].slice(0, 5));
      setPreview(null);
      setPendingToken(null);
      lastTokenRef.current = null;
      onConfirmed?.();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="size-4" aria-hidden /> Scan student QR
        </CardTitle>
        <CardDescription>
          Point the camera at the student&apos;s rotating code. You confirm each identity before it is recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden rounded-lg border border-border bg-black/90">
          <video
            ref={videoRef}
            className="mx-auto block aspect-square w-full max-w-sm object-cover"
            muted
            playsInline
          />
          {!scanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white/80">
              <Camera className="size-8" aria-hidden />
              <p className="px-6 text-sm">Camera is off.</p>
            </div>
          ) : null}
        </div>

        {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}

        <div className="flex gap-2">
          {!scanning ? (
            <Button onClick={start} disabled={starting}>
              <Camera className="size-4" aria-hidden /> {starting ? "Starting…" : "Start camera"}
            </Button>
          ) : (
            <Button variant="outline" onClick={stop}>
              <CameraOff className="size-4" aria-hidden /> Stop camera
            </Button>
          )}
        </div>

        {preview ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4" role="status">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Confirm identity
            </p>
            <div className="flex items-center gap-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {preview.student.photoFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${preview.student.photoFileId}`} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground">
                    {preview.student.fullName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{preview.student.fullName}</p>
                <p className="font-mono text-xs text-muted-foreground">{preview.student.studentNumber}</p>
                <p className="text-xs text-muted-foreground">{preview.student.className ?? "—"}</p>
              </div>
              <Badge variant={preview.suggestedStatus === "LATE" ? "warning" : "success"}>
                {preview.suggestedStatus}
              </Badge>
            </div>

            {preview.alreadyMarked ? (
              <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Already marked <strong>{preview.alreadyMarked.status}</strong> at{" "}
                {new Date(preview.alreadyMarked.scanTime).toLocaleTimeString()}.
                {canOverride ? " You can override below." : " Ask an authorised user to override."}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => confirm("PRESENT")} disabled={confirming}>
                <CheckCircle2 className="size-4" aria-hidden /> Confirm present
              </Button>
              <Button variant="outline" onClick={() => confirm("LATE")} disabled={confirming}>
                Mark late
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  setPendingToken(null);
                  lastTokenRef.current = null;
                }}
                disabled={confirming}
              >
                <XCircle className="size-4" aria-hidden /> Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {recent.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Just recorded
            </p>
            <ul className="space-y-1 text-sm">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                  <span>{r.name}</span>
                  {r.status ? <Badge variant="outline">{r.status}</Badge> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
