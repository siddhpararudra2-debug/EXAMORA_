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
    [examId, studentName, studentEmail, enrollmentNo, joining, router, toast]
  );

  // -------- Friendly unavailable states --------
  if (check.state === "not-found" || check.state === "inactive") {
    const inactive = check.state === "inactive";
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
              ) : (
                <SearchX className="h-10 w-10" />
              )}
              <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
                <AlertCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-destructive">
                Exam unavailable
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-2">
                {inactive ? "This exam isn't active yet" : "Exam not found"}
              </CardTitle>
              <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
                {inactive
                  ? "This exam is still a draft or hasn't been published yet. Check back once your teacher starts it."
                  : "We couldn't find this exam. The link may be wrong, or the exam may have been removed."}
              </CardDescription>
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
              {check.title}
            </CardTitle>
            <CardDescription className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
              Enter your details to begin. Your session is monitored — please ensure you are in a quiet environment.
            </CardDescription>
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
                className="h-12 text-base bg-secondary/50 focus:bg-background transition-colors border-border/40"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
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
                className="h-12 text-base bg-secondary/50 focus:bg-background transition-colors border-border/40"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
              />
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
                className="h-12 text-base bg-secondary/50 focus:bg-background transition-colors border-border/40"
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
              />
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
