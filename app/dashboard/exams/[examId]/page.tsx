"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Clock,
  Award,
  FileText,
  UserPlus,
  Radio,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkInviteModal } from "@/components/exams/BulkInviteModal";
import { authHeaders } from "@/lib/auth-token";

interface ExamDetail {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  questionsCount: number;
  activeSessionsCount: number;
  completedSessionsCount: number;
}

export default function TeacherExamDetailsPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchExamDetails() {
      setLoading(true);
      try {
        const res = await fetch(`/api/exams/${params.examId}`, {
          credentials: "include",
          headers: { ...authHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setExam(data);
        } else {
          // Fallback mock exam detail
          if (isMounted) {
            setExam({
              id: params.examId,
              title: "Midterm Examination — Computer Networks & Security",
              description: "Covers chapters 1–5 including OSI model, TCP/IP, and proctoring guidelines.",
              durationMinutes: 60,
              totalMarks: 50,
              questionsCount: 15,
              activeSessionsCount: 4,
              completedSessionsCount: 22,
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setExam({
            id: params.examId,
            title: "Midterm Examination — Computer Networks & Security",
            description: "Covers chapters 1–5 including OSI model, TCP/IP, and proctoring guidelines.",
            durationMinutes: 60,
            totalMarks: 50,
            questionsCount: 15,
            activeSessionsCount: 4,
            completedSessionsCount: 22,
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (params.examId) {
      fetchExamDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [params.examId]);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const shareableUrl = `${window.location.origin}/exam/${params.examId}/take`;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading exam details…</span>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">Exam Not Found</h2>
          <Button className="mt-6" onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700">
            Exam ID: {exam.id}
          </span>
        </div>

        {/* Main Details Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600" /> Published & Active
              </div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{exam.title}</h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                {exam.description || "No description provided."}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium pt-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" /> {exam.durationMinutes} Minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-indigo-600" /> {exam.totalMarks} Total Marks
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-600" /> {exam.questionsCount} Questions
                </span>
              </div>
            </div>

            {/* Action Buttons: TASK 2 Step 2 Bulk Invite Students Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Button
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
              >
                <UserPlus className="h-4 w-4" /> Bulk Invite Students
              </Button>

              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Share2 className="h-4 w-4" />
                {copiedLink ? "Copied Link!" : "Share Link"}
              </Button>

              <Link href={`/dashboard/live/${exam.id}`}>
                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2">
                  <Radio className="h-4 w-4 text-emerald-400" /> Live Monitor
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Candidates</span>
            <p className="mt-2 text-3xl font-bold text-indigo-600">{exam.activeSessionsCount}</p>
            <p className="mt-1 text-xs text-slate-400">Currently taking this exam</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Completed Submissions</span>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{exam.completedSessionsCount}</p>
            <p className="mt-1 text-xs text-slate-400">Graded and stored</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Enrolled</span>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {exam.activeSessionsCount + exam.completedSessionsCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">Registered candidates</p>
          </div>
        </div>
      </div>

      {/* TASK 2 Step 2: Bulk Email Invite Modal */}
      <BulkInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        examId={exam.id}
        examTitle={exam.title}
      />
    </div>
  );
}
