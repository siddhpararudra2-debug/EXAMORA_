"use client";

import { create } from "zustand";

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
  /** Unique id (exam session id or student enrollment id) */
  id: string;
  name: string;
  enrollmentNumber: string;
  email?: string;
  streamStatus: StreamStatus;
  hasVideo: boolean;
  hasAudio: boolean;
  /** True while the student's microphone is actively picking up speech */
  micActive: boolean;
  violations: StudentViolation[];
  joinedAt: string;
}

export interface SupervisionState {
  students: Record<string, SupervisedStudent>;
  layout: GridLayout;
  selectedStudentId: string | null;
  isLoading: boolean;
  error: string | null;
  connected: boolean;
  usingMockData: boolean;

  // Store actions
  setLayout: (layout: GridLayout) => void;
  selectStudent: (studentId: string | null) => void;
  setStudents: (studentsList: SupervisedStudent[]) => void;
  upsertStudent: (student: SupervisedStudent) => void;
  removeStudent: (studentId: string) => void;
  setStreamStatus: (
    studentId: string,
    status: StreamStatus,
    hasVideo?: boolean,
    hasAudio?: boolean
  ) => void;
  setMicActive: (studentId: string, active: boolean) => void;
  addViolation: (
    studentId: string,
    violation: Omit<StudentViolation, "id" | "timestamp"> & {
      id?: string;
      timestamp?: string;
    }
  ) => void;
  fetchActiveSessions: (examId?: string) => Promise<void>;
  setConnected: (connected: boolean, usingMockData?: boolean) => void;
  reset: () => void;
}

