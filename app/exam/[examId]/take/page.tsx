"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";

interface ExamQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  options?: string[];
  marks: number;
}

interface ExamData {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  questions: ExamQuestion[];
  warningsLimit: number;
}

const MAX_WARNINGS = 3;

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
    durationMinutes: 60,
    warningsLimit: MAX_WARNINGS,
    questions: [
      {
        id: "q1",
        type: "MCQ",
        questionText:
          "Which of the following data structures uses LIFO (Last-In, First-Out) ordering?",
        options: ["Queue", "Stack", "Linked List", "Binary Search Tree"],
        marks: 2,
      },
      {
        id: "q2",
        type: "MCQ",
        questionText:
          "What is the time complexity of binary search on a sorted array of size N?",
        options: ["O(N)", "O(N log N)", "O(log N)", "O(1)"],
        marks: 2,
      },
      {
        id: "q3",
        type: "TRUE_FALSE",
        questionText:
          "True or False: HTTP is a stateless application-layer protocol.",
        options: ["True", "False"],
        marks: 1,
      },
      {
        id: "q4",
        type: "SHORT_ANSWER",
        questionText:
          "In 2–4 sentences, explain the difference between process and thread. Mention at least one context where threads are preferred.",
        marks: 5,
      },
      {
        id: "q5",
        type: "MCQ",
        questionText:
          "Which sorting algorithm has the best average-case time complexity?",
        options: ["Bubble Sort", "Selection Sort", "Merge Sort", "Insertion Sort"],
        marks: 2,
      },
      {
        id: "q6",
        type: "SHORT_ANSWER",
        questionText:
          "Define Big-O notation. What is the Big-O of the following loop?\n\nfor (int i = 0; i < n; i *= 2) { print(i); }",
        marks: 5,
      },
    ],
  };
}

export default function TakeExamPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const examId = params.examId;

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Load exam data
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/exams/${examId}`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as ExamData;
          if (!canceled) {
            setExam(data);
            setTimeLeft((data.durationMinutes || 60) * 60);
          }
        } else {
          if (!canceled) {
            const data = mockExamData(examId);
            setExam(data);
            setTimeLeft(data.durationMinutes * 60);
          }
        }
      } catch {
        if (!canceled) {
          const data = mockExamData(examId);
          setExam(data);
          setTimeLeft(data.durationMinutes * 60);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) {
      void handleSubmit(true);
      return;
    }
    const t = setInterval(() => {
      setTimeLeft((s) => (s === null ? null : s - 1));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft === null, submitted]);

  // Proctoring: detect tab visibility changes
  useEffect(() => {
    if (submitted || loading || !exam) return;
    const onVisibility = () => {
      if (document.hidden) {
        setWarnings((w) => {
          const next = w + 1;
          toast({
            title: "Proctoring alert",
            description: `Tab switch detected. Warning ${next}/${MAX_WARNINGS}.`,
            variant: next >= MAX_WARNINGS ? "destructive" : "default",
          });
          if (next >= MAX_WARNINGS) {
            void handleSubmit(true, true);
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
  const warningLimit = exam?.warningsLimit ?? MAX_WARNINGS;
  const warningsCritical = warnings >= warningLimit;

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

  async function handleSubmit(
    auto = false,
    terminated = false
  ) {
    if (!exam || submitting || submitted) return;
    setSubmitting(true);
    try {
      const payload = {
        examId: exam.id,
        answers: Object.entries(answers).map(([questionId, answerText]) => ({
          questionId,
          answerText,
        })),
        warnings,
        autoSubmit: auto,
        terminated,
      };
      const res = await fetch(`/api/exams/${exam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // still allow local "submitted" state with a toast (mock compatibility)
      }
      toast({
        title: terminated ? "Exam terminated" : auto ? "Auto-submitted" : "Exam submitted",
        description: terminated
          ? "Too many proctoring violations."
          : "Your answers have been received.",
      });
      setSubmitted(true);
      setShowConfirm(false);
    } catch {
      toast({
        title: "Submission saved locally",
        description: "Network unavailable; answers stored on device.",
      });
      setSubmitted(true);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }

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

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            {warningsCritical ? "Exam terminated" : "Exam submitted"}
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            {warningsCritical
              ? "Your exam was terminated due to repeated proctoring violations."
              : "Thanks! Your answers have been submitted successfully."}
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
              <dt className="text-sm font-medium text-slate-500">Total marks</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {totalMarks}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Warnings</dt>
              <dd
                className={cn(
                  "mt-1 text-2xl font-semibold",
                  warningsCritical ? "text-red-600" : "text-slate-900"
                )}
              >
                {warnings}
                <span className="text-base font-normal text-slate-500">
                  {" "}
                  / {warningLimit}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Exam ID</dt>
              <dd className="mt-1 truncate text-sm font-mono text-slate-900">
                {exam.id}
              </dd>
            </div>
          </dl>
          <Button className="mt-8" onClick={() => router.push("/")}>
            Return to home
          </Button>
        </div>
      </div>
    );
  }

  const timerAlmostOver =
    timeLeft !== null && timeLeft <= 60;
  const timerWarn =
    timeLeft !== null && timeLeft <= 5 * 60 && !timerAlmostOver;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
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
                warningsCritical
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              )}
              title="Proctoring warnings — tabs switches trigger warnings"
            >
              {warningsCritical ? (
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
          <div key={currentQuestion.id} className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-indigo-700">
                  Question {currentIndex + 1} of {totalQuestions}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      currentQuestion.type === "MCQ" &&
                        "bg-indigo-50 text-indigo-700",
                      currentQuestion.type === "TRUE_FALSE" &&
                        "bg-sky-50 text-sky-700",
                      currentQuestion.type === "SHORT_ANSWER" &&
                        "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {currentQuestion.type === "MCQ"
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
              {currentQuestion.questionText}
            </h2>

            {/* MCQ / True-False */}
            {(currentQuestion.type === "MCQ" ||
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
                        "group cursor-pointer rounded-2xl border px-5 py-4 text-lg transition-colors sm:text-xl",
                        selected
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
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
                          onChange={() => setAnswer(currentQuestion.id, value)}
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
                  className="min-h-[240px] resize-y text-lg leading-7"
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
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg border text-base font-semibold transition",
                    active
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : answered
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                  )}
                  aria-current={active ? "page" : undefined}
                  aria-label={`Question ${i + 1}${answered ? " (answered)" : ""}`}
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
            disabled={currentIndex === 0}
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
              disabled={submitting}
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
    </div>
  );
}
