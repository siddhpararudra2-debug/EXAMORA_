"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
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
import { toast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/auth-token";

interface SessionResult {
  id: string;
  studentName: string;
  enrollmentNumber: string | null;
  email: string | null;
  status: string;
  submittedAt: string | null;
  totalScore: number | null;
  percentage: number | null;
  answers: {
    question_id: string;
    answer_text: string | null;
    is_correct: boolean | null;
    marks_awarded: number | null;
    needs_review: boolean;
  }[];
}

interface Question {
  id: string;
  question_text: string;
  type: string;
  marks: number;
  correct_answer: string | null;
  order_index: number;
}

interface ResultsPayload {
  exam: { id: string; title: string };
  questions: Question[];
  results: SessionResult[];
}

const DEMO_EXAM: ResultsPayload = {
  exam: { id: "demo-1", title: "Midterm — Computer Networks & Security" },
  questions: Array.from({ length: 15 }, (_, i) => ({
    id: `q${i + 1}`,
    question_text: `Sample question ${i + 1}`,
    type: "MCQ",
    marks: 5,
    correct_answer: "A",
    order_index: i + 1,
  })),
  results: Array.from({ length: 4 }, (_, i) => ({
    id: `s${i + 1}`,
    studentName: `Demo Student ${i + 1}`,
    enrollmentNumber: `ENR-${i + 1}000${i}`,
    email: `student${i + 1}@example.com`,
    status: "SUBMITTED",
    submittedAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    totalScore: 60 - i * 5,
    percentage: 80 - i * 6.67,
    answers: [],
  })),
};

function StatusBadge({ status }: { status: string }) {
  if (status === "TERMINATED") {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
        TERMINATED
      </span>
    );
  }
  if (status === "SUBMITTED") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        SUBMITTED
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      {status}
    </span>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const pct = Math.round(value * 100) / 100;
  const color =
    pct >= 60
      ? "text-emerald-600"
      : pct >= 40
        ? "text-amber-600"
        : "text-rose-600";
  return <span className={`font-semibold ${color}`}>{pct.toFixed(1)}%</span>;
}

export default function ExamResultsPage() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, boolean>>({});

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/results`, {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          status: string;
          data: ResultsPayload;
        };
        setData(payload.data);
        setLoading(false);
        return;
      }
    } catch {
      // Backend unavailable — fall back to demo data below.
    }
    setData(DEMO_EXAM);
    setLoading(false);
  }, [examId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const gradeAll = useCallback(async () => {
    setGrading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/grade-all`, {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders() },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (res.ok) {
        toast({
          title: "Grading complete",
          description:
            payload?.message ?? "Sessions have been graded. You can now email scorecards.",
        });
        await loadResults();
      } else {
        toast({
          title: "Couldn't grade sessions",
          description: payload?.message ?? "The server returned an error.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't grade sessions",
        description: "Network unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGrading(false);
    }
  }, [examId, loadResults]);

  const emailScorecards = useCallback(async () => {
    setEmailing(true);
    try {
      const res = await fetch(`/api/v1/exams/${examId}/declare-results`, {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders() },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (res.ok) {
        toast({
          title: "Scorecards emailed",
          description:
            payload?.message ?? "Every student's marksheet has been sent by email.",
        });
        await loadResults();
      } else {
        toast({
          title: "Couldn't email scorecards",
          description: payload?.message ?? "The server returned an error.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't email scorecards",
        description: "Network unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEmailing(false);
    }
  }, [examId, loadResults]);

  const [exportingCsv, setExportingCsv] = useState(false);

  const exportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      const res = await fetch(`/api/v1/exams/${examId}/results/export`, {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast({
          title: "Couldn't export results",
          description: payload?.message ?? "The server returned an error.",
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `Results_${examId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Couldn't export results",
        description: "Network unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingCsv(false);
    }
  }, [examId]);

  const downloadMarksheet = useCallback(
    async (sessionId: string) => {
      setDownloads((prev) => ({ ...prev, [sessionId]: true }));
      try {
        const res = await fetch(
          `/api/v1/exams/${examId}/sessions/${sessionId}/marksheet`,
          { credentials: "include", headers: { ...authHeaders() } },
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          toast({
            title: "Couldn't download scorecard",
            description: payload?.message ?? "The server returned an error.",
            variant: "destructive",
          });
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="([^"]+)"/);
        a.download = match?.[1] ?? `Marksheet_${sessionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        toast({
          title: "Couldn't download scorecard",
          description: "Network unavailable. Please try again.",
          variant: "destructive",
        });
      } finally {
        setDownloads((prev) => ({ ...prev, [sessionId]: false }));
      }
    },
    [examId],
  );

  const stats = useMemo(() => {
    const results = data?.results ?? [];
    const percentages = results
      .map((r) => r.percentage)
      .filter((p): p is number => p !== null && p !== undefined);
    const emails = results.filter((r) => r.email).length;
    return [
      { label: "Graded Students", value: String(percentages.length), icon: Users2 },
      {
        label: "Class Average",
        value: percentages.length
          ? `${(percentages.reduce((s, p) => s + p, 0) / percentages.length).toFixed(1)}%`
          : "—",
        icon: TrendingUp,
      },
      {
        label: "Highest Score",
        value: percentages.length
          ? `${Math.max(...percentages).toFixed(1)}%`
          : "—",
        icon: Award,
      },
      { label: "Emailable", value: String(emails), icon: Mail },
    ];
  }, [data]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 h-8 w-fit gap-2 pl-2 text-muted-foreground"
          >
            <Link href="/dashboard/results">
              <ArrowLeft className="h-4 w-4" />
              All results
            </Link>
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scorecards
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {data?.exam.title ?? "Loading…"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Review graded sessions, download individual scorecards, or email
            marksheets to the whole class.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-10 gap-2 border-border/40"
            onClick={() => void loadResults()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 border-border/40"
            onClick={() => void gradeAll()}
            disabled={grading || loading}
          >
            {grading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {grading ? "Grading…" : "Grade remaining"}
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 border-border/40"
            onClick={() => void exportCsv()}
            disabled={exportingCsv || loading}
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {exportingCsv ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            className="h-10 gap-2"
            onClick={() => void emailScorecards()}
            disabled={emailing || loading}
          >
            {emailing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {emailing ? "Emailing…" : "Email scorecards"}
          </Button>
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
              <BarChart3 className="h-5 w-5 text-primary" />
              Graded sessions
            </CardTitle>
            <CardDescription>
              One scorecard per student. Downloads use the same PDF generator as
              the bulk email.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.results ?? []).map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4 transition hover:border-primary/30 hover:bg-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {session.studentName}
                  </p>
                  <StatusBadge status={session.status} />
                  {session.answers.some((a) => a.needs_review) && (
                    <span
                      title="At least one answer was flagged for manual review (low AI confidence)."
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      Needs review
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {session.enrollmentNumber ?? "No enrollment no."} ·{" "}
                  {session.email ?? "No email on file"}
                  {session.submittedAt
                    ? ` · submitted ${new Date(
                        session.submittedAt,
                      ).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {session.totalScore !== null && session.totalScore !== undefined
                      ? `${session.totalScore} pts`
                      : "Not scored"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <ScoreCell value={session.percentage} />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-border/40"
                  onClick={() => void downloadMarksheet(session.id)}
                  disabled={downloads[session.id]}
                >
                  {downloads[session.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {downloads[session.id] ? "Preparing…" : "Scorecard PDF"}
                </Button>
              </div>
            </div>
          ))}

          {!loading && (data?.results ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No graded sessions yet. Click “Grade remaining” once students
                have submitted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