/** Mock fallback dataset for demo and testing mode */
const MOCK_SUPERVISED_STUDENTS: SupervisedStudent[] = [
  {
    id: "mock-std-101",
    name: "Aarav Sharma",
    enrollmentNumber: "EN2024-8841",
    email: "aarav.sharma@examora.edu",
    streamStatus: "live",
    hasVideo: true,
    hasAudio: true,
    micActive: true,
    joinedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    violations: [
      {
        id: "v-1",
        type: "AI_OVERLAY",
        label: "Gemini AI floating overlay detected",
        severity: "critical",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "mock-std-102",
    name: "Priya Patel",
    enrollmentNumber: "EN2024-9120",
    email: "priya.patel@examora.edu",
    streamStatus: "live",
    hasVideo: true,
    hasAudio: true,
    micActive: false,
    joinedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    violations: [],
  },
  {
    id: "mock-std-103",
    name: "Rohan Mehta",
    enrollmentNumber: "EN2024-7734",
    email: "rohan.mehta@examora.edu",
    streamStatus: "live",
    hasVideo: true,
    hasAudio: true,
    micActive: false,
    joinedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    violations: [
      {
        id: "v-2",
        type: "TAB_SWITCH",
        label: "Tab or window focus lost",
        severity: "warning",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: "v-3",
        type: "DEVTOOLS",
        label: "F12 Developer Tools opened",
        severity: "critical",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "mock-std-104",
    name: "Ananya Iyer",
    enrollmentNumber: "EN2024-6512",
    email: "ananya.iyer@examora.edu",
    streamStatus: "live",
    hasVideo: true,
    hasAudio: true,
    micActive: true,
    joinedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    violations: [],
  },
  {
    id: "mock-std-105",
    name: "Kabir Verma",
    enrollmentNumber: "EN2024-3390",
    email: "kabir.verma@examora.edu",
    streamStatus: "connecting",
    hasVideo: false,
    hasAudio: true,
    micActive: false,
    joinedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    violations: [],
  },
  {
    id: "mock-std-106",
    name: "Sneha Reddy",
    enrollmentNumber: "EN2024-4419",
    email: "sneha.reddy@examora.edu",
    streamStatus: "live",
    hasVideo: true,
    hasAudio: true,
    micActive: false,
    joinedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    violations: [
      {
        id: "v-4",
        type: "BLOCKED_INPUT",
        label: "Blocked shortcut Ctrl+C (Copy)",
        severity: "warning",
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export const useSupervisionStore = create<SupervisionState>()((set, get) => ({
  students: {},
  layout: 3,
  selectedStudentId: null,
  isLoading: false,
  error: null,
  connected: false,
  usingMockData: false,

  setLayout: (layout) => set({ layout }),

  selectStudent: (selectedStudentId) => set({ selectedStudentId }),

  setStudents: (studentsList) => {
    const studentMap: Record<string, SupervisedStudent> = {};
    studentsList.forEach((s) => {
      studentMap[s.id] = s;
    });
    set({ students: studentMap });
  },

  upsertStudent: (student) =>
    set((state) => {
      const existing = state.students[student.id];
      return {
        students: {
          ...state.students,
          [student.id]: existing
            ? { ...existing, ...student, violations: student.violations || existing.violations }
            : student,
        },
      };
    }),

  removeStudent: (studentId) =>
    set((state) => {
      const updated = { ...state.students };
      delete updated[studentId];
      return {
        students: updated,
        selectedStudentId: state.selectedStudentId === studentId ? null : state.selectedStudentId,
      };
    }),

  setStreamStatus: (studentId, status, hasVideo, hasAudio) =>
    set((state) => {
      const student = state.students[studentId];
      if (!student) return state;
      return {
        students: {
          ...state.students,
          [studentId]: {
            ...student,
            streamStatus: status,
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
      return {
        students: {
          ...state.students,
          [studentId]: { ...student, micActive },
        },
      };
    }),

  addViolation: (studentId, violation) =>
    set((state) => {
      const student = state.students[studentId];
      if (!student) return state;
      const newViolation: StudentViolation = {
        id: violation.id || `v-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: violation.type,
        label: violation.label,
        severity: violation.severity,
        timestamp: violation.timestamp || new Date().toISOString(),
      };

      return {
        students: {
          ...state.students,
          [studentId]: {
            ...student,
            violations: [newViolation, ...student.violations],
          },
        },
      };
    }),

  /**
   * Fetches active sessions and violation details from the backend.
   * Fallback to mock data if endpoint is unavailable.
   */
  fetchActiveSessions: async (examId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const targetEndpoint = examId
        ? `/api/v1/supervision/active-sessions?examId=${encodeURIComponent(examId)}`
        : `/api/v1/exam-session/active`;

      const response = await fetch(targetEndpoint, {
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch active sessions`);
      }

      const data = await response.json();
      const sessions = Array.isArray(data) ? data : data.sessions || [];

      if (sessions.length > 0) {
        const fetchedStudents: SupervisedStudent[] = sessions.map((item: any) => ({
          id: item.id || item.sessionId || item.studentId,
          name: item.studentName || item.name || "Student",
          enrollmentNumber: item.enrollmentNumber || item.studentId || "N/A",
          email: item.email,
          streamStatus: item.streamStatus || "live",
          hasVideo: item.hasVideo ?? true,
          hasAudio: item.hasAudio ?? true,
          micActive: item.micActive ?? false,
          joinedAt: item.joinedAt || new Date().toISOString(),
          violations: (item.violations || []).map((v: any) => ({
            id: v.id || `v-${Math.random()}`,
            type: v.violationType || v.type || "VIOLATION",
            label: v.details || v.label || "Proctoring Warning",
            severity: v.severity || (v.violationType === "AI_OVERLAY" ? "critical" : "warning"),
            timestamp: v.createdAt || v.timestamp || new Date().toISOString(),
          })),
        }));

        get().setStudents(fetchedStudents);
        set({ isLoading: false, connected: true, usingMockData: false });
        return;
      }
    } catch (err: any) {
      console.warn("[useSupervisionStore] Server fetch active sessions notice:", err.message);
    }

    // Fallback to mock data when backend endpoint is not active or empty
    const mockMap: Record<string, SupervisedStudent> = {};
    MOCK_SUPERVISED_STUDENTS.forEach((s) => {
      mockMap[s.id] = s;
    });
    set({
      students: mockMap,
      isLoading: false,
      connected: true,
      usingMockData: true,
    });
  },

  setConnected: (connected, usingMockData = false) => set({ connected, usingMockData }),

  reset: () =>
    set({
      students: {},
      selectedStudentId: null,
      isLoading: false,
      error: null,
      connected: false,
      usingMockData: false,
    }),
}));

/** Convenience selector: returns sorted student array */
export const selectStudentList = (state: SupervisionState): SupervisedStudent[] =>
  Object.values(state.students).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

export default useSupervisionStore;
