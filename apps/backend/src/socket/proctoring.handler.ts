import { Server, Socket } from 'socket.io';
import { SessionStatus, EventType } from '@prisma/client';
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
  eventType?: EventType | string;
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
  status: SessionStatus;
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

/** Maps arbitrary event type strings to Prisma EventType enum */
function mapEventType(typeStr?: string, reason?: string): EventType {
  if (!typeStr) {
    if (reason?.toLowerCase().includes("face lost") || reason?.toLowerCase().includes("no face")) {
      return EventType.FACE_LOST;
    }
    if (reason?.toLowerCase().includes("fullscreen")) {
      return EventType.FULLSCREEN_EXIT;
    }
    if (reason?.toLowerCase().includes("multiple faces")) {
      return EventType.MULTIPLE_FACES;
    }
    if (reason?.toLowerCase().includes("phone")) {
      return EventType.PHONE_DETECTED;
    }
    return EventType.TAB_SWITCH;
  }

  const upper = typeStr.toUpperCase();
  if (upper === "FACE_LOST") return EventType.FACE_LOST;
  if (upper === "FULLSCREEN_EXIT") return EventType.FULLSCREEN_EXIT;
  if (upper === "MULTIPLE_FACES") return EventType.MULTIPLE_FACES;
  if (upper === "PHONE_DETECTED") return EventType.PHONE_DETECTED;
  return EventType.TAB_SWITCH;
}

const registerStudentWarningHandler = (io: Server, socket: Socket): void => {
  socket.on(PROCTORING_EVENTS.STUDENT_WARNING, async (payload: StudentWarningPayload) => {
    try {
      const { sessionToken, sessionId, examId, reason, eventType, metadata } = payload;

      // Locate session by sessionToken or sessionId
      const session = await prisma.studentSession.findFirst({
        where: {
          OR: [
            ...(sessionToken ? [{ sessionToken, examId }] : []),
            ...(sessionId ? [{ id: sessionId, examId }] : []),
          ],
        },
      });

      if (!session) {
        socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
          message: 'Invalid session token or session ID for this exam',
        });
        return;
      }

      if (session.status !== SessionStatus.ACTIVE) {
        return;
      }

      // Step 2: Create ProctoringEvent record in database via Prisma
      const mappedType = mapEventType(eventType as string, reason);
      await prisma.proctoringEvent.create({
        data: {
          sessionId: session.id,
          eventType: mappedType,
          metadata: {
            reason: reason ?? 'Proctoring violation warning',
            ...(metadata ?? {}),
          },
        },
      });

      // Increment warningsCount
      const updated = await prisma.studentSession.update({
        where: { id: session.id },
        data: { warningsCount: { increment: 1 } },
      });

      const terminated = updated.warningsCount >= MAX_WARNINGS;

      if (terminated) {
        await prisma.studentSession.update({
          where: { id: session.id },
          data: { status: SessionStatus.TERMINATED, submittedAt: new Date() },
        });

        socket.emit(PROCTORING_EVENTS.EXAM_TERMINATED, {
          examId,
          sessionId: session.id,
          reason: reason ?? 'warnings_limit',
          warnings: updated.warningsCount,
          warningsLimit: MAX_WARNINGS,
        } satisfies ExamTerminatedPayload);
      }

      // Broadcast update to teacher live monitoring room
      io.to(roomName(examId)).emit(
        PROCTORING_EVENTS.STUDENT_STATUS_UPDATE,
        {
          examId,
          sessionId: session.id,
          studentName: session.studentName,
          studentEmail: session.studentEmail,
          enrollmentNo: session.enrollmentNo,
          status: terminated ? SessionStatus.TERMINATED : SessionStatus.ACTIVE,
          warnings: updated.warningsCount,
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

        const session = await prisma.studentSession.findFirst({
          where: { sessionToken, examId },
        });

        if (!session) {
          ack?.({ status: 'error', message: 'Invalid session token for this exam' });
          return;
        }

        if (session.status === SessionStatus.TERMINATED) {
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
