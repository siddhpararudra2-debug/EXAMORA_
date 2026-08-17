import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SubmissionStatus, ViolationType } from '@prisma/client';
import prisma from '../../../../prisma/client.js';
import { JWT_SECRET } from '../../../../server/config.js';
import { normalizeExamSettings } from '../../../../packages/database/src/shuffle.service.js';

export const MAX_WARNINGS = 3;

/**
 * MVP privacy boundary: remote media is opt-in for a future governed release.
 * The default launch path is event/status telemetry only.
 */
export const ENABLE_REMOTE_MEDIA_SUPERVISION =
  process.env.ENABLE_REMOTE_MEDIA_SUPERVISION === 'true';

export const MEDIA_SUPERVISION_DISABLED_MESSAGE =
  'Remote media supervision is disabled for the MVP; use event/status monitoring.';

/**
 * Maximum number of students whose camera/mic streams a teacher could receive
 * if remote media is explicitly enabled for a future governed release. The MVP
 * leaves this path disabled and uses event/status telemetry only.
 */
export const MAX_LIVE_STREAMS_PER_TEACHER = Number(
  process.env.MAX_LIVE_STREAMS_PER_TEACHER ?? 6,
);

/** Minimum server-side spacing between lockdown heartbeat DB updates. */
export const HEARTBEAT_MIN_INTERVAL_MS = 5_000;

/** Upper bound for a snapshot frame payload (data URL), ~300KB of JPEG. */
export const MAX_SNAPSHOT_LENGTH = 400_000;

export const PROCTORING_EVENTS = {
  JOIN_EXAM_ROOM: 'join_exam_room',
  EXAM_TERMINATED: 'exam_terminated',
  STUDENT_STATUS_UPDATE: 'student_status_update',
  PROCTORING_ERROR: 'proctoring_error',
  TEACHER_JOIN_EXAM_ROOM: 'teacher_join_exam_room',
  TEACHER_LEAVE_EXAM_ROOM: 'teacher_leave_exam_room',
  EXAM_ROOM_JOINED: 'exam_room_joined',
  /** Student → server liveness signal; persisted to last_heartbeat_at. */
  HEARTBEAT: 'heartbeat',
} as const;

/**
 * Remote media supervision is retained as an explicitly gated compatibility
 * path for a future release. In the MVP, all `webrtc_*` transport handlers
 * reject media requests by default. Socket.io still carries the teacher-owned
 * event/status room, and the server continues to enforce heartbeat and
 * duplicate-session evidence that client-side JS cannot disable.
 */
