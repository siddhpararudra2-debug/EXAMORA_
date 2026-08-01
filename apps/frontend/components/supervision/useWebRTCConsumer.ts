"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SupervisedStudent, StreamStatus, useSupervisionStore } from "./supervisionStore";

/**
 * WebRTC consumer hook for the Examora supervision dashboard.
 *
 * Connects to a simple WebRTC SFU over a JSON WebSocket signaling channel
 * and consumes the audio/video streams each student publishes:
 *
 *   → { type: "teacher-join", examId }            (teacher enters the room)
 *   ← { type: "peers", peers: [...] }             (list of active producers)
 *   ← { type: "offer", studentId, offer }         (SFU asks teacher to consume)
 *   → { type: "answer", studentId, answer }       (teacher answers)
 *   ↔ { type: "ice-candidate", studentId, candidate }
 *   ← { type: "peer-left", studentId }
 *
 * If no SFU URL is configured, the signaling server is unreachable, or
 * `forceMock` is set, the hook transparently falls back to fully simulated
 * students with canvas-generated video streams and oscillator audio, so the
 * dashboard always renders.
 */

export interface WebRTCConsumerOptions {
  /** Exam room to join. */
  examId: string;
  /** WebSocket signaling endpoint, e.g. "wss://sfu.examora.app/signaling". */
  sfuUrl?: string;
  /** Set to true to skip any real connection attempt. */
  forceMock?: boolean;
  /** Number of simulated students used by the mock fallback. Default: 9 */
  mockStudentCount?: number;
  /** Called whenever the connection mode changes. */
  onConnectionChange?: (connected: boolean, usingMockData: boolean) => void;
}

export interface WebRTCConsumerResult {
  connected: boolean;
  usingMockData: boolean;
  error: string | null;
  /** Live MediaStreams keyed by student id. */
  streams: Record<string, MediaStream>;
  reconnect: () => void;
}

interface SignalingMessage {
  type: string;
  studentId?: string;
  peers?: Array<{
    studentId: string;
    name: string;
    enrollmentNumber: string;
    email?: string;
  }>;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const SIGNALING_CONNECT_TIMEOUT_MS = 5000;
const MOCK_STUDENT_POOL = [
  { name: "Aarav Mehta", enrollmentNumber: "CS2023-0001", email: "aarav.mehta@student.edu" },
  { name: "Priya Sharma", enrollmentNumber: "CS2023-0042", email: "priya.sharma@student.edu" },
  { name: "Rohan Verma", enrollmentNumber: "CS2023-0007", email: "rohan.verma@student.edu" },
  { name: "Sneha Kulkarni", enrollmentNumber: "CS2023-0012", email: "sneha.kulkarni@student.edu" },
  { name: "Aditya Rao", enrollmentNumber: "CS2023-0023", email: "aditya.rao@student.edu" },
  { name: "Ishita Banerjee", enrollmentNumber: "CS2023-0031", email: "ishita.banerjee@student.edu" },
  { name: "Vikram Singh", enrollmentNumber: "CS2023-0018", email: "vikram.singh@student.edu" },
  { name: "Ananya Reddy", enrollmentNumber: "CS2023-0047", email: "ananya.reddy@student.edu" },
  { name: "Kabir Malhotra", enrollmentNumber: "CS2023-0051", email: "kabir.malhotra@student.edu" },
  { name: "Divya Nair", enrollmentNumber: "CS2023-0058", email: "divya.nair@student.edu" },
  { name: "Arjun Iyer", enrollmentNumber: "CS2023-0063", email: "arjun.iyer@student.edu" },
  { name: "Meera Krishnan", enrollmentNumber: "CS2023-0069", email: "meera.krishnan@student.edu" },
];

const MOCK_VIOLATIONS = [
  { type: "TAB_SWITCH", label: "Tab Switch", severity: "warning" as const },
  { type: "FACE_LOST", label: "Face Lost", severity: "warning" as const },
  { type: "PHONE_DETECTED", label: "Phone Detected", severity: "critical" as const },
  { type: "AI_OVERLAY", label: "AI Overlay", severity: "critical" as const },
  { type: "DEVTOOLS", label: "DevTools", severity: "critical" as const },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Creates a simulated live video stream: a canvas drawing the student's
 * initials over a gradient, captured via captureStream(). The "camera"
 * blinks every few seconds to feel alive.
 */
function createMockVideoStream(student: SupervisedStudent): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx2d = canvas.getContext("2d");

  const initials = student.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const draw = () => {
    if (!ctx2d) return;
    const now = Date.now();
    const gradient = ctx2d.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#312e81");
    gradient.addColorStop(1, "#4f46e5");
    ctx2d.fillStyle = gradient;
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    ctx2d.fillStyle = "rgba(255,255,255,0.95)";
    ctx2d.font = "bold 160px Arial, sans-serif";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText(initials, canvas.width / 2, canvas.height / 2 - 20);
    ctx2d.fillStyle = "rgba(255,255,255,0.6)";
    ctx2d.font = "22px Arial, sans-serif";
    ctx2d.fillText("MOCK FEED", canvas.width / 2, canvas.height / 2 + 110);
    // Blink indicator
    ctx2d.fillStyle = now % 4000 < 150 ? "#22c55e" : "#166534";
    ctx2d.beginPath();
    ctx2d.arc(40, 40, 12, 0, Math.PI * 2);
    ctx2d.fill();
  };

  draw();
  const stream = canvas.captureStream(10);
  const drawTimer = window.setInterval(draw, 2000);

  // Attach the interval to the stream so it can be cleaned up with it.
  (stream as MediaStream & { __mockTimer?: number }).__mockTimer = drawTimer;
  return stream;
}

/**
 * Simulated audio track: a near-silent oscillator through a media stream
 * destination. This gives mock streams a REAL audio track, so the expanded
 * modal's "audio enabled" view works end-to-end without an SFU.
 */
function createMockAudioTrack(): MediaStreamTrack {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = 180;
  gain.gain.value = 0.001;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  return ctx.createMediaStreamDestination().stream.getAudioTracks()[0];
}

/**
 * Monitors a student's audio track volume and flips `micActive` in the
 * store whenever speech-level energy is detected.
 */
function startMicActivityMonitor(stream: MediaStream, studentId: string, onActivity: (active: boolean) => void): () => void {
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) return () => {};

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  void ctx.resume().catch(() => {});

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const interval = window.setInterval(() => {
    analyser.getByteFrequencyData(frequencyData);
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i += 1) sum += frequencyData[i];
    const average = sum / frequencyData.length;
    onActivity(average > 22);
  }, 600);

  return () => {
    window.clearInterval(interval);
    source.disconnect();
    void ctx.close().catch(() => {});
  };
}

