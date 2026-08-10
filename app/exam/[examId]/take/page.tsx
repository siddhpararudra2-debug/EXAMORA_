"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
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
import { useAIFaceDetection } from "@/components/proctoring/useAIFaceDetection";
import { useLiveSupervision } from "@/components/proctoring/useLiveSupervision";
import { isAIOverlayElement } from "@/components/proctoring/useExamLockdown";
import {
  ExamTerminatedEvent,
  getSocket,
  getSocketForAuth,
} from "@/lib/socket";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";

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
  settings?: {
    supervision?: {
      camera?: boolean;
      mic?: boolean;
    };
  };
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

function TakeExamContent() {
  const params = useParams<{ examId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const examId = params.examId;
  const initialSessionToken = search.get("token") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
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
                setIsDemoMode(false);
              }
            }
          } catch (err) {
            console.warn("Student view network fetch failed, using offline demo mode:", err);
          }
        }

        if (!examData) {
          examData = mockExamData(examId);
          setIsDemoMode(true);
        }
        if (!sessionData) {
          sessionData = mockSessionInit(examId);
          setIsDemoMode(true);
        }

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
      socket = getSocketForAuth(session.sessionToken);
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

  // -------- Handlers --------
  const doTerminate = useCallback(
    (reason: ExamTerminatedEvent["reason"]) => {
      setTerminated(true);
      setTerminatedReason(reason);
      setTerminatedCountdown(
        Math.round(TERMINATED_REDIRECT_DELAY_MS / 1000)
      );

      if (!session?.sessionToken) return;

      // Flush the in-memory answers via canonical REST API (best-effort).
      // The /answer route accepts TERMINATED sessions, so the last answers
      // are persisted before the student is redirected. A terminated session
      // can no longer be submitted via /submit.
      (async () => {
        try {
          for (const [questionId, answerData] of Object.entries(answers)) {
            if (answerData && answerData.trim()) {
              await fetch(`/api/v1/exam-session/${session.sessionToken}/answer`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.sessionToken}`,
                },
                body: JSON.stringify({ questionId, answerData }),
              }).catch(() => {});
            }
          }
        } catch {
          /* ignore */
        }
      })();
    },
    [answers, session]
  );

  // -------- Tab-switch + AI face proctoring --------
  const emitViolation = useCallback(
    async (
      reason: string,
      type:
        | "TAB_SWITCH"
        | "APP_SWITCH"
        | "MINIMIZE"
        | "MOBILE_BUTTON"
        | "AI_OVERLAY"
        | "DEVTOOLS"
        | "SCREEN_CAPTURE"
        | "KEYBOARD_SHORTCUT" = "TAB_SWITCH"
    ) => {
      if (!session?.sessionToken || !exam) return;

      try {
        const res = await fetch(
          `/api/v1/exam-session/${session.sessionToken}/violation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.sessionToken}`,
            },
            body: JSON.stringify({
              type,
              description: reason,
            }),
          }
        );

        if (res.ok) {
          const payload = (await res.json()) as {
            data?: { terminated?: boolean; warningsCount?: number };
          };
          const count = payload.data?.warningsCount ?? 0;
          const limit = exam.warningsLimit ?? DEFAULT_WARNINGS_LIMIT;
          const isTerminated = payload.data?.terminated || count >= limit;

          setWarnings(count);

          toast({
            title: "Proctoring alert",
            description: `${reason}. Warning ${count}/${limit}.`,
            variant: isTerminated ? "destructive" : "default",
          });

          if (isTerminated) {
            doTerminate("warnings_limit");
          }
        }
      } catch {
        /* network failure handled gracefully */
      }
    },
    [session, exam, toast, doTerminate]
  );

  useEffect(() => {
    if (submitted || loading || !exam) return;
    const onVisibility = () => {
      if (document.hidden) {
        const reason = "Tab or window switch detected";
        void emitViolation(reason);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [submitted, loading, exam, emitViolation]);

  // -------- Mobile hardware back button + screen-recording detection --------
  useEffect(() => {
    if (submitted || terminated || loading || !exam) return;

    const HISTORY_SENTINEL_KEY = "__examoraLockdownSentinel";
    const pushHistorySentinel = () => {
      try {
        window.history.pushState(
          { ...(window.history.state || {}), [HISTORY_SENTINEL_KEY]: true },
          "",
          window.location.href
        );
      } catch {
        /* history locked by the browser — ignore */
      }
    };

    const onPopState = () => {
      void emitViolation(
        "Hardware back button or back swipe detected",
        "MOBILE_BUTTON"
      );
      pushHistorySentinel();
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void emitViolation(
          "Page restored from back-forward cache",
          "MOBILE_BUTTON"
        );
        pushHistorySentinel();
      }
    };

    // Screen-recording / virtual-capture device detection (best-effort heuristic).
    const SCREEN_CAPTURE_KEYWORDS = [
      "obs",
      "virtual cam",
      "screen capture",
      "display capture",
      "mirroring",
      "manycam",
      "elgato",
      "splitcam",
      "recorder",
    ];
    let lastScreenCaptureViolation = 0;
    const scanCaptureDevices = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const captureDevice = devices.find(
          (d) =>
            d.kind === "videoinput" &&
            SCREEN_CAPTURE_KEYWORDS.some((kw) =>
              d.label.toLowerCase().includes(kw)
            )
        );
        if (captureDevice) {
          const now = Date.now();
          if (now - lastScreenCaptureViolation > 60_000) {
            lastScreenCaptureViolation = now;
            void emitViolation(
              `Screen-capture device detected: ${captureDevice.label}`,
              "SCREEN_CAPTURE"
            );
          }
        }
      } catch {
        /* device labels unavailable — ignore */
      }
    };

    const onDeviceChange = () => void scanCaptureDevices();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const isScreenRecordHotkey =
        (e.metaKey && e.altKey && key === "r") ||
        (e.metaKey && e.shiftKey && (key === "3" || key === "4" || key === "5"));
      if (isScreenRecordHotkey) {
        e.preventDefault();
        e.stopPropagation();
        void emitViolation("Screen-record hotkey blocked", "SCREEN_CAPTURE");
      }
    };

    pushHistorySentinel();
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    window.addEventListener("keydown", onKeyDown, true);
    const captureScan = setInterval(() => void scanCaptureDevices(), 5000);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      window.removeEventListener("keydown", onKeyDown, true);
      clearInterval(captureScan);
    };
  }, [submitted, terminated, loading, exam, emitViolation]);

  // -------- AI overlay detection (MutationObserver) + DevTools + input blocking --------
  useEffect(() => {
    if (submitted || terminated || loading || !exam) return;

    const scanExistingDOMForOverlays = () => {
      const candidates = document.querySelectorAll<HTMLElement>(
        "div, section, aside, iframe, span"
      );
      for (let i = 0; i < candidates.length; i += 1) {
        if (isAIOverlayElement(candidates[i])) {
          void emitViolation(
            `AI overlay / floating element detected on page: <${candidates[i].tagName.toLowerCase()}>`,
            "AI_OVERLAY"
          );
          break;
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i += 1) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE && isAIOverlayElement(node as Element)) {
            void emitViolation("Injected AI overlay detected", "AI_OVERLAY");
            return;
          }
        }
        if (
          mutation.type === "attributes" &&
          mutation.target.nodeType === Node.ELEMENT_NODE &&
          isAIOverlayElement(mutation.target as Element)
        ) {
          void emitViolation("Modified AI overlay attributes detected", "AI_OVERLAY");
          return;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "style"],
    });
    scanExistingDOMForOverlays();

    // DevTools detection (viewport delta heuristic)
    const devToolsInterval = setInterval(() => {
      if (window.outerWidth - window.innerWidth > 200) {
        void emitViolation("Developer tools detected", "DEVTOOLS");
      }
    }, 1000);

    // Input blocking: cut / copy / paste / right-click
    const onBlockedInput = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      void emitViolation(
        e.type === "contextmenu"
          ? "Right-click context menu disabled"
          : `${e.type.toUpperCase()} operation blocked`,
        "KEYBOARD_SHORTCUT"
      );
    };
    window.addEventListener("cut", onBlockedInput, true);
    window.addEventListener("copy", onBlockedInput, true);
    window.addEventListener("paste", onBlockedInput, true);
    window.addEventListener("contextmenu", onBlockedInput, true);

    return () => {
      observer.disconnect();
      clearInterval(devToolsInterval);
      window.removeEventListener("cut", onBlockedInput, true);
      window.removeEventListener("copy", onBlockedInput, true);
      window.removeEventListener("paste", onBlockedInput, true);
      window.removeEventListener("contextmenu", onBlockedInput, true);
    };
  }, [submitted, terminated, loading, exam, emitViolation]);

  // -------- AI face detection (BlazeFace, client-side) --------
  // Runs only while the exam is live; reports missing / multiple faces
  // through the canonical /violation endpoint (AI_OVERLAY type).
  // When live supervision is required, the shared supervision stream/video
  // element is reused so only ONE camera capture happens per student.
  const supervisionEnabled = Boolean(
    exam?.settings?.supervision?.camera || exam?.settings?.supervision?.mic
  );
  const supervision = useLiveSupervision({
    enabled:
      !!session && supervisionEnabled && !submitted && !terminated,
    examId,
    sessionToken: session?.sessionToken ?? "",
    requireMic: exam?.settings?.supervision?.mic ?? false,
    requireCamera: exam?.settings?.supervision?.camera ?? false,
  });
  // With supervision, defer to the supervision stream (once captured) and
  // never open a second camera for face detection.
  const faceDetectionEnabled =
    !!session && !submitted && !terminated &&
    (!supervisionEnabled || supervision.stream !== null);
  const { videoRef: faceDetectionVideoRef } = useAIFaceDetection({
    enabled: faceDetectionEnabled,
    onViolation: (reason) => void emitViolation(reason, "AI_OVERLAY"),
    externalVideoRef: supervisionEnabled
      ? supervision.videoRef
      : undefined,
    externalStream: supervisionEnabled ? supervision.stream : null,
  });

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

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    if (session?.sessionToken) {
      fetch(`/api/v1/exam-session/${session.sessionToken}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({ questionId: qid, answerData: value }),
      }).catch(() => {});
    }
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
    if (!session || !exam || submitting || submitted || terminated) return;
    setSubmitting(true);
    try {
      // Save answers via canonical REST API
      for (const [questionId, answerData] of Object.entries(answers)) {
        if (answerData && answerData.trim()) {
          await fetch(`/api/v1/exam-session/${session.sessionToken}/answer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.sessionToken}`,
            },
            body: JSON.stringify({ questionId, answerData }),
          }).catch(() => {});
        }
      }

      const res = await fetch(
        `/api/v1/exam-session/${session.sessionToken}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.sessionToken}`,
          },
          body: JSON.stringify({ sessionToken: session.sessionToken }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        submittedAt?: string;
        message?: string;
        data?: { message?: string };
      };

      if (!res.ok) {
        toast({
          title: auto ? "Auto-submit failed" : "Submission failed",
          description:
            data?.data?.message ??
            data?.message ??
            "The server rejected the submission. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: auto ? "Time's up — auto-submitted" : "Exam submitted",
        description:
          data?.data?.message ?? data?.message ?? "Your answers have been received.",
      });

      setSubmitted(true);
      setSubmittedViaAuto(auto);
      setShowConfirm(false);
      setSubmittedResult({
        submittedAt: new Date().toISOString(),
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
      <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
        {/* Subtle ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20 pointer-events-none" 
             style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0) 70%)' }} />
        <div className="flex items-center gap-3 text-muted-foreground animate-in fade-in duration-500 relative z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg font-medium">Preparing exam environment…</span>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            Exam not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            The exam you&apos;re looking for isn&apos;t available.
          </p>
          <Button className="mt-8" onClick={() => router.push("/")}>
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
    <div className="flex min-h-screen flex-col bg-background text-foreground relative selection:bg-primary/20">
      {/* Webcam feed for the BlazeFace proctoring hook. When live supervision
          is required the self-view tile below hosts the shared stream; when
          not, an invisible 1px video still powers face detection. */}
      {!supervisionEnabled && (
        <video
          ref={faceDetectionVideoRef}
          autoPlay
          playsInline
          muted
          className="pointer-events-none fixed h-px w-px opacity-0"
          aria-hidden="true"
        />
      )}

      {/* Live supervision self-view (S02/S03) — camera + mic are streamed to
          the teacher's live dashboard via WebRTC while the exam runs. */}
      {supervisionEnabled && (
        <div className="fixed bottom-24 right-4 z-40 w-44 animate-in slide-in-from-bottom-4 fade-in duration-500 sm:bottom-6 sm:right-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-black shadow-2xl">
            <video
              ref={supervision.videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {supervision.cameraDenied ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/90 text-white">
                  <VideoOff className="h-5 w-5" />
                </span>
              ) : null}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-2">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    supervision.streamingToTeacher
                      ? "bg-red-500 animate-pulse"
                      : "bg-amber-400"
                  )}
                />
                {supervision.streamingToTeacher ? "Live" : "Camera"}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={supervision.toggleMic}
                  disabled={supervision.micDenied}
                  aria-label={supervision.micOn ? "Mute microphone" : "Unmute microphone"}
                  title={supervision.micDenied ? "Microphone denied" : supervision.micOn ? "Mute microphone" : "Unmute microphone"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors",
                    supervision.micDenied
                      ? "bg-white/20 text-white/50"
                      : supervision.micOn
                      ? "bg-white/25 hover:bg-white/40"
                      : "bg-red-500/80 hover:bg-red-500"
                  )}
                >
                  {supervision.micOn ? (
                    <Mic className="h-3.5 w-3.5" />
                  ) : (
                    <MicOff className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={supervision.toggleCam}
                  disabled={supervision.cameraDenied}
                  aria-label={supervision.camOn ? "Turn camera off" : "Turn camera on"}
                  title={supervision.camOn ? "Turn camera off" : "Turn camera on"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors",
                    supervision.cameraDenied
                      ? "bg-white/20 text-white/50"
                      : supervision.camOn
                      ? "bg-white/25 hover:bg-white/40"
                      : "bg-red-500/80 hover:bg-red-500"
                  )}
                >
                  {supervision.camOn ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <VideoOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Strict termination overlay */}
      {terminated && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="term-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-xl animate-in fade-in duration-300"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl glass-panel border-destructive/30 animate-in zoom-in-95 duration-500">
            <div className="flex items-center justify-center bg-destructive/10 py-10">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive text-destructive-foreground shadow-sm">
                <OctagonX className="h-10 w-10" />
              </div>
            </div>
            <div className="p-8 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-destructive">
                <ShieldAlert className="h-4 w-4" />
                Exam terminated
              </span>
              <h2
                id="term-title"
                className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              >
                Your exam has been terminated
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                {terminatedReason === "warnings_limit"
                  ? `Due to repeated proctoring violations (${warnings}/${warningLimit} warnings), this session has been closed.`
                  : terminatedReason === "teacher"
                  ? "Your teacher ended this session. Any answers submitted so far have been saved."
                  : "This session has been closed. Any answers submitted so far have been retained."}
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-4 rounded-xl bg-secondary/50 p-5">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Warnings
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-destructive">
                    {warnings}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {warningLimit}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Answers saved
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-foreground">
                    {answeredCount}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {totalQuestions}
                    </span>
                  </dd>
                </div>
              </dl>
              <div
                role="status"
                className="mt-8 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-xl rounded-2xl glass-panel p-10 text-center animate-in zoom-in-95 duration-500">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-4 w-4" />
              Submission successful
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              Your exam has been submitted
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Thanks — your answers have been received and saved. Redirecting…
            </p>
            <dl className="mt-10 grid grid-cols-2 gap-4 rounded-xl bg-secondary/30 p-6 text-left border border-border/40">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Questions answered
                </dt>
                <dd className="mt-1 text-2xl font-bold text-foreground">
                  {answeredCount}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {totalQuestions}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Total marks
                </dt>
                <dd className="mt-1 text-2xl font-bold text-foreground">
                  {totalMarks}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Warnings
                </dt>
                <dd className="mt-1 text-2xl font-bold text-foreground">
                  {warnings}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {warningLimit}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Submitted at
                </dt>
                <dd className="mt-1 truncate text-sm font-mono text-foreground">
                  {submittedResult?.submittedAt
                    ? new Date(submittedResult.submittedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {!submitted && (
        <>
          {/* Demo Mode Banner */}
          {isDemoMode && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Preview / Demo Mode: Live backend connection unavailable. Your answers will not be persisted to the server.</span>
            </div>
          )}

          {/* Top Bar */}
          <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-20 w-full max-w-5xl flex-wrap items-center gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                  Now taking
                </p>
                <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-0.5">
                  {exam.title}
                </h1>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors",
                    timerAlmostOver
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : timerWarn
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                      : "border-border/40 bg-secondary/30 text-foreground"
                  )}
                  aria-live="polite"
                >
                  <Clock className="h-5 w-5" aria-hidden />
                  <span className="font-mono text-lg font-bold tabular-nums sm:text-xl tracking-tight">
                    {formatTime(timeLeft ?? 0)}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 transition-colors",
                    warningsCritical || terminated
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border/40 bg-secondary/30 text-foreground"
                  )}
                  title="Proctoring warnings"
                >
                  {warningsCritical || terminated ? (
                    <ShieldAlert className="h-5 w-5" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden />
                  )}
                  <span className="text-sm font-semibold sm:text-base">
                    Warnings: {warnings}/{warningLimit}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Area */}
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
            {currentQuestion && (
              <div
                key={currentQuestion.id}
                className="flex flex-col gap-8 animate-in slide-in-from-right-4 fade-in duration-500"
                aria-disabled={disabled}
              >
                <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-border/40">
                  <div>
                    <p className="text-sm font-bold text-muted-foreground">
                      Question {currentIndex + 1} of {totalQuestions}
                    </p>
                    <p className="mt-2 text-sm">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                          currentQuestion.type === "MCQ_SINGLE" &&
                            "bg-secondary text-foreground",
                          currentQuestion.type === "TRUE_FALSE" &&
                            "bg-secondary text-foreground",
                          currentQuestion.type === "SHORT_ANSWER" &&
                            "bg-primary/10 text-primary"
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
                  <p className="text-sm font-bold text-muted-foreground">
                    {currentQuestion.marks}{" "}
                    {currentQuestion.marks === 1 ? "mark" : "marks"}
                  </p>
                </div>

                <h2 className="text-2xl font-bold leading-relaxed tracking-tight text-foreground whitespace-pre-wrap sm:text-3xl">
                  {currentQuestion.question_text}
                </h2>

                {/* MCQ / True-False */}
                {(currentQuestion.type === "MCQ_SINGLE" ||
                  currentQuestion.type === "TRUE_FALSE") && (
                  <div className="flex flex-col gap-4 mt-2">
                    {(currentQuestion.options ?? []).map((option, i) => {
                      const optionKey = String.fromCharCode(65 + i);
                      const value = option;
                      const selected = answers[currentQuestion.id] === value;
                      return (
                        <label
                          key={`${currentQuestion.id}-${i}`}
                          className={cn(
                            "group relative rounded-xl border p-5 text-lg transition-all duration-200 sm:text-xl",
                            disabled && "pointer-events-none opacity-50",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary cursor-pointer shadow-sm"
                              : "border-border/40 bg-secondary/20 hover:border-border hover:bg-secondary/60 cursor-pointer"
                          )}
                        >
                          <span className="flex items-start gap-5">
                            <span
                              className={cn(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold transition-colors",
                                selected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-muted-foreground border border-border group-hover:border-foreground/30"
                              )}
                              aria-hidden
                            >
                              {selected ? (
                                <CheckCircle2 className="h-5 w-5" />
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
                            <span className={cn("leading-relaxed", selected ? "text-foreground font-medium" : "text-muted-foreground")}>
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
                  <div className="flex flex-col gap-4 mt-2">
                    <Textarea
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={(e) =>
                        setAnswer(currentQuestion.id, e.target.value)
                      }
                      placeholder="Type your answer here…"
                      disabled={disabled}
                      className="min-h-[280px] resize-y text-lg leading-relaxed p-6 bg-secondary/30 border-border/40 focus-visible:ring-primary focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Your answer is auto-saved locally as you type.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Question navigator */}
            <div className="mt-20 border-t border-border/40 pt-8">
              <p className="mb-4 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Exam Overview
              </p>
              <div className="flex flex-wrap gap-2.5">
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
                        "flex h-12 w-12 items-center justify-center rounded-lg text-base font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        active
                          ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                          : answered
                          ? "bg-secondary text-foreground hover:bg-secondary/80 border border-border/40"
                          : "bg-transparent text-muted-foreground hover:bg-secondary/50 border border-border/40"
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
              <div className="mt-6 flex gap-6 text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-secondary border border-border/40" />
                  Answered
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-primary" />
                  Current
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-transparent border border-border/40" />
                  Unanswered
                </span>
              </div>
            </div>
          </main>

          {/* Bottom Bar */}
          <footer className="sticky bottom-0 z-30 border-t border-border/40 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-24 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goPrev}
                disabled={disabled || currentIndex === 0}
                className="h-12 gap-2 w-[140px] border-border/40 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" /> Previous
              </Button>

              <div className="hidden sm:flex flex-col items-center">
                <p className="text-sm font-bold text-foreground">
                  {Math.round((answeredCount / totalQuestions) * 100)}% Completed
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">
                  {answeredCount} of {totalQuestions} answered
                </p>
              </div>

              {currentIndex < totalQuestions - 1 ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={goNext}
                  disabled={disabled}
                  className="h-12 gap-2 w-[140px]"
                >
                  Next <ArrowRight className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="h-12 gap-2 w-[140px] text-base"
                  onClick={() => setShowConfirm(true)}
                  disabled={disabled || submitting}
                >
                  <Send className="h-5 w-5" /> Submit
                </Button>
              )}
            </div>
          </footer>

          {/* Confirmation Dialog */}
          {showConfirm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-confirm-title"
            >
              <div className="w-full max-w-md rounded-2xl glass-panel p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="submit-confirm-title"
                      className="text-xl font-bold tracking-tight text-foreground"
                    >
                      Submit Exam
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      You have answered{" "}
                      <span className="font-bold text-foreground">
                        {answeredCount}
                      </span>{" "}
                      out of{" "}
                      <span className="font-bold text-foreground">
                        {totalQuestions}
                      </span>{" "}
                      questions.
                    </p>
                    {answeredCount < totalQuestions && (
                      <div className="mt-4 rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
                        <p className="text-sm font-semibold text-amber-500">
                          {totalQuestions - answeredCount} question
                          {totalQuestions - answeredCount === 1 ? "" : "s"} left
                          unanswered.
                        </p>
                        <p className="text-sm mt-1 text-amber-500/80">
                           Are you sure you want to finish early?
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                    disabled={submitting}
                    className="border-border/40"
                  >
                    Keep working
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="min-w-[140px]"
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

export default function TakeExamPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">Loading exam...</div>}>
      <TakeExamContent />
    </Suspense>
  );
}
