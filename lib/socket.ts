import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export interface SocketOptions {
  /** Absolute or origin-relative socket server URL. Defaults to `/api/socket/io` via rewrites. */
  url?: string;
  /** Auth/session token (JWT) passed as the `token` handshake auth field. */
  token?: string;
  /** Extra auth fields sent on handshake. */
  authExtra?: Record<string, unknown>;
  /** Force a fresh connection (disconnects existing if any). */
  forceNew?: boolean;
}

/**
 * Returns (and lazily creates) a single `socket.io-client` instance shared
 * across the app. Always call `.connect()` after attaching event listeners,
 * or pass `autoConnect: false` in the options.
 */
export function getSocket(opts: SocketOptions = {}): Socket {
  const {
    url = getSocketUrl(),
    token,
    authExtra,
    forceNew = false,
  } = opts;

  if (forceNew || !socketInstance) {
    if (socketInstance && forceNew) {
      try {
        socketInstance.disconnect();
      } catch {
        /* ignore */
      }
      socketInstance = null;
    }
    socketInstance = io(url, {
      autoConnect: false,
      auth: {
        ...(token ? { token } : {}),
        ...(authExtra ?? {}),
      },
      transports: ["polling", "websocket"],
      withCredentials: true,
    });
  }

  return socketInstance;
}

/** Returns the public WS server URL, preferring an env override. */
export function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  const envValue = (process.env.NEXT_PUBLIC_SOCKET_URL as string | undefined)?.trim();
  if (envValue) return envValue;
  // Default: same origin (Next rewrites /api/socket/* → backend socket endpoint)
  return window.location.origin;
}

export type SessionStatus =
  | "ACTIVE"
  | "TERMINATED"
  | "SUBMITTED"
  | "GRADED"
  | "JOINED";

export interface StudentSessionView {
  id: string;
  examId: string;
  studentName: string;
  studentEmail?: string;
  status: SessionStatus;
  warnings: number;
  warningsLimit: number;
  joinedAt?: string;
  lastActivityAt?: string;
}

export interface StudentStatusUpdateEvent {
  examId: string;
  sessionId: string;
  studentName?: string;
  status?: SessionStatus;
  warnings?: number;
  warningsLimit?: number;
  terminated?: boolean;
  submitted?: boolean;
  timestamp?: string;
}

export interface ExamTerminatedEvent {
  examId: string;
  sessionId: string;
  reason: "warnings_limit" | "teacher" | string;
  warnings: number;
  warningsLimit: number;
}

export interface ExamSubmittedEvent {
  examId: string;
  sessionId: string;
  submittedAt: string;
}
