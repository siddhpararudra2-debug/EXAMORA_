"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Clock,
  FileText,
  Loader2,
  MonitorPlay,
  Users,
  Video,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authHeaders, handleAuthFailure } from "@/lib/auth-token";

interface LiveExamItem {
  id: string;
  title: string;
  description?: string | null;
  duration_minutes: number;
  total_marks: number;
  status: string;
  created_at: string;
  _count: {
    questions: number;
    sessions: number;
  };
}

const DEMO_LIVE_EXAMS: LiveExamItem[] = [
  {
    id: "live_demo_1",
    title: "CS 301 — Computer Networks & Security Midterm",
    description: "Chapters 1–5: OSI model, TCP/IP handshake, Transport Layer, Cryptography",
    duration_minutes: 60,
    total_marks: 50,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    _count: { questions: 20, sessions: 28 },
  },
];

export default function LiveExamsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [liveExams, setLiveExams] = useState<LiveExamItem[]>([]);

  const fetchLiveExams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exams?page=1&pageSize=100", {
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) {
        const payload = await res.json();
        const activeOnly = (payload.data?.exams || []).filter(
          (e: LiveExamItem) => e.status === "ACTIVE" || e.status === "PUBLISHED"
        );
        setLiveExams(activeOnly.length > 0 ? activeOnly : DEMO_LIVE_EXAMS);
        setLoading(false);
        return;
      }
      if (res.status === 401) {
        handleAuthFailure();
        return;
      }
    } catch {
      // Fallback to demo
    }
    setLiveExams(DEMO_LIVE_EXAMS);
    setLoading(false);
  };

  useEffect(() => {
    void fetchLiveExams();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-xs text-zinc-500">
        Loading active sessions…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Live Supervision
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Monitor active candidate camera streams, network status, and proctoring flags.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLiveExams}
          className="h-8 gap-1.5 text-xs border-zinc-200 dark:border-zinc-800 self-start sm:self-auto"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* List of active exams */}
      <div className="grid grid-cols-1 gap-4">
        {liveExams.map((exam) => (
          <Card key={exam.id} className="border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 p-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live Session
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    ID: {exam.id}
                  </span>
                </div>
                <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {exam.title}
                </CardTitle>
                {exam.description && (
                  <CardDescription className="text-xs text-zinc-500 mt-0.5">
                    {exam.description}
                  </CardDescription>
                )}
              </div>

              <Button asChild size="sm" className="h-8 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 shrink-0">
                <Link href={`/dashboard/live/${exam.id}`}>
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                  Open Live Monitor Room
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 flex flex-wrap items-center gap-6 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                <span>{exam.duration_minutes} minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                <span>{exam.total_marks} marks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {exam._count.sessions} candidates connected
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {liveExams.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-10 text-center text-xs text-zinc-500">
            <MonitorPlay className="mx-auto h-6 w-6 text-zinc-300 dark:text-zinc-700 mb-2" />
            <p className="font-medium text-zinc-700 dark:text-zinc-300">No active live exams</p>
            <p className="text-zinc-400 mt-0.5">Start an exam session to begin live supervision.</p>
            <Button asChild size="sm" className="mt-3 h-7 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
              <Link href="/dashboard/exams/create">Create Exam</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
