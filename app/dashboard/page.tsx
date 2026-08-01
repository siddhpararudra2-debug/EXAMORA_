"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ExamStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

interface ExamListItem {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  totalMarks: number;
  status: ExamStatus;
  createdAt: string;
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
    durationMinutes: 60,
    totalMarks: 40,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    _count: { questions: 20, sessions: 58 },
  },
  {
    id: "demo_completed_1",
    title: "Final — Intro to Algorithms",
    description: "Full syllabus",
    durationMinutes: 120,
    totalMarks: 100,
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 30, sessions: 124 },
  },
  {
    id: "demo_draft_1",
    title: "Assignment 2 — Database Design",
    description: "ER diagrams + SQL",
    durationMinutes: 45,
    totalMarks: 25,
    status: "DRAFT",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    _count: { questions: 12, sessions: 0 },
  },
];

function StatusBadge({ status }: { status: ExamStatus }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 hover:bg-emerald-50">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        ACTIVE
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge className="gap-1 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100 hover:bg-indigo-50">
        <CheckCircle2 className="h-3 w-3" />
        COMPLETED
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
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

export default function DashboardHomePage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ExamListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exams", { credentials: "include" });
      if (res.ok) {
        const payload = (await res.json()) as {
          data: { exams: ExamListItem[] };
        };
        setExams(payload.data.exams);
        return;
      }
    } catch {
      // Backend unavailable — fall back to demo data below.
    }
    setExams(DEMO_EXAMS);
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
      });
      if (res.ok) {
        setExams((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        toast({
          title: "Exam deleted",
          description: `"${deleteTarget.title}" was removed.`,
        });
      } else {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast({
          title: "Couldn&apos;t delete exam",
          description: payload?.message ?? "The server returned an error.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn&apos;t delete exam",
        description: "Network unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleting, toast]);

  const stats = useMemo(() => {
    const total = exams.length;
    const active = exams.filter((e) => e.status === "ACTIVE").length;
    const completed = exams.filter((e) => e.status === "COMPLETED").length;
    const totalSessions = exams.reduce((s, e) => s + e._count.sessions, 0);
    return [
      {
        label: "Total Exams",
        value: String(total),
        delta: `${active} active now`,
        icon: ClipboardList,
        tint: "indigo",
      },
      {
        label: "Active Students",
        value: String(totalSessions),
        delta: "sessions recorded",
        icon: Users2,
        tint: "sky",
      },
      {
        label: "Live Now",
        value: String(active),
        delta: active === 1 ? "exam in progress" : "exams in progress",
        icon: Activity,
        tint: "emerald",
      },
      {
        label: "Completed",
        value: String(completed),
        delta: "ready for grading",
        icon: TrendingUp,
        tint: "amber",
      },
    ];
  }, [exams]);

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Teacher workspace
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Your exams
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-600 sm:text-base">
            Here&apos;s an overview of your exams, students, and results today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10 gap-1.5">
            <Link href="/dashboard/live">
              <MonitorPlay className="h-4 w-4" />
              Live exams
            </Link>
          </Button>
          <Button asChild className="h-10 gap-1.5 bg-indigo-700 hover:bg-indigo-800">
            <Link href="/dashboard/exams/create">
              <PlusCircle className="h-4 w-4" />
              Create exam
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-slate-200/70 bg-white ring-1 ring-slate-100">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="mt-5 h-4 w-24" />
                  <Skeleton className="mt-2 h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : stats.map((s) => {
              const Icon = s.icon;
              const tint = {
                indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
                sky: "bg-sky-50 text-sky-700 ring-sky-100",
                emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
                amber: "bg-amber-50 text-amber-700 ring-amber-100",
              }[s.tint];
              return (
                <Card
                  key={s.label}
                  className="border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset",
                          tint
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                        {s.delta}
                      </span>
                    </div>
                    <p className="mt-5 text-sm font-medium text-slate-500">{s.label}</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                      {s.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
      </section>

      {/* Main grid */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="border-slate-200/70 bg-white ring-1 ring-slate-100 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">
                Recent &amp; scheduled exams
              </CardTitle>
              <CardDescription className="mt-0.5 text-sm text-slate-500">
                Monitor activity or jump into grading.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Skeleton className="mt-0.5 h-10 w-10 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-2/3 max-w-[280px]" />
                        <Skeleton className="h-3.5 w-1/2 max-w-[200px]" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-9 w-20 rounded-lg" />
                      <Skeleton className="h-9 w-9 rounded-lg" />
                    </div>
                  </div>
                ))
              : exams.length === 0
              ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No exams yet</h3>
                    <p className="max-w-md text-sm text-slate-600">
                      Create your first exam to get started.
                    </p>
                    <Button asChild className="mt-2 h-10 gap-1.5 bg-indigo-700 hover:bg-indigo-800">
                      <Link href="/dashboard/exams/create">
                        <PlusCircle className="h-4 w-4" />
                        Create exam
                      </Link>
                    </Button>
                  </div>
                )
              : exams.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                          e.status === "ACTIVE" &&
                            "bg-emerald-50 text-emerald-600 ring-emerald-100",
                          e.status === "COMPLETED" &&
                            "bg-indigo-50 text-indigo-600 ring-indigo-100",
                          e.status === "DRAFT" &&
                            "bg-slate-50 text-slate-500 ring-slate-200"
                        )}
                      >
                        <StatusIcon status={e.status} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[15px] font-semibold leading-5 text-slate-900">
                            {e.title}
                          </h3>
                          <StatusBadge status={e.status} />
                        </div>
                        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {e.durationMinutes} min · {e.totalMarks} marks
                          <span className="text-slate-300">·</span>
                          <Users2 className="h-3.5 w-3.5" />
                          {e._count.sessions} session
                          {e._count.sessions === 1 ? "" : "s"}
                          <span className="text-slate-300">·</span>
                          {e._count.questions} questions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/results/${e.id}`} className="gap-1">
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
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
                          <Link href={`/dashboard/live/${e.id}`} className="gap-1">
                            <MonitorPlay className="h-4 w-4" /> Monitor
                          </Link>
                        </Button>
                      )}
                      {e.status === "DRAFT" && (
                        <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800" asChild>
                          <Link href={`/dashboard/exams/create?from=${e.id}`} className="gap-1">
                            <PlusCircle className="h-4 w-4" /> Edit
                          </Link>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Delete ${e.title}`}
                        onClick={() => setDeleteTarget(e)}
                        className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-white ring-1 ring-slate-100">
          <CardHeader className="border-b border-slate-100 px-6 py-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">
              Quick actions
            </CardTitle>
            <CardDescription className="mt-0.5 text-sm text-slate-500">
              Jump into common tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2.5 p-5">
            {[
              {
                href: "/dashboard/exams/create",
                icon: PlusCircle,
                title: "Create a new exam",
                desc: "MCQ, True/False, Short Answer.",
                tint: "text-indigo-600 bg-indigo-50",
              },
              {
                href: "/dashboard/live",
                icon: MonitorPlay,
                title: "Monitor live sessions",
                desc: "Proctoring, warnings, snapshots.",
                tint: "text-emerald-600 bg-emerald-50",
              },
              {
                href: "/dashboard/results",
                icon: FileText,
                title: "Review results",
                desc: "Grade answers and export reports.",
                tint: "text-sky-600 bg-sky-50",
              },
              {
                href: "/dashboard?tab=students",
                icon: Users2,
                title: "Student directory",
                desc: "Sessions, history, and enrollment.",
                tint: "text-amber-600 bg-amber-50",
              },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      a.tint
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-800">
                      {a.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">{a.desc}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-slate-700">
                &quot;{deleteTarget?.title}&quot;
              </span>{" "}
              and all of its questions, sessions, and submissions will be
              permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete exam"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
