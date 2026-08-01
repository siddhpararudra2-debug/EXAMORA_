"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AlertTriangle, Grid, Grid2x2, Grid3x3, LayoutGrid, RefreshCw, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GridLayout, selectStudentList, useSupervisionStore } from "./supervisionStore";
import { StudentVideoTile } from "./StudentVideoTile";
import { useWebRTCConsumer, WebRTCConsumerOptions } from "./useWebRTCConsumer";

export interface SupervisionDashboardProps {
  examId: string;
  examTitle?: string;
  /** WebSocket signaling endpoint of the WebRTC SFU. Omit to run in mock mode. */
  sfuUrl?: string;
  /** Extra options forwarded to the WebRTC consumer hook. */
  consumerOptions?: Omit<WebRTCConsumerOptions, "examId" | "sfuUrl">;
}

const GRID_COLUMNS: Record<GridLayout, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
};

const LAYOUT_OPTIONS: Array<{ value: GridLayout; icon: typeof Grid2x2; label: string }> = [
  { value: 2, icon: Grid2x2, label: "2x2" },
  { value: 3, icon: Grid3x3, label: "3x3" },
  { value: 4, icon: Grid, label: "4x4" },
];

/**
 * Teacher live-supervision dashboard: a toggleable video grid of every
 * active student with mic activity, cheat flags and an expanded audio view.
 */
export function SupervisionDashboard({ examId, examTitle, sfuUrl, consumerOptions }: SupervisionDashboardProps) {
  const layout = useSupervisionStore((state) => state.layout);
  const setLayout = useSupervisionStore((state) => state.setLayout);
  const selectedStudentId = useSupervisionStore((state) => state.selectedStudentId);
  const selectStudent = useSupervisionStore((state) => state.selectStudent);
  const students = useSupervisionStore(useShallow(selectStudentList));

  const { connected, usingMockData, error, streams, reconnect } = useWebRTCConsumer({
    examId,
    sfuUrl,
    ...consumerOptions,
  });

  const [expandedAudioReady, setExpandedAudioReady] = useState(false);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  const flaggedCount = students.filter((student) => student.violations.length > 0).length;
  const violationCount = students.reduce((sum, student) => sum + student.violations.length, 0);
  const liveCount = students.filter((student) => student.streamStatus === "live").length;

  return (
    <div className="w-full space-y-5">
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <LayoutGrid className="h-5 w-5 text-indigo-600" />
            Live Supervision
            {examTitle && <span className="text-sm font-normal text-slate-500">— {examTitle}</span>}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant={connected ? "default" : "secondary"}
              className={usingMockData ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}
            >
              {connected ? (usingMockData ? "Demo mode" : "Connected to SFU") : "Connecting…"}
            </Badge>
            <span className="text-xs text-slate-500">
              {students.length} active · {liveCount} live feeds · {flaggedCount} flagged · {violationCount} violations
            </span>
            <Button variant="outline" size="sm" onClick={reconnect} className="h-7 gap-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Reconnect
            </Button>
          </div>
        </div>

        {/* Grid density toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {LAYOUT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = layout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLayout(option.value)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
                }`}
                aria-pressed={active}
                title={`${option.label} grid`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- SFU error banner ---------------- */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ---------------- Student grid ---------------- */}
      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-slate-500">
          <LayoutGrid className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium">Waiting for students to join…</p>
          <p className="text-xs">Student feeds will appear here as sessions start.</p>
        </div>
      ) : (
        <div className={`grid gap-3 ${GRID_COLUMNS[layout]}`}>
          {students.map((student) => (
            <StudentVideoTile
              key={student.id}
              student={student}
              stream={streams[student.id] ?? null}
              gridSize={layout}
              onSelect={selectStudent}
            />
          ))}
        </div>
      )}

      {/* ---------------- Expanded student view (modal, audio enabled) ---------------- */}
      <Dialog
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setExpandedAudioReady(false);
            selectStudent(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl bg-slate-950 text-white">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-50">
                  {selectedStudent.name}
                  <span className="font-mono text-xs font-normal text-slate-400">{selectedStudent.enrollmentNumber}</span>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-slate-400">
                  <Volume2 className="h-3.5 w-3.5" />
                  Audio enabled in this view
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${selectedStudent.micActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
                    />
                    {selectedStudent.micActive ? "Speaking" : "Silent"}
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Large video with sound */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-700">
                <StudentVideoTile student={selectedStudent} stream={streams[selectedStudent.id] ?? null} audioEnabled onSelect={() => {}} />
              </div>

              {/* Violation log */}
              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {selectedStudent.violations.length === 0 ? (
                  <p className="py-2 text-center text-xs text-slate-400">No violations recorded for this student.</p>
                ) : (
                  selectedStudent.violations
                    .slice()
                    .reverse()
                    .map((violation) => (
                      <div
                        key={violation.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                          violation.severity === "critical"
                            ? "border-red-500/40 bg-red-500/10 text-red-200"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {violation.label}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(violation.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SupervisionDashboard;