export const WEBRTC_EVENTS = {
  REQUEST_STREAMS: 'webrtc_request_streams',
  BEGIN: 'webrtc_begin',
  OFFER: 'webrtc_offer',
  ANSWER: 'webrtc_answer',
  ICE: 'webrtc_ice',
  END: 'webrtc_end',
  STATE: 'webrtc_state',
  /** Teacher → student: enter snapshot mode (send periodic JPEG frames). */
  SNAPSHOT_BEGIN: 'webrtc_snapshot_begin',
  /** Teacher → student: leave snapshot mode. */
  SNAPSHOT_END: 'webrtc_snapshot_end',
  /** Student → server → teacher room: one JPEG frame (data URL). */
  SNAPSHOT: 'webrtc_snapshot',
  /** Teacher → server: swap a snapshot tile into the live pool. */
  FOCUS: 'webrtc_focus',
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

interface StreamSubscriptions {
  /** studentSocketId → sessionId, insertion order = FIFO eviction order. */
  live: Map<string, string>;
  /** studentSocketIds publishing snapshots instead of a live stream. */
  snapshot: Set<string>;
}

const getSubscriptions = (socket: Socket, examId: string): StreamSubscriptions => {
  const all = (socket.data.streamSubscriptions ??
    new Map<string, StreamSubscriptions>()) as Map<string, StreamSubscriptions>;
  socket.data.streamSubscriptions = all;
  let subs = all.get(examId);
  if (!subs) {
    subs = { live: new Map(), snapshot: new Set() };
    all.set(examId, subs);
  }
  return subs;
};

const registerJoinExamRoomHandler = (io: Server, socket: Socket): void => {
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

        // ── Server-side duplicate-session guard ────────────────────────────
        // A second live socket presenting the same session token means the
        // exam is running on a second device/tab (or the lockdown JS was
        // bypassed). This check lives on the server, so it cannot be disabled
        // from the console. The session is terminated server-side and both
        // connections are notified.
        const sessionRoom = sessionRoomName(session.id);
        const incumbent = Array.from(
          io.sockets.adapter.rooms.get(sessionRoom) ?? new Set<string>(),
        ).find((memberId) => memberId !== socket.id);

        if (incumbent) {
          const now = new Date();
          await prisma.examSession.updateMany({
            where: { id: session.id, status: SubmissionStatus.IN_PROGRESS },
            data: { status: SubmissionStatus.TERMINATED, submitted_at: now },
          });
          await prisma.violation.create({
            data: {
              session_id: session.id,
              type: ViolationType.MOBILE_BUTTON,
              description:
                'Duplicate session detected: the same session token connected from a second device or tab',
              metadata: {
                incumbent_socket_id: incumbent,
                newcomer_socket_id: socket.id,
              },
            },
          });
          const examSettings = await prisma.exam.findUnique({
            where: { id: examId, deleted_at: null },
            select: { settings: true },
          });
          const warningsLimit =
            normalizeExamSettings(examSettings?.settings).warningThreshold ?? MAX_WARNINGS;
          const payload = {
            examId,
            sessionId: session.id,
            reason: 'duplicate_session',
            warnings: warningsLimit,
            warningsLimit,
          };
          io.to(sessionRoom).emit(PROCTORING_EVENTS.EXAM_TERMINATED, payload);
          socket.emit(PROCTORING_EVENTS.EXAM_TERMINATED, payload);
          ack?.({ status: 'success' });
          return;
        }

        await socket.join(roomName(examId));
        await socket.join(sessionRoom);

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

/** Students in the exam room, in room-membership (insertion) order. */
const studentsInRoom = (
  io: Server,
  examId: string,
): { socket: Socket; sessionId: string }[] => {
  const room = roomName(examId);
  const students: { socket: Socket; sessionId: string }[] = [];
  for (const memberId of io.sockets.adapter.rooms.get(room) ?? new Set<string>()) {
    const member = io.sockets.sockets.get(memberId);
    if (member && isStudentSocket(member) && member.data.examId === examId) {
      students.push({ socket: member, sessionId: member.data.sessionId });
    }
  }
  return students;
};

const registerWebRtcHandlers = (io: Server, socket: Socket): void => {
  // Teacher: request all students in the room to publish (bounded).
  // The first MAX_LIVE_STREAMS_PER_TEACHER students publish full WebRTC
  // media; everyone else switches to snapshot mode instead.
  socket.on(
    WEBRTC_EVENTS.REQUEST_STREAMS,
    (
      payload: { examId?: string },
      ack?: (response: {
        status: string;
        live?: number;
        snapshot?: number;
        message?: string;
      }) => void,
    ) => {
      const { examId } = payload ?? {};
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION) {
        ack?.({ status: 'error', message: MEDIA_SUPERVISION_DISABLED_MESSAGE });
        return;
      }
      if (!examId || !isTeacherForExam(socket, examId)) {
        ack?.({ status: 'error' });
        return;
      }

      const subs = getSubscriptions(socket, examId);

      // Re-request: release previous subscriptions before re-assigning.
      for (const studentId of subs.live.keys()) {
        io.to(studentId).emit(WEBRTC_EVENTS.END, { from: socket.id });
      }
      for (const studentId of subs.snapshot) {
        io.to(studentId).emit(WEBRTC_EVENTS.SNAPSHOT_END, { from: socket.id });
      }
      subs.live.clear();
      subs.snapshot.clear();

      const students = studentsInRoom(io, examId);
      for (const { socket: student } of students) {
        if (subs.live.size < MAX_LIVE_STREAMS_PER_TEACHER) {
          subs.live.set(student.id, student.data.sessionId);
          io.to(student.id).emit(WEBRTC_EVENTS.BEGIN, { teacherId: socket.id });
        } else {
          subs.snapshot.add(student.id);
          io.to(student.id).emit(WEBRTC_EVENTS.SNAPSHOT_BEGIN, {
            from: socket.id,
            examId,
          });
        }
      }

      console.log(
        `[webrtc] teacher ${socket.id} requested streams for exam ${examId}: ` +
          `${subs.live.size} live (cap ${MAX_LIVE_STREAMS_PER_TEACHER}), ${subs.snapshot.size} snapshot`,
      );
      ack?.({ status: 'success', live: subs.live.size, snapshot: subs.snapshot.size });
    },
  );

  // Teacher: swap one snapshot tile into the live pool, evicting the oldest
  // live tile (FIFO) when the cap is reached.
  socket.on(
    WEBRTC_EVENTS.FOCUS,
    (
      payload: { examId?: string; sessionId?: string },
      ack?: (response: { status: string; live?: number; message?: string }) => void,
    ) => {
      const { examId, sessionId } = payload ?? {};
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION) {
        ack?.({ status: 'error', message: MEDIA_SUPERVISION_DISABLED_MESSAGE });
        return;
      }
      if (!examId || !sessionId || !isTeacherForExam(socket, examId)) {
        ack?.({ status: 'error', message: 'Invalid focus request' });
        return;
      }

      const subs = getSubscriptions(socket, examId);
      const target = studentsInRoom(io, examId).find(
        (student) => student.sessionId === sessionId,
      );

      if (!target) {
        ack?.({ status: 'error', message: 'Student is not connected' });
        return;
      }

      if (subs.live.has(target.socket.id)) {
        ack?.({ status: 'success', live: subs.live.size });
        return;
      }

      if (subs.live.size >= MAX_LIVE_STREAMS_PER_TEACHER) {
        const evictId = subs.live.keys().next().value as string | undefined;
        if (evictId) {
          subs.live.delete(evictId);
          io.to(evictId).emit(WEBRTC_EVENTS.END, { from: socket.id });
          io.to(evictId).emit(WEBRTC_EVENTS.SNAPSHOT_BEGIN, {
            from: socket.id,
            examId,
          });
          subs.snapshot.add(evictId);
        }
      }

      subs.live.set(target.socket.id, sessionId);
      subs.snapshot.delete(target.socket.id);
      io.to(target.socket.id).emit(WEBRTC_EVENTS.BEGIN, { teacherId: socket.id });
      ack?.({ status: 'success', live: subs.live.size });
    },
  );

  // Student → teacher: offer an RTCPeerConnection.
  socket.on(
    WEBRTC_EVENTS.OFFER,
    (payload: WebRtcSignalPayload) => {
      const { to, sdp } = payload ?? {};
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION || !isStudentSocket(socket)) return;
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
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION) return;
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
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION || !candidate) return;
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
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION || !to) return;
      const resolvedExamId = examId ?? socket.data.examId;
      relayWithinRoom(io, socket, resolvedExamId, to, WEBRTC_EVENTS.END, {});
    },
  );

  // Student → server → teacher room: one JPEG snapshot frame.
  socket.on(
    WEBRTC_EVENTS.SNAPSHOT,
    (payload: { data?: string }) => {
      if (!isStudentSocket(socket)) return;
      const { data } = payload ?? {};
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION) return;
      if (
        typeof data !== 'string' ||
        data.length === 0 ||
        data.length > MAX_SNAPSHOT_LENGTH
      ) {
        return; // oversized or malformed frame — drop
      }
      io.to(roomName(socket.data.examId)).emit(WEBRTC_EVENTS.SNAPSHOT, {
        from: socket.id,
        sessionId: socket.data.sessionId,
        data,
      });
    },
  );

  // Student → teacher(s): mic/cam state so the grid can show mute/off badges.
  socket.on(
    WEBRTC_EVENTS.STATE,
    (payload: { micOn?: boolean; camOn?: boolean }) => {
      const { micOn, camOn } = payload ?? {};
      if (!ENABLE_REMOTE_MEDIA_SUPERVISION || !isStudentSocket(socket)) return;
      io.to(roomName(socket.data.examId)).emit(WEBRTC_EVENTS.STATE, {
        from: socket.id,
        sessionId: socket.data.sessionId,
        micOn: Boolean(micOn),
        camOn: Boolean(camOn),
      });
    },
  );

  // ── Server-side proctoring liveness heartbeat ────────────────────────────
  // The client lockdown reports in periodically; the auto-submit sweep
  // terminates sessions whose heartbeat goes silent (client JS disabled,
  // crashed, or the student left). Server-inserted evidence the client
  // cannot remove.
  socket.on(PROCTORING_EVENTS.HEARTBEAT, () => {
    if (!isStudentSocket(socket)) return;
    const now = Date.now();
    const last = (socket.data.lastHeartbeatAt as number | undefined) ?? 0;
    if (now - last < HEARTBEAT_MIN_INTERVAL_MS) return;
    socket.data.lastHeartbeatAt = now;
    prisma.examSession
      .update({
        where: { id: socket.data.sessionId },
        data: { last_heartbeat_at: new Date(now) },
      })
      .catch(() => {
        /* session closed while heartbeating — ignore */
      });
  });

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

    // Prune the departed student from every teacher's subscription maps.
    for (const [, member] of io.sockets.sockets) {
      const subsMap = member.data.streamSubscriptions as
        | Map<string, StreamSubscriptions>
        | undefined;
      if (!subsMap) continue;
      for (const subs of subsMap.values()) {
        subs.live.delete(socket.id);
        subs.snapshot.delete(socket.id);
      }
    }
  });
};

export const registerProctoringHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    registerJoinExamRoomHandler(io, socket);
    registerTeacherRoomHandler(socket);
    registerWebRtcHandlers(io, socket);
  });
};