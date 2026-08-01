"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Socket } from "socket.io-client";
import {
  Activity,
  ArrowLeft,
  CircleDot,
  Loader2,
  MonitorPlay,
  OctagonX,
  Radio,
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
} from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";

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
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
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
  if (status === "ACTIVE") {
    return (
      <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 hover:bg-emerald-50">
        <CircleDot className="h-3 w-3 fill-emerald-500 text-emerald-500" />
        In progress
      </Badge>
    );
  }
  if (status === "JOINED") {
    return (
      <Badge className="gap-1 bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100 hover:bg-sky-50">
        <Radio className="h-3 w-3" />
        Joined
      </Badge>
    );
  }
  if (status === "SUBMITTED") {
    return (
      <Badge className="gap-1 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 hover:bg-indigo-50">
        <ShieldCheck className="h-3 w-3" />
        Submitted
      </Badge>
    );
  }
  if (status === "GRADED") {
    return (
      <Badge className="gap-1 bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100">
        <ShieldCheck className="h-3 w-3" />
        Graded
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-red-50 text-red-700 ring-1 ring-inset ring-red-100 hover:bg-red-50">
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
      <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-100">
        <ShieldAlert className="h-3.5 w-3.5" />
        🚫 {warnings}/{limit} TERMINATED
      </div>
    );
  }
  const warn = warnings > 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        warn
          ? "border-amber-200 bg-amber-50 text-amber-800 ring-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-100"
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

  // Re-render every ~30s so relative timestamps stay fresh
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
              status: (ev.status ?? "JOINED") as SessionStatus,
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
      } else {
        setExamMeta({
          title: "Midterm Examination — Introduction to Computer Science",
          startedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
        });
        setSessions(mockSessions(examId).map((s) => ({ ...s, _new: false })));
      }
    } catch {
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

  // Initial fetch + socket setup
  useEffect(() => {
    let canceled = false;
    let socket: Socket | null = null;

    (async () => {
      await loadInitial();
      if (canceled) return;

      try {
        socket = getSocket();
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
        } catch {
          /* ignore */
        }
        socket.off("connect");
        socket.off("disconnect");
        socket.off("exam_room_joined");
        socket.off("student_status_update");
        // Do NOT globally disconnect — another page might need the socket.
      }
    };
    // Intentionally refresh only when examId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const counts = useMemo(() => {
    const c = { active: 0, terminated: 0, submitted: 0, total: 0, warnings: 0 };
    for (const s of sessions) {
      c.total += 1;
      if (s.status === "ACTIVE" || s.status === "JOINED") c.active += 1;
      if (s.status === "TERMINATED") c.terminated += 1;
      if (s.status === "SUBMITTED" || s.status === "GRADED") c.submitted += 1;
      c.warnings += s.warnings;
    }
    return c;
  }, [sessions]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard/exams/live"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Live exams
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {examMeta?.title ?? "Live proctoring"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Real-time view of every student session. Warnings and status
            updates stream in without a page refresh.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadInitial()}
            disabled={refreshing}
            className="h-9 gap-1.5"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh list
          </Button>
          <span
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold ring-1 ring-inset",
              connected && roomJoined
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-100"
                : connected
                ? "border-amber-200 bg-amber-50 text-amber-800 ring-amber-100"
                : "border-slate-200 bg-slate-50 text-slate-600 ring-slate-200"
            )}
          >
            {connected && roomJoined ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                Live
              </>
            ) : connected ? (
              <>
                <Activity className="h-3.5 w-3.5" />
                Connecting…
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </>
            )}
          </span>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-slate-200/70 ring-1 ring-slate-100">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
                <Users2 className="h-5 w-5" />
              </span>
              {examMeta?.startedAt && (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                  Started {relativeTime(examMeta.startedAt)}
                </span>
              )}
            </div>
            <p className="mt-5 text-sm font-medium text-slate-500">
              Students total
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {counts.total}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 ring-1 ring-slate-100">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                <MonitorPlay className="h-5 w-5" />
              </span>
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-5 text-sm font-medium text-slate-500">
              In progress
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {counts.active}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 ring-1 ring-slate-100">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-500">
              Submitted
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {counts.submitted}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 ring-1 ring-slate-100">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-inset ring-red-100">
                <ShieldAlert className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-500">
              Terminated · Total warnings
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {counts.terminated}
              <span className="ml-2 text-base font-normal text-slate-500">
                · {counts.warnings}⚠
              </span>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Grid */}
      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-700" />
            <span className="text-base">Loading student sessions…</span>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-white/60 ring-1 ring-slate-100">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
              <Users2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              No students yet
            </h3>
            <p className="max-w-md text-sm text-slate-600">
              Students haven&apos;t joined this exam. Their sessions will
              appear here the moment they start.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sessions.map((s) => {
            const terminated = s.status === "TERMINATED";
            const submitted = s.status === "SUBMITTED" || s.status === "GRADED";
            return (
              <Card
                key={s.id}
                className={cn(
                  "transition-shadow",
                  terminated
                    ? "border-red-200 bg-white shadow-[0_1px_2px_rgba(127,29,29,0.05)] ring-1 ring-inset ring-red-100"
                    : submitted
                    ? "border-indigo-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-inset ring-indigo-100"
                    : "border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100",
                  s._new &&
                    "animate-[fadeIn_300ms_ease-out] ring-2 ring-indigo-200"
                )}
              >
                <CardHeader className="flex-row items-start justify-between gap-3 p-5 pb-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 text-sm font-semibold text-white shadow-sm ring-2 ring-white"
                    >
                      {initials(s.studentName)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-[15px] font-semibold leading-5 text-slate-900">
                        {s.studentName}
                      </CardTitle>
                      {s.studentEmail ? (
                        <CardDescription className="mt-0.5 truncate text-xs text-slate-500">
                          {s.studentEmail}
                        </CardDescription>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 p-5">
                  <WarningsBadge
                    warnings={s.warnings}
                    limit={s.warningsLimit}
                    terminated={terminated}
                  />
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <div>
                      <p className="font-medium uppercase tracking-wider text-slate-400">
                        Joined
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {relativeTime(s.joinedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium uppercase tracking-wider text-slate-400">
                        Last activity
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {relativeTime(s.lastActivityAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      {s.id.length > 12
                        ? `…${s.id.slice(s.id.length - 12)}`
                        : s.id}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      asChild
                    >
                      <Link href={`/dashboard/results?examId=${encodeURIComponent(examId)}&sessionId=${encodeURIComponent(s.id)}`}>
                        View session
                      </Link>
                    </Button>
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
