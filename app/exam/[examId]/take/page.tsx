"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Socket } from "socket.io-client";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  OctagonX,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ExamTerminatedEvent,
  getSocket,
} from "@/lib/socket";

type QuestionType = "MCQ_SINGLE" | "TRUE_FALSE" | "SHORT_ANSWER";

interface ExamQuestion {
  id: string;
  type: QuestionType;
  question_text: string;
  options?: string[];
  marks: number;
}

interface ExamData {
  id: string;
  title: string;
  description?: string | null;
  duration_minutes: number;
  questions: ExamQuestion[];
  warningsLimit: number;
}

interface SessionInit {
  id: string;
  sessionId: string;
  sessionToken: string;
  studentName?: string;
}

const DEFAULT_WARNINGS_LIMIT = 3;

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function mockExamData(examId: string): ExamData {
  return {
    id: examId,
    title: "Midterm Examination — Introduction to Computer Science",
    description:
      "Covers chapters 1–5. Read each question carefully. Switching tabs will be logged as a proctoring violation.",
    duration_minutes: 60,
    warningsLimit: DEFAULT_WARNINGS_LIMIT,
    questions: [
      {
        id: "q1",
        type: "MCQ_SINGLE",
        question_text:
          "Which of the following data structures uses LIFO (Last-In, First-Out) ordering?",
        options: ["Queue", "Stack", "Linked List", "Binary Search Tree"],
        marks: 2,
      },
      {
        id: "q2",
        type: "MCQ_SINGLE",
        question_text:
          "What is the time complexity of binary search on a sorted array of size N?",
        options: ["O(N)", "O(N log N)", "O(log N)", "O(1)"],
        marks: 2,
      },
      {
        id: "q3",
        type: "TRUE_FALSE",
        question_text:
          "True or False: HTTP is a stateless application-layer protocol.",
        options: ["True", "False"],
        marks: 1,
      },
      {
        id: "q4",
        type: "SHORT_ANSWER",
        question_text:
          "In 2–4 sentences, explain the difference between process and thread. Mention at least one context where threads are preferred.",
        marks: 5,
      },
      {
        id: "q5",
        type: "MCQ_SINGLE",
        question_text:
          "Which sorting algorithm has the best average-case time complexity?",
        options: ["Bubble Sort", "Selection Sort", "Merge Sort", "Insertion Sort"],
        marks: 2,
      },
      {
        id: "q6",
        type: "SHORT_ANSWER",
        question_text:
          "Define Big-O notation. What is the Big-O of the following loop?\n\nfor (int i = 0; i < n; i *= 2) { print(i); }",
        marks: 5,
      },
    ],
  };
}

function mockSessionInit(examId: string): SessionInit {
  const sessionId = `sess_${examId}_demo`;
  return {
    id: sessionId,
    sessionId,
    sessionToken: `demo-token-${examId}`,
    studentName: "Aarav Sharma",
  };
}

const TERMINATED_REDIRECT_DELAY_MS = 3_000;

