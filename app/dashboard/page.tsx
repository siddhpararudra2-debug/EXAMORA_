"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Loader2,
  MonitorPlay,
  PlusCircle,
  Trash2,
  TrendingUp,
  Users2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { authHeaders, handleAuthFailure } from "@/lib/auth-token";

type ExamStatus = "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

interface ExamListItem {
  id: string;
  title: string;
  description?: string | null;
  duration_minutes: number;
  total_marks: number;
  status: ExamStatus;
  created_at: string;
  _count: {
    questions: number;
    sessions: number;
  };
}

const DEMO_EXAMS: ExamListItem[] = [
  {
    id: "demo_active_1",
    title: "Midterm — Data Structures",
    description: "Chapters 1–5",
    duration_minutes: 60,
    total_marks: 40,
    status: "ACTIVE",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    _count: { questions: 20, sessions: 58 },
  },
  {
    id: "demo_completed_1",
    title: "Final — Intro to Algorithms",
    description: "Full syllabus",
    duration_minutes: 120,
    total_marks: 100,
    status: "COMPLETED",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 30, sessions: 124 },
  },
  {
    id: "demo_draft_1",
    title: "Assignment 2 — Database Design",
    description: "ER diagrams + SQL",
    duration_minutes: 45,
    total_marks: 25,
    status: "DRAFT",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 12, sessions: 0 },
  },
];