export function useWebRTCConsumer(options: WebRTCConsumerOptions): WebRTCConsumerResult {
  const { examId, sfuUrl, forceMock = false, mockStudentCount = 9, onConnectionChange } = options;

  const setConnected = useSupervisionStore((state) => state.setConnected);
  const upsertStudent = useSupervisionStore((state) => state.upsertStudent);
  const removeStudent = useSupervisionStore((state) => state.removeStudent);
  const setStreamStatus = useSupervisionStore((state) => state.setStreamStatus);
  const setMicActive = useSupervisionStore((state) => state.setMicActive);
  const addViolation = useSupervisionStore((state) => state.addViolation);
  const reset = useSupervisionStore((state) => state.reset);

  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [connected, setConnectedState] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  const mockStreamsRef = useRef<Record<string, MediaStream>>({});
  const cleanupRef = useRef<(() => void) | null>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  const mockTimersRef = useRef<number[]>([]);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<WebSocket | null>(null);

  const applyConnectionState = useCallback(
    (isConnected: boolean, isMock: boolean) => {
      setConnectedState(isConnected);
      setUsingMockData(isMock);
      setConnected(isConnected, isMock);
      onConnectionChange?.(isConnected, isMock);
    },
    [onConnectionChange, setConnected],
  );

  const connect = useCallback(() => {
    /* ---------------- Teardown any previous session ---------------- */
    cleanupRef.current?.();
    reset();
    setStreams({});
    setError(null);

    const teardown = () => {
      socketRef.current?.close();
      socketRef.current = null;
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      mockTimersRef.current.forEach((timer) => window.clearInterval(timer));
      mockTimersRef.current = [];
      cleanupFnsRef.current.forEach((stop) => stop());
      cleanupFnsRef.current = [];
      Object.values(mockStreamsRef.current).forEach((stream) => {
        const mockStream = stream as MediaStream & { __mockTimer?: number };
        if (mockStream.__mockTimer !== undefined) window.clearInterval(mockStream.__mockTimer);
        mockStream.getTracks().forEach((track) => track.stop());
      });
      mockStreamsRef.current = {};
      cleanupRef.current = null;
    };
    cleanupRef.current = teardown;

    /* ---------------- Mock fallback mode ---------------- */
    const startMockMode = () => {
      const count = Math.min(Math.max(mockStudentCount, 1), MOCK_STUDENT_POOL.length);
      const mockStudents: SupervisedStudent[] = MOCK_STUDENT_POOL.slice(0, count).map((pool, index) => ({
        id: `mock-${index + 1}`,
        name: pool.name,
        enrollmentNumber: pool.enrollmentNumber,
        email: pool.email,
        streamStatus: "live",
        hasVideo: true,
        hasAudio: true,
        micActive: false,
        violations: [],
        joinedAt: new Date(Date.now() - (index + 1) * 37_000).toISOString(),
      }));

      const mockStreams: Record<string, MediaStream> = {};
      mockStudents.forEach((student) => {
        upsertStudent(student);
        const videoStream = createMockVideoStream(student);
        const audioTrack = createMockAudioTrack();
        videoStream.addTrack(audioTrack);
        mockStreams[student.id] = videoStream;
        setStreamStatus(student.id, "live", true, true);

        // Simulated mic activity: random talking bursts.
        const micTimer = window.setInterval(() => {
          setMicActive(student.id, Math.random() < 0.55);
        }, 3500);
        mockTimersRef.current.push(micTimer);

        // Simulated violations: a student occasionally gets flagged.
        const violationTimer = window.setInterval(() => {
          const poolItem = MOCK_VIOLATIONS[Math.floor(Math.random() * MOCK_VIOLATIONS.length)];
          addViolation(student.id, poolItem);
        }, 28_000 + Math.random() * 22_000);
        mockTimersRef.current.push(violationTimer);
      });

      setStreams(mockStreams);
      mockStreamsRef.current = mockStreams;
      applyConnectionState(true, true);
      console.warn("[Supervision] SFU unavailable — running with simulated students.");
    };

    /* ---------------- Real WebRTC / SFU mode ---------------- */
    const startSfuMode = () => {
      if (!sfuUrl) {
        startMockMode();
        return;
      }

      let didConnect = false;
      const socket = new WebSocket(sfuUrl);
      socketRef.current = socket;

      const connectTimeout = window.setTimeout(() => {
        if (!didConnect) {
          console.error("[Supervision] Signaling connection timed out; switching to mock data.");
          teardown();
          setError("SFU unreachable — displaying simulated students.");
          startMockMode();
        }
      }, SIGNALING_CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "teacher-join", examId }));
      };

      const handlePeerOffer = async (studentId: string, offer: RTCSessionDescriptionInit) => {
        let pc = peerConnectionsRef.current.get(studentId);
        if (!pc) {
          pc = new RTCPeerConnection(RTC_CONFIG);
          pc.addTransceiver("video", { direction: "recvonly" });
          pc.addTransceiver("audio", { direction: "recvonly" });
          peerConnectionsRef.current.set(studentId, pc);

          pc.onicecandidate = (event) => {
            if (event.candidate && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ice-candidate", studentId, candidate: event.candidate.toJSON() }));
            }
          };

          pc.onconnectionstatechange = () => {
            const status: StreamStatus = pc?.connectionState === "connected" ? "live" : pc?.connectionState === "failed" || pc?.connectionState === "closed" ? "offline" : "connecting";
            setStreamStatus(studentId, status);
          };

          pc.ontrack = (event) => {
            setStreams((previous) => {
              const existing = previous[studentId];
              const stream = existing ?? new MediaStream();
              event.streams[0]?.getTracks().forEach((track) => stream.addTrack(track));
              setStreamStatus(studentId, "live", stream.getVideoTracks().length > 0, stream.getAudioTracks().length > 0);
              if (!existing && stream.getAudioTracks().length > 0) {
                const stopMonitor = startMicActivityMonitor(stream, studentId, (active) => setMicActive(studentId, active));
                cleanupFnsRef.current.push(stopMonitor);
              }
              return { ...previous, [studentId]: stream };
            });
          };
        }

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: "answer", studentId, answer: pc.localDescription }));
      };

      socket.onmessage = (event) => {
        let message: SignalingMessage;
        try {
          message = JSON.parse(event.data as string) as SignalingMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case "peers":
            didConnect = true;
            window.clearTimeout(connectTimeout);
            applyConnectionState(true, false);
            message.peers?.forEach((peer) => {
              upsertStudent({
                id: peer.studentId,
                name: peer.name,
                enrollmentNumber: peer.enrollmentNumber,
                email: peer.email,
                streamStatus: "connecting",
                hasVideo: false,
                hasAudio: false,
                micActive: false,
                violations: [],
                joinedAt: new Date().toISOString(),
              });
            });
            break;
          case "offer":
            if (message.studentId && message.offer) {
              void handlePeerOffer(message.studentId, message.offer).catch((err) => {
                console.error("[Supervision] Failed to answer offer:", err);
              });
            }
            break;
          case "ice-candidate":
            if (message.studentId && message.candidate) {
              const pc = peerConnectionsRef.current.get(message.studentId);
              void pc?.addIceCandidate(message.candidate).catch(() => {});
            }
            break;
          case "peer-left":
            if (message.studentId) {
              const leftStudentId = message.studentId;
              peerConnectionsRef.current.get(leftStudentId)?.close();
              peerConnectionsRef.current.delete(leftStudentId);
              removeStudent(leftStudentId);
              setStreams((previous) => {
                const next = { ...previous };
                delete next[leftStudentId];
                return next;
              });
            }
            break;
          default:
            break;
        }
      };

      socket.onerror = () => {
        console.error("[Supervision] Signaling WebSocket error.");
      };

      socket.onclose = () => {
        window.clearTimeout(connectTimeout);
        if (!didConnect) {
          teardown();
          setError("Signaling connection failed — displaying simulated students.");
          startMockMode();
        } else {
          setConnectedState(false);
          setConnected(false, false);
        }
      };
    };

    if (forceMock || !sfuUrl) {
      startMockMode();
    } else {
      startSfuMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, sfuUrl, forceMock, mockStudentCount, reconnectKey]);

  const reconnect = useCallback(() => {
    setReconnectKey((key) => key + 1);
  }, []);

  /* ---------------- Mount: connect once; unmount: full teardown ---------------- */
  useEffect(() => {
    connect();
    return () => {
      cleanupRef.current?.();
      reset();
    };
  }, [connect, reset]);

  return { connected, usingMockData, error, streams, reconnect };
}
