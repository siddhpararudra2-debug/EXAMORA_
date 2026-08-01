"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  EyeOff,
  Maximize2,
  Users,
  Smartphone,
  Clock,
  Info,
} from "lucide-react";

export type ProctoringEventType =
  | "TAB_SWITCH"
  | "FACE_LOST"
  | "FULLSCREEN_EXIT"
  | "MULTIPLE_FACES"
  | "PHONE_DETECTED"
  | string;

export interface ProctoringEvent {
  id: string;
  type: ProctoringEventType;
  timestamp: string; // ISO date string
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProctoringTimelineProps {
  events: ProctoringEvent[];
  examDurationMinutes: number;
  examStartTime: string;
  className?: string;
}

/** Returns styling metadata for a given event type */
export function getEventConfig(type: string) {
  switch (type) {
    case "TAB_SWITCH":
      return {
        label: "Tab Switch",
        dotColor: "bg-amber-400 border-amber-600 ring-amber-200",
        badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
        icon: AlertTriangle,
        textColor: "text-amber-700",
      };
    case "FACE_LOST":
      return {
        label: "Face Lost",
        dotColor: "bg-orange-500 border-orange-700 ring-orange-200",
        badgeBg: "bg-orange-50 text-orange-800 border-orange-200",
        icon: EyeOff,
        textColor: "text-orange-700",
      };
    case "FULLSCREEN_EXIT":
      return {
        label: "Fullscreen Exit",
        dotColor: "bg-red-600 border-red-800 ring-red-200",
        badgeBg: "bg-red-50 text-red-800 border-red-200",
        icon: Maximize2,
        textColor: "text-red-700",
      };
    case "MULTIPLE_FACES":
      return {
        label: "Multiple Faces Detected",
        dotColor: "bg-purple-600 border-purple-800 ring-purple-200",
        badgeBg: "bg-purple-50 text-purple-800 border-purple-200",
        icon: Users,
        textColor: "text-purple-700",
      };
    case "PHONE_DETECTED":
      return {
        label: "Phone Detected",
        dotColor: "bg-purple-600 border-purple-800 ring-purple-200",
        badgeBg: "bg-purple-50 text-purple-800 border-purple-200",
        icon: Smartphone,
        textColor: "text-purple-700",
      };
    default:
      return {
        label: type.replace(/_/g, " "),
        dotColor: "bg-slate-500 border-slate-700 ring-slate-200",
        badgeBg: "bg-slate-100 text-slate-800 border-slate-200",
        icon: Info,
        textColor: "text-slate-700",
      };
  }
}

/** Formats milliseconds into HH:MM:SS offset display */
export function formatTimeOffset(diffMs: number): string {
  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ProctoringTimeline({
  events = [],
  examDurationMinutes = 60,
  examStartTime,
  className = "",
}: ProctoringTimelineProps) {
  const [hoveredEvent, setHoveredEvent] = useState<{
    event: ProctoringEvent;
    offsetStr: string;
    percentage: number;
  } | null>(null);

  const startTimeMs = new Date(examStartTime).getTime();
  const totalDurationMs = Math.max(1, examDurationMinutes * 60 * 1000);

  return (
    <div className={`w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            Proctoring Event Timeline
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Hover over markers to inspect timestamped proctoring violations.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-amber-600" /> Tab Switch
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 border border-orange-700" /> Face Lost
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 border border-red-800" /> Fullscreen Exit
          </span>
          <span className="flex items-center gap-1.5 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-600 border border-purple-800" /> Multiple Faces / Phone
          </span>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative my-8 px-2">
        {/* Horizontal Line */}
        <div className="h-3 w-full rounded-full bg-slate-100 border border-slate-200 relative overflow-hidden">
          <div className="h-full bg-indigo-50/50 w-full" />
        </div>

        {/* Start / End Labels */}
        <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-400 mt-2">
          <span>00:00:00 (Start)</span>
          <span>{formatTimeOffset(totalDurationMs)} ({examDurationMinutes}m)</span>
        </div>

        {/* Timeline Event Dots */}
        {events.map((evt) => {
          const eventTimeMs = new Date(evt.timestamp).getTime();
          const diffMs = eventTimeMs - startTimeMs;
          const percentage = Math.max(0, Math.min(100, (diffMs / totalDurationMs) * 100));
          const config = getEventConfig(evt.type);
          const offsetStr = formatTimeOffset(diffMs);

          return (
            <div
              key={evt.id}
              style={{ left: `${percentage}%` }}
              className="absolute top-1.5 -translate-x-1/2 -translate-y-1/2 group z-20 cursor-pointer"
              onMouseEnter={() => setHoveredEvent({ event: evt, offsetStr, percentage })}
              onMouseLeave={() => setHoveredEvent(null)}
            >
              {/* Pulsing Ring & Dot */}
              <span className={`relative flex h-4 w-4 items-center justify-center`}>
                <span className={`absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-40 animate-ping`} />
                <span className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 ${config.dotColor} shadow-md transition-transform group-hover:scale-125`} />
              </span>
            </div>
          );
        })}

        {/* Hover Tooltip Card */}
        {hoveredEvent && (
          <div
            style={{
              left: `${Math.max(10, Math.min(90, hoveredEvent.percentage))}%`,
            }}
            className="absolute bottom-8 -translate-x-1/2 z-30 w-64 rounded-xl border border-slate-200 bg-slate-900 text-white p-3 shadow-xl backdrop-blur animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
              <span className="font-mono text-xs text-amber-300 font-semibold">
                ⏱ {hoveredEvent.offsetStr}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getEventConfig(hoveredEvent.event.type).badgeBg}`}>
                {getEventConfig(hoveredEvent.event.type).label}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {hoveredEvent.event.description || "Proctoring violation recorded."}
            </p>
            {hoveredEvent.event.metadata && (
              <div className="mt-2 text-[10px] font-mono text-slate-400 bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                {JSON.stringify(hoveredEvent.event.metadata)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
        <span>Total Logged Incidents: <strong className="text-slate-800">{events.length}</strong></span>
        <span>Duration: <strong className="text-slate-800">{examDurationMinutes} Minutes</strong></span>
      </div>
    </div>
  );
}

export default ProctoringTimeline;
