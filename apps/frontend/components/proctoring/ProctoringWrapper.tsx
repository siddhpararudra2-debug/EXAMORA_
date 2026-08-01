"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Video, VideoOff, AlertTriangle, X } from "lucide-react";
import { useExamLockdown } from "./useExamLockdown";

export interface ProctoringWrapperProps {
  children: React.ReactNode;
  maxWarnings?: number;
  onTerminate?: () => void;
  onAutoSubmit?: () => void | Promise<void>;
  terminatedRedirectUrl?: string;
  className?: string;
}

export function ProctoringWrapper({
  children,
  maxWarnings = 3,
  onTerminate: onTerminateProp,
  onAutoSubmit,
  terminatedRedirectUrl = "/exam/terminated",
  className = "",
}: ProctoringWrapperProps) {
  const router = useRouter();

  // Webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [webcamActive, setWebcamActive] = useState<boolean>(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [minimizedWebcam, setMinimizedWebcam] = useState<boolean>(false);

  // Warning banner state
  const [latestWarningReason, setLatestWarningReason] = useState<string | null>(null);
  const [showWarningBanner, setShowWarningBanner] = useState<boolean>(false);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle exam termination
  const handleTerminate = useCallback(async () => {
    try {
      if (onAutoSubmit) {
        await onAutoSubmit();
      }
    } catch (err) {
      console.error("[ProctoringWrapper] Auto-submit failed during termination:", err);
    }

    if (onTerminateProp) {
      onTerminateProp();
    }

    router.push(terminatedRedirectUrl);
  }, [onAutoSubmit, onTerminateProp, router, terminatedRedirectUrl]);

  // Handle individual warning violations
  const handleWarning = useCallback((count: number, reason: string) => {
    setLatestWarningReason(reason);
    setShowWarningBanner(true);

    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    warningTimerRef.current = setTimeout(() => {
      setShowWarningBanner(false);
    }, 4000);
  }, []);

  // Initialize browser lockdown hook
  const { warnings, isFullscreen, requestFullscreen } = useExamLockdown({
    maxWarnings,
    onTerminate: handleTerminate,
    onWarning: handleWarning,
  });

  // Step 3 & Step 4: Initialize and handle webcam stream & cleanup
  useEffect(() => {
    let isMounted = true;

    async function initWebcam() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (isMounted) setWebcamError("Camera access not supported by browser");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setWebcamActive(true);
        setWebcamError(null);
      } catch (err) {
        if (isMounted) {
          console.warn("[ProctoringWrapper] Camera permission error:", err);
          setWebcamActive(false);
          setWebcamError("Camera permission denied or camera unavailable");
        }
      }
    }

    initWebcam();

    // Clean up tracks when component unmounts
    return () => {
      isMounted = false;
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative min-h-screen ${className}`}>
      {/* Violation Alert Banner */}
      {showWarningBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 transition-all">
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-600 text-white p-4 shadow-2xl backdrop-blur">
            <AlertTriangle className="h-6 w-6 shrink-0 animate-bounce text-amber-300" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold uppercase tracking-wider">
                Proctoring Warning ({warnings}/{maxWarnings})
              </h4>
              <p className="text-xs text-red-100 mt-0.5 truncate">
                {latestWarningReason || "Proctoring rule violation detected"}
              </p>
            </div>
            <button
              onClick={() => setShowWarningBanner(false)}
              className="rounded-lg p-1 hover:bg-red-700 transition"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Re-entry Prompt if exited */}
      {!isFullscreen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4">
          <button
            onClick={requestFullscreen}
            className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium px-4 py-2 text-sm shadow-lg transition"
          >
            <AlertTriangle className="h-4 w-4" />
            Re-enter Fullscreen Mode
          </button>
        </div>
      )}

      {/* Main Student Exam Content */}
      {children}

      {/* Fixed Bottom-Right Webcam Floating Box */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="relative overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-2xl transition-all">
          {/* Top Bar inside Webcam Feed */}
          <div className="flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-1.5 backdrop-blur">
            <div className="flex items-center gap-2">
              {/* Step 4: Red Pulsing Dot Indicator */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-slate-200 uppercase">
                Proctoring Active
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-300">
                {warnings}/{maxWarnings} Warnings
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

          {/* Video Container */}
          {!minimizedWebcam && (
            <div className="relative h-32 w-48 bg-slate-950 sm:h-36 sm:w-52 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover transform -scale-x-100 ${
                  webcamActive ? "block" : "hidden"
                }`}
              />

              {!webcamActive && (
                <div className="flex flex-col items-center justify-center p-3 text-center text-slate-400">
                  {webcamError ? (
                    <>
                      <VideoOff className="h-6 w-6 text-red-400 mb-1" />
                      <span className="text-[11px] leading-tight text-red-300">
                        {webcamError}
                      </span>
                    </>
                  ) : (
                    <>
                      <Video className="h-6 w-6 animate-pulse text-indigo-400 mb-1" />
                      <span className="text-[11px]">Connecting camera…</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProctoringWrapper;
