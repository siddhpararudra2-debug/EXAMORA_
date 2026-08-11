"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Socket } from "socket.io-client";
import { authHeaders, handleAuthFailure } from "@/lib/auth-token";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CircleDot,
  History,
  Loader2,
  MonitorPlay,
  OctagonX,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  StudentSessionView,
  StudentStatusUpdateEvent,
  SessionStatus,
  getSocket,
  getSocketForAuth,
} from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth-token";
import { SupervisionGrid } from "@/components/live/SupervisionGrid";

const DEFAULT_WARNINGS_LIMIT = 3;

type SessionCard = StudentSessionView & { _new?: boolean };

function mockSessions(examId: string): StudentSessionView[] {
  const students = [
    { name: "Aarav Sharma", email: "aarav.s@school.edu" },
    { name: "Priya Desai", email: "priya.d@school.edu" },
    { name: "Noah Williams", email: "noah.w@school.edu" },
    { name: "Sofia Martinez", email: "sofia.m@school.edu" },
    { name: "Rohan Mehta", email: "rohan.m@school.edu" },
    { name: "Emma Johnson", email: "emma.j@school.edu" },
    { name: "Kenji Tanaka", email: "kenji.t@school.edu" },
    { name: "Amelia Clark", email: "amelia.c@school.edu" },
  ];
  const statuses: SessionStatus[] = [
    "IN_PROGRESS",
    "IN_PROGRESS",
    "IN_PROGRESS",
    "IN_PROGRESS",
    "IN_PROGRESS",
    "IN_PROGRESS",
    "TERMINATED",
    "SUBMITTED",
  ];
  const warningCounts = [0, 1, 0, 2, 0, 0, 3, 0];
  return students.map((s, i) => ({
    id: `sess_${examId}_${i + 1}`,
    examId,
    studentName: s.name,
    studentEmail: s.email,
    status: statuses[i],
    warnings: warningCounts[i],
    warningsLimit: DEFAULT_WARNINGS_LIMIT,
    joinedAt: new Date(Date.now() - (i + 3) * 60_000).toISOString(),
    lastActivityAt: new Date(Date.now() - (i + 1) * 30_000).toISOString(),
  }));
}

function StatusBadge({ status }: { status: SessionStatus }) {
  if (status === "IN_PROGRESS") {
    return (
      <Badge className="gap-1 bg-primary/10 text-primary border-none shadow-none font-semibold">
        <CircleDot className="h-3 w-3 text-primary animate-pulse" />
        In Progress
      </Badge>
    );
  }
  if (status === "SUBMITTED" || status === "AUTO_SUBMITTED") {
    return (
      <Badge className="gap-1 bg-secondary text-foreground border-none shadow-none font-semibold">
        <ShieldCheck className="h-3 w-3" />
        Submitted
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-destructive/10 text-destructive border-none shadow-none font-semibold">
      <OctagonX className="h-3 w-3" />
      Terminated
    </Badge>
  );
}

function WarningsBadge({
  warnings,
  limit,
  terminated,
}: {
  warnings: number;
  limit: number;
  terminated: boolean;
}) {
  if (terminated || warnings >= limit) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
        <ShieldAlert className="h-3.5 w-3.5" />
        🚫 {warnings}/{limit} TERMINATED
      </div>
    );
  }
  const warn = warnings > 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        warn
          ? "bg-amber-100 text-amber-800"
          : "bg-secondary/50 text-muted-foreground"
      )}
    >
      {warn ? (
        <ShieldAlert className="h-3.5 w-3.5" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" />
      )}
      ⚠️ {warnings}/{limit}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Math.round((Date.now() - then) / 1000);
  if (diff < 45) return `${diff}s ago`;
  if (diff < 3_600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86_400) return `${Math.round(diff / 3_600)}h ago`;
  return `${Math.round(diff / 86_400)}d ago`;
}

export default function LiveProctoringDashboard() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [examMeta, setExamMeta] = useState<{
    title: string;
    startedAt?: string;
  } | null>(null);
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [connected, setConnected] = useState(false);
  const [roomJoined, setRoomJoined] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const applyUpdate = useCallback((ev: StudentStatusUpdateEvent) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === ev.sessionId);
      const next: SessionCard =
        idx >= 0
          ? { ...prev[idx] }
          : {
              id: ev.sessionId,
              examId: ev.examId,
              studentName: ev.studentName ?? "Unknown student",
              status: (ev.status ?? "IN_PROGRESS") as SessionStatus,
              warnings: ev.warnings ?? 0,
              warningsLimit: ev.warningsLimit ?? DEFAULT_WARNINGS_LIMIT,
              _new: true,
              joinedAt: new Date().toISOString(),
              lastActivityAt: ev.timestamp ?? new Date().toISOString(),
            };

      if (typeof ev.warnings === "number") next.warnings = ev.warnings;
      if (typeof ev.warningsLimit === "number")
        next.warningsLimit = ev.warningsLimit;
      if (ev.status) next.status = ev.status as SessionStatus;
      if (ev.studentName) next.studentName = ev.studentName;
      if (ev.terminated) next.status = "TERMINATED";
      if (ev.submitted && next.status !== "TERMINATED")
        next.status = "SUBMITTED";
      next.lastActivityAt = ev.timestamp ?? new Date().toISOString();

      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      }
      return [next, ...prev];
    });
  }, []);

  const loadInitial = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/exams/${examId}/sessions`, {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          exam?: { title: string; startedAt?: string };
          sessions?: StudentSessionView[];
        };
        setExamMeta(data.exam ?? { title: "Live exam" });
        setSessions(
          (data.sessions ?? []).map((s) => ({ ...s, _new: false }))
        );
        setIsDemoMode(false);
      } else if (res.status === 401) {
        handleAuthFailure();
        return;
      } else {
        setIsDemoMode(true);
        setExamMeta({
          title: "Midterm Examination — Introduction to Computer Science",
          startedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
        });
        setSessions(mockSessions(examId).map((s) => ({ ...s, _new: false })));
      }
    } catch (err) {
      console.warn("Failed to load live sessions from server:", err);
      setIsDemoMode(true);
      setExamMeta({
        title: "Midterm Examination — Introduction to Computer Science",
        startedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
      });
      setSessions(mockSessions(examId).map((s) => ({ ...s, _new: false })));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    let canceled = false;
    let socket: Socket | null = null;

    (async () => {
      await loadInitial();
      if (canceled) return;

      try {
        socket = getSocketForAuth(getAuthToken() ?? undefined);
        socketRef.current = socket;

        socket.on("connect", () => {
          if (canceled) return;
          setConnected(true);
          socket?.emit("teacher_join_exam_room", { examId });
        });

        socket.on("disconnect", () => {
          if (canceled) return;
          setConnected(false);
          setRoomJoined(false);
        });

        socket.on("exam_room_joined", (payload: { examId: string }) => {
          if (canceled || payload.examId !== examId) return;
          setRoomJoined(true);
        });

        socket.on(
          "student_status_update",
          (ev: StudentStatusUpdateEvent) => {
            if (canceled || ev.examId !== examId) return;
            applyUpdate(ev);
            const critical = ev.terminated || (ev.warnings ?? 0) >= 3;
            toast({
              title: critical
                ? "Student session terminated"
                : ev.submitted
                ? "Student submitted"
                : "Proctoring event",
              description:
                (ev.studentName ?? "A student") +
                (ev.terminated
                  ? ` — reached the warnings limit (${ev.warnings}/${
                      ev.warningsLimit ?? DEFAULT_WARNINGS_LIMIT
                    }).`
                  : ev.submitted
                  ? " — submitted answers."
                  : typeof ev.warnings === "number" && ev.warnings > 0
                  ? ` — warning ${ev.warnings}/${
                      ev.warningsLimit ?? DEFAULT_WARNINGS_LIMIT
                    }.`
                  : " — status updated."),
              variant: critical ? "destructive" : "default",
            });
          }
        );

        socket.connect();
      } catch (e) {
        if (!canceled) {
          toast({
            title: "Live updates unavailable",
            description:
              "Socket connection failed. Refresh the page to retry.",
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      canceled = true;
      if (socket) {
        try {
          socket.emit("teacher_leave_exam_room", { examId });
        } catch (err) {
          console.debug("Error while leaving teacher exam room:", err);
        }
        socket.off("connect");
        socket.off("disconnect");
        socket.off("exam_room_joined");
        socket.off("student_status_update");
      }
    };
  }, [examId, applyUpdate, loadInitial, toast]);

  const counts = useMemo(() => {
    const c = { active: 0, terminated: 0, submitted: 0, total: 0, warnings: 0 };
    for (const s of sessions) {
      c.total += 1;
      if (s.status === "IN_PROGRESS") c.active += 1;
      if (s.status === "TERMINATED") c.terminated += 1;
      if (s.status === "SUBMITTED" || s.status === "AUTO_SUBMITTED") c.submitted += 1;
      c.warnings += s.warnings;
    }
    return c;
  }, [sessions]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm leading-tight">
            <span className="font-semibold">Demo / Offline Monitor Mode:</span> Live session backend is unreachable. Displaying simulated student telemetry.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadInitial()}
            className="h-8 border-amber-500/40 text-xs text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-in slide-in-from-bottom-2 fade-in duration-500">
        <div>
          <Link
            href="/dashboard/exams/live"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to live exams
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {examMeta?.title ?? "Live proctoring"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Real-time view of every student session. Warnings and status
            updates stream in instantly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadInitial()}
            disabled={refreshing}
            className="h-10 gap-2 border-border/40"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh list
          </Button>
          <span
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
              connected && roomJoined
                ? "bg-primary/10 text-primary"
                : connected
                ? "bg-amber-100 text-amber-800"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {connected && roomJoined ? (
              <>
                <Wifi className="h-4 w-4" />
                Live
              </>
            ) : connected ? (
              <>
                <Activity className="h-4 w-4 animate-pulse" />
                Connecting…
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                Offline
              </>
            )}
          </span>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Card className="glass-panel animate-in slide-in-from-bottom-4 fade-in duration-700">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground">
                <Users2 className="h-6 w-6" />
              </span>
              {examMeta?.startedAt && (
                <span className="rounded-full bg-secondary/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Started {relativeTime(examMeta.startedAt)}
                </span>
              )}
            </div>
            <p className="mt-6 text-sm font-medium text-muted-foreground">
              Total Students
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
              {counts.total}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel animate-in slide-in-from-bottom-4 fade-in duration-700 delay-75">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MonitorPlay className="h-6 w-6" />
              </span>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-6 text-sm font-medium text-muted-foreground">
              In Progress
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
              {counts.active}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel animate-in slide-in-from-bottom-4 fade-in duration-700 delay-150">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground">
                <ShieldCheck className="h-6 w-6" />
              </span>
            </div>
            <p className="mt-6 text-sm font-medium text-muted-foreground">
              Submitted
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
              {counts.submitted}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-6 w-6" />
              </span>
            </div>
            <p className="mt-6 text-sm font-medium text-muted-foreground">
              Terminated · Warnings
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-foreground">
              {counts.terminated}
              <span className="ml-2 text-xl font-normal text-muted-foreground">
                · {counts.warnings}⚠
              </span>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Live camera & mic supervision (WebRTC mesh) — S02/S03/S07 */}
      <SupervisionGrid
        examId={examId}
        socket={socketRef.current}
        roomJoined={roomJoined}
        sessions={sessions}
      />

      {/* Grid */}
      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl glass-panel">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-lg font-medium">Loading student sessions…</span>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="glass-panel border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Users2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              No students yet
            </h3>
            <p className="max-w-md text-base text-muted-foreground">
              Students haven&apos;t joined this exam. Their sessions will
              appear here the moment they start.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sessions.map((s) => {
            const terminated = s.status === "TERMINATED";
            const submitted = s.status === "SUBMITTED" || s.status === "AUTO_SUBMITTED";
            return (
              <Card
                key={s.id}
                className={cn(
                  "glass-panel hover-lift transition-all",
                  terminated && "border-destructive/30 bg-destructive/5 ring-1 ring-destructive/20",
                  s._new && "animate-[fadeIn_300ms_ease-out] ring-2 ring-primary/30"
                )}
              >
                <CardHeader className="flex-row items-start justify-between gap-3 p-6 pb-2">
                  <div className="flex min-w-0 items-start gap-4">
                    <div
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-sm ring-2 ring-background"
                    >
                      {initials(s.studentName)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base font-bold leading-5 text-foreground mt-1">
                        {s.studentName}
                      </CardTitle>
                      {s.studentEmail ? (
                        <CardDescription className="mt-1 truncate text-xs text-muted-foreground">
                          {s.studentEmail}
                        </CardDescription>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <div className="px-6 py-2 flex justify-end">
                    <StatusBadge status={s.status} />
                </div>
                <CardContent className="grid grid-cols-1 gap-5 p-6 pt-2">
                  <WarningsBadge
                    warnings={s.warnings}
                    limit={s.warningsLimit}
                    terminated={terminated}
                  />
                  <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-5 text-xs text-muted-foreground">
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Joined
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-foreground">
                        {relativeTime(s.joinedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Last activity
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-foreground">
                        {relativeTime(s.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 pt-5 mt-1 gap-2">
                    <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/50 truncate">
                      {s.id.length > 10
                        ? `…${s.id.slice(s.id.length - 10)}`
                        : s.id}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-semibold rounded-full gap-1 border-border/40 hover:bg-primary/5 hover:text-primary"
                        asChild
                      >
                        <Link href={`/dashboard/exams/${encodeURIComponent(examId)}/sessions/${encodeURIComponent(s.id)}/timeline`}>
                          <History className="h-3.5 w-3.5 text-primary" />
                          Timeline
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs font-semibold rounded-full"
                        asChild
                      >
                        <Link href={`/dashboard/results/${encodeURIComponent(examId)}?sessionId=${encodeURIComponent(s.id)}`}>
                          View Session
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
