import { Server, Socket } from 'socket.io';
import { SubmissionStatus, ViolationType } from '@prisma/client';
import prisma from '../../../../prisma/client.js';

export const MAX_WARNINGS = 3;

export const PROCTORING_EVENTS = {
  JOIN_EXAM_ROOM: 'join_exam_room',
  STUDENT_WARNING: 'student_warning',
  EXAM_TERMINATED: 'exam_terminated',
  STUDENT_STATUS_UPDATE: 'student_status_update',
  PROCTORING_ERROR: 'proctoring_error',
  TEACHER_JOIN_EXAM_ROOM: 'teacher_join_exam_room',
  TEACHER_LEAVE_EXAM_ROOM: 'teacher_leave_exam_room',
  EXAM_ROOM_JOINED: 'exam_room_joined',
} as const;

export interface JoinExamRoomPayload {
  sessionToken: string;
  examId: string;
}

export interface StudentWarningPayload {
  sessionToken?: string;
  sessionId?: string;
  examId: string;
  eventType?: ViolationType | string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TeacherJoinRoomPayload {
  examId: string;
}

export interface StudentStatusUpdatePayload {
  examId: string;
  sessionId: string;
  studentName: string;
  studentEmail: string;
  enrollmentNo: string;
  status: SubmissionStatus;
  warnings: number;
  warningsLimit: number;
  terminated: boolean;
  submitted: boolean;
  timestamp: string;
  reason?: string;
}

export interface ExamTerminatedPayload {
  examId: string;
  sessionId: string;
  reason: string;
  warnings: number;
  warningsLimit: number;
}

export type JoinExamRoomResponse =
  | { status: 'success' }
  | { status: 'error'; message: string };

export const roomName = (examId: string): string => `exam_${examId}`;

/**
 * Maps arbitrary event type strings to the Prisma ViolationType enum.
 * Camera-era event names (FACE_LOST, FULLSCREEN_EXIT, ...) are folded into the
 * closest modern ViolationType; anything unrecognized falls back to TAB_SWITCH.
 */
function mapViolationType(typeStr?: string, reason?: string): ViolationType {
  const lowerReason = reason?.toLowerCase() ?? '';
  if (!typeStr) {
    if (lowerReason.includes('face lost') || lowerReason.includes('no face')) {
      return ViolationType.AI_OVERLAY;
    }
    if (lowerReason.includes('fullscreen')) {
      return ViolationType.MINIMIZE;
    }
    if (lowerReason.includes('multiple faces')) {
      return ViolationType.SCREEN_CAPTURE;
    }
    if (lowerReason.includes('phone')) {
      return ViolationType.APP_SWITCH;
    }
    return ViolationType.TAB_SWITCH;
  }

  const upper = typeStr.toUpperCase();
  if (upper === 'FACE_LOST' || upper === 'AI_OVERLAY') return ViolationType.AI_OVERLAY;
  if (upper === 'FULLSCREEN_EXIT' || upper === 'MINIMIZE') return ViolationType.MINIMIZE;
  if (upper === 'MULTIPLE_FACES') return ViolationType.SCREEN_CAPTURE;
  if (upper === 'PHONE_DETECTED' || upper === 'APP_SWITCH') return ViolationType.APP_SWITCH;
  if (upper === 'MOBILE_BUTTON') return ViolationType.MOBILE_BUTTON;
  if (upper === 'DEVTOOLS') return ViolationType.DEVTOOLS;
  if (upper === 'KEYBOARD_SHORTCUT') return ViolationType.KEYBOARD_SHORTCUT;
  return ViolationType.TAB_SWITCH;
}

const registerStudentWarningHandler = (io: Server, socket: Socket): void => {
  socket.on(PROCTORING_EVENTS.STUDENT_WARNING, async (payload: StudentWarningPayload) => {
    try {
      const { sessionToken, sessionId, examId, reason, eventType, metadata } = payload;

      // Locate session by sessionToken or sessionId
      const session = await prisma.examSession.findFirst({
        where: {
          OR: [
            ...(sessionToken ? [{ session_token: sessionToken, exam_id: examId }] : []),
            ...(sessionId ? [{ id: sessionId, exam_id: examId }] : []),
          ],
        },
      });

      if (!session) {
        socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
          message: 'Invalid session token or session ID for this exam',
        });
        return;
      }

      if (session.status !== SubmissionStatus.IN_PROGRESS) {
        return;
      }

      // Step 2: Create Violation record in database via Prisma
      const mappedType = mapViolationType(eventType as string, reason);
      await prisma.violation.create({
        data: {
          session_id: session.id,
          type: mappedType,
          description: reason ?? 'Proctoring violation warning',
          metadata: {
            reason: reason ?? 'Proctoring violation warning',
            ...(metadata ?? {}),
          },
        },
      });

      // Warning count = total violations recorded for the session
      const warningsCount = await prisma.violation.count({
        where: { session_id: session.id },
      });

      const terminated = warningsCount >= MAX_WARNINGS;

      if (terminated) {
        await prisma.examSession.update({
          where: { id: session.id },
          data: { status: SubmissionStatus.TERMINATED, submitted_at: new Date() },
        });

        socket.emit(PROCTORING_EVENTS.EXAM_TERMINATED, {
          examId,
          sessionId: session.id,
          reason: reason ?? 'warnings_limit',
          warnings: warningsCount,
          warningsLimit: MAX_WARNINGS,
        } satisfies ExamTerminatedPayload);
      }

      // Broadcast update to teacher live monitoring room
      io.to(roomName(examId)).emit(
        PROCTORING_EVENTS.STUDENT_STATUS_UPDATE,
        {
          examId,
          sessionId: session.id,
          studentName: session.student_name,
          studentEmail: session.student_email ?? '',
          enrollmentNo: session.enrollment_number ?? '',
          status: terminated ? SubmissionStatus.TERMINATED : SubmissionStatus.IN_PROGRESS,
          warnings: warningsCount,
          warningsLimit: MAX_WARNINGS,
          terminated,
          submitted: false,
          timestamp: new Date().toISOString(),
          reason,
        } satisfies StudentStatusUpdatePayload,
      );
    } catch (err) {
      console.error('[proctoring] student_warning failed:', err);
      socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
        message: 'Failed to record proctoring warning',
      });
    }
  });
};