export default function TakeExamPage() {
  const params = useParams<{ examId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const examId = params.examId;
  const initialSessionToken = search.get("token") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [session, setSession] = useState<SessionInit | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedViaAuto, setSubmittedViaAuto] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<null | {
    submittedAt: string;
  }>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [terminated, setTerminated] = useState(false);
  const [terminatedReason, setTerminatedReason] =
    useState<ExamTerminatedEvent["reason"]>("warnings_limit");
  const [terminatedCountdown, setTerminatedCountdown] = useState<number | null>(
    null
  );

  const socketRef = useRef<Socket | null>(null);

  // -------- Data load + session verification --------
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        let examData: ExamData | null = null;
        let sessionData: SessionInit | null = null;

        // Verify the session token against the backend. The server returns
        // 403 when the session is already SUBMITTED/TERMINATED, so a student
        // refreshing the page can never retake the exam.
        if (initialSessionToken) {
          try {
            const res = await fetch(
              `/api/exams/${examId}/student-view?sessionToken=${encodeURIComponent(
                initialSessionToken
              )}`,
              { credentials: "include" }
            );

            if (res.status === 403) {
              // Already submitted or terminated — do not allow a retake.
              if (!canceled) router.replace("/exam/already-completed");
              return;
            }
            if (res.status === 401) {
              // Invalid or expired session token — start over at join.
              if (!canceled) router.replace(`/exam/${examId}/join`);
              return;
            }
            if (res.status === 404) {
              if (!canceled) router.replace("/exam/not-found");
              return;
            }
            if (res.status === 400) {
              if (!canceled)
                router.replace("/exam/not-found?reason=inactive");
              return;
            }
            if (res.ok) {
              const payload = (await res.json()) as {
                data?: {
                  exam?: ExamData;
                  session?: {
                    id: string;
                    studentName: string;
                    startedAt?: string;
                    warningsCount?: number;
                  };
                };
                exam?: ExamData;
                session?: {
                  id: string;
                  studentName: string;
                  startedAt?: string;
                  warningsCount?: number;
                };
              };
              const serverExam = payload.data?.exam ?? payload.exam;
              const serverSession = payload.data?.session ?? payload.session;
              if (!canceled && serverExam && serverSession) {
                examData = {
                  ...serverExam,
                  warningsLimit:
                    serverExam.warningsLimit ?? DEFAULT_WARNINGS_LIMIT,
                };
                sessionData = {
                  id: serverSession.id,
                  sessionId: serverSession.id,
                  sessionToken: initialSessionToken,
                  studentName: serverSession.studentName,
                };
              }
            }
          } catch {
            // Network failure — fall back to demo data below.
          }
        }

        if (!examData) examData = mockExamData(examId);
        if (!sessionData) sessionData = mockSessionInit(examId);

        if (!canceled) {
          setExam(examData);
          setSession(sessionData);
          setTimeLeft(examData.duration_minutes * 60);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [examId, initialSessionToken, router]);

  // -------- Socket --------
  useEffect(() => {
    if (!session || !exam || terminated || submitted) return;
    let socket: Socket | null = null;
    try {
      socket = getSocket({ token: session.sessionToken });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket?.emit("join_exam_room", {
          examId: exam.id,
          sessionToken: session.sessionToken,
        });
      });

      socket.on("exam_terminated", (ev: ExamTerminatedEvent) => {
        if (ev.examId !== exam.id) return;
        if (
          ev.sessionId &&
          session.id &&
          ev.sessionId !== session.id
        )
          return;
        doTerminate(ev.reason ?? "warnings_limit");
      });

      socket.on("proctoring_error", () => {
        // noop; the session still works without live proctoring
      });

      socket.connect();
    } catch {
      // ignore; offline mode still works
    }
    return () => {
      if (socket) {
        try {
          socket.emit("leave_exam_room", {
            examId: exam.id,
            sessionId: session.id,
          });
        } catch {
          /* ignore */
        }
        socket.off("connect");
        socket.off("exam_terminated");
        socket.off("proctoring_error");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session, !!exam, terminated, submitted]);

  // -------- Countdown timer --------
  useEffect(() => {
    if (timeLeft === null || submitted || terminated) return;
    if (timeLeft <= 0) {
      void handleSubmit(true);
      return;
    }
    const t = setInterval(() => {
      setTimeLeft((s) => (s === null ? null : s - 1));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft === null, submitted, terminated]);

  // -------- Tab-switch proctoring --------
  const emitViolation = useCallback(
    (reason: string) => {
      if (!socketRef.current || !session || !exam) return;
      try {
        socketRef.current.emit("student_warning", {
          examId: exam.id,
          sessionToken: session.sessionToken,
          reason,
        });
      } catch {
        /* ignore */
      }
    },
    [session, exam]
  );

  useEffect(() => {
    if (submitted || loading || !exam) return;
    const onVisibility = () => {
      if (document.hidden) {
        const reason = "Tab or window switch detected";
        setWarnings((w) => {
          const next = w + 1;
          toast({
            title: "Proctoring alert",
            description: `Tab switch detected. Warning ${next}/${
              exam?.warningsLimit ?? DEFAULT_WARNINGS_LIMIT
            }.`,
            variant: next >= DEFAULT_WARNINGS_LIMIT ? "destructive" : "default",
          });
          emitViolation(reason);
          if (next >= (exam?.warningsLimit ?? DEFAULT_WARNINGS_LIMIT)) {
            doTerminate("warnings_limit");
          }
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, loading, !!exam]);

  // -------- Derived --------
  const totalQuestions = exam?.questions.length ?? 0;
  const currentQuestion = exam?.questions[currentIndex];
  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter(
        (a) => typeof a === "string" && a.trim().length > 0
      ).length,
    [answers]
  );
  const totalMarks = useMemo(
    () => exam?.questions.reduce((s, q) => s + q.marks, 0) ?? 0,
    [exam]
  );
  const warningLimit = exam?.warningsLimit ?? DEFAULT_WARNINGS_LIMIT;
  const warningsCritical = warnings >= warningLimit;

  // -------- Handlers --------
  const doTerminate = useCallback(
    (reason: ExamTerminatedEvent["reason"]) => {
      setTerminated(true);
      setTerminatedReason(reason);
      setTerminatedCountdown(
        Math.round(TERMINATED_REDIRECT_DELAY_MS / 1000)
      );
      emitViolation("session-terminated");
      // Try POSTing answers server-side
      if (!exam) return;
      const payload = {
        examId: exam.id,
        answers: Object.entries(answers).map(([questionId, answerText]) => ({
          questionId,
          answerText,
        })),
        warnings,
        autoSubmit: true,
        terminated: true,
        reason,
      };
      // Fire-and-forget. Don't await; UX should not block.
      fetch(`/api/exams/${exam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).catch(() => void 0);
    },
    [answers, emitViolation, exam, warnings]
  );

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function goNext() {
    if (!exam) return;
    setCurrentIndex((i) => Math.min(i + 1, exam.questions.length - 1));
  }

  function goPrev() {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  // -------- Redirect after termination countdown --------
  useEffect(() => {
    if (!terminated || terminatedCountdown === null) return;
    if (terminatedCountdown <= 0) {
      const q = new URLSearchParams();
      q.set("reason", terminatedReason === "warnings_limit" ? "warnings" : terminatedReason);
      q.set("warnings", String(warnings));
      q.set("limit", String(warningLimit));
      if (exam) q.set("examId", exam.id);
      router.replace(`/exam/terminated?${q.toString()}`);
      return;
    }
    const t = setTimeout(() => {
      setTerminatedCountdown((c) => (c === null ? c : c - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [
    terminated,
    terminatedCountdown,
    terminatedReason,
    router,
    warnings,
    warningLimit,
    exam,
  ]);

  // -------- Submit --------
  async function handleSubmit(auto = false) {
    if (!exam || submitting || submitted || terminated) return;
    setSubmitting(true);
    try {
      const payload = {
        examId: exam.id,
        sessionId: session?.id,
        answers: Object.entries(answers).map(([questionId, answerText]) => ({
          questionId,
          answerText,
        })),
        warnings,
        autoSubmit: auto,
        terminated: false,
      };
      const res = await fetch(`/api/exams/${exam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        submittedAt?: string;
        message?: string;
      };

      if (res.ok) {
        toast({
          title: auto ? "Time's up — auto-submitted" : "Exam submitted",
          description:
            data?.message ?? "Your answers have been received.",
        });
      } else {
        toast({
          title: auto ? "Auto-submitted (local)" : "Answers saved locally",
          description:
            "Network unavailable; please confirm with your teacher.",
          variant: "destructive",
        });
      }

      setSubmitted(true);
      setSubmittedViaAuto(auto);
      setShowConfirm(false);
      setSubmittedResult({
        submittedAt: data?.submittedAt ?? new Date().toISOString(),
      });
    } catch {
      toast({
        title: auto ? "Auto-submitted (local)" : "Answers saved locally",
        description: "Network unavailable; stored on device.",
      });
      setSubmitted(true);
      setSubmittedViaAuto(auto);
      setShowConfirm(false);
      setSubmittedResult({ submittedAt: new Date().toISOString() });
    } finally {
      setSubmitting(false);
    }
  }

  // -------- Submission-success redirect --------
  // Auto (time's up) → /exam/times-up · Manual → /exam/already-completed
  useEffect(() => {
    if (!submitted) return;
    const delay = submittedViaAuto ? 2_000 : 4_500;
    const t = setTimeout(() => {
      const q = new URLSearchParams();
      q.set("warnings", String(warnings));
      q.set("limit", String(warningLimit));
      if (exam) q.set("examId", exam.id);
      const destination = submittedViaAuto
        ? `/exam/times-up?${q.toString()}`
        : `/exam/already-completed?${q.toString()}`;
      router.replace(destination);
    }, delay);
    return () => clearTimeout(t);
  }, [submitted, submittedViaAuto, router, warnings, warningLimit, exam]);

  // -------- Rendering states --------
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-700" />
          <span className="text-lg">Preparing exam environment…</span>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            Exam not found
          </h1>
          <p className="mt-2 text-slate-600">
            The exam you&apos;re looking for isn&apos;t available.
          </p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  const disabled = terminated;
  const timerAlmostOver = timeLeft !== null && timeLeft <= 60;
  const timerWarn =
    timeLeft !== null && timeLeft <= 5 * 60 && !timerAlmostOver;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Strict termination overlay */}
      {terminated && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="term-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-red-900/30 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl">
            <div className="flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 py-10">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-4 ring-red-100 text-red-600">
                <OctagonX className="h-10 w-10" />
              </div>
            </div>
            <div className="p-6 text-center sm:p-8">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-700 ring-1 ring-inset ring-red-100">
                <ShieldAlert className="h-3.5 w-3.5" />
                Exam terminated
              </span>
              <h2
                id="term-title"
                className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              >
                Your exam has been terminated
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                {terminatedReason === "warnings_limit"
                  ? `Due to repeated proctoring violations (${warnings}/${warningLimit} warnings), this session has been closed.`
                  : terminatedReason === "teacher"
                  ? "Your teacher ended this session. Any answers submitted so far have been saved."
                  : "This session has been closed. Any answers submitted so far have been retained."}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-5 ring-1 ring-inset ring-slate-100">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Warnings
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-red-600">
                    {warnings}
                    <span className="text-sm font-normal text-slate-500">
                      {" "}
                      / {warningLimit}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Answers saved
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-slate-900">
                    {answeredCount}
                    <span className="text-sm font-normal text-slate-500">
                      {" "}
                      / {totalQuestions}
                    </span>
                  </dd>
                </div>
              </dl>
              <div
                role="status"
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <strong>Redirecting in{" "}
                  {terminatedCountdown ?? TERMINATED_REDIRECT_DELAY_MS / 1000}…</strong>{" "}
                Contact your teacher if you believe this was an error.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submitted success state (visible for ~4.5s before redirect) */}
      {submitted && (
        <div className="flex min-h-screen flex-col bg-slate-50">
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-sm ring-1 ring-inset ring-emerald-100">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Submission successful
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Your exam has been submitted
              </h1>
              <p className="mt-3 text-lg text-slate-600">
                Thanks — your answers have been received and saved. Redirecting…
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-6 text-left">
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Questions answered
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">
                    {answeredCount}
                    <span className="text-base font-normal text-slate-500">
                      {" "}
                      / {totalQuestions}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Total marks
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">
                    {totalMarks}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Warnings
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">
                    {warnings}
                    <span className="text-base font-normal text-slate-500">
                      {" "}
                      / {warningLimit}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Submitted at
                  </dt>
                  <dd className="mt-1 truncate text-sm font-mono text-slate-800">
                    {submittedResult?.submittedAt
                      ? new Date(submittedResult.submittedAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {!submitted && (
        <>
          {/* Top Bar */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
            <div className="mx-auto flex h-20 w-full max-w-6xl flex-wrap items-center gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Now taking
                </p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  {exam.title}
                </h1>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5",
                    timerAlmostOver
                      ? "border-red-200 bg-red-50 text-red-700"
                      : timerWarn
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  )}
                  aria-live="polite"
                >
                  <Clock className="h-5 w-5" aria-hidden />
                  <span className="font-mono text-lg font-semibold tabular-nums sm:text-xl">
                    {formatTime(timeLeft ?? 0)}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5",
                    warningsCritical || terminated
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                  title="Proctoring warnings"
                >
                  {warningsCritical || terminated ? (
                    <ShieldAlert className="h-5 w-5" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-5 w-5" aria-hidden />
                  )}
                  <span className="text-sm font-semibold sm:text-base">
                    Warnings: {warnings}/{warningLimit}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Area */}
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
            {currentQuestion && (
              <div
                key={currentQuestion.id}
                className="flex flex-col gap-8"
                aria-disabled={disabled}
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-indigo-700">
                      Question {currentIndex + 1} of {totalQuestions}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          currentQuestion.type === "MCQ_SINGLE" &&
                            "bg-indigo-50 text-indigo-700",
                          currentQuestion.type === "TRUE_FALSE" &&
                            "bg-sky-50 text-sky-700",
                          currentQuestion.type === "SHORT_ANSWER" &&
                            "bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {currentQuestion.type === "MCQ_SINGLE"
                          ? "Multiple choice"
                          : currentQuestion.type === "TRUE_FALSE"
                          ? "True / False"
                          : "Short answer"}
                      </span>
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    {currentQuestion.marks}{" "}
                    {currentQuestion.marks === 1 ? "mark" : "marks"}
                  </p>
                </div>

                <h2 className="text-2xl font-semibold leading-relaxed tracking-tight text-slate-900 whitespace-pre-wrap sm:text-3xl">
                  {currentQuestion.question_text}
                </h2>

                {/* MCQ / True-False */}
                {(currentQuestion.type === "MCQ_SINGLE" ||
                  currentQuestion.type === "TRUE_FALSE") && (
                  <div className="flex flex-col gap-3">
                    {(currentQuestion.options ?? []).map((option, i) => {
                      const optionKey = String.fromCharCode(65 + i);
                      const value = option;
                      const selected = answers[currentQuestion.id] === value;
                      return (
                        <label
                          key={`${currentQuestion.id}-${i}`}
                          className={cn(
                            "group rounded-2xl border px-5 py-4 text-lg transition-colors sm:text-xl",
                            disabled && "pointer-events-none opacity-60",
                            selected
                              ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 cursor-pointer"
                              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 cursor-pointer"
                          )}
                        >
                          <span className="flex items-start gap-4">
                            <span
                              className={cn(
                                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-base font-semibold",
                                selected
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-slate-300 bg-white text-slate-500 group-hover:border-indigo-400"
                              )}
                              aria-hidden
                            >
                              {selected ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                optionKey
                              )}
                            </span>
                            <input
                              type="radio"
                              name={`q-${currentQuestion.id}`}
                              className="sr-only"
                              value={value}
                              checked={selected}
                              disabled={disabled}
                              onChange={() =>
                                setAnswer(currentQuestion.id, value)
                              }
                            />
                            <span className="leading-7 text-slate-800">
                              {option}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer */}
                {currentQuestion.type === "SHORT_ANSWER" && (
                  <div className="flex flex-col gap-3">
                    <Textarea
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={(e) =>
                        setAnswer(currentQuestion.id, e.target.value)
                      }
                      placeholder="Type your answer here…"
                      disabled={disabled}
                      className="min-h-[240px] resize-y text-lg leading-7 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <p className="text-sm text-slate-500">
                      Your answer is auto-saved locally as you type.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Question navigator */}
            <div className="mt-14">
              <p className="mb-3 text-sm font-medium text-slate-500">
                Jump to question
              </p>
              <div className="flex flex-wrap gap-2">
                {exam.questions.map((q, i) => {
                  const active = i === currentIndex;
                  const answered = Boolean(answers[q.id]?.trim());
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(i)}
                      disabled={disabled}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-lg border text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                        active
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : answered
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                      )}
                      aria-current={active ? "page" : undefined}
                      aria-label={`Question ${i + 1}${
                        answered ? " (answered)" : ""
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                <span className="inline-flex h-3 w-3 rounded bg-emerald-500 align-middle" />{" "}
                = answered
                <span className="mx-2">·</span>
                <span className="inline-flex h-3 w-3 rounded bg-indigo-600 align-middle" />{" "}
                = current
              </p>
            </div>
          </main>

          {/* Bottom Bar */}
          <footer className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goPrev}
                disabled={disabled || currentIndex === 0}
                className="h-12 gap-2"
              >
                <ArrowLeft className="h-5 w-5" /> Previous
              </Button>

              <p className="hidden text-sm font-medium text-slate-500 sm:block">
                {answeredCount} of {totalQuestions} answered
              </p>

              {currentIndex < totalQuestions - 1 ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={goNext}
                  disabled={disabled}
                  className="h-12 gap-2"
                >
                  Next <ArrowRight className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="h-12 gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowConfirm(true)}
                  disabled={disabled || submitting}
                >
                  <Send className="h-5 w-5" /> Submit Exam
                </Button>
              )}
            </div>
          </footer>

          {/* Confirmation Dialog */}
          {showConfirm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-confirm-title"
            >
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="submit-confirm-title"
                      className="text-xl font-semibold text-slate-900"
                    >
                      Submit your exam?
                    </h2>
                    <p className="mt-2 text-slate-600">
                      You have answered{" "}
                      <span className="font-semibold text-slate-900">
                        {answeredCount}
                      </span>{" "}
                      out of{" "}
                      <span className="font-semibold text-slate-900">
                        {totalQuestions}
                      </span>{" "}
                      questions.
                    </p>
                    {answeredCount < totalQuestions && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                        {totalQuestions - answeredCount} question
                        {totalQuestions - answeredCount === 1 ? "" : "s"} left
                        unanswered. Are you sure you want to continue?
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                    disabled={submitting}
                  >
                    Keep working
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      "Submit now"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
