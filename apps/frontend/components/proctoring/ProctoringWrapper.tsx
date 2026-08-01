"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Video, VideoOff, AlertTriangle, X, Eye } from "lucide-react";
import { useExamLockdown } from "./useExamLockdown";
import { useAIFaceDetection } from "./useAIFaceDetection";
import { getSocket } from "@/lib/socket";

export interface ProctoringWrapperProps {
  children: React.ReactNode;
  maxWarnings?: number;
  examId?: string;
  sessionId?: string;
  onTerminate?: () => void;
  onAutoSubmit?: () => void | Promise<void>;
  terminatedRedirectUrl?: string;
  className?: string;
}

/**
 * Web Audio API Oscillator Beep Generator.
 * Creates a short, distinct audio beep without reliance on external MP3 files.
 */
function playBeepSound(frequency = 880, duration = 0.3): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Envelope: quick attack and smooth exponential decay
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);

    setTimeout(() => {
      if (ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
    }, Math.ceil(duration * 1000) + 100);
  } catch (err) {
    console.warn("[ProctoringWrapper] Web Audio beep playback suppressed:", err);
  }
}

/**
 * Task 2: Student Proctoring Layout Wrapper & 3-Warning Beep System.
 * Combines useExamLockdown and useAIFaceDetection into a unified warning system.
 */
export function ProctoringWrapper({
  children,
  maxWarnings = 3,
  examId,
  sessionId,
  onTerminate: onTerminateProp,
  onAutoSubmit,
  terminatedRedirectUrl = "/exam/terminated",
  className = "",
}: ProctoringWrapperProps) {
  const router = useRouter();

  // Unified warning state fed by both useExamLockdown and useAIFaceDetection
  const [warningCount, setWarningCount] = useState<number>(0);
  const [latestWarningReason, setLatestWarningReason] = useState<string | null>(null);
  const [showWarningBanner, setShowWarningBanner] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [minimizedWebcam, setMinimizedWebcam] = useState<boolean>(false);
  const lastViolationTimeRef = useRef<number>(0);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  // References for current callback values
  const onAutoSubmitRef = useRef(onAutoSubmit);
  const onTerminatePropRef = useRef(onTerminateProp);
  const maxWarningsRef = useRef(maxWarnings);

  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
    onTerminatePropRef.current = onTerminateProp;
    maxWarningsRef.current = maxWarnings;
  }, [onAutoSubmit, onTerminateProp, maxWarnings]);

  // Unified violation handler
  const handleViolation = useCallback(
    (reason: string) => {
      if (isTerminatedRef.current) return;

      const now = Date.now();
      // 800ms cooldown between consecutive violations to avoid duplicate counts
      if (now - lastViolationTimeRef.current < 800) {
        return;
      }
      lastViolationTimeRef.current = now;

      // Step 3: Play short audio beep on every warning
      playBeepSound(880, 0.3);

      setLatestWarningReason(reason);
      setShowWarningBanner(true);

      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(() => {
        setShowWarningBanner(false);
      }, 4000);

      setWarningCount((prevCount) => {
        const nextCount = prevCount + 1;
        const limit = maxWarningsRef.current;

        // Emit student_warning socket event to backend
        try {
          const socket = getSocket();
          if (socket && (examId || sessionId)) {
            socket.emit("student_warning", {
              examId,
              sessionId,
              warningCount: nextCount,
              warningsLimit: limit,
              reason,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn("[ProctoringWrapper] Socket event emit error:", err);
        }

        // Step 4: If warningCount >= maxWarnings, trigger termination sequence
        if (nextCount >= limit) {
          isTerminatedRef.current = true;

          // Urgent termination beep sequence
          playBeepSound(1100, 0.5);

          (async () => {
            try {
              if (onAutoSubmitRef.current) {
                await onAutoSubmitRef.current();
              }
            } catch (err) {
              console.error("[ProctoringWrapper] Auto-submit error during termination:", err);
            }

            if (onTerminatePropRef.current) {
              onTerminatePropRef.current();
            }

            router.push(terminatedRedirectUrl);
          })();
        }

        return nextCount;
      });
    },
    [examId, sessionId, router, terminatedRedirectUrl]
  );

  // Hook 1: Core Lockdown Hook (Tab switch / Fullscreen exit / Keyboard shortcuts / Right click)
  const { isFullscreen, requestFullscreen } = useExamLockdown({
    maxWarnings,
    onWarning: (_cnt, reason) => handleViolation(reason),
    onTerminate: () => {}, // Handled inside handleViolation
  });

  // Hook 2: Client-Side AI Face Detection Hook (BlazeFace / MediaPipe 2000ms detection)
  const { faceCount, isModelLoading, modelError, stream } = useAIFaceDetection({
    externalVideoRef: videoRef,
    intervalMs: 2000,
    onViolation: (reason) => handleViolation(reason),
  });

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  return (
    <div className={`relative min-h-screen ${className}`}>
      {/* Top Violation Warning Banner */}
      {showWarningBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 transition-all">
          <div className="flex items-center gap-3 rounded-xl border border-red-500 bg-red-600 text-white p-4 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-300 animate-bounce" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-100">
                Proctoring Warning ({warningCount}/{maxWarnings})
              </h4>
              <p className="text-sm font-medium mt-0.5 truncate text-white">
                {latestWarningReason || "Violation detected"}
              </p>
            </div>
            <button
              onClick={() => setShowWarningBanner(false)}
              className="rounded-lg p-1 hover:bg-red-700 transition"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Re-entry Prompt */}
      {!isFullscreen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4">
          <button
            onClick={requestFullscreen}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 text-sm shadow-xl transition"
          >
            <AlertTriangle className="h-4 w-4" />
            Click to Re-enter Fullscreen Mode
          </button>
        </div>
      )}

      {/* Main Student Exam Interface */}
      {children}

      {/* Step 5: Small picture-in-picture webcam preview in bottom-right corner with 🔴 Recording badge */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="relative overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-2xl transition-all">
          {/* Top Bar with 🔴 Recording Badge */}
          <div className="flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-1.5 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-[11px] font-bold tracking-wide text-red-400 uppercase">
                🔴 Recording
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-amber-300">
                {warningCount}/{maxWarnings} Warnings
              </span>
              <button
                type="button"
                onClick={() => setMinimizedWebcam(!minimizedWebcam)}
                className="text-slate-400 hover:text-white transition text-xs px-1"
                title={minimizedWebcam ? "Expand preview" : "Minimize preview"}
              >
                {minimizedWebcam ? "▲" : "▼"}
              </button>
            </div>
          </div>

          {/* Video Feed Box */}
          {!minimizedWebcam && (
            <div className="relative h-32 w-48 bg-slate-950 sm:h-36 sm:w-52 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover transform -scale-x-100 block"
              />

              {/* Status Overlay Badges */}
              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
                {isModelLoading ? (
                  <span className="rounded bg-slate-900/80 px-2 py-0.5 text-[10px] text-indigo-300 backdrop-blur">
                    Loading AI…
                  </span>
                ) : faceCount === 1 ? (
                  <span className="rounded bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur">
                    ✓ Face Verified
                  </span>
                ) : faceCount === 0 ? (
                  <span className="rounded bg-red-950/90 border border-red-500/50 px-2 py-0.5 text-[10px] font-bold text-red-300 backdrop-blur animate-pulse">
                    ⚠️ No Face
                  </span>
                ) : (
                  <span className="rounded bg-amber-950/90 border border-amber-500/50 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur animate-pulse">
                    ⚠️ Multiple Faces ({faceCount})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProctoringWrapper;