const registerJoinExamRoomHandler = (socket: Socket): void => {
  socket.on(
    PROCTORING_EVENTS.JOIN_EXAM_ROOM,
    async (
      payload: JoinExamRoomPayload,
      ack?: (response: JoinExamRoomResponse) => void,
    ): Promise<void> => {
      try {
        const { sessionToken, examId } = payload;

        const session = await prisma.examSession.findFirst({
          where: { session_token: sessionToken, exam_id: examId },
        });

        if (!session) {
          ack?.({ status: 'error', message: 'Invalid session token for this exam' });
          return;
        }

        if (session.status === SubmissionStatus.TERMINATED) {
          ack?.({
            status: 'error',
            message: 'Session has been terminated and cannot rejoin',
          });
          return;
        }

        await socket.join(roomName(examId));

        socket.data.sessionId = session.id;
        socket.data.examId = examId;
        socket.data.sessionToken = sessionToken;

        ack?.({ status: 'success' });
      } catch (err) {
        console.error('[proctoring] join_exam_room failed:', err);
        ack?.({ status: 'error', message: 'Failed to join exam room' });
      }
    },
  );
};

const registerTeacherRoomHandler = (socket: Socket): void => {
  socket.on(
    PROCTORING_EVENTS.TEACHER_JOIN_EXAM_ROOM,
    (payload: TeacherJoinRoomPayload) => {
      const { examId } = payload;
      if (!examId) {
        socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
          message: 'examId is required',
        });
        return;
      }
      void socket.join(roomName(examId));
      socket.emit(PROCTORING_EVENTS.EXAM_ROOM_JOINED, { examId });
    },
  );

  socket.on(
    PROCTORING_EVENTS.TEACHER_LEAVE_EXAM_ROOM,
    (payload: TeacherJoinRoomPayload) => {
      const { examId } = payload;
      if (!examId) return;
      void socket.leave(roomName(examId));
    },
  );
};

export const registerProctoringHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    registerJoinExamRoomHandler(socket);
    registerStudentWarningHandler(io, socket);
    registerTeacherRoomHandler(socket);
  });
};
