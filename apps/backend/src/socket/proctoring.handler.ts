import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SubmissionStatus } from '@prisma/client';
import prisma from '../../../../prisma/client.js';
import { JWT_SECRET } from '../../../../server/config.js';

export const MAX_WARNINGS = 3;

export const PROCTORING_EVENTS = {
  JOIN_EXAM_ROOM: 'join_exam_room',
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
export const sessionRoomName = (sessionId: string): string => `session_${sessionId}`;

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
        await socket.join(sessionRoomName(session.id));

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

/**
 * Verifies the teacher JWT from the socket handshake (`auth.token`) and
 * resolves the teacher's user id. Emits a PROCTORING_ERROR and returns null
 * on any failure so the caller can abort.
 */
const resolveTeacherId = (socket: Socket): string | null => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
      message: 'Authentication required. Provide a teacher JWT via the socket handshake.',
    });
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: string };
    if (!payload.userId) {
      socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
        message: 'Invalid teacher token',
      });
      return null;
    }
    return payload.userId;
  } catch {
    socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
      message: 'Invalid or expired teacher token',
    });
    return null;
  }
};

const registerTeacherRoomHandler = (socket: Socket): void => {
  socket.on(
    PROCTORING_EVENTS.TEACHER_JOIN_EXAM_ROOM,
    async (payload: TeacherJoinRoomPayload) => {
      const { examId } = payload;
      if (!examId) {
        socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
          message: 'examId is required',
        });
        return;
      }

      // Only the exam's owner may join the live-monitoring room: students and
      // third parties know the examId, so a bare id join would leak every
      // student's status updates (name, email, enrollment no, warnings).
      const teacherId = resolveTeacherId(socket);
      if (!teacherId) return;

      try {
        const exam = await prisma.exam.findUnique({
          where: { id: examId },
          select: { created_by: true },
        });

        if (!exam) {
          socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
            message: 'Exam not found',
          });
          return;
        }

        if (exam.created_by !== teacherId) {
          socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
            message: 'You do not have access to this exam',
          });
          return;
        }

        await socket.join(roomName(examId));
        socket.emit(PROCTORING_EVENTS.EXAM_ROOM_JOINED, { examId });
      } catch (err) {
        console.error('[proctoring] teacher_join_exam_room failed:', err);
        socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
          message: 'Failed to join exam room',
        });
      }
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
    registerTeacherRoomHandler(socket);
  });
};
