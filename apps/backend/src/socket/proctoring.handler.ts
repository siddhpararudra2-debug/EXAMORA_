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

/**
 * S02/S03 — live camera/mic supervision over WebRTC (mesh topology).
 *
 * Signaling rides the existing Socket.io connection; media travels peer to
 * peer between the student's browser and the teacher's browser, so no SFU or
 * media server is required. These events are pure relay/broadcast primitives:
 *
 * - `webrtc_request_streams` (teacher)   → server fans out `webrtc_begin` to every
 *                                          student socket in the exam room.
 * - `webrtc_offer`  (student)  { to, sdp } → relayed to the target teacher.
 * - `webrtc_answer` (teacher)  { to, sdp } → relayed to the target student.
 * - `webrtc_ice`    (either)   { to, candidate } → relayed.
 * - `webrtc_end`    (either)   { to } → notify the peer to close the connection.
 * - `webrtc_state`  (student)  { micOn, camOn } → broadcast to the exam room
 *                                                 (teacher tiles update).
 *
 * All relays verify both sockets are members of the same exam room, and
 * offer/answer additionally enforce the student/teacher role.
 */
export const WEBRTC_EVENTS = {
  REQUEST_STREAMS: 'webrtc_request_streams',
  BEGIN: 'webrtc_begin',
  OFFER: 'webrtc_offer',
  ANSWER: 'webrtc_answer',
  ICE: 'webrtc_ice',
  END: 'webrtc_end',
  STATE: 'webrtc_state',
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

        socket.data.teacherExams = socket.data.teacherExams
          ? new Set([...socket.data.teacherExams, examId])
          : new Set([examId]);
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

// ── WebRTC supervision signaling ─────────────────────────────────────────────

export interface WebRtcSignalPayload {
  to?: string;
  sdp?: string;
  candidate?: string;
  examId?: string;
  micOn?: boolean;
  camOn?: boolean;
}

const isInRoom = (io: Server, socketId: string, room: string): boolean => {
  const target = io.sockets.sockets.get(socketId);
  return Boolean(target && target.rooms.has(room));
};

const isStudentSocket = (socket: Socket): boolean =>
  Boolean(socket.data.sessionId && socket.data.examId);

const isTeacherForExam = (socket: Socket, examId: string): boolean =>
  Boolean(socket.data.teacherExams?.has(examId));

/** Relays an event to `toSocketId` when both peers are members of the same exam room. */
const relayWithinRoom = (
  io: Server,
  sender: Socket,
  examId: string | undefined,
  toSocketId: string | undefined,
  event: string,
  payload: Record<string, unknown>,
): boolean => {
  if (!examId || !toSocketId) return false;
  const room = roomName(examId);
  if (!isInRoom(io, toSocketId, room)) return false;
  io.to(toSocketId).emit(event, { from: sender.id, ...payload });
  return true;
};

const registerWebRtcHandlers = (io: Server, socket: Socket): void => {
  // Teacher: request all students in the room to start publishing their
  // camera/mic streams (fan-out — each student gets a webrtc_begin).
  socket.on(
    WEBRTC_EVENTS.REQUEST_STREAMS,
    (payload: { examId?: string }, ack?: (response: { status: string }) => void) => {
      const { examId } = payload ?? {};
      if (!examId || !isTeacherForExam(socket, examId)) {
        ack?.({ status: 'error' });
        return;
      }

      const room = roomName(examId);
      const members = io.sockets.adapter.rooms.get(room) ?? new Set<string>();
      let published = 0;
      for (const memberId of members) {
        const member = io.sockets.sockets.get(memberId);
        if (member && isStudentSocket(member) && member.data.examId === examId) {
          io.to(memberId).emit(WEBRTC_EVENTS.BEGIN, { teacherId: socket.id });
          published += 1;
        }
      }
      ack?.({ status: 'success' });
      console.log(
        `[webrtc] teacher ${socket.id} requested streams for exam ${examId}; notified ${published} student(s)`,
      );
    },
  );

  // Student → teacher: offer an RTCPeerConnection.
  socket.on(
    WEBRTC_EVENTS.OFFER,
    (payload: WebRtcSignalPayload) => {
      const { to, sdp } = payload ?? {};
      if (!isStudentSocket(socket)) return;
      relayWithinRoom(io, socket, socket.data.examId, to, WEBRTC_EVENTS.OFFER, {
        sdp,
        sessionId: socket.data.sessionId,
      });
    },
  );

  // Teacher → student: answer the offer.
  socket.on(
    WEBRTC_EVENTS.ANSWER,
    (payload: WebRtcSignalPayload) => {
      const { to, sdp, examId } = payload ?? {};
      const teacherExamId = examId ?? socket.data.examId;
      if (!to || !sdp || !isTeacherForExam(socket, teacherExamId)) return;
      relayWithinRoom(io, socket, teacherExamId, to, WEBRTC_EVENTS.ANSWER, {
        sdp,
      });
    },
  );

  // Either side: ICE candidate.
  socket.on(
    WEBRTC_EVENTS.ICE,
    (payload: WebRtcSignalPayload) => {
      const { to, candidate, examId } = payload ?? {};
      if (!candidate) return;
      const resolvedExamId = examId ?? socket.data.examId;
      relayWithinRoom(io, socket, resolvedExamId, to, WEBRTC_EVENTS.ICE, {
        candidate,
      });
    },
  );

  // Either side: tear down a peer connection.
  socket.on(
    WEBRTC_EVENTS.END,
    (payload: WebRtcSignalPayload) => {
      const { to, examId } = payload ?? {};
      if (!to) return;
      const resolvedExamId = examId ?? socket.data.examId;
      relayWithinRoom(io, socket, resolvedExamId, to, WEBRTC_EVENTS.END, {});
    },
  );

  // Student → teacher(s): mic/cam state so the grid can show mute/off badges.
  socket.on(
    WEBRTC_EVENTS.STATE,
    (payload: { micOn?: boolean; camOn?: boolean }) => {
      const { micOn, camOn } = payload ?? {};
      if (!isStudentSocket(socket)) return;
      io.to(roomName(socket.data.examId)).emit(WEBRTC_EVENTS.STATE, {
        from: socket.id,
        sessionId: socket.data.sessionId,
        micOn: Boolean(micOn),
        camOn: Boolean(camOn),
      });
    },
  );

  // Cleanup: when a socket drops, tell every peer in its exam rooms to close
  // the peer connection so the teacher grid does not leak dead tiles.
  socket.on('disconnect', () => {
    const examIds = new Set<string>();
    const studentExamId = socket.data.examId as string | undefined;
    if (studentExamId) examIds.add(studentExamId);
    const teacherExams = socket.data.teacherExams as Set<string> | undefined;
    if (teacherExams) for (const id of teacherExams) examIds.add(id);

    for (const examId of examIds) {
      const room = roomName(examId);
      const members = io.sockets.adapter.rooms.get(room) ?? new Set<string>();
      for (const memberId of members) {
        if (memberId !== socket.id) {
          io.to(memberId).emit(WEBRTC_EVENTS.END, { from: socket.id });
        }
      }
    }
  });
};

export const registerProctoringHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    registerJoinExamRoomHandler(socket);
    registerTeacherRoomHandler(socket);
    registerWebRtcHandlers(io, socket);
  });
};
