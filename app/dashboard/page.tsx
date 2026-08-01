import Link from "next/link";
import {
  ClipboardList,
  Users2,
  Activity,
  TrendingUp,
  ArrowUpRight,
  PlusCircle,
  MonitorPlay,
  FileText,
  Clock,
  CircleDot,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stats = [
  {
    label: "Total Exams",
    value: "24",
    delta: "+3 this week",
    trend: "up" as const,
    icon: ClipboardList,
    tint: "indigo",
  },
  {
    label: "Active Students",
    value: "318",
    delta: "+12% vs last month",
    trend: "up" as const,
    icon: Users2,
    tint: "sky",
  },
  {
    label: "Live Now",
    value: "2",
    delta: "47 students testing",
    trend: "neutral" as const,
    icon: Activity,
    tint: "emerald",
  },
  {
    label: "Avg. Score",
    value: "82.4%",
    delta: "+1.8 pts vs last term",
    trend: "up" as const,
    icon: TrendingUp,
    tint: "amber",
  },
];

const recentExams = [
  {
    id: "ex_01",
    title: "Midterm — Data Structures",
    status: "LIVE",
    startedAt: "Started 22 min ago",
    enrolled: 62,
    joined: 58,
  },
  {
    id: "ex_02",
    title: "Quiz 4 — Networking Fundamentals",
    status: "LIVE",
    startedAt: "Started 47 min ago",
    enrolled: 41,
    joined: 37,
  },
  {
    id: "ex_03",
    title: "Final — Intro to Algorithms",
    status: "GRADING",
    startedAt: "Ended yesterday",
    enrolled: 128,
    joined: 124,
  },
  {
    id: "ex_04",
    title: "Assignment 2 — Database Design",
    status: "DRAFT",
    startedAt: "Scheduled in 3 days",
    enrolled: 89,
    joined: 0,
  },
];

export default function DashboardHomePage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Teacher workspace
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back, Dr. Carter
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-600 sm:text-base">
            Here&apos;s an overview of your exams, students, and results today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10 gap-1.5">
            <Link href="/dashboard/exams/live">
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
        {stats.map((s) => {
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
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      s.trend === "up" &&
                        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
                      s.trend === "neutral" &&
                        "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200"
                    )}
                  >
                    {s.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                    {s.delta}
                  </span>
                </div>
                <p className="mt-5 text-sm font-medium text-slate-500">
                  {s.label}
                </p>
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/results" className="gap-1">
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {recentExams.map((e) => {
              const isLive = e.status === "LIVE";
              const isGrading = e.status === "GRADING";
              const isDraft = e.status === "DRAFT";
              return (
                <div
                  key={e.id}
                  className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                        isLive &&
                          "bg-emerald-50 text-emerald-600 ring-emerald-100",
                        isGrading &&
                          "bg-amber-50 text-amber-600 ring-amber-100",
                        isDraft && "bg-slate-50 text-slate-500 ring-slate-200"
                      )}
                    >
                      {isLive ? (
                        <CircleDot className="h-5 w-5 animate-pulse" />
                      ) : isGrading ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold leading-5 text-slate-900">
                          {e.title}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            isLive &&
                              "bg-emerald-50 text-emerald-700 ring-emerald-100",
                            isGrading &&
                              "bg-amber-50 text-amber-700 ring-amber-100",
                            isDraft &&
                              "bg-slate-50 text-slate-600 ring-slate-200"
                          )}
                        >
                          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                          {e.status}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {e.startedAt}
                        <span className="text-slate-300">·</span>
                        <Users2 className="h-3.5 w-3.5" />
                        {e.joined}/{e.enrolled} joined
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/results/${e.id}`} className="gap-1">
                        {isGrading ? (
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
                    {isLive && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
                        <Link href={`/dashboard/exams/live/${e.id}`} className="gap-1">
                          <MonitorPlay className="h-4 w-4" /> Monitor
                        </Link>
                      </Button>
                    )}
                    {isDraft && (
                      <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800" asChild>
                        <Link href={`/dashboard/exams/create?from=${e.id}`} className="gap-1">
                          <PlusCircle className="h-4 w-4" /> Edit
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
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
                href: "/dashboard/exams/live",
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
    </div>
  );
}
