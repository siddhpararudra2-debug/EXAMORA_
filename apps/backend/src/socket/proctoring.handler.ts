import { Server, Socket } from 'socket.io';
import { SessionStatus } from '@prisma/client';
import prisma from '../../../../prisma/client.js';

export const MAX_WARNINGS = 3;

export const PROCTORING_EVENTS = {
  JOIN_EXAM_ROOM: 'join_exam_room',
  STUDENT_WARNING: 'student_warning',
  EXAM_TERMINATED: 'exam_terminated',
  STUDENT_STATUS_UPDATE: 'student_status_update',
  PROCTORING_ERROR: 'proctoring_error',
} as const;

export interface JoinExamRoomPayload {
  sessionToken: string;
  examId: string;
}

export interface StudentWarningPayload {
  sessionToken: string;
  examId: string;
  reason?: string;
}

export interface StudentStatusUpdatePayload {
  sessionId: string;
  examId: string;
  studentName: string;
  studentEmail: string;
  enrollmentNo: string;
  warningsCount: number;
  status: SessionStatus;
  reason?: string;
}

export interface ExamTerminatedPayload {
  sessionId: string;
  warningsCount: number;
  reason: string;
}

export type JoinExamRoomResponse =
  | { status: 'success' }
  | { status: 'error'; message: string };

export const roomName = (examId: string): string => `exam_${examId}`;

const registerStudentWarningHandler = (io: Server, socket: Socket): void => {
  socket.on(PROCTORING_EVENTS.STUDENT_WARNING, async (payload: StudentWarningPayload) => {
    try {
      const { sessionToken, examId, reason } = payload;

      const session = await prisma.studentSession.findFirst({
        where: { sessionToken, examId },
      });

      if (!session) {
        socket.emit(PROCTORING_EVENTS.PROCTORING_ERROR, {
          message: 'Invalid session token for this exam',
        });
        return;
      }

      if (session.status !== SessionStatus.ACTIVE) {
        return;
      }

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
          sessionId: session.id,
          warningsCount: updated.warningsCount,
          reason: reason ?? 'Maximum proctoring warnings exceeded',
        } satisfies ExamTerminatedPayload);
      }

      io.to(roomName(examId)).emit(
        PROCTORING_EVENTS.STUDENT_STATUS_UPDATE,
        {
          sessionId: session.id,
          examId,
          studentName: session.studentName,
          studentEmail: session.studentEmail,
          enrollmentNo: session.enrollmentNo,
          warningsCount: updated.warningsCount,
          status: terminated ? SessionStatus.TERMINATED : SessionStatus.ACTIVE,
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

export const registerProctoringHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    registerJoinExamRoomHandler(socket);
    registerStudentWarningHandler(io, socket);
  });
};
