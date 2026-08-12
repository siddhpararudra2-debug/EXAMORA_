"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

/**
 * S02/S03 — student side of live camera/mic supervision.
 *
 * Scalable hybrid topology:
 * - When a teacher asks for a live stream (`webrtc_begin`) the student
 *   publishes WebRTC media P2P at low resolution (320×240) with a hard
 *   bitrate cap (~200kbps) so a teacher's browser can decode several
 *   simultaneous tiles without dying.
 * - When the teacher is at the live cap, the student gets
 *   `webrtc_snapshot_begin` instead: a JPEG frame is captured every 2s and
 *   shipped over the existing Socket.io connection (server-relayed), which
 *   costs a fraction of the bandwidth/CPU of a video stream.
 *
 * Media/snapshot decision is server-driven; signaling rides Socket.io.
 */

export interface UseLiveSupervisionOptions {
  enabled: boolean;
  examId: string;
  /** Socket.io session token (anonymous exam token). */
  sessionToken: string;
  requireMic: boolean;
  requireCamera: boolean;
  /** Optional existing video element for the self view. */
  externalVideoRef?: React.RefObject<HTMLVideoElement>;
}

export interface UseLiveSupervisionReturn {
  stream: MediaStream | null;
  cameraDenied: boolean;
  micDenied: boolean;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamingToTeacher: boolean;
  /** True while the student is in snapshot mode (no WebRTC sender active). */
  snapshotMode: boolean;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** Live camera capture size — deliberately small so multi-tile decoding is cheap. */
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;

/** Hard cap for the upstream video bitrate (very low for a proctoring feed). */
const LIVE_VIDEO_MAX_BITRATE_BPS = 200_000;

/** JPEG snapshot cadence while in snapshot mode. */
const SNAPSHOT_INTERVAL_MS = 2000;
/** Snapshot frame is never wider than this (data URL stays small). */
const SNAPSHOT_MAX_WIDTH = 640;
const SNAPSHOT_JPEG_QUALITY = 0.55;

function loadSocket(): ReturnType<typeof getSocket> | null {
  if (typeof window === "undefined") return null;
  try {
    // Shared singleton — created (with the session token) by the take page.
    return getSocket();
  } catch {
    return null;
  }
}

export function useLiveSupervision({
  enabled,
  examId,
  sessionToken,
  requireMic,
  requireCamera,
  externalVideoRef,
}: UseLiveSupervisionOptions): UseLiveSupervisionReturn {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streamingToTeacher, setStreamingToTeacher] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);
  const snapshotPeersRef = useRef<Set<string>>(new Set());
  const snapshotBusyRef = useRef(false);

  const applyTrackState = useCallback(() => {
    const media = streamRef.current;
    if (!media) return;
    media.getAudioTracks().forEach((track) => (track.enabled = micOnRef.current));
    media.getVideoTracks().forEach((track) => (track.enabled = camOnRef.current));
  }, []);

  // Capture media once, then keep the stream alive for the whole session.
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let canceled = false;
    let localStream: MediaStream | null = null;

    (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: requireCamera
            ? {
                width: { ideal: CAPTURE_WIDTH },
                height: { ideal: CAPTURE_HEIGHT },
                facingMode: "user",
              }
            : false,
          audio: requireMic,
        };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (canceled) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = localStream;
        setStream(localStream);
        if (videoRef.current) videoRef.current.srcObject = localStream;
      } catch (error) {
        if (canceled) return;
        // Distinguish camera vs mic failure from the error name.
        const name = error instanceof DOMException ? error.name : "";
        const message = error instanceof Error ? error.message : String(error);
        if (/audio|mic/i.test(message)) setMicDenied(true);
        if (/video|camera|device/i.test(message)) setCameraDenied(true);
        if (name === "NotAllowedError") {
          setCameraDenied(true);
          setMicDenied(requireMic);
        }
      }
    })();

    return () => {
      canceled = true;
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, requireMic, requireCamera]);

  const createPeerConnection = useCallback(
    (teacherId: string) => {
      const existing = pcsRef.current.get(teacherId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
        iceCandidatePoolSize: 4,
      });

      const media = streamRef.current;
      if (media) {
        for (const track of media.getTracks()) {
          pc.addTrack(track, media);
        }
      }

      // Cap the video bitrate so N simultaneous P2P senders stay tiny.
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        try {
          videoSender
            .setParameters({
              ...videoSender.getParameters(),
              encodings: [{ maxBitrate: LIVE_VIDEO_MAX_BITRATE_BPS }],
            })
            .catch(() => {
              /* older browsers — signal default bitrate then */
            });
        } catch {
          /* ignore unsupported */
        }
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit("webrtc_ice", {
          to: teacherId,
          examId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          pcsRef.current.delete(teacherId);
          try {
            pc.close();
          } catch {
            /* ignore */
          }
        }
      };

      pcsRef.current.set(teacherId, pc);
      return pc;
    },
    [examId],
  );

  /**
   * Captures one JPEG frame from the camera track (no video element needed),
   * with a rendered-element fallback. Returns a data URL or null when the
   * camera is off or capture fails.
   */
  const captureSnapshotFrame = useCallback(async (): Promise<string | null> => {
    const media = streamRef.current;
    if (!media) return null;
    const videoTrack = media.getVideoTracks()[0];
    if (!videoTrack || !videoTrack.enabled) return null;

    try {
      // TS's DOM lib doesn't include MediaStreamTrack in ImageBitmapSource
      // yet, though all modern engines accept it.
      const bitmap = await createImageBitmap(
        videoTrack as unknown as ImageBitmapSource,
      );
      const scale = Math.min(1, SNAPSHOT_MAX_WIDTH / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return null;
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL("image/jpeg", SNAPSHOT_JPEG_QUALITY);
    } catch {
      // Fallback: draw the (possibly rendered) self-view element.
      const video = videoRef.current;
      if (!video || video.videoWidth <= 0 || !video.videoHeight) return null;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(SNAPSHOT_MAX_WIDTH, video.videoWidth);
      canvas.height = Math.round(
        (canvas.width / video.videoWidth) * video.videoHeight,
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", SNAPSHOT_JPEG_QUALITY);
    }
  }, [videoRef]);

  const sendSnapshot = useCallback(async (): Promise<void> => {
    if (snapshotBusyRef.current) return;
    snapshotBusyRef.current = true;
    try {
      const data = await captureSnapshotFrame();
      if (data) {
        socketRef.current?.emit("webrtc_snapshot", { examId, data });
      }
    } finally {
      snapshotBusyRef.current = false;
    }
  }, [captureSnapshotFrame, examId]);

  // Signaling: publish to teachers that request the stream.
  useEffect(() => {
    if (!enabled || !sessionToken) return;

    const socket = loadSocket();
    if (!socket) return;
    socketRef.current = socket;

    const onBegin = async (payload: { teacherId?: string }) => {
      const teacherId = payload?.teacherId;
      if (!teacherId) return;
      // The teacher may request the stream before getUserMedia resolves —
      // wait (bounded) so the published offer actually carries tracks.
      const deadline = Date.now() + 8000;
      while (!streamRef.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      const pc = createPeerConnection(teacherId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc_offer", {
        to: teacherId,
        examId,
        sdp: pc.localDescription,
      });
      setStreamingToTeacher(true);
    };

    const onAnswer = async (payload: {
      from?: string;
      sdp?: RTCSessionDescriptionInit;
    }) => {
      const pc = payload?.from ? pcsRef.current.get(payload.from) : undefined;
      if (pc && payload?.sdp) {
        await pc.setRemoteDescription(payload.sdp);
      }
    };

    const onIce = async (payload: {
      from?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      const pc = payload?.from ? pcsRef.current.get(payload.from) : undefined;
      if (pc && payload?.candidate) {
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          /* stale candidate */
        }
      }
    };

    // Enter snapshot mode for a teacher that's at the live cap.
    const onSnapshotBegin = (payload: { from?: string }) => {
      const teacherId = payload?.from;
      if (!teacherId) return;
      snapshotPeersRef.current.add(teacherId);
      setSnapshotMode(true);
      void sendSnapshot();
    };

    const onSnapshotEnd = (payload: { from?: string }) => {
      const teacherId = payload?.from;
      if (!teacherId) return;
      snapshotPeersRef.current.delete(teacherId);
      if (snapshotPeersRef.current.size === 0) setSnapshotMode(false);
    };

    const onEnd = (payload: { from?: string }) => {
      const teacherId = payload?.from;
      if (!teacherId) return;
      snapshotPeersRef.current.delete(teacherId);
      const pc = pcsRef.current.get(teacherId);
      if (pc) {
        pcsRef.current.delete(teacherId);
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      if (pcsRef.current.size === 0 && snapshotPeersRef.current.size === 0) {
        setStreamingToTeacher(false);
        setSnapshotMode(false);
      }
    };

    const attach = () => {
      socket.on("webrtc_begin", onBegin);
      socket.on("webrtc_answer", onAnswer);
      socket.on("webrtc_ice", onIce);
      socket.on("webrtc_end", onEnd);
      socket.on("webrtc_snapshot_begin", onSnapshotBegin);
      socket.on("webrtc_snapshot_end", onSnapshotEnd);
    };
    const detach = () => {
      socket.off("webrtc_begin", onBegin);
      socket.off("webrtc_answer", onAnswer);
      socket.off("webrtc_ice", onIce);
      socket.off("webrtc_end", onEnd);
      socket.off("webrtc_snapshot_begin", onSnapshotBegin);
      socket.off("webrtc_snapshot_end", onSnapshotEnd);
    };

    if (socket.connected) {
      attach();
    } else {
      socket.on("connect", attach);
    }

    const livePcs = pcsRef.current;
    const snapshotPeers = snapshotPeersRef.current;
    return () => {
      detach();
      socket.off("connect", attach);
      for (const pc of livePcs.values()) {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      livePcs.clear();
      snapshotPeers.clear();
      setStreamingToTeacher(false);
      setSnapshotMode(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionToken, examId, createPeerConnection, sendSnapshot]);

  // Snapshot cadence: while in snapshot mode, ship a frame every few seconds.
  useEffect(() => {
    if (!enabled || !snapshotMode) return;
    const interval = setInterval(() => {
      void sendSnapshot();
    }, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, snapshotMode, sendSnapshot]);

  const toggleMic = useCallback(() => {
    micOnRef.current = !micOnRef.current;
    setMicOn(micOnRef.current);
    applyTrackState();
    socketRef.current?.emit("webrtc_state", {
      micOn: micOnRef.current,
      camOn: camOnRef.current,
    });
  }, [applyTrackState]);

  const toggleCam = useCallback(() => {
    camOnRef.current = !camOnRef.current;
    setCamOn(camOnRef.current);
    applyTrackState();
    socketRef.current?.emit("webrtc_state", {
      micOn: micOnRef.current,
      camOn: camOnRef.current,
    });
  }, [applyTrackState]);

  // Announce state once a teacher connects (grid renders correct badges).
  useEffect(() => {
    if (!enabled || !streamingToTeacher) return;
    socketRef.current?.emit("webrtc_state", {
      micOn: micOnRef.current,
      camOn: camOnRef.current,
    });
  }, [enabled, streamingToTeacher]);

  return {
    stream,
    cameraDenied,
    micDenied,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    videoRef,
    streamingToTeacher,
    snapshotMode,
  };
}

export default useLiveSupervision;