"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarX2,
  ClipboardList,
  Home,
  Loader2,
  SearchX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type ExamCheck =
  | { state: "checking" }
  | { state: "ready"; title: string }
  | { state: "not-found" }
  | { state: "inactive"; title: string };

export default function JoinExamPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const examId = params.examId;

  const [check, setCheck] = useState<ExamCheck>({ state: "checking" });
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [joining, setJoining] = useState(false);

  // Verify the exam exists and is ACTIVE before showing the join form.
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`/api/exams/${examId}/status`);
        if (res.status === 404) {
          if (!canceled) setCheck({ state: "not-found" });
          return;
        }
        if (res.ok) {
          const payload = (await res.json()) as {
            data: { exam: { title: string; status: string } };
          };
          const exam = payload.data?.exam;
          if (!canceled) {
            setCheck(
              exam?.status === "ACTIVE"
                ? { state: "ready", title: exam.title }
                : { state: "inactive", title: exam?.title ?? "Exam" }
            );
          }
          return;
        }
        if (!canceled) setCheck({ state: "not-found" });
      } catch {
        // Backend unreachable — still allow joining; the POST will validate.
        if (!canceled) setCheck({ state: "ready", title: "Exam" });
      }
    })();
    return () => {
      canceled = true;
    };
  }, [examId]);

  const handleJoin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (joining) return;
      setJoining(true);
      try {
        const res = await fetch(`/api/exams/${examId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ studentName, studentEmail, enrollmentNo }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          status?: string;
          message?: string;
          data?: { sessionToken?: string };
        };

        if (!res.ok) {
          if (res.status === 404) {
            setCheck({ state: "not-found" });
            return;
          }
          if (res.status === 400) {
            setCheck({ state: "inactive", title: "Exam" });
            return;
          }
          toast({
            title: "Couldn&apos;t join",
            description:
              payload?.message ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
          return;
        }

        const token = payload.data?.sessionToken;
        if (!token) {
          toast({
            title: "Couldn&apos;t join",
            description: "No session was returned by the server.",
            variant: "destructive",
          });
          return;
        }

        router.replace(
          `/exam/${examId}/take?token=${encodeURIComponent(token)}`
        );
      } catch {
        toast({
          title: "Network unavailable",
          description:
            "Couldn&apos;t reach the server. Check your connection and try again.",
          variant: "destructive",
        });
      } finally {
        setJoining(false);
      }
    },
    [examId, studentName, studentEmail, enrollmentNo, joining, router, toast]
  );

  // -------- Friendly unavailable states --------
  if (check.state === "not-found" || check.state === "inactive") {
    const inactive = check.state === "inactive";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-lg border-slate-200 bg-white text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <CardHeader className="items-center gap-4 pt-10">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-inset ring-red-200">
              {inactive ? (
                <CalendarX2 className="h-10 w-10 text-red-500" />
              ) : (
                <SearchX className="h-10 w-10 text-red-500" />
              )}
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm">
                <AlertCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-700 ring-1 ring-inset ring-red-100">
                Exam unavailable
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {inactive ? "This exam isn&apos;t active yet" : "Exam not found"}
              </CardTitle>
              <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-slate-600 sm:text-base">
                {inactive
                  ? "This exam is still a draft or hasn&apos;t been published yet. Check back once your teacher starts it."
                  : "We couldn&apos;t find this exam. The link may be wrong, or the exam may have been removed."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-10">
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (check.state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-700" />
          <span className="text-lg">Checking exam availability…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
        <CardHeader className="items-center gap-4 pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <ClipboardList className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {check.title}
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-slate-600 sm:text-base">
              Enter your details to begin. Your session is anonymous — no
              account is needed.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-10">
          <form onSubmit={handleJoin} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="student-name" className="text-sm font-medium text-slate-700">
                Full name
              </Label>
              <Input
                id="student-name"
                required
                minLength={2}
                placeholder="e.g. Aarav Sharma"
                className="h-11 text-base"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="student-email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="student-email"
                type="email"
                required
                placeholder="you@example.com"
                className="h-11 text-base"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="enrollment-no" className="text-sm font-medium text-slate-700">
                Enrollment number
              </Label>
              <Input
                id="enrollment-no"
                required
                minLength={2}
                placeholder="e.g. CS2023-0142"
                className="h-11 text-base"
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={joining}
              className="mt-2 h-12 gap-2 bg-indigo-700 hover:bg-indigo-800"
            >
              {joining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Joining…
                </>
              ) : (
                <>
                  Start exam
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
