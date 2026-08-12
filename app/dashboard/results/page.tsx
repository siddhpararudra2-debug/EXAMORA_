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
  Mail,
  ArrowRight,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    _count: { questions: 20, sessions: 28 },
  },
  {
    id: "demo-2",
    title: "Final Exam — Data Structures & Algorithms",
    status: "COMPLETED",
    _count: { questions: 30, sessions: 45 },
  },
  {
    id: "demo-3",
    title: "Operating Systems — Concurrency & Deadlocks",
    status: "ACTIVE",
    _count: { questions: 12, sessions: 16 },
  },
];

function StatusBadge({ status }: { status: ExamListItem["status"] }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none font-bold text-[10px]">
        ACTIVE
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge className="gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-none font-bold text-[10px]">
        COMPLETED
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-secondary text-muted-foreground border-border/40 shadow-none text-[10px]">
      DRAFT
    </Badge>
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
    } catch {
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
      {
        label: "Total Assessments",
        value: String(list.length),
        icon: ClipboardList,
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-500/10",
      },
      {
        label: "Completed & Graded",
        value: String(completed),
        icon: CheckCircle2,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10",
      },
      {
        label: "Candidate Submissions",
        value: String(sessions),
        icon: Users2,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500/10",
      },
      {
        label: "PDF Scorecards Ready",
        value: String(completed),
        icon: Award,
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-500/10",
      },
    ];
  }, [exams]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-xs sm:text-sm">
            <span className="font-semibold">Demo Gradebook:</span> Showing simulated assessment results and scorecards.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadExams()}
            className="h-8 border-amber-500/40 text-xs rounded-xl hover:bg-amber-500/20"
          >
            Refresh
          </Button>
        </div>
      )}

      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            Grading & PDF Scorecards
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Results & Marksheets
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            Review individual student answers, generate branded PDF scorecards, and email final gradebooks in bulk.
          </p>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel">
                <CardContent className="p-5">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))
          : stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="glass-panel border-slate-200/80 dark:border-slate-800 hover-lift">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </span>
                      <p className="mt-1 text-3xl font-extrabold text-foreground">
                        {s.value}
                      </p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bgColor} ${s.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      {/* Exam List */}
      <Card className="glass-panel border-slate-200/80 dark:border-slate-800 shadow-lg">
        <CardHeader className="border-b border-border/40 px-6 py-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Assessment Gradebooks
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Select an assessment to view student submissions, evaluate AI subjective grades, or batch distribute marksheets.
          </CardDescription>
        </CardHeader>

        <CardContent className="divide-y divide-border/40 p-0">
          {(exams ?? []).map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors hover:bg-secondary/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-foreground">
                    {exam.title}
                  </p>
                  <StatusBadge status={exam.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                  <span>{exam._count.questions} questions</span>
                  <span>•</span>
                  <span className="font-semibold text-foreground">{exam._count.sessions} candidate submissions</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="h-9 gap-2 gradient-brand rounded-xl font-semibold text-xs shadow-sm shadow-indigo-500/20"
                >
                  <Link href={`/dashboard/results/${exam.id}`}>
                    <BarChart3 className="h-3.5 w-3.5" />
                    Scorecards & Review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}

          {!loading && exams?.length === 0 && (
            <div className="rounded-2xl p-12 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground">No assessments created yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create an exam to begin recording submissions.</p>
              <Button asChild className="mt-4 gradient-brand rounded-xl h-9 text-xs font-semibold">
                <Link href="/dashboard/exams/create">Create Exam</Link>
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