function StatusBadge({ status }: { status: ExamStatus }) {
  if (status === "ACTIVE" || status === "PUBLISHED") {
    return (
      <Badge className="gap-1 bg-primary/10 text-primary border-none shadow-none">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {status}
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge className="gap-1 bg-secondary text-foreground border-none shadow-none">
        <CheckCircle2 className="h-3 w-3" />
        COMPLETED
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-secondary/50 text-muted-foreground border-none shadow-none">
      <Clock className="h-3 w-3" />
      DRAFT
    </Badge>
  );
}

function StatusIcon({ status }: { status: ExamStatus }) {
  if (status === "ACTIVE") return <CircleDot className="h-5 w-5 animate-pulse" />;
  if (status === "COMPLETED") return <FileText className="h-5 w-5" />;
  return <Clock className="h-5 w-5" />;
}

function DashboardHomeContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    totalPages: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const PAGE_SIZE = 20;

  const loadExams = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await fetch(
        `/api/exams?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        {
          credentials: "include",
          headers: { ...authHeaders() },
        },
      );
      if (res.ok) {
        const payload = (await res.json()) as {
          data: {
            exams: ExamListItem[];
            pagination: {
              total: number;
              totalPages: number;
              page: number;
              pageSize: number;
            };
          };
        };
        setExams((prev) =>
          append ? [...prev, ...payload.data.exams] : payload.data.exams,
        );
        setPagination(payload.data.pagination);
        return;
      }
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
      if (!append) setExams(DEMO_EXAMS);
    } catch {
      // Backend unavailable — fall back to demo data.
      if (!append) setExams(DEMO_EXAMS);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        setExams((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        toast({
          title: "Exam deleted",
          description: `"${deleteTarget.title}" was removed.`,
        });
      } else if (res.status === 401) {
        handleAuthFailure();
      } else {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast({
          title: "Couldn't delete exam",
          description: payload?.message ?? "The server returned an error.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't delete exam",
        description: "Network unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleting, toast]);

  const stats = useMemo(() => {
    const total = pagination ? pagination.total : exams.length;
    const active = exams.filter((e) => e.status === "ACTIVE").length;
    const completed = exams.filter((e) => e.status === "COMPLETED").length;
    const totalSessions = exams.reduce((s, e) => s + e._count.sessions, 0);
    return [
      {
        label: "Total Exams",
        value: String(total),
        delta: `${active} active now`,
        icon: ClipboardList,
      },
      {
        label: "Active Students",
        value: String(totalSessions),
        delta: "sessions recorded",
        icon: Users2,
      },
      {
        label: "Live Now",
        value: String(active),
        delta: active === 1 ? "exam in progress" : "exams in progress",
        icon: Activity,
      },
      {
        label: "Completed",
        value: String(completed),
        delta: "ready for grading",
        icon: TrendingUp,
      },
    ];
  }, [exams, pagination]);

  return (
    <div className="flex flex-col gap-10">
      {/* Page header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-in slide-in-from-bottom-2 fade-in duration-500">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Teacher workspace
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Overview
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Manage exams, monitor active sessions, and review recent results.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="h-10 gap-2 border-border/40">
            <Link href="/dashboard/live">
              <MonitorPlay className="h-4 w-4" />
              Live monitoring
            </Link>
          </Button>
          <Button asChild className="h-10 gap-2">
            <Link href="/dashboard/exams/create">
              <PlusCircle className="h-4 w-4" />
              New exam
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="mt-6 h-4 w-24" />
                  <Skeleton className="mt-3 h-10 w-16" />
                </CardContent>
              </Card>
            ))
          : stats.map((s, idx) => {
              const Icon = s.icon;
              return (
                <Card
                  key={s.label}
                  className="glass-panel hover-lift animate-in slide-in-from-bottom-4 fade-in"
                  style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground"
                      >
                        <Icon className="h-6 w-6" aria-hidden />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {s.delta}
                      </span>
                    </div>
                    <p className="mt-6 text-sm font-medium text-muted-foreground">{s.label}</p>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                      {s.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      {/* Main grid */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="glass-panel xl:col-span-2 animate-in slide-in-from-bottom-8 fade-in duration-700">
          <CardHeader className="border-b border-border/40 px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  {searchQuery ? `Search Results for "${searchQuery}"` : "Recent Exams"}
                </CardTitle>
                <CardDescription className="mt-1 text-sm text-muted-foreground">
                  {searchQuery ? `Showing exams matching "${searchQuery}".` : "Track status and manage your ongoing assessments."}
                </CardDescription>
              </div>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard")}
                  className="h-8 text-xs border-border/40"
                >
                  Clear search
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border/40 p-0">
            {(() => {
              const filteredExams = exams.filter((e) =>
                searchQuery
                  ? e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    e.description?.toLowerCase().includes(searchQuery.toLowerCase())
                  : true
              );

              if (loading) {
                return Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <Skeleton className="mt-0.5 h-12 w-12 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <Skeleton className="h-5 w-2/3 max-w-[280px]" />
                        <Skeleton className="h-4 w-1/2 max-w-[200px]" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-24 rounded-lg" />
                      <Skeleton className="h-10 w-10 rounded-lg" />
                    </div>
                  </div>
                ));
              }

              if (filteredExams.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                      <ClipboardList className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">
                        {searchQuery ? "No matching exams" : "No exams found"}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                        {searchQuery
                          ? `No exams found matching "${searchQuery}". Try a different search term.`
                          : "You haven't created any exams yet. Start by creating a new assessment."}
                      </p>
                    </div>
                    {searchQuery ? (
                      <Button
                        variant="outline"
                        onClick={() => router.push("/dashboard")}
                        className="mt-4 h-10 gap-2"
                      >
                        Clear search
                      </Button>
                    ) : (
                      <Button asChild className="mt-4 h-11 gap-2">
                        <Link href="/dashboard/exams/create">
                          <PlusCircle className="h-4 w-4" />
                          Create your first exam
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              }

              return filteredExams.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-secondary/20"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <span
                        className={cn(
                          "mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                          e.status === "ACTIVE"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <StatusIcon status={e.status} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="truncate text-base font-semibold leading-6 text-foreground">
                            {e.title}
                          </h3>
                          <StatusBadge status={e.status} />
                        </div>
                        <p className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {e.duration_minutes} min
                          </span>
                          <span className="text-border/60">|</span>
                          <span className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4" />
                            {e.total_marks} marks
                          </span>
                          <span className="text-border/60">|</span>
                          <span className="flex items-center gap-1.5">
                            <Users2 className="h-4 w-4" />
                            {e._count.sessions} sessions
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <Button variant="outline" size="sm" asChild className="border-border/40">
                        <Link href={`/dashboard/results/${e.id}`} className="gap-2">
                          {e.status === "COMPLETED" ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> Grade
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" /> View
                            </>
                          )}
                        </Link>
                      </Button>
                      {e.status === "ACTIVE" && (
                        <Button size="sm" asChild>
                          <Link href={`/dashboard/live/${e.id}`} className="gap-2">
                            <MonitorPlay className="h-4 w-4" /> Monitor
                          </Link>
                        </Button>
                      )}
                      {e.status === "DRAFT" && (
                        <Button size="sm" asChild>
                          <Link href={`/dashboard/exams/create?from=${e.id}`} className="gap-2">
                            <PlusCircle className="h-4 w-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${e.title}`}
                        onClick={() => setDeleteTarget(e)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ));
            })()}
            {pagination && exams.length < pagination.total && !loading ? (
              <div className="border-t border-border/40 p-4">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={loadingMore}
                  onClick={() =>
                    void loadExams(pagination.page + 1, true)
                  }
                >
                  {loadingMore
                    ? "Loading…"
                    : `Load more exams (${exams.length} of ${pagination.total})`}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-panel animate-in slide-in-from-bottom-8 fade-in duration-700 delay-150">
          <CardHeader className="border-b border-border/40 px-6 py-5">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Quick Actions
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Jump straight into common tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 p-5">
            {[
              {
                href: "/dashboard/exams/create",
                icon: PlusCircle,
                title: "Create Exam",
                desc: "MCQ, Short Answer.",
              },
              {
                href: "/dashboard/live",
                icon: MonitorPlay,
                title: "Monitor Live",
                desc: "Proctoring, warnings.",
              },
              {
                href: "/dashboard/results",
                icon: FileText,
                title: "Review Results",
                desc: "Grade and export.",
              },
              {
                href: "/dashboard?tab=students",
                icon: Users2,
                title: "Directory",
                desc: "Student history.",
              },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-center gap-4 rounded-xl border border-border/20 bg-secondary/20 p-4 transition-all hover:bg-secondary/60 hover:border-border/60"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-background text-foreground shadow-sm"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {a.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="glass-panel border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              <span className="font-bold text-foreground">
                &quot;{deleteTarget?.title}&quot;
              </span>{" "}
              and all of its questions, sessions, and submissions will be
              permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="border-border/40">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Exam"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DashboardHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading dashboard…
          </div>
        </div>
      }
    >
      <DashboardHomeContent />
    </Suspense>
  );
}
