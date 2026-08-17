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
  Loader2,
  Calendar,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authHeaders, handleAuthFailure } from "@/lib/auth-token";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<StudentSessionDetail | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSessionEvents() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(
          `/api/exams/${params.examId}/sessions/${params.sessionId}/events`,
          { credentials: "include", headers: { ...authHeaders() } }
        );

        if (res.ok) {
          const payload = await res.json();
          const sessionData: StudentSessionDetail = payload.data?.session ?? payload.session ?? payload;
          const eventsList = payload.data?.events ?? payload.events ?? sessionData.events ?? [];
          if (isMounted) {
            setSession({ ...sessionData, events: eventsList });
            setErrorMessage(null);
          }
        } else if (res.status === 401) {
          if (isMounted) handleAuthFailure();
        } else {
          const payload = (await res.json().catch(() => ({}))) as { message?: string };
          if (isMounted) {
            setSession(null);
            setErrorMessage(payload.message ?? "Could not load this audit timeline.");
          }
        }
      } catch (err) {
        console.error("API timeline load error:", err);
        if (isMounted) {
          setSession(null);
          setErrorMessage("The telemetry service is unavailable. Check your connection and retry.");
        }
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
          <h2 className="mt-4 text-xl font-bold text-slate-900">Unable to load audit timeline</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{errorMessage ?? "The requested session timeline could not be loaded."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
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
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/results/${params.examId}?sessionId=${params.sessionId}`}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Results
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href={`/dashboard/live/${params.examId}`}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
            >
              Live Monitor
            </Link>
          </div>
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
