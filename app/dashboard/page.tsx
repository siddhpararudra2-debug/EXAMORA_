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
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  Check,
  ShieldCheck,
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
    title: "Midterm — Computer Networks & Security",
    description: "Chapters 1–5: OSI model, TCP/IP, Transport Layer, Cryptography",
    duration_minutes: 60,
    total_marks: 50,
    status: "ACTIVE",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    _count: { questions: 20, sessions: 28 },
  },
  {
    id: "demo_completed_1",
    title: "Final Exam — Data Structures & Algorithms",
    description: "Trees, Graphs, Dynamic Programming, and Complexity Analysis",
    duration_minutes: 120,
    total_marks: 100,
    status: "COMPLETED",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 30, sessions: 45 },
  },
  {
    id: "demo_draft_1",
    title: "Database Systems — Normalization & SQL",
    description: "3NF, BCNF, Relational Algebra, and Query Optimization",
    duration_minutes: 45,
    total_marks: 30,
    status: "DRAFT",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 15, sessions: 0 },
  },
];

function StatusBadge({ status }: { status: ExamStatus }) {
  if (status === "ACTIVE" || status === "PUBLISHED") {
    return (
      <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none font-semibold text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        LIVE NOW
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge className="gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-none font-semibold text-[11px]">
        <CheckCircle2 className="h-3 w-3" />
        COMPLETED
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-secondary text-muted-foreground border-border/40 shadow-none font-medium text-[11px]">
      <Clock className="h-3 w-3" />
      DRAFT
    </Badge>
  );
}

function StatusIcon({ status }: { status: ExamStatus }) {
  if (status === "ACTIVE") return <CircleDot className="h-5 w-5 animate-pulse text-emerald-500" />;
  if (status === "COMPLETED") return <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

function DashboardHomeContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const [filterTab, setFilterTab] = useState<"ALL" | "ACTIVE" | "DRAFT" | "COMPLETED">("ALL");
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
          title: "Assessment Deleted",
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
          description: payload?.message ?? "Server returned an error.",
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
        label: "Total Assessments",
        value: String(total),
        delta: "Curriculum created",
        icon: ClipboardList,
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-500/10",
      },
      {
        label: "Live Proctoring",
        value: String(active),
        delta: active === 1 ? "1 active exam" : `${active} active exams`,
        icon: Activity,
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10",
      },
      {
        label: "Candidate Sessions",
        value: String(totalSessions),
        delta: "Students supervised",
        icon: Users2,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500/10",
      },
      {
        label: "Completed & Graded",
        value: String(completed),
        delta: "Scorecards ready",
        icon: TrendingUp,
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-500/10",
      },
    ];
  }, [exams, pagination]);

  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      const matchSearch = searchQuery
        ? e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      if (!matchSearch) return false;
      if (filterTab === "ALL") return true;
      if (filterTab === "ACTIVE") return e.status === "ACTIVE" || e.status === "PUBLISHED";
      if (filterTab === "DRAFT") return e.status === "DRAFT";
      if (filterTab === "COMPLETED") return e.status === "COMPLETED";
      return true;
    });
  }, [exams, searchQuery, filterTab]);

  return (
    <div className="flex flex-col gap-8">
      {/* Workspace Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-in slide-in-from-bottom-2 fade-in duration-500 border-b border-border/40 pb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            Educator Command Center
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Assessment Overview
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            Supervise ongoing exams, generate new question sets with AI, and review real-time candidate scorecards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="h-10 gap-2 border-border/60 rounded-xl hover:bg-secondary">
            <Link href="/dashboard/live">
              <MonitorPlay className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Live Proctoring
            </Link>
          </Button>
          <Button asChild className="h-10 gap-2 gradient-brand rounded-xl shadow-md shadow-indigo-500/20 font-semibold">
            <Link href="/dashboard/exams/create">
              <PlusCircle className="h-4 w-4" />
              Create Assessment
            </Link>
          </Button>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel">
                <CardContent className="p-5">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="mt-4 h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : stats.map((s, idx) => {
              const Icon = s.icon;
              return (
                <Card
                  key={s.label}
                  className="glass-panel hover-lift border-slate-200/80 dark:border-slate-800 animate-in slide-in-from-bottom-4 fade-in"
                  style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", s.bgColor, s.color)}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-full">
                        {s.delta}
                      </span>
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
                      {s.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      {/* Main Grid: Exam Management + Quick Action Tiles */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Exam Management Table */}
        <Card className="glass-panel xl:col-span-2 border-slate-200/80 dark:border-slate-800 shadow-lg">
          <CardHeader className="border-b border-border/40 px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">
                  {searchQuery ? `Search Results for "${searchQuery}"` : "Exam Directory"}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Manage exam status, candidate links, and grading.
                </CardDescription>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-secondary/70 p-1 rounded-xl">
                {(["ALL", "ACTIVE", "DRAFT", "COMPLETED"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterTab(tab)}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-lg transition-all",
                      filterTab === tab
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "ALL" ? "All" : tab === "ACTIVE" ? "Live" : tab === "DRAFT" ? "Drafts" : "Done"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="divide-y divide-border/40 p-0">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-5">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
              ))
            ) : filteredExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground mb-3">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">No assessments found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  {searchQuery
                    ? `No assessments matched "${searchQuery}".`
                    : "Create your first examination to begin supervising candidates."}
                </p>
                <Button asChild className="mt-4 gradient-brand rounded-xl h-9 text-xs font-semibold">
                  <Link href="/dashboard/exams/create">Create New Exam</Link>
                </Button>
              </div>
            ) : (
              filteredExams.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5",
                        e.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : e.status === "COMPLETED"
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <StatusIcon status={e.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground truncate">{e.title}</h4>
                        <StatusBadge status={e.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                          {e.duration_minutes}m
                        </span>
                        <span>•</span>
                        <span className="font-mono">{e.total_marks} marks</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Users2 className="h-3.5 w-3.5 text-indigo-500" />
                          {e._count.sessions} candidates
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs rounded-lg border-border/60">
                      <Link href={`/dashboard/results/${e.id}`}>
                        {e.status === "COMPLETED" ? "Gradebook" : "View"}
                      </Link>
                    </Button>
                    {e.status === "ACTIVE" && (
                      <Button size="sm" asChild className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                        <Link href={`/dashboard/live/${e.id}`}>
                          Monitor Live
                        </Link>
                      </Button>
                    )}
                    {e.status === "DRAFT" && (
                      <Button size="sm" asChild className="h-8 text-xs rounded-lg gradient-brand font-semibold">
                        <Link href={`/dashboard/exams/create?from=${e.id}`}>
                          Edit
                        </Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(e)}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Command Center */}
        <Card className="glass-panel border-slate-200/80 dark:border-slate-800 shadow-lg flex flex-col">
          <CardHeader className="border-b border-border/40 px-6 py-4">
            <CardTitle className="text-lg font-bold text-foreground">Command Center</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Instant shortcuts to essential educator tools.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-3 flex-1">
            {[
              {
                title: "AI Assessment Generator",
                desc: "Upload syllabi / notes to generate instant questions.",
                icon: Sparkles,
                href: "/dashboard/exams/create",
                color: "text-indigo-600 dark:text-indigo-400",
                bgColor: "bg-indigo-500/10",
              },
              {
                title: "Multi-Candidate Live Monitor",
                desc: "Stream real-time WebRTC feeds & anti-cheat alerts.",
                icon: MonitorPlay,
                href: "/dashboard/live",
                color: "text-emerald-600 dark:text-emerald-400",
                bgColor: "bg-emerald-500/10",
              },
              {
                title: "Scorecards & Bulk Email",
                desc: "Generate branded PDF results and email students.",
                icon: FileText,
                href: "/dashboard/results",
                color: "text-blue-600 dark:text-blue-400",
                bgColor: "bg-blue-500/10",
              },
              {
                title: "Candidate Join Link",
                desc: "Open the anonymous student PIN entry portal.",
                icon: ShieldCheck,
                href: "/join",
                color: "text-violet-600 dark:text-violet-400",
                bgColor: "bg-violet-500/10",
              },
            ].map((action, i) => {
              const Icon = action.icon;
              return (
                <Link
                  key={i}
                  href={action.href}
                  className="group flex items-center gap-3.5 rounded-xl border border-border/40 bg-secondary/30 p-3.5 transition-all hover:bg-secondary hover:border-border/80"
                >
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", action.bgColor, action.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {action.title}
                    </h5>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {action.desc}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="glass-panel border-border/60 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-foreground">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              ? All questions, candidate submissions, and grading records will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting} className="rounded-xl border-border/60 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-rose-600 text-white hover:bg-rose-500 rounded-xl text-xs font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
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
            Loading workspace…
          </div>
        </div>
      }
    >
      <DashboardHomeContent />
    </Suspense>
  );
}
