"use client";

import { Socket } from "socket.io-client";
import {
  Activity,
  Clock3,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Examora MVP supervision policy.
 *
 * The educator receives reviewable event/status telemetry only. Student video
 * is not requested, relayed, recorded, or exposed in the default launch path.
 * Device-local face/gaze checks and browser integrity listeners continue to
 * report approved event metadata through the canonical proctoring API.
 */

interface SessionLike {
  id: string;
  studentName: string;
  status?: string;
  warnings?: number;
  warningsLimit?: number;
  lastActivityAt?: string;
}

interface SupervisionGridProps {
  examId: string;
  socket: Socket | null;
  roomJoined: boolean;
  sessions: SessionLike[];
}

function relativeTime(iso?: string): string {
  if (!iso) return "Awaiting first event";
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "Awaiting first event";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function statusLabel(status?: string): string {
  if (status === "TERMINATED") return "Terminated";
  if (status === "SUBMITTED" || status === "AUTO_SUBMITTED") return "Submitted";
  return "In progress";
}

export function SupervisionGrid({
  examId,
  socket,
  roomJoined,
  sessions,
}: SupervisionGridProps) {
  if (!roomJoined) return null;

  const warningCount = sessions.reduce(
    (total, session) => total + (session.warnings ?? 0),
    0,
  );
  const activeCount = sessions.filter(
    (session) => !["TERMINATED", "SUBMITTED", "AUTO_SUBMITTED"].includes(session.status ?? ""),
  ).length;
  const connected = Boolean(socket?.connected);

  return (
    <section
      aria-labelledby="supervision-title"
      data-exam-id={examId}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="supervision-title" className="text-base font-bold text-foreground">
                Integrity event monitor
              </h2>
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 shadow-none dark:text-emerald-300">
                Video not shared
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Examora records reviewable warning and session signals. Face and gaze checks run on the student&apos;s device; the educator receives event type, time, warning count, and session status—not a default camera feed or recording.
            </p>
          </div>
        </div>
        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
            connected
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-secondary text-muted-foreground",
          )}
          aria-live="polite"
        >
          {connected ? (
            <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {connected ? "Realtime connected" : "Last-known status"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-2xl font-bold text-foreground">{activeCount}</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active sessions
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Status updates remain visible during a connection interruption.</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <Radio className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="text-2xl font-bold text-foreground">{warningCount}</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Signals recorded
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Signals are evidence for review, not automatic misconduct findings.</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <LockKeyhole className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-2xl font-bold text-foreground">{sessions.length}</span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Owned sessions
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Only the assessment owner can view this exam&apos;s telemetry.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
        <Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          Latest candidate activity is shown on each session card. Open a candidate&apos;s timeline for the chronological event record.
        </span>
        <span className="ml-auto hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:inline">
          {sessions.length > 0 ? relativeTime(sessions[0]?.lastActivityAt) : "No events"}
        </span>
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground/80">
        Privacy boundary: the MVP does not request remote camera feeds, snapshots, audio, or recordings for educator supervision. Any future media feature must be enabled separately with consent, retention rules, and access controls.
      </p>
    </section>
  );
}

export default SupervisionGrid;
