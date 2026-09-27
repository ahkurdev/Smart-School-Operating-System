"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, RefreshCw, WifiOff, Clock } from "lucide-react";
import { toast } from "sonner";
import { issueAttendanceTokenAction, type AttendanceTokenResult } from "@/features/attendance/actions";
import { cn } from "@/lib/cn";

/**
 * The digital student card: identity block plus a rotating QR. The token is
 * fetched from the server on a timer (never embedded in the page), and the QR is
 * rendered locally. When the network fails the card says so plainly and does NOT
 * pretend the QR is still valid — verification is server-side only.
 */

type CardStudent = {
  fullName: string;
  studentNumber: string;
  className: string | null;
  schoolName: string;
  academicYear: string | null;
  photoUrl: string | null;
};

export function DigitalStudentCard({
  studentId,
  student,
}: {
  studentId: string;
  student: CardStudent;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [openSessionTitle, setOpenSessionTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "offline" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyResult = useCallback(async (res: AttendanceTokenResult) => {
    if (!res.ok) {
      setStatus("error");
      setErrorMsg(res.message);
      setToken(null);
      return;
    }
    setToken(res.token);
    setExpiresAt(new Date(res.expiresAt));
    setOpenSessionTitle(res.openSession?.title ?? res.openSession ? res.openSession.title : null);
    setStatus("ready");
    setErrorMsg(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await issueAttendanceTokenAction(studentId);
      await applyResult(res);
    } catch {
      setStatus("offline");
      setToken(null);
    }
  }, [studentId, applyResult]);

  // Initial fetch + periodic refresh a little before expiry.
  useEffect(() => {
    void refresh();
    refreshRef.current = setInterval(() => void refresh(), 28_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [refresh]);

  // Countdown ticker.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (expiresAt) {
        const left = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
        setSecondsLeft(left);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  // Render QR whenever the token changes.
  useEffect(() => {
    if (!token || !canvasRef.current) return;
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toCanvas(canvasRef.current!, token, {
          width: 224,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
          errorCorrectionLevel: "M",
        }),
      )
      .catch(() => {
        if (!cancelled) toast.error("Could not render the QR code.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const expired = secondsLeft <= 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <QrCode className="size-4" aria-hidden /> Student identity
        </div>
        <span className="text-xs text-muted-foreground">{student.schoolName}</span>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4 sm:flex-col sm:text-center">
          <div className="size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
            {student.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {student.fullName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="sm:mt-1">
            <p className="text-base font-semibold leading-tight">{student.fullName}</p>
            <p className="font-mono text-xs text-muted-foreground">{student.studentNumber}</p>
            {student.className ? <p className="text-xs text-muted-foreground">{student.className}</p> : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center">
          <div className="relative rounded-xl border border-border bg-white p-3">
            <canvas
              ref={canvasRef}
              className={cn("block size-56", (status === "offline" || status === "error") && "opacity-30")}
              aria-label="Dynamic attendance QR code"
              role="img"
            />
            {status === "offline" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/85 text-center">
                <WifiOff className="size-6 text-destructive" aria-hidden />
                <p className="px-6 text-xs font-medium text-destructive">
                  QR cannot be verified until the connection is restored.
                </p>
              </div>
            ) : null}
            {status === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/85 px-6 text-center">
                <p className="text-xs font-medium text-destructive">{errorMsg}</p>
              </div>
            ) : null}
            {expired && status === "ready" ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/85">
                <RefreshCw className="size-6 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {status === "loading" || status === "idle" ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" aria-hidden /> Preparing secure code…
              </>
            ) : status === "ready" ? (
              <>
                <Clock className="size-3.5" aria-hidden />
                <span aria-live="polite">Valid for {secondsLeft}s</span>
              </>
            ) : (
              <span className="text-destructive">Not available offline</span>
            )}
          </div>

          {openSessionTitle ? (
            <p className="mt-2 rounded-md bg-success/10 px-2 py-1 text-xs text-success">
              Attendance open: {openSessionTitle}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No attendance session is open right now. You can still show this card.
            </p>
          )}
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            This code rotates automatically and contains no personal data.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>Academic year</span>
        <span className="tabular font-medium">{student.academicYear ?? "—"}</span>
      </div>
    </div>
  );
}
