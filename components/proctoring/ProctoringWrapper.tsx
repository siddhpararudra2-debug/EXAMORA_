"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useExamLockdown } from "./useExamLockdown";
import { useAIFaceDetection } from "./useAIFaceDetection";

export interface ProctoringWrapperProps {
  children: React.ReactNode;
  /** Real session token — violations are POSTed to /api/v1/exam-session/:token/violation. */
  token: string;
  /** Master switch. When false, no listeners attach and no camera is requested. */
  enabled: boolean;
  /** Educator setting (settings.supervision.camera). When false, face detection stays off. */
  cameraAllowed?: boolean;
  maxWarnings?: number;
  /**
   * Controlled display count, owned by the host page and updated exclusively
   * from server-confirmed values (onWarning). The wrapper never owns a
   * counter — a single source of truth prevents the banner, header pill, and
   * server from ever disagreeing.
   */
  warnings: number;
  examId?: string;
  sessionId?: string;
  /** Fired with the SERVER count after each confirmed violation (toasts, counters). */
  onWarning?: (count: number, reason: string) => void;
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
 * Student proctoring shell: warning banner, beeps, fullscreen prompt, and a
 * picture-in-picture camera preview. Detection comes from useExamLockdown +
 * useAIFaceDetection; every violation is POSTed to the server and the
 * server-authoritative count drives all UI and termination. The wrapper
 * never counts locally and never terminates on its own.
 */
export function ProctoringWrapper({
  children,
  token,
  enabled,
  cameraAllowed = true,
  maxWarnings = 3,
  warnings: displayWarnings,
  examId,
  sessionId,
  onWarning,
  onTerminate: onTerminateProp,
  onAutoSubmit,
  terminatedRedirectUrl = "/exam/terminated",
  className = "",
}: ProctoringWrapperProps) {
  // The displayed count is the controlled `warnings` prop (owned by the host
  // page, fed only by server confirmations). This component keeps no counter.
  const warningCount = displayWarnings;
  const [latestWarningReason, setLatestWarningReason] = useState<string | null>(null);
  const [showWarningBanner, setShowWarningBanner] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [minimizedWebcam, setMinimizedWebcam] = useState<boolean>(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // References for current callback values
  const onAutoSubmitRef = useRef(onAutoSubmit);
  const onTerminatePropRef = useRef(onTerminateProp);
  const onWarningPropRef = useRef(onWarning);

  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
    onTerminatePropRef.current = onTerminateProp;
    onWarningPropRef.current = onWarning;
  }, [onAutoSubmit, onTerminateProp, onWarning]);

  // Immediate feedback on detection (banner + beep). Counting happens only
  // when the server confirms the violation (see onWarning below).
  const handleDetect = useCallback((_type: string, reason?: string) => {
    playBeepSound(880, 0.3);

    setLatestWarningReason(reason ?? "Integrity signal detected");
    setShowWarningBanner(true);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      setShowWarningBanner(false);
    }, 4000);
  }, []);

  // Server-confirmed violation: forward the authoritative count to the host
  // page (which owns the counter) and refresh the banner reason.
  const handleServerWarning = useCallback(
    (count: number, _type: string, reason?: string) => {
      if (reason) setLatestWarningReason(reason);
      try {
        onWarningPropRef.current?.(count, reason ?? "");
      } catch (err) {
        console.error("[ProctoringWrapper] Error in onWarning callback:", err);
      }
    },
    []
  );

  // Termination is server-driven (hook's executeTerminationFlow): flush
  // answers first via onAutoSubmit, then notify the host page, which shows
  // its own termination UI (the hook does not redirect — see below).
  const handleTerminate = useCallback(async () => {
    try {
      if (onAutoSubmitRef.current) {
        await onAutoSubmitRef.current();
      }
    } catch (err) {
      console.error("[ProctoringWrapper] Auto-submit error during termination:", err);
    }
    try {
      onTerminatePropRef.current?.();
    } catch (err) {
      console.error("[ProctoringWrapper] Error in onTerminate callback:", err);
    }
  }, []);

  // Hook 1: Core lockdown (tab switch / blur / fullscreen / shortcuts / input
  // blocking / devtools / screen capture / AI overlays). redirectOnTerminate
  // is false because the host page renders its own termination overlay and
  // redirects after a countdown.
  const { isFullscreen, requestFullscreen, triggerViolation } = useExamLockdown({
    token,
    maxWarnings,
    enabled,
    redirectOnTerminate: false,
    terminatedRedirectUrl,
    onDetect: handleDetect,
    onWarning: handleServerWarning,
    onTerminate: () => void handleTerminate(),
  });

  // Hook 2: Client-side AI face detection (BlazeFace). Gated on the master
  // switch AND the educator's camera setting. Face violations are routed
  // through the lockdown hook so they reach the server like any other
  // violation (previously they were local-only and never persisted).
  const { faceCount, isModelLoading } = useAIFaceDetection({
    enabled: enabled && cameraAllowed,
    externalVideoRef: videoRef,
    intervalMs: 2000,
    onViolation: (reason) => triggerViolation("ai_overlay", reason),
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
          <div className="flex items-center gap-3 rounded-xl border border-red-500 bg-red-600 text-white p-4 shadow-2xl animate-in fade-in slide-in-from-top-4">
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

      {/* Step 5: Small picture-in-picture webcam preview in bottom-right corner with monitoring badge */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="pointer-events-none relative overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-900 shadow-2xl transition-all">
          {/* Top Bar with AI Monitoring Badge (video never leaves the device) */}
          <div className="pointer-events-auto flex items-center justify-between gap-2 bg-slate-950/90 px-3 py-1.5 ">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-[11px] font-bold tracking-wide text-red-400 uppercase">
                AI Monitoring
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
                  <span className="rounded bg-slate-900/80 px-2 py-0.5 text-[10px] text-indigo-300 ">
                    Loading AI…
                  </span>
                ) : faceCount === 1 ? (
                  <span className="rounded bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ">
                    ✓ Face Verified
                  </span>
                ) : faceCount === 0 ? (
                  <span className="rounded bg-red-950/90 border border-red-500/50 px-2 py-0.5 text-[10px] font-bold text-red-300 animate-pulse">
                    ⚠️ No Face
                  </span>
                ) : (
                  <span className="rounded bg-amber-950/90 border border-amber-500/50 px-2 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
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
