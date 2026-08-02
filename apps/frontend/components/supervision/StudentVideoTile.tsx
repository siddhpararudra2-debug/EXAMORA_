"use client";

import React, { useEffect, useRef } from "react";
import { AlertOctagon, Flag, Mic, MicOff, UserRound, VideoOff } from "lucide-react";
import { GridLayout, SupervisedStudent } from "./useSupervisionStore";

export interface StudentVideoTileProps {
  student: SupervisedStudent;
  /** Optional videoRef passed from parent for WebRTC stream consumption */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Live MediaStream for this student if WebRTC stream is active */
  stream?: MediaStream | null;
  /** Current grid layout density (2x2, 3x3, 4x4) */
  gridSize?: GridLayout;
  /** Whether audio playback is enabled (used in expanded modal view) */
  audioEnabled?: boolean;
  /** Callback triggered when student tile is clicked */
  onSelect?: (studentId: string) => void;
}

/**
 * Student Video Tile Component for Examora Teacher Supervision Dashboard.
 * Displays student video (or canvas mock animation), mic status indicator,
 * and prominent cheat flag alerts when violations occur.
 */
export function StudentVideoTile({
  student,
  videoRef: externalVideoRef,
  stream,
  gridSize = 3,
  audioEnabled = false,
  onSelect,
}: StudentVideoTileProps) {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeVideoRef = externalVideoRef || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hasLiveVideo = Boolean(stream) && student.hasVideo;

  // Attach / detach MediaStream to the video element
  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    if (stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream, activeVideoRef]);

  // Requirement 2: Canvas Mock Video Animation when live video is not active
  useEffect(() => {
    if (hasLiveVideo) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const renderMockFrame = () => {
      step += 0.04;
      const width = (canvas.width = canvas.clientWidth || 320);
      const height = (canvas.height = canvas.clientHeight || 180);

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#090d16");
      bgGrad.addColorStop(0.5, "#0f172a");
      bgGrad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle tech grid lines
      ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
      ctx.lineWidth = 1;
      const gridSizePx = 20;
      for (let x = 0; x < width; x += gridSizePx) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSizePx) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Animated scan line
      const scanY = (Math.sin(step * 0.8) * 0.5 + 0.5) * height;
      ctx.strokeStyle = "rgba(129, 140, 248, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.stroke();

      // Student silhouette avatar in center
      const centerX = width / 2;
      const centerY = height / 2 - 5;
      const headRadius = Math.min(width, height) * 0.14;

      // Head glow circle
      ctx.fillStyle = "rgba(79, 70, 229, 0.4)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, headRadius + 4, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = "#6366f1";
      ctx.beginPath();
      ctx.arc(centerX, centerY, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // Body shoulders
      ctx.fillStyle = "#4338ca";
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + headRadius * 2.1, headRadius * 1.8, headRadius * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // HUD view finder corners
      const margin = 12;
      const cornerLen = 14;
      ctx.strokeStyle = "rgba(244, 63, 94, 0.4)";
      ctx.lineWidth = 2;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(margin, margin + cornerLen);
      ctx.lineTo(margin, margin);
      ctx.lineTo(margin + cornerLen, margin);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(width - margin - cornerLen, margin);
      ctx.lineTo(width - margin, margin);
      ctx.lineTo(width - margin, margin + cornerLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(margin, height - margin - cornerLen);
      ctx.lineTo(margin, height - margin);
      ctx.lineTo(margin + cornerLen, height - margin);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(width - margin - cornerLen, height - margin);
      ctx.lineTo(width - margin, height - margin);
      ctx.lineTo(width - margin, height - margin - cornerLen);
      ctx.stroke();

      // Simulated mic audio spectrum equalizer bar at bottom
      if (student.micActive) {
        const barCount = 7;
        const barWidth = 4;
        const barGap = 3;
        const totalBarWidth = barCount * (barWidth + barGap);
        const startX = width / 2 - totalBarWidth / 2;

        ctx.fillStyle = "#10b981";
        for (let b = 0; b < barCount; b++) {
          const barHeight = Math.abs(Math.sin(step * 4 + b * 0.8)) * 14 + 4;
          ctx.fillRect(
            startX + b * (barWidth + barGap),
            height - margin - barHeight,
            barWidth,
            barHeight
          );
        }
      }

      animationFrameId = requestAnimationFrame(renderMockFrame);
    };

    renderMockFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hasLiveVideo, student.micActive]);

  const latestViolation = student.violations.length > 0 ? student.violations[0] : null;
  const hasCheatFlags = student.violations.length > 0;
  const isCompact = gridSize === 4;

  const initials = student.name
    ? student.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "ST";

  return (
    <div
      onClick={() => onSelect?.(student.id)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(student.id);
        }
      }}
      className={`group relative w-full overflow-hidden rounded-2xl border bg-slate-950 text-left shadow-lg transition-all cursor-pointer hover:z-10 hover:shadow-2xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        hasCheatFlags
          ? "border-red-500/80 ring-2 ring-red-500/50 shadow-red-950/40"
          : "border-slate-800 hover:border-indigo-500/80"
      } ${isCompact ? "aspect-[4/3]" : "aspect-video"}`}
      aria-label={`Supervise student ${student.name}`}
    >
      {/* ---------------- Video or Animated Canvas Placeholder ---------------- */}
      {hasLiveVideo && stream ? (
        <video
          ref={activeVideoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          playsInline
          muted={!audioEnabled}
          className="h-full w-full object-cover"
        />
      ) : (
        <canvas ref={canvasRef} className="h-full w-full object-cover block" />
      )}

      {/* ---------------- Top Bar: Student Name & Enrollment Number ---------------- */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white drop-shadow-md">
            {student.name}
          </p>
          <p className="truncate font-mono text-[10px] font-medium text-slate-300">
            {student.enrollmentNumber}
          </p>
        </div>

        {/* ---------------- Requirement 2: Mic Activity Dot ---------------- */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-md backdrop-blur-md transition-colors ${
            student.micActive
              ? "bg-emerald-500 text-white animate-pulse ring-2 ring-emerald-400/50"
              : "bg-slate-900/80 text-red-400 border border-red-500/40"
          }`}
          title={student.micActive ? "Microphone active (speaking)" : "Microphone muted"}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              student.micActive ? "bg-white animate-ping" : "bg-red-500"
            }`}
          />
          {student.micActive ? (
            <Mic className="h-3 w-3 text-white" />
          ) : (
            <MicOff className="h-3 w-3 text-red-400" />
          )}
          {!isCompact && (
            <span>{student.micActive ? "MIC LIVE" : "MIC MUTED"}</span>
          )}
        </div>
      </div>

      {/* ---------------- REQUIREMENT 2: PROMINENT CHEAT FLAG BADGE ---------------- */}
      {hasCheatFlags && (
        <div className="absolute top-12 left-2 right-2 z-20 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 rounded-lg bg-red-600/95 border border-red-400 text-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide shadow-xl backdrop-blur animate-bounce">
            <AlertOctagon className="h-4 w-4 text-amber-300 shrink-0" />
            <span className="truncate">
              🚨 CHEAT FLAG: {latestViolation?.type || "SUSPICIOUS_BEHAVIOR"}
            </span>
          </div>
        </div>
      )}

      {/* ---------------- Bottom Bar: Stream Status & Total Violations ---------------- */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5">
        {/* Stream Status Indicator */}
        <div className="flex items-center gap-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 px-2 py-0.5 backdrop-blur-md">
          <span
            className={`h-2 w-2 rounded-full ${
              student.streamStatus === "live"
                ? "bg-emerald-400"
                : student.streamStatus === "connecting"
                ? "bg-amber-400 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="text-[10px] font-semibold uppercase text-slate-200">
            {student.streamStatus}
          </span>
        </div>

        {/* Total Violation Count Badge */}
        {hasCheatFlags && (
          <span className="flex items-center gap-1 rounded-full bg-red-950/90 border border-red-500/80 px-2 py-0.5 text-[10px] font-black text-red-200 backdrop-blur-md">
            <Flag className="h-3 w-3 text-red-400" />
            {student.violations.length} {student.violations.length === 1 ? "Flag" : "Flags"}
          </span>
        )}
      </div>

      {/* ---------------- Hover affordance ---------------- */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-indigo-950/40 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-[2px]">
        <span className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-xl transform scale-95 transition-transform group-hover:scale-100">
          Click to Expand & Listen
        </span>
      </div>
    </div>
  );
}

export default StudentVideoTile;
