"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ProctoringTimeline,
  ProctoringEvent,
  getEventConfig,
  formatTimeOffset,
} from "@/components/proctoring/ProctoringTimeline";

interface StudentSessionDetail {
  id: string;
  examId: string;
  examTitle: string;
  studentName: string;
  studentEmail: string;
  enrollmentNo: string;
  totalWarnings: number;
  warningsLimit: number;
  finalScore?: number;
  maxScore?: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "TERMINATED";
  examStartTime: string;
  examDurationMinutes: number;
  events: ProctoringEvent[];
}

export default function ProctoringTimelinePage() {
  const params = useParams<{ examId: string; sessionId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<StudentSessionDetail | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSessionEvents() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/exams/${params.examId}/sessions/${params.sessionId}/events`,
          { credentials: "include" }
        );

        if (res.ok) {
          const data = await res.json();
          if (isMounted) setSession(data);
        } else {
          // Fallback mock data for testing/demo
          if (isMounted) {
            const now = new Date();
            const start = new Date(now.getTime() - 25 * 60 * 1000).toISOString();
            setSession({
              id: params.sessionId,
              examId: params.examId,
              examTitle: "Midterm Examination — Computer Networks & Security",
              studentName: "Rudra Siddhpara",
              studentEmail: "rudra@examora.edu",
              enrollmentNo: "ENR20268892",
              totalWarnings: 2,
              warningsLimit: 3,
              finalScore: 85,
              maxScore: 100,
              status: "SUBMITTED",
              examStartTime: start,
              examDurationMinutes: 60,
              events: [
                {
                  id: "e1",
                  type: "TAB_SWITCH",
                  occurred_at: new Date(new Date(start).getTime() + 4 * 60 * 1000).toISOString(),
                  description: "Tab switch detected: switched to browser window.",
                },
                {
                  id: "e2",
                  type: "AI_OVERLAY",
                  occurred_at: new Date(new Date(start).getTime() + 12 * 60 * 1000).toISOString(),
                  description: "AI overlay detected over the exam window.",
                },
                {
                  id: "e3",
                  type: "DEVTOOLS",
                  occurred_at: new Date(new Date(start).getTime() + 18 * 60 * 1000).toISOString(),
                  description: "Developer tools opened while answering.",
                },
              ],
            });
          }
        }
      } catch (err) {
        console.warn("API timeline load error, falling back to demo view:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (params.examId && params.sessionId) {
      fetchSessionEvents();
    }

    return () => {
      isMounted = false;
    };
  }, [params.examId, params.sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading proctoring timeline…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Proctoring Data Not Found</h2>
          <p className="mt-2 text-sm text-slate-600">
            The requested session timeline could not be loaded.
          </p>
          <Button className="mt-6" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const startTimeMs = new Date(session.examStartTime).getTime();

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Live Proctoring
          </button>
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700">
            Audit Log ID: {session.id.substring(0, 8)}
          </span>
        </div>

        {/* Student Info Summary Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 font-bold text-xl">
                {session.studentName.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{session.studentName}</h1>
                <p className="text-sm text-slate-500 font-mono">
                  {session.studentEmail} • Enrollment No: <strong className="text-slate-700">{session.enrollmentNo}</strong>
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center min-w-[100px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Warnings</span>
                <p className={`text-xl font-bold ${session.totalWarnings >= session.warningsLimit ? "text-red-600" : "text-amber-600"}`}>
                  {session.totalWarnings} / {session.warningsLimit}
                </p>
              </div>

              {session.finalScore !== undefined && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-center min-w-[100px]">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-600">Score</span>
                  <p className="text-xl font-bold text-indigo-900">
                    {session.finalScore} <span className="text-xs font-normal text-indigo-600">/ {session.maxScore || 100}</span>
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center min-w-[110px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">Status</span>
                <p className="text-sm font-bold text-emerald-800 uppercase mt-1">
                  {session.status}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TASK 1 Step 1: Proctoring Timeline Visualizer */}
        <ProctoringTimeline
          events={session.events}
          examDurationMinutes={session.examDurationMinutes}
          examStartTime={session.examStartTime}
        />

        {/* TASK 1 Step 2: Chronological Log List View */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-indigo-600" /> Chronological Incident Log ({session.events.length})
          </h3>

          {session.events.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
              <h4 className="text-sm font-semibold text-slate-800">Clean Proctoring Session</h4>
              <p className="text-xs text-slate-500 mt-1">No proctoring violations recorded for this student during the exam.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {session.events.map((evt, idx) => {
                const config = getEventConfig(evt.type);
                const IconComponent = config.icon;
                const eventTimeMs = new Date(evt.occurred_at).getTime();
                const offsetStr = formatTimeOffset(eventTimeMs - startTimeMs);

                return (
                  <div key={evt.id} className="py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${config.badgeBg}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${config.textColor}`}>
                            {config.label}
                          </span>
                          <span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-mono font-medium">
                            Incident #{idx + 1}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {evt.description || "Violation logged by proctoring engine."}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-slate-900 block">
                        ⏱ +{offsetStr}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        {new Date(evt.occurred_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
