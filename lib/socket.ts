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

/**
 * Returns the shared socket, re-creating it when the requested auth token
 * differs from the one the existing instance was created with.
 *
 * The singleton is shared app-wide; without this check, the FIRST page that
 * touches it locks in its handshake token. A teacher opening the live
 * dashboard after having viewed the student take page (or vice versa) would
 * otherwise keep the wrong identity — the server's teacher-role checks read
 * `auth.token` and would reject them.
 */
export function getSocketForAuth(token?: string): Socket {
  const desired = token ?? undefined;
  const current = getSocket();
  const currentToken = (current as unknown as { auth?: { token?: unknown } })
    .auth?.token as string | undefined;
  return getSocket({ token, forceNew: currentToken !== desired });
}

export type SessionStatus =
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "AUTO_SUBMITTED"
  | "TERMINATED";

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
