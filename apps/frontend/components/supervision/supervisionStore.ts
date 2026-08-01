"use client";

import { create } from "zustand";

/**
 * Zustand store for the teacher supervision dashboard.
 * Holds the active student list, per-student stream status, mic activity,
 * flagged violations, the toggleable grid layout and the currently
 * selected (expanded) student.
 */

export type GridLayout = 2 | 3 | 4;

export type StreamStatus = "connecting" | "live" | "offline";

export type ViolationSeverity = "warning" | "critical";

export interface StudentViolation {
  id: string;
  type: string;
  label: string;
  severity: ViolationSeverity;
  timestamp: string;
}

export interface SupervisedStudent {
  /** Unique id (exam session id / student id from the SFU). */
  id: string;
  name: string;
  enrollmentNumber: string;
  email?: string;
  streamStatus: StreamStatus;
  hasVideo: boolean;
  hasAudio: boolean;
  /** True while the student is currently speaking (volume above threshold). */
  micActive: boolean;
  violations: StudentViolation[];
  joinedAt: string;
}

export interface SupervisionState {
  students: Record<string, SupervisedStudent>;
  layout: GridLayout;
  selectedStudentId: string | null;
  connected: boolean;
  usingMockData: boolean;

  setLayout: (layout: GridLayout) => void;
  selectStudent: (studentId: string | null) => void;
  upsertStudent: (student: SupervisedStudent) => void;
  removeStudent: (studentId: string) => void;
  setStreamStatus: (studentId: string, status: StreamStatus, hasVideo?: boolean, hasAudio?: boolean) => void;
  setMicActive: (studentId: string, active: boolean) => void;
  addViolation: (studentId: string, violation: Omit<StudentViolation, "id" | "timestamp">) => void;
  setConnected: (connected: boolean, usingMockData: boolean) => void;
  reset: () => void;
}

const initialStudents: Record<string, SupervisedStudent> = {};

export const useSupervisionStore = create<SupervisionState>()((set) => ({
  students: initialStudents,
  layout: 3,
  selectedStudentId: null,
  connected: false,
  usingMockData: false,

  setLayout: (layout) => set({ layout }),

  selectStudent: (selectedStudentId) => set({ selectedStudentId }),

  upsertStudent: (student) =>
    set((state) => {
      const existing = state.students[student.id];
      return {
        students: {
          ...state.students,
          [student.id]: existing ? { ...existing, ...student, violations: existing.violations } : student,
        },
      };
    }),

  removeStudent: (studentId) =>
    set((state) => {
      const students = { ...state.students };
      delete students[studentId];
      return {
        students,
        selectedStudentId: state.selectedStudentId === studentId ? null : state.selectedStudentId,
      };
    }),

  setStreamStatus: (studentId, streamStatus, hasVideo, hasAudio) =>
    set((state) => {
      const student = state.students[studentId];
      if (!student) return state;
      return {
        students: {
          ...state.students,
          [studentId]: {
            ...student,
            streamStatus,
            hasVideo: hasVideo ?? student.hasVideo,
            hasAudio: hasAudio ?? student.hasAudio,
          },
        },
      };
    }),

  setMicActive: (studentId, micActive) =>
    set((state) => {
      const student = state.students[studentId];
      if (!student) return state;
      return { students: { ...state.students, [studentId]: { ...student, micActive } } };
    }),

  addViolation: (studentId, violation) =>
    set((state) => {
      const student = state.students[studentId];
      if (!student) return state;
      return {
        students: {
          ...state.students,
          [studentId]: {
            ...student,
            violations: [
              ...student.violations,
              { ...violation, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toISOString() },
            ],
          },
        },
      };
    }),

  setConnected: (connected, usingMockData) => set({ connected, usingMockData }),

  reset: () =>
    set({
      students: {},
      selectedStudentId: null,
      connected: false,
      usingMockData: false,
    }),
}));

/** Convenience selector: active students as a stable array (by join time). */
export const selectStudentList = (state: SupervisionState): SupervisedStudent[] =>
  Object.values(state.students).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
