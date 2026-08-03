"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

/**
 * S02/S03 — student side of live camera/mic supervision.
 *
 * Captures the camera (and mic when required), shows a local self-view, and
 * publishes the stream to every teacher that requests it via WebRTC mesh
 * signaling. Signaling rides the shared Socket.io connection (see
 * proctoring.handler.ts `webrtc_*` events); media travels peer-to-peer.
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
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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

  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);

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
          video: requireCamera ? { width: 640, height: 480, facingMode: "user" } : false,
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

    const onEnd = (payload: { from?: string }) => {
      const teacherId = payload?.from;
      if (!teacherId) return;
      const pc = pcsRef.current.get(teacherId);
      if (pc) {
        pcsRef.current.delete(teacherId);
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      }
      if (pcsRef.current.size === 0) setStreamingToTeacher(false);
    };

    const attach = () => {
      socket.on("webrtc_begin", onBegin);
      socket.on("webrtc_answer", onAnswer);
      socket.on("webrtc_ice", onIce);
      socket.on("webrtc_end", onEnd);
    };
    const detach = () => {
      socket.off("webrtc_begin", onBegin);
      socket.off("webrtc_answer", onAnswer);
      socket.off("webrtc_ice", onIce);
      socket.off("webrtc_end", onEnd);
    };

    if (socket.connected) {
      attach();
    } else {
      socket.on("connect", attach);
    }

    const livePcs = pcsRef.current;
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
      setStreamingToTeacher(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionToken, examId, createPeerConnection]);

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
  };
}

export default useLiveSupervision;
