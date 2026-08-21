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
  ArrowRight,
  Clock,
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
    title: "CS 301 — Computer Networks & Security Midterm",
    status: "COMPLETED",
    _count: { questions: 20, sessions: 28 },
  },
  {
    id: "demo-2",
    title: "CS 201 — Data Structures Final Examination",
    status: "COMPLETED",
    _count: { questions: 30, sessions: 45 },
  },
  {
    id: "demo-3",
    title: "CS 204 — Database Systems Assignment",
    status: "ACTIVE",
    _count: { questions: 15, sessions: 16 },
  },
];

function StatusBadge({ status }: { status: ExamListItem["status"] }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
        <CheckCircle2 className="h-3 w-3 text-zinc-500" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-500 border border-zinc-200 dark:border-zinc-800">
      <Clock className="h-3 w-3 text-zinc-400" />
      Draft
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
      { label: "Total Assessments", value: String(list.length), icon: ClipboardList },
      { label: "Completed Exams", value: String(completed), icon: CheckCircle2 },
      { label: "Candidate Submissions", value: String(sessions), icon: Users2 },
      { label: "PDF Scorecards Ready", value: String(completed), icon: Award },
    ];
  }, [exams]);

  return (
    <div className="flex flex-col gap-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="flex items-center gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <span className="font-medium">Offline Preview:</span> Displaying sample assessment gradebooks.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadExams()}
            className="h-6 text-[11px] border-amber-300 dark:border-amber-800"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Results & Scorecards
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Review individual student submissions, verify question scoring, and export PDF marksheets.
          </p>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <CardContent className="p-4">
                  <div className="h-3.5 w-20 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="mt-2 h-7 w-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))
          : stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-zinc-500 font-medium">
                        {s.label}
                      </span>
                      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {s.value}
                      </p>
                    </div>
                    <Icon className="h-4 w-4 text-zinc-400" />
                  </CardContent>
                </Card>
              );
            })}
      </section>

      {/* Exam List */}
      <Card className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5">
          <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Assessment Records
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 mt-0.5">
            Select an assessment to view submitted student answers and export results.
          </CardDescription>
        </CardHeader>

        <CardContent className="divide-y divide-zinc-100 dark:divide-zinc-800 p-0">
          {(exams ?? []).map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {exam.title}
                  </p>
                  <StatusBadge status={exam.status} />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {exam._count.questions} questions · {exam._count.sessions} candidate submissions
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  asChild
                  size="sm"
                  className="h-7 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Link href={`/dashboard/results/${exam.id}`}>
                    <BarChart3 className="mr-1.5 h-3 w-3" />
                    Review Scorecards
                  </Link>
                </Button>
              </div>
            </div>
          ))}

          {!loading && exams?.length === 0 && (
            <div className="p-8 text-center text-xs text-zinc-500">
              <ClipboardList className="mx-auto h-6 w-6 text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="font-medium text-zinc-700 dark:text-zinc-300">No assessments created yet</p>
              <Button asChild size="sm" className="mt-3 h-7 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
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
        <div className="flex min-h-[300px] items-center justify-center text-xs text-zinc-500">
          Loading results…
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
