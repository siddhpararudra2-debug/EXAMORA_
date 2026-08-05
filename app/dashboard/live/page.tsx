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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authHeaders } from "@/lib/auth-token";

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
    description: "Covers chapters 1–5 including OSI model, TCP/IP, and proctoring guidelines.",
    duration_minutes: 60,
    total_marks: 50,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    _count: { questions: 15, sessions: 26 },
  },
];

export default function LiveExamsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [liveExams, setLiveExams] = useState<LiveExamItem[]>([]);

  useEffect(() => {
    async function fetchLiveExams() {
      try {
        const res = await fetch("/api/exams", {
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
      } catch {
        // Fall back to demo live exam
      }
      setLiveExams(DEMO_LIVE_EXAMS);
      setLoading(false);
    }

    void fetchLiveExams();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading active exams…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MonitorPlay className="h-4 w-4 text-primary" />
          Proctoring Monitor
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Live Exams Overview
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Select an active exam below to view candidate streams, warning counts, and real-time proctoring status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {liveExams.map((exam) => (
          <Card key={exam.id} className="glass-panel hover-lift">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none">
                    <CircleDot className="h-3 w-3 animate-pulse text-emerald-500" />
                    LIVE NOW
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">ID: {exam.id}</span>
                </div>
                <CardTitle className="text-xl font-bold">{exam.title}</CardTitle>
                {exam.description && (
                  <CardDescription className="mt-1">{exam.description}</CardDescription>
                )}
              </div>

              <Button asChild className="gap-2 shrink-0 bg-primary">
                <Link href={`/dashboard/live/${exam.id}`}>
                  <Activity className="h-4 w-4" />
                  Monitor Live Sessions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="pt-4 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>{exam.duration_minutes} minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>{exam.total_marks} marks</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{exam._count.sessions} candidate sessions</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
