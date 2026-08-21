"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import {
  Activity,
  ArrowRight,
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
  Search,
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
    title: "CS 301 — Computer Networks & Security Midterm",
    description: "Chapters 1–5: OSI model, TCP/IP, Cryptography",
    duration_minutes: 60,
    total_marks: 50,
    status: "ACTIVE",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    _count: { questions: 20, sessions: 28 },
  },
  {
    id: "demo_completed_1",
    title: "CS 201 — Data Structures Final Examination",
    description: "Trees, Graphs, Dynamic Programming",
    duration_minutes: 120,
    total_marks: 100,
    status: "COMPLETED",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 30, sessions: 45 },
  },
  {
    id: "demo_draft_1",
    title: "CS 204 — Database Systems Assignment",
    description: "Normalization, SQL, and Indexing",
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
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
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
        hint: "All scheduled",
        icon: ClipboardList,
      },
      {
        label: "Active Exams",
        value: String(active),
        hint: "Live now",
        icon: Activity,
      },
      {
        label: "Candidates Supervised",
        value: String(totalSessions),
        hint: "Total attempts",
        icon: Users2,
      },
      {
        label: "Completed & Graded",
        value: String(completed),
        hint: "Ready for review",
        icon: TrendingUp,
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
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Overview
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your examinations, track live student sessions, and review gradebooks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs border-zinc-200 dark:border-zinc-800">
            <Link href="/dashboard/live">
              <MonitorPlay className="mr-1.5 h-3.5 w-3.5" />
              Live Monitor
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
            <Link href="/dashboard/exams/create">
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              New Exam
            </Link>
          </Button>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-7 w-12" />
                </CardContent>
              </Card>
            ))
          : stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card
                  key={s.label}
                  className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 font-medium">
                        {s.label}
                      </span>
                      <Icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {s.value}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {s.hint}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      {/* Main Content Area */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam Table */}
        <Card className="lg:col-span-2 border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {searchQuery ? `Matching "${searchQuery}"` : "Exams"}
              </CardTitle>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md self-start sm:self-auto">
                {(["ALL", "ACTIVE", "DRAFT", "COMPLETED"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterTab(tab)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-colors",
                      filterTab === tab
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    {tab === "ALL" ? "All" : tab === "ACTIVE" ? "Live" : tab === "DRAFT" ? "Drafts" : "Done"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="divide-y divide-zinc-100 dark:divide-zinc-800 p-0">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-16" />
                </div>
              ))
            ) : filteredExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center text-xs text-zinc-500">
                <ClipboardList className="h-6 w-6 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p className="font-medium text-zinc-700 dark:text-zinc-300">No assessments found</p>
                <p className="text-zinc-400 mt-0.5">
                  {searchQuery ? "Try a different search keyword." : "Create your first exam to get started."}
                </p>
                <Button asChild size="sm" className="mt-3 h-7 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                  <Link href="/dashboard/exams/create">Create Exam</Link>
                </Button>
              </div>
            ) : (
              filteredExams.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {e.title}
                      </h4>
                      <StatusBadge status={e.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                      <span>{e.duration_minutes} mins</span>
                      <span>•</span>
                      <span>{e.total_marks} marks</span>
                      <span>•</span>
                      <span>{e._count.questions} questions</span>
                      <span>•</span>
                      <span>{e._count.sessions} candidate submissions</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild className="h-7 text-xs border-zinc-200 dark:border-zinc-800">
                      <Link href={`/dashboard/results/${e.id}`}>
                        {e.status === "COMPLETED" ? "Gradebook" : "View"}
                      </Link>
                    </Button>
                    {e.status === "ACTIVE" && (
                      <Button size="sm" asChild className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                        <Link href={`/dashboard/live/${e.id}`}>
                          Monitor
                        </Link>
                      </Button>
                    )}
                    {e.status === "DRAFT" && (
                      <Button size="sm" asChild className="h-7 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 font-medium">
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
                      className="h-7 w-7 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5">
            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Quick Actions
            </CardTitle>
          </CardHeader>

          <CardContent className="p-3 space-y-2">
            {[
              {
                title: "Create Assessment",
                desc: "Multiple choice, true/false, or descriptive.",
                icon: PlusCircle,
                href: "/dashboard/exams/create",
              },
              {
                title: "Live Proctoring Monitor",
                desc: "Stream candidate feeds and flags.",
                icon: MonitorPlay,
                href: "/dashboard/live",
              },
              {
                title: "Results & Gradebooks",
                desc: "Review grades and download scorecards.",
                icon: FileText,
                href: "/dashboard/results",
              },
              {
                title: "Candidate Join Page",
                desc: "Direct link for students to enter PIN.",
                icon: ShieldCheck,
                href: "/join",
              },
            ].map((a, i) => {
              const Icon = a.icon;
              return (
                <Link
                  key={i}
                  href={a.href}
                  className="flex items-center gap-3 rounded-md border border-zinc-100 dark:border-zinc-800 p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {a.title}
                    </h5>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {a.desc}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Delete Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-500">
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This will remove all questions and student submissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700 text-xs h-8"
            >
              {deleting ? "Deleting…" : "Delete"}
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
        <div className="flex min-h-[300px] items-center justify-center text-xs text-zinc-500">
          Loading dashboard…
        </div>
      }
    >
      <DashboardHomeContent />
    </Suspense>
  );
}
