"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
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
import { authHeaders, handleAuthFailure } from "@/lib/auth-token";
import { cn } from "@/lib/utils";

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

function ExamResultsContent() {
  const params = useParams<{ examId: string }>();
  const searchParams = useSearchParams();
  const examId = params.examId;
  const targetSessionId = searchParams.get("sessionId");

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, boolean>>({});

  const loadResults = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/exams/${examId}/results`, {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        data?: ResultsPayload;
      };
      if (res.ok && payload.data) {
        setData(payload.data);
        setErrorMessage(null);
        return;
      }
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      setData(null);
      setErrorMessage(payload.message ?? "Could not load results for this exam.");
    } catch (err) {
      console.error("Could not fetch exam results from backend:", err);
      setData(null);
      setErrorMessage("The results service is unavailable. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  // Auto-scroll to selected student session card if passed in query string
  useEffect(() => {
    if (targetSessionId && data) {
      setTimeout(() => {
        const el = document.getElementById(`session-${targetSessionId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);
    }
  }, [targetSessionId, data]);

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
          description: payload.message ?? "All submissions graded successfully.",
        });
        await loadResults();
      } else {
        toast({
          title: "Grading failed",
          description: payload.message ?? "Couldn't grade submissions.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.warn("Grade all error:", err);
      toast({
        title: "Grading failed",
        description: "The grading service is unavailable. No results were changed.",
        variant: "destructive",
      });
    } finally {
      setGrading(false);
    }
  }, [examId, loadResults]);

  const exportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      const res = await fetch(`/api/v1/exams/${examId}/results/export`, {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `exam-${examId}-results.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast({
          title: "CSV exported",
          description: "Spreadsheet downloaded to your device.",
        });
      } else {
        toast({
          title: "Export failed",
          description: "Could not generate CSV export.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.warn("Export CSV error:", err);
      toast({
        title: "Export failed",
        description: "The results service is unavailable. No file was downloaded.",
        variant: "destructive",
      });
    } finally {
      setExportingCsv(false);
    }
  }, [examId]);

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
          title: "Results declared",
          description: payload.message ?? "Results were graded and scorecards queued for delivery.",
        });
      } else {
        toast({
          title: "Email delivery failed",
          description: payload.message ?? "Could not send scorecards.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.warn("Email scorecards error:", err);
      toast({
        title: "Email delivery failed",
        description: "The results service is unavailable. No scorecards were sent.",
        variant: "destructive",
      });
    } finally {
      setEmailing(false);
    }
  }, [examId]);

  const downloadMarksheet = useCallback(
    async (sessionId: string) => {
      setDownloads((prev) => ({ ...prev, [sessionId]: true }));
      try {
        const res = await fetch(
          `/api/v1/exams/${examId}/sessions/${sessionId}/marksheet`,
          {
            credentials: "include",
            headers: { ...authHeaders() },
          }
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `marksheet-${sessionId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          toast({
            title: "Scorecard PDF downloaded",
            description: "PDF marksheet has been saved.",
          });
        } else {
          toast({
            title: "Download failed",
            description: "Could not generate scorecard PDF.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.warn("Download marksheet error:", err);
      toast({
        title: "Download failed",
        description: "The scorecard service is unavailable. No file was downloaded.",
        variant: "destructive",
      });
      } finally {
        setDownloads((prev) => ({ ...prev, [sessionId]: false }));
      }
    },
    [examId]
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
      {errorMessage && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm leading-5">{errorMessage}</div>
          <Button size="sm" variant="outline" onClick={() => void loadResults()} className="h-8 border-destructive/30">
            Retry
          </Button>
        </div>
      )}

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
            Review graded sessions, view violation timelines, download scorecards, or declare results and email marksheets to the class.
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
            disabled={grading || loading || !data}
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
            disabled={exportingCsv || loading || !data}
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
            disabled={emailing || loading || !data}
          >
            {emailing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {emailing ? "Declaring…" : "Declare & email results"}
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
              One scorecard per student. Review answers, access proctoring timelines, and download marksheets.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.results ?? []).map((session) => {
            const isHighlighted = targetSessionId === session.id;
            return (
              <div
                key={session.id}
                id={`session-${session.id}`}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center sm:justify-between",
                  isHighlighted
                    ? "border-primary bg-primary/5 ring-2 ring-primary shadow-md"
                    : "border-border/60 bg-card/50 hover:border-primary/30 hover:bg-card"
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {session.studentName}
                    </p>
                    <StatusBadge status={session.status} />
                    {isHighlighted && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Selected
                      </span>
                    )}
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
                          session.submittedAt
                        ).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
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

                  {/* View Timeline Button */}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 border-border/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Link href={`/dashboard/exams/${examId}/sessions/${session.id}/timeline`}>
                      <History className="h-4 w-4 text-primary" />
                      Timeline
                    </Link>
                  </Button>

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
            );
          })}

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

export default function ExamResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading exam results…
          </div>
        </div>
      }
    >
      <ExamResultsContent />
    </Suspense>
  );
}
