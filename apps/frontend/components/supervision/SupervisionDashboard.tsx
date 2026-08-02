"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  Mic,
  MicOff,
  RefreshCw,
  ShieldAlert,
  Users,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GridLayout,
  selectStudentList,
  useSupervisionStore,
} from "./useSupervisionStore";
import { StudentVideoTile } from "./StudentVideoTile";

export interface SupervisionDashboardProps {
  examId?: string;
  examTitle?: string;
}

const GRID_CLASSES: Record<GridLayout, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
};

const LAYOUT_OPTIONS: Array<{
  value: GridLayout;
  icon: typeof Grid2x2;
  label: string;
}> = [
  { value: 2, icon: Grid2x2, label: "2x2" },
  { value: 3, icon: Grid3x3, label: "3x3" },
  { value: 4, icon: LayoutGrid, label: "4x4" },
];

/**
 * Examora Teacher Supervision Dashboard
 * Displays a live, responsive video supervision grid (toggleable 2x2, 3x3, 4x4)
 * for proctoring active student exam sessions and real-time cheat flags.
 */
export function SupervisionDashboard({
  examId,
  examTitle = "Live Exam Proctoring Session",
}: SupervisionDashboardProps) {
  // Zustand store selectors
  const layout = useSupervisionStore((state) => state.layout);
  const setLayout = useSupervisionStore((state) => state.setLayout);
  const selectedStudentId = useSupervisionStore((state) => state.selectedStudentId);
  const selectStudent = useSupervisionStore((state) => state.selectStudent);
  const fetchActiveSessions = useSupervisionStore((state) => state.fetchActiveSessions);
  const isLoading = useSupervisionStore((state) => state.isLoading);
  const connected = useSupervisionStore((state) => state.connected);
  const usingMockData = useSupervisionStore((state) => state.usingMockData);

  const students = useSupervisionStore(useShallow(selectStudentList));

  // Requirement 1: Fetch active sessions on mount
  useEffect(() => {
    fetchActiveSessions(examId);
  }, [examId, fetchActiveSessions]);

  // Selected student object for expanded modal view
  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  // Top-level stats calculation
  const totalStudents = students.length;
  const liveCount = students.filter((s) => s.streamStatus === "live").length;
  const flaggedStudentsCount = students.filter((s) => s.violations.length > 0).length;
  const totalViolationsCount = students.reduce(
    (sum, s) => sum + s.violations.length,
    0
  );

  return (
    <div className="w-full space-y-6">
      {/* ---------------- Header Controls & Metrics Bar ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 text-white shadow-2xl backdrop-blur-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 shadow-md">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Teacher Supervision Dashboard
                {examTitle && (
                  <span className="text-xs font-medium text-slate-400">
                    — {examTitle}
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <Badge
              variant="outline"
              className={
                usingMockData
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              }
            >
              {usingMockData ? "Demo Mode" : "SFU Active"}
            </Badge>

            <span className="flex items-center gap-1.5 font-medium">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              {totalStudents} Active Students
            </span>
            <span className="text-slate-600">•</span>

            <span className="flex items-center gap-1 font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {liveCount} Live Streams
            </span>
            <span className="text-slate-600">•</span>

            <span className="flex items-center gap-1 font-bold text-red-400">
              <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
              {flaggedStudentsCount} Flagged ({totalViolationsCount} Violations)
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchActiveSessions(examId)}
              disabled={isLoading}
              className="h-7 gap-1.5 border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoading ? "animate-spin text-indigo-400" : ""}`}
              />
              Refresh Feeds
            </Button>
          </div>
        </div>

        {/* ---------------- REQUIREMENT 1: TOGGLEABLE GRID LAYOUT (2x2, 3x3, 4x4) ---------------- */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-inner">
          <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Grid View:
          </span>
          {LAYOUT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = layout === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLayout(option.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
                aria-pressed={isSelected}
                title={`Switch to ${option.label} grid density`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- Student Video Grid ---------------- */}
      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/60 py-28 text-center text-slate-400 backdrop-blur">
          <LayoutGrid className="h-10 w-10 text-slate-600 animate-pulse" />
          <h3 className="text-base font-semibold text-slate-200">
            No Active Student Sessions Found
          </h3>
          <p className="max-w-md text-xs text-slate-400">
            Students joining this exam will automatically appear in the live video grid.
          </p>
          <Button
            onClick={() => fetchActiveSessions(examId)}
            className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold"
          >
            Retry Active Sessions Fetch
          </Button>
        </div>
      ) : (
        <div className={`grid gap-4 ${GRID_CLASSES[layout]}`}>
          {students.map((student) => (
            <StudentVideoTile
              key={student.id}
              student={student}
              gridSize={layout}
              onSelect={selectStudent}
            />
          ))}
        </div>
      )}

      {/* ---------------- REQUIREMENT 2: EXPANDED STUDENT MODAL VIEW ---------------- */}
      <Dialog
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) selectStudent(null);
        }}
      >
        <DialogContent className="max-w-4xl border-slate-800 bg-slate-950 text-white shadow-2xl">
          {selectedStudent && (
            <>
              <DialogHeader className="border-b border-slate-800 pb-4">
                <DialogTitle className="flex items-center justify-between gap-4 text-xl font-bold text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-black text-white text-base">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <div>
                      <span>{selectedStudent.name}</span>
                      <p className="font-mono text-xs font-semibold text-indigo-400 mt-0.5">
                        Enrollment: {selectedStudent.enrollmentNumber}
                      </p>
                    </div>
                  </div>

                  {selectedStudent.violations.length > 0 && (
                    <Badge className="bg-red-600 text-white border-red-400 px-3 py-1 text-xs font-black animate-pulse">
                      🚨 {selectedStudent.violations.length} CHEAT FLAGS
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    Live Audio Feed Enabled
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        selectedStudent.micActive
                          ? "bg-emerald-400 animate-ping"
                          : "bg-red-500"
                      }`}
                    />
                    Microphone: {selectedStudent.micActive ? "Speaking" : "Silent"}
                  </span>
                  <span>•</span>
                  <span>Joined: {new Date(selectedStudent.joinedAt).toLocaleTimeString()}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {/* Expanded Video Tile */}
                <div className="md:col-span-2 relative aspect-video overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-900 shadow-2xl">
                  <StudentVideoTile
                    student={selectedStudent}
                    audioEnabled={true}
                    onSelect={() => {}}
                  />
                </div>

                {/* Violation Audit Log */}
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                  <h4 className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-red-400" />
                      Proctor Audit Log
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      {selectedStudent.violations.length} Events
                    </span>
                  </h4>

                  <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                    {selectedStudent.violations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mb-2" />
                        <p className="text-xs font-medium text-slate-300">Clean Exam Record</p>
                        <p className="text-[10px] text-slate-500">No cheating violations detected.</p>
                      </div>
                    ) : (
                      selectedStudent.violations.map((violation) => (
                        <div
                          key={violation.id}
                          className={`rounded-xl border p-3 text-xs transition-all ${
                            violation.severity === "critical"
                              ? "border-red-500/60 bg-red-950/40 text-red-200"
                              : "border-amber-500/60 bg-amber-950/40 text-amber-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-bold mb-1">
                            <span className="flex items-center gap-1.5 uppercase text-[11px] tracking-wide">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              {violation.type}
                            </span>
                            <span className="font-mono text-[10px] opacity-75">
                              {new Date(violation.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium leading-relaxed opacity-90">
                            {violation.label}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SupervisionDashboard;
