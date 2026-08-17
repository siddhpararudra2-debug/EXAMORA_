"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Home,
  Loader2,
  ListChecks,
  SearchX,
  ShieldCheck,
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

type ExamPreview = {
  title: string;
  description?: string | null;
  durationMinutes: number;
  questionCount: number;
  warningsLimit: number;
  endTime?: string | null;
};

type ExamCheck =
  | { state: "checking" }
  | { state: "ready"; exam: ExamPreview }
  | { state: "not-found" }
  | { state: "inactive"; exam: ExamPreview }
  | { state: "error"; message: string };

export default function JoinExamPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const examId = params.examId;

  const [check, setCheck] = useState<ExamCheck>({ state: "checking" });
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState(false);

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
            data?: {
              exam?: {
                title: string;
                description?: string | null;
                status: string;
                durationMinutes: number;
                questionCount: number;
                warningsLimit: number;
                endTime?: string | null;
                isJoinable: boolean;
              };
            };
          };
          const exam = payload.data?.exam;
          if (!exam) {
            if (!canceled) setCheck({ state: "error", message: "The exam preview was incomplete. Please try the invite link again." });
            return;
          }
          const preview: ExamPreview = {
            title: exam.title,
            description: exam.description,
            durationMinutes: exam.durationMinutes,
            questionCount: exam.questionCount,
            warningsLimit: exam.warningsLimit,
            endTime: exam.endTime,
          };
          if (!canceled) {
            setCheck(
              exam.isJoinable && exam.status === "ACTIVE"
                ? { state: "ready", exam: preview }
                : { state: "inactive", exam: preview }
            );
          }
          return;
        }
        if (!canceled) setCheck({ state: "not-found" });
      } catch {
        if (!canceled) setCheck({ state: "error", message: "We couldn't verify this exam right now. Check your connection and try again." });
      }
    })();
    return () => {
      canceled = true;
    };
  }, [examId]);

  const handleJoin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (joining || check.state !== "ready") return;
      const nextErrors: Record<string, string> = {};
      if (studentName.trim().length < 2) nextErrors.studentName = "Enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(studentEmail.trim())) nextErrors.studentEmail = "Enter a valid email address.";
      if (enrollmentNo.trim().length < 2) nextErrors.enrollmentNo = "Enter your enrollment number.";
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        return;
      }
      setFieldErrors({});
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
            setCheck({ state: "error", message: payload?.message ?? "This exam is not currently available." });
            return;
          }
          toast({
            title: "Couldn't join",
            description:
              payload?.message ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
          return;
        }

        const token = payload.data?.sessionToken;
        if (!token) {
          toast({
            title: "Couldn't join",
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
            "Couldn't reach the server. Check your connection and try again.",
          variant: "destructive",
        });
      } finally {
        setJoining(false);
      }
    },
    [check.state, examId, studentName, studentEmail, enrollmentNo, joining, router, toast]
  );

  // -------- Friendly unavailable states --------
  if (check.state === "not-found" || check.state === "inactive" || check.state === "error") {
    const inactive = check.state === "inactive";
    const verificationError = check.state === "error";
    const preview = check.state === "inactive" ? check.exam : undefined;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6">
        {/* Subtle ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 pointer-events-none" 
             style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />
             
        <Card className="glass-panel w-full max-w-lg text-center animate-in slide-in-from-bottom-8 fade-in duration-700 relative z-10">
          <CardHeader className="items-center gap-4 pt-10">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              {inactive ? (
                <CalendarX2 className="h-10 w-10" />
              ) : verificationError ? (
                <AlertCircle className="h-10 w-10" />
              ) : (
                <SearchX className="h-10 w-10" />
              )}
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                <AlertCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-destructive">
                {verificationError ? "Unable to verify exam" : inactive ? "This exam isn't active yet" : "Exam not found"}
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-2">
                {verificationError ? "Please try again" : inactive ? "This exam isn't active yet" : "Exam not found"}
              </CardTitle>
              <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
                {verificationError
                  ? check.message
                  : inactive
                  ? "This exam is still a draft, has ended, or hasn't been published yet. Check back once your teacher starts it."
                  : "We couldn't find this exam. The link may be wrong, or the exam may have been removed."}
              </CardDescription>
              {preview && (
                <div className="mt-4 rounded-xl border border-border/50 bg-secondary/30 p-4 text-left text-sm">
                  <p className="font-semibold text-foreground">{preview.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">The educator has not opened this assessment for candidates yet.</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-10 pt-4">
            <Button asChild variant="outline" className="h-11 gap-2 border-border/40">
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
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex items-center gap-3 text-muted-foreground animate-in fade-in duration-500">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg font-medium">Checking exam availability…</span>
        </div>
      </div>
    );
  }

  if (check.state !== "ready") return null;
  const exam = check.exam;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6">
      {/* Subtle ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 pointer-events-none" 
           style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />

      <Card className="glass-panel w-full max-w-lg animate-in slide-in-from-bottom-8 fade-in duration-700 relative z-10">
        <CardHeader className="items-center gap-4 pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ClipboardList className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {exam.title}
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
              {exam.description || "Enter your details to begin. Your session is monitored — please ensure you are in a quiet environment."}
            </CardDescription>
            <div className="mt-4 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                <Clock3 className="h-4 w-4 text-primary" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold text-foreground">{exam.durationMinutes} minutes</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                <ListChecks className="h-4 w-4 text-primary" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Questions</p>
                <p className="text-sm font-semibold text-foreground">{exam.questionCount}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-secondary/30 p-3">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Integrity policy</p>
                <p className="text-sm font-semibold text-foreground">{exam.warningsLimit} signals</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-left text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Integrity signals are review evidence. They do not automatically determine misconduct.</span>
            </div>
            <div className="mt-3 rounded-xl border border-border/50 bg-secondary/20 p-4 text-left">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Before you start
              </div>
              <div className="mt-3 grid gap-3 text-xs leading-5 text-muted-foreground sm:grid-cols-3">
                <p><strong className="text-foreground">One attempt.</strong> This session is tied to your identity and cannot be reopened after submission or termination.</p>
                <p><strong className="text-foreground">Server-controlled time.</strong> When time expires, the server closes the session and submits eligible answers.</p>
                <p><strong className="text-foreground">Privacy by default.</strong> Device checks stay local; no live camera feed or recording is shared with the educator in this MVP.</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-10 pt-4">
          <form onSubmit={handleJoin} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="student-name" className="text-sm font-semibold text-foreground">
                Full name
              </Label>
              <Input
                id="student-name"
                required
                minLength={2}
                placeholder="e.g. Aarav Sharma"
                aria-invalid={Boolean(fieldErrors.studentName)}
                className="h-12 text-base bg-secondary/50 focus:bg-background transition-colors border-border/40"
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setFieldErrors((current) => ({ ...current, studentName: "" }));
                }}
              />
              {fieldErrors.studentName && <p className="text-xs text-destructive">{fieldErrors.studentName}</p>}
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="student-email" className="text-sm font-semibold text-foreground">
                Email
              </Label>
              <Input
                id="student-email"
                type="email"
                required
                placeholder="you@example.com"
                aria-invalid={Boolean(fieldErrors.studentEmail)}
                className="h-12 text-base bg-secondary/50 focus:bg-background transition-colors border-border/40"
                value={studentEmail}
                onChange={(e) => {
                  setStudentEmail(e.target.value);
                  setFieldErrors((current) => ({ ...current, studentEmail: "" }));
                }}
              />
              {fieldErrors.studentEmail && <p className="text-xs text-destructive">{fieldErrors.studentEmail}</p>}
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="enrollment-no" className="text-sm font-semibold text-foreground">
                Enrollment number
              </Label>
              <Input
                id="enrollment-no"
                required
                minLength={2}
                placeholder="e.g. CS2023-0142"
                aria-invalid={Boolean(fieldErrors.enrollmentNo)}
                className="h-12 text-base bg-secondary/50 focus:bg-background transition-colors border-border/40"
                value={enrollmentNo}
                onChange={(e) => {
                  setEnrollmentNo(e.target.value);
                  setFieldErrors((current) => ({ ...current, enrollmentNo: "" }));
                }}
              />
              {fieldErrors.enrollmentNo && <p className="text-xs text-destructive">{fieldErrors.enrollmentNo}</p>}
            </div>
            <Button
              type="submit"
              disabled={joining}
              className="mt-4 h-12 gap-2 text-base w-full"
            >
              {joining ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Joining…
                </>
              ) : (
                <>
                  Start Exam
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
