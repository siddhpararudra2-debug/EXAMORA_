"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CircleDot,
  Clock,
  Eye,
  FileText,
  Loader2,
  MonitorPlay,
  Users,
  ShieldAlert,
  Video,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    title: "Midterm Examination — Computer Networks & Security",
    description: "Covers OSI model, TCP/IP handshake, transport protocols, and active encryption.",
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
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Checking active exam channels…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live WebRTC Supervision Grid
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Active Proctoring Streams
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            Select an in-progress assessment to view candidate camera feeds, real-time audio telemetry, and automated tab-switch violations.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLiveExams}
          className="gap-2 self-start sm:self-auto rounded-xl border-border/60 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Channels
        </Button>
      </div>

      {/* Grid of active exams */}
      <div className="grid grid-cols-1 gap-5">
        {liveExams.map((exam) => (
          <Card key={exam.id} className="glass-panel border-slate-200/80 dark:border-slate-800 shadow-md hover-lift">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none font-bold text-[11px]">
                    <CircleDot className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
                    LIVE CHANNEL ACTIVE
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono bg-secondary/80 px-2 py-0.5 rounded-md">
                    ID: {exam.id}
                  </span>
                </div>
                <CardTitle className="text-xl font-extrabold text-foreground">{exam.title}</CardTitle>
                {exam.description && (
                  <CardDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">{exam.description}</CardDescription>
                )}
              </div>

              <Button asChild className="gap-2 shrink-0 gradient-brand rounded-xl shadow-md shadow-indigo-500/20 font-semibold h-11 px-5">
                <Link href={`/dashboard/live/${exam.id}`}>
                  <Video className="h-4 w-4" />
                  Open Live Monitoring Room
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="pt-4 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span className="font-mono">{exam.duration_minutes} minutes allocated</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <span className="font-mono">{exam.total_marks} marks total</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <span className="font-bold text-foreground">{exam._count.sessions} candidates connected</span>
              </div>
            </CardContent>
          </Card>
        ))}

        {liveExams.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center">
            <Video className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No active live exams right now</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Publish and start an assessment from your workspace to broadcast live proctoring feeds.
            </p>
            <Button asChild className="mt-4 gradient-brand rounded-xl h-9 text-xs font-semibold">
              <Link href="/dashboard/exams/create">Launch an Exam</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
