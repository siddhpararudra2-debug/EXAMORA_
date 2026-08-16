"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Socket } from "socket.io-client";
import {
  Expand,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Video,
  VideoOff,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * S02/S03 — teacher side of live camera/mic supervision.
 *
 * Renders a grid of every student's published WebRTC stream with:
 * - click-to-enlarge overlay (audio enabled on click)
 * - live mic/cam state badges
 * - per-student recording (MediaRecorder → WebM download) — S07
 *
 * Media flows peer-to-peer; signaling rides Socket.io (webrtc_* events).
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface StreamTile {
  teacherId: string; // student socket id
  sessionId: string | null;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  recording: boolean;
}

interface SessionLike {
  id: string;
  studentName: string;
}

interface SupervisionGridProps {
  examId: string;
  socket: Socket | null;
  roomJoined: boolean;
  sessions: SessionLike[];
}

function supportsWebmRecording(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return (
    MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ||
    MediaRecorder.isTypeSupported("video/webm")
  );
}

const activeRecorders = new Map<string, MediaRecorder>();

export function SupervisionGrid({
  examId,
  socket,
  roomJoined,
  sessions,
}: SupervisionGridProps) {
  const [tiles, setTiles] = useState<StreamTile[]>([]);
  const [enlarged, setEnlarged] = useState<StreamTile | null>(null);
  const [requesting, setRequesting] = useState(false);
  /** sessionId → latest JPEG snapshot frame (data URL) from snapshot-mode students. */
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const tilesRef = useRef<StreamTile[]>([]);
  const sessionNameById = useMemo(
    () => new Map(sessions.map((s) => [s.id, s.studentName])),
    [sessions],
  );

  tilesRef.current = tiles;

  const liveSessionIds = useMemo(
    () =>
      new Set(
        tiles.map((t) => t.sessionId).filter((id): id is string => Boolean(id)),
      ),
    [tiles],
  );
  // Students that are NOT publishing a live stream and have at least one
  // server-relayed snapshot frame.
  const snapshotTiles = useMemo(
    () => sessions.filter((s) => !liveSessionIds.has(s.id) && snapshots[s.id]),
    [sessions, liveSessionIds, snapshots],
  );

  const nameFor = useCallback(
    (sessionId: string | null): string | null =>
      sessionId ? (sessionNameById.get(sessionId) ?? null) : null,
    [sessionNameById],
  );

  const closeTile = useCallback((teacherId: string) => {
    setTiles((prev) => {
      const tile = prev.find((t) => t.teacherId === teacherId);
      if (tile) {
        try {
          tile.pc.close();
        } catch {
          /* ignore */
        }
      }
      return prev.filter((t) => t.teacherId !== teacherId);
    });
    setEnlarged((current) =>
      current?.teacherId === teacherId ? null : current
    );
  }, []);

  const requestStreams = useCallback(() => {
    if (!socket?.connected || !roomJoined) return;
    setRequesting(true);
    socket.emit(
      "webrtc_request_streams",
      { examId },
      (ack?: { status?: string }) => {
        setRequesting(false);
        if (ack?.status !== "success") {
          setRequesting(false);
        }
      },
    );
  }, [socket, roomJoined, examId]);

  const handleOffer = useCallback(
    async (payload: {
      from: string;
      sdp?: RTCSessionDescriptionInit;
      sessionId?: string;
    }) => {
      const { from, sdp, sessionId } = payload;
      if (!sdp || !socket) return;
      if (tilesRef.current.some((t) => t.teacherId === from)) return;

      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
        iceCandidatePoolSize: 4,
      });
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });

      const tile: StreamTile = {
        teacherId: from,
        sessionId: sessionId ?? null,
        pc,
        stream: null,
        micOn: true,
        camOn: true,
        recording: false,
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setTiles((prev) =>
          prev.map((t) =>
            t.teacherId === from ? { ...t, stream } : t
          )
        );
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket.emit("webrtc_ice", {
          to: from,
          examId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          closeTile(from);
        }
      };

      setTiles((prev) => [...prev, tile]);

      try {
        await pc.setRemoteDescription(sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc_answer", {
          to: from,
          examId,
          sdp: pc.localDescription,
        });
      } catch (error) {
        console.warn("[SupervisionGrid] failed to answer offer:", error);
        closeTile(from);
      }
    },
    [socket, examId, closeTile],
  );

  const handleIce = useCallback(
    (payload: { from?: string; candidate?: RTCIceCandidateInit }) => {
      const tile = tilesRef.current.find(
        (t) => t.teacherId === payload?.from
      );
      if (tile && payload?.candidate) {
        tile.pc.addIceCandidate(payload.candidate).catch(() => {
          /* stale candidate */
        });
      }
    },
    [],
  );

  const handleState = useCallback(
    (payload: {
      from?: string;
      sessionId?: string;
      micOn?: boolean;
      camOn?: boolean;
    }) => {
      if (!payload?.from) return;
      setTiles((prev) =>
        prev.map((t) =>
          t.teacherId === payload.from
            ? {
                ...t,
                sessionId: payload.sessionId ?? t.sessionId,
                micOn: payload.micOn ?? t.micOn,
                camOn: payload.camOn ?? t.camOn,
              }
            : t
        )
      );
    },
    [],
  );

  const handleSnapshot = useCallback(
    (payload: { from?: string; sessionId?: string; data?: string }) => {
      if (!payload?.sessionId || typeof payload.data !== "string") return;
      const { sessionId, data } = payload;
      setSnapshots((prev) => ({ ...prev, [sessionId]: data }));
    },
    [],
  );

  /** Swaps one snapshot student into the teacher's live-pool (server enforces the cap). */
  const focusSnapshotTile = useCallback(
    (sessionId: string) => {
      if (!socket?.connected) return;
      socket.emit(
        "webrtc_focus",
        { examId, sessionId },
        (ack?: { status?: string }) => {
          if (ack?.status !== "success") {
            console.warn("[SupervisionGrid] focus request rejected:", ack);
          }
        },
      );
    },
    [socket, examId],
  );

  // Wire up signaling when the teacher is in the exam room.
  useEffect(() => {
    if (!socket || !roomJoined) return;

    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_ice", handleIce);
    socket.on("webrtc_state", handleState);
    socket.on("webrtc_snapshot", handleSnapshot);
    socket.on("webrtc_end", (payload: { from?: string }) => {
      if (payload?.from) closeTile(payload.from);
    });

    requestStreams();

    return () => {
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_ice", handleIce);
      socket.off("webrtc_state", handleState);
      socket.off("webrtc_snapshot", handleSnapshot);
      socket.off("webrtc_end");
      // Tear down all peer connections and tell students we're done.
      for (const tile of tilesRef.current) {
        try {
          socket.emit("webrtc_end", { to: tile.teacherId, examId });
          tile.pc.close();
        } catch {
          /* ignore */
        }
      }
      setTiles([]);
    };
  }, [socket, roomJoined, examId, handleOffer, handleIce, handleState, handleSnapshot, closeTile, requestStreams]);

  const startRecording = useCallback((tile: StreamTile) => {
    if (!tile.stream || tile.recording || !supportsWebmRecording()) return;
    const recorder = new MediaRecorder(tile.stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm",
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = nameFor(tile.sessionId) ?? tile.sessionId ?? "student";
      a.href = url;
      a.download = `${name.replace(/[^\w\s-]/g, "") || "student"}_supervision_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
    recorder.start(1000);
    activeRecorders.set(tile.teacherId, recorder);
    setTiles((prev) =>
      prev.map((t) =>
        t.teacherId === tile.teacherId ? { ...t, recording: true } : t
      )
    );
  }, [nameFor]);

  const stopRecording = useCallback((tile: StreamTile) => {
    const recorder = activeRecorders.get(tile.teacherId);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    activeRecorders.delete(tile.teacherId);
    setTiles((prev) =>
      prev.map((t) =>
        t.teacherId === tile.teacherId ? { ...t, recording: false } : t
      )
    );
  }, []);

  if (!roomJoined) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Live camera &amp; mic
            </h2>
            <p className="text-xs text-muted-foreground">
              {tiles.length === 0 && snapshotTiles.length === 0
                ? "Waiting for students to publish their feeds…"
                : `${tiles.length} live stream${tiles.length === 1 ? "" : "s"} · ${snapshotTiles.length} snapshot tile${snapshotTiles.length === 1 ? "" : "s"} · click a live tile to listen in`}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 border-border/40"
          onClick={requestStreams}
          disabled={requesting}
        >
          {requesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          {requesting ? "Requesting…" : "Request feeds"}
        </Button>
      </div>

      {tiles.length === 0 && snapshotTiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
          <VideoOff className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No camera feeds yet. Student feeds appear here the moment they
            start streaming. Click “Request feeds” to re-broadcast to anyone
            who joined late.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => {
            const name = nameFor(tile.sessionId);
            return (
              <div
                key={tile.teacherId}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/50 bg-black shadow-sm",
                  tile.recording && "ring-2 ring-red-500/60"
                )}
              >
                <video
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                  ref={(el) => {
                    if (el && el.srcObject !== tile.stream) {
                      el.srcObject = tile.stream;
                    }
                  }}
                />
                {!tile.stream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                  </div>
                )}
                {!tile.camOn && tile.stream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <VideoOff className="h-6 w-6 text-white/80" />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white">
                      {name ?? "Unknown student"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <Badge
                        className={cn(
                          "h-4 gap-1 border-none px-1.5 text-[9px] font-bold",
                          tile.micOn
                            ? "bg-white/20 text-white"
                            : "bg-red-500/80 text-white"
                        )}
                      >
                        {tile.micOn ? (
                          <Mic className="h-2.5 w-2.5" />
                        ) : (
                          <MicOff className="h-2.5 w-2.5" />
                        )}
                        {tile.micOn ? "MIC" : "MUTED"}
                      </Badge>
                      <Badge
                        className={cn(
                          "h-4 gap-1 border-none px-1.5 text-[9px] font-bold",
                          tile.camOn
                            ? "bg-white/20 text-white"
                            : "bg-red-500/80 text-white"
                        )}
                      >
                        {tile.camOn ? (
                          <Video className="h-2.5 w-2.5" />
                        ) : (
                          <VideoOff className="h-2.5 w-2.5" />
                        )}
                        {tile.camOn ? "CAM" : "OFF"}
                      </Badge>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        tile.recording
                          ? stopRecording(tile)
                          : startRecording(tile)
                      }
                      disabled={!tile.stream || !supportsWebmRecording()}
                      title={
                        !supportsWebmRecording()
                          ? "Recording not supported in this browser"
                          : tile.recording
                          ? "Stop recording and download"
                          : "Record this feed (WebM)"
                      }
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                        tile.recording
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-white/25 text-white hover:bg-white/40"
                      )}
                    >
                      <span
                        className={cn(
                          "block h-2.5 w-2.5 rounded-full",
                          tile.recording && "animate-pulse bg-white"
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnlarged(tile)}
                      disabled={!tile.stream}
                      title="Enlarge with audio"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-white transition-colors hover:bg-white/40 disabled:opacity-40"
                    >
                      <Expand className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => closeTile(tile.teacherId)}
                      title="Remove feed"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-white transition-colors hover:bg-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {snapshotTiles.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Snapshot tiles ({snapshotTiles.length}) — camera frames are
            relayed by the server every ~2s; click “Live” to stream this
            student in real time
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {snapshotTiles.map((session) => (
              <div
                key={session.id}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-black shadow-sm"
              >
                {/* Snapshot frames are runtime-generated data URLs; Next Image optimization is not applicable here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={snapshots[session.id]}
                  alt={`${session.studentName} camera snapshot`}
                  className="aspect-video w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2.5">
                  <span className="min-w-0 truncate text-xs font-bold text-white">
                    {session.studentName}
                  </span>
                  <Button
                    type="button"
                    className="h-7 shrink-0 gap-1 bg-white/20 text-white hover:bg-primary hover:text-white"
                    onClick={() => focusSnapshotTile(session.id)}
                  >
                    <Radio className="h-3 w-3" />
                    Live
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Click-to-enlarge overlay with audio (S03) */}
      {enlarged?.stream && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${nameFor(enlarged.sessionId) ?? "Student"} camera feed`}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/90 p-4 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setEnlarged(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={(el) => {
                if (el && el.srcObject !== enlarged.stream) {
                  el.srcObject = enlarged.stream;
                  void el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              className="max-h-[78vh] w-full object-contain"
            />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                {nameFor(enlarged.sessionId) ?? "Unknown student"}
                <Badge
                  className={cn(
                    "h-4 gap-1 border-none px-1.5 text-[9px] font-bold",
                    enlarged.micOn ? "bg-white/25 text-white" : "bg-red-500/80 text-white"
                  )}
                >
                  {enlarged.micOn ? (
                    <Mic className="h-2.5 w-2.5" />
                  ) : (
                    <MicOff className="h-2.5 w-2.5" />
                  )}
                  {enlarged.micOn ? "AUDIO ON" : "MUTED"}
                </Badge>
              </p>
              <button
                type="button"
                onClick={() => setEnlarged(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-red-500"
                aria-label="Close enlarged feed"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-xs font-semibold text-white/90">
              Live camera &amp; mic supervision — audio is enabled in this view.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SupervisionGrid;
