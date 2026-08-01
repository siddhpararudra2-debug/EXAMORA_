"use client";

import { useEffect, useRef } from "react";
import { Flag, Mic, MicOff, UserRound, VideoOff } from "lucide-react";
import { GridLayout, SupervisedStudent } from "./supervisionStore";

export interface StudentVideoTileProps {
  student: SupervisedStudent;
  /** Live MediaStream for this student (undefined in mock-less offline states). */
  stream?: MediaStream | null;
  /** Current grid density — tiles keep a fixed aspect ratio in every layout. */
  gridSize?: GridLayout;
  /** Whether audio should be audible on this tile (only in the expanded modal). */
  audioEnabled?: boolean;
  /** Fired when the tile is clicked. */
  onSelect?: (studentId: string) => void;
}

/**
 * One student cell in the supervision grid: live video (or placeholder),
 * student identity, mic activity dot and red cheat-flag badges.
 */
export function StudentVideoTile({ student, stream, gridSize = 3, audioEnabled = false, onSelect }: StudentVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach / detach the MediaStream to the <video> element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const initials = student.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasLiveVideo = Boolean(stream) && student.hasVideo;
  const criticalFlags = student.violations.filter((violation) => violation.severity === "critical");
  const totalFlags = student.violations.length;
  const compact = gridSize === 4;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(student.id)}
      className={`group relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-left shadow-sm transition-all hover:z-10 hover:shadow-xl hover:ring-2 hover:ring-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${compact ? "aspect-[4/3]" : "aspect-video"}`}
      aria-label={`Expand view for ${student.name}`}
    >
      {/* ---------- Video layer ---------- */}
      {hasLiveVideo && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!audioEnabled}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/80 text-lg font-bold text-white">
            {initials}
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <VideoOff className="h-3 w-3" />
            {student.streamStatus === "connecting" ? "Connecting…" : "No video feed"}
          </span>
        </div>
      )}

      {/* ---------- Identity overlay (top-left) ---------- */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white drop-shadow">{student.name}</p>
          <p className="truncate font-mono text-[10px] text-slate-300">{student.enrollmentNumber}</p>
        </div>
      </div>

      {/* ---------- Mic indicator (top-right) ---------- */}
      <div
        className={`absolute right-2 top-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow backdrop-blur ${
          student.micActive
            ? "bg-emerald-500/90 text-white animate-pulse"
            : student.hasAudio
              ? "bg-slate-800/80 text-slate-300"
              : "bg-slate-800/80 text-slate-500"
        }`}
        title={student.micActive ? "Microphone active" : "Microphone muted / no audio"}
      >
        {student.micActive ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
        {!compact && <span>{student.micActive ? "LIVE" : "MUTED"}</span>}
      </div>

      {/* ---------- Stream status dot (bottom-left) ---------- */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            student.streamStatus === "live"
              ? "bg-emerald-400"
              : student.streamStatus === "connecting"
                ? "bg-amber-400 animate-pulse"
                : "bg-red-500"
          }`}
        />
        <span className="text-[10px] font-medium text-slate-200 drop-shadow">{student.streamStatus}</span>
      </div>

      {/* ---------- Cheat flags (bottom-right) ---------- */}
      {totalFlags > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {criticalFlags.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
              <Flag className="h-3 w-3" />
              {criticalFlags.length}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            <Flag className="h-3 w-3" />
            {totalFlags}
          </span>
        </div>
      )}

      {/* ---------- Hover affordance ---------- */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
        <span className="mb-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-800 shadow">
          Click to expand
        </span>
      </div>

      {/* ---------- Mock badge ---------- */}
      {student.id.startsWith("mock-") && (
        <span className="absolute left-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
          Demo
        </span>
      )}

      {/* Fallback avatar icon for empty names */}
      {!student.name && <UserRound className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-slate-600" />}
    </button>
  );
}

export default StudentVideoTile;
