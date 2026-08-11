"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Loader2,
  TrendingUp,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authHeaders, handleAuthFailure } from "@/lib/auth-token";

interface ExamListItem {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  _count: { questions: number; sessions: number };
}

const DEMO_EXAMS: ExamListItem[] = [
  {
    id: "demo-1",
    title: "Midterm — Computer Networks & Security",
    status: "COMPLETED",
    _count: { questions: 15, sessions: 22 },
  },
  {
    id: "demo-2",
    title: "Data Structures & Algorithms Quiz",
    status: "COMPLETED",
    _count: { questions: 10, sessions: 18 },
  },
  {
    id: "demo-3",
    title: "Operating Systems — Chapter 5 Test",
    status: "ACTIVE",
    _count: { questions: 8, sessions: 6 },
  },
];

function StatusBadge({ status }: { status: ExamListItem["status"] }) {
  if (status === "ACTIVE") {
    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
        ACTIVE
      </span>
    );
  }
  if (status === "COMPLETED") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        COMPLETED
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      DRAFT
    </span>
  );
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examIdParam = searchParams.get("examId");
  const sessionIdParam = searchParams.get("sessionId");

  const [exams, setExams] = useState<ExamListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Auto-redirect if examId is present in query string
  useEffect(() => {
    if (examIdParam) {
      const target = `/dashboard/results/${encodeURIComponent(examIdParam)}${
        sessionIdParam ? `?sessionId=${encodeURIComponent(sessionIdParam)}` : ""
      }`;
      router.replace(target);
    }
  }, [examIdParam, sessionIdParam, router]);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exams?page=1&pageSize=100", {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          data: { exams: ExamListItem[] };
        };
        if (payload.data?.exams) {
          setExams(payload.data.exams);
          setIsDemoMode(false);
          return;
        }
      }
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      setIsDemoMode(true);
      setExams(DEMO_EXAMS);
    } catch (err) {
      console.warn("Could not fetch exams for results page:", err);
      setIsDemoMode(true);
      setExams(DEMO_EXAMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const stats = useMemo(() => {
    const list = exams ?? [];
    const completed = list.filter((e) => e.status === "COMPLETED").length;
    const sessions = list.reduce((s, e) => s + e._count.sessions, 0);
    return [
      { label: "Total Exams", value: String(list.length), icon: ClipboardList },
      { label: "Completed", value: String(completed), icon: CheckCircle2 },
      { label: "Sessions Recorded", value: String(sessions), icon: Users2 },
      { label: "Ready to Email", value: String(completed), icon: TrendingUp },
    ];
  }, [exams]);

  return (
    <div className="flex flex-col gap-8">
      {/* Demo / Offline Mode Banner */}
      {isDemoMode && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm leading-tight">
            <span className="font-semibold">Demo / Preview Mode:</span> Backend server is unreachable. Displaying sample exam results.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadExams()}
            className="h-8 border-amber-500/40 text-xs text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
          >
            Retry
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Grading & distribution
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Results & scorecards
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Review per-student results, download PDF scorecards, and email
            marksheets to the whole class in one click.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel">
                <CardContent className="p-6">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))
          : stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="glass-panel">
                  <CardContent className="flex items-start justify-between p-6">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </span>
                      <p className="mt-2 text-3xl font-bold text-foreground">
                        {s.value}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      <Card className="glass-panel">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-primary" />
              Your exams
            </CardTitle>
            <CardDescription>
              Open an exam to grade sessions and distribute scorecards.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(exams ?? []).map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4 transition hover:border-primary/30 hover:bg-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {exam.title}
                  </p>
                  <StatusBadge status={exam.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {exam._count.questions} questions · {exam._count.sessions}{" "}
                  sessions
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-border/40"
                >
                  <Link href={`/dashboard/results/${exam.id}`}>
                    <BarChart3 className="h-4 w-4" />
                    Results & scorecards
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-border/40"
                >
                  <Link href={`/dashboard/exams/${exam.id}`}>
                    <FileDown className="h-4 w-4" />
                    Exam details
                  </Link>
                </Button>
              </div>
            </div>
          ))}

          {!loading && exams?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No exams yet — create one to start grading.
              </p>
              <Button asChild className="mt-4 h-9 gap-2">
                <Link href="/dashboard/exams/create">Create exam</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading results…
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
