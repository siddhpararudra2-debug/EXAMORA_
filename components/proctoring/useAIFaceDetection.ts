"use client";

import { useEffect, useRef, useState } from "react";

export interface UseAIFaceDetectionOptions {
  /** Callback triggered when 0 faces (after grace period) or >1 face is detected */
  onViolation?: (reason: string, faceCount: number) => void;
  /** Detection interval in milliseconds. Default: 2000ms */
  intervalMs?: number;
  /** Grace period duration in milliseconds before a missing face triggers a violation. Default: 5000ms (5 seconds) */
  gracePeriodMs?: number;
  /** Whether AI face detection is active. Default: true */
  enabled?: boolean;
  /** Optional video element reference if an external stream is provided */
  externalVideoRef?: React.RefObject<HTMLVideoElement>;
}

export interface UseAIFaceDetectionReturn {
  faceCount: number;
  isModelLoading: boolean;
  modelError: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
}

interface BlazeFacePrediction {
  topLeft: [number, number] | Float32Array;
  bottomRight: [number, number] | Float32Array;
  probability?: [number] | Float32Array;
}

interface BlazeFaceModel {
  estimateFaces: (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    returnTensors?: boolean
  ) => Promise<BlazeFacePrediction[]>;
  dispose?: () => void;
}

/**
 * Loads the BlazeFace client-side face detection model dynamically.
 */
async function loadBlazeFaceModel(): Promise<BlazeFaceModel | null> {
  try {
    // 1. Try npm package imports
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const blazeface = await import("@tensorflow-models/blazeface");
    const model = await blazeface.load();
    return model as unknown as BlazeFaceModel;
  } catch (err) {
    console.warn("[AIFaceDetection] Package import fallback to CDN loader:", err);
  }

  // 2. Fallback to CDN script tags if direct import is unavailable
  try {
    if (typeof window === "undefined") return null;

    if (!(window as unknown as { tf?: unknown }).tf) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js");
    }
    const windowTF = (window as unknown as { tf?: { ready: () => Promise<void> } }).tf;
    if (windowTF) await windowTF.ready();

    if (!(window as unknown as { blazeface?: unknown }).blazeface) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js");
    }

    const windowBlaze = (window as unknown as { blazeface?: { load: () => Promise<BlazeFaceModel> } }).blazeface;
    if (windowBlaze) {
      const model = await windowBlaze.load();
      return model;
    }
  } catch (err) {
    console.warn("[AIFaceDetection] CDN script loading failed:", err);
  }

  return null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("document unavailable"));
      return;
    }
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

/**
 * Task 1 & Task 2: Client-Side AI Face Detection Hook for Examora.
 * Runs MediaPipe/BlazeFace face detection every 2000ms.
 * Includes a 5-Second Grace Period for missing face detection to eliminate false positives.
 * Triggers onViolation if face remains missing for >5s OR if >1 face is detected.
 * Manages model disposal and webcam track cleanup on unmount.
 */
export function useAIFaceDetection({
  onViolation,
  intervalMs = 2000,
  gracePeriodMs = 5000,
  enabled = true,
  externalVideoRef,
}: UseAIFaceDetectionOptions = {}): UseAIFaceDetectionReturn {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [faceCount, setFaceCount] = useState<number>(1);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const modelRef = useRef<BlazeFaceModel | null>(null);
  const onViolationRef = useRef(onViolation);
  const streamRef = useRef<MediaStream | null>(null);
  const isDetectingRef = useRef<boolean>(false);
  const noFaceStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  // Step 2 & Step 3: Initialize model and webcam stream
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let isMounted = true;
    let internalStream: MediaStream | null = null;

    async function init() {
      setIsModelLoading(true);
      setModelError(null);

      // Load AI Model
      const loadedModel = await loadBlazeFaceModel();
      if (!isMounted) {
        if (loadedModel?.dispose) loadedModel.dispose();
        return;
      }

      if (!loadedModel) {
        setModelError("Failed to load AI face detection model");
        setIsModelLoading(false);
      } else {
        modelRef.current = loadedModel;
        setIsModelLoading(false);
      }

      // Initialize Webcam if external video ref is not attached or has no srcObject
      if (!videoRef.current?.srcObject) {
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            internalStream = await navigator.mediaDevices.getUserMedia({
              video: { width: 640, height: 480, facingMode: "user" },
              audio: false,
            });

            if (!isMounted) {
              internalStream.getTracks().forEach((track) => track.stop());
              return;
            }

            streamRef.current = internalStream;
            setStream(internalStream);

            if (videoRef.current) {
              videoRef.current.srcObject = internalStream;
            }
          }
        } catch (err) {
          if (isMounted) {
            console.warn("[AIFaceDetection] Webcam access error:", err);
            setModelError("Webcam stream access denied");
          }
        }
      }
    }

    init();

    // Step 5: Clean up model & webcam tracks on unmount
    return () => {
      isMounted = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (internalStream) {
        internalStream.getTracks().forEach((track) => track.stop());
      }

      if (modelRef.current?.dispose) {
        try {
          modelRef.current.dispose();
        } catch (e) {
          console.warn("[AIFaceDetection] Model disposal error:", e);
        }
        modelRef.current = null;
      }
    };
  }, [enabled, videoRef]);

  // Step 3 & Step 4: Run face detection every intervalMs with 5-Second Grace Period
  useEffect(() => {
    if (!enabled || isModelLoading || modelError || typeof window === "undefined") return;

    const intervalId = setInterval(async () => {
      const videoElement = videoRef.current;
      const model = modelRef.current;

      if (!videoElement || !model || isDetectingRef.current) return;
      if (videoElement.readyState < 2) return; // HAVE_CURRENT_DATA

      try {
        isDetectingRef.current = true;
        const predictions = await model.estimateFaces(videoElement, false);
        const count = predictions.length;

        setFaceCount(count);

        // 5-Second Grace Period Logic
        if (count === 0) {
          const now = Date.now();
          if (noFaceStartTimeRef.current === null) {
            noFaceStartTimeRef.current = now;
          }

          const missingDurationMs = now - noFaceStartTimeRef.current;

          // Only trigger violation after full 5-second grace period expires
          if (missingDurationMs >= gracePeriodMs) {
            if (onViolationRef.current) {
              onViolationRef.current(
                `No face detected for over ${Math.round(gracePeriodMs / 1000)} seconds`,
                0
              );
            }
            noFaceStartTimeRef.current = null; // Reset grace period timer after violation
          }
        } else if (count === 1) {
          // Face restored / single face verified — reset missing face timer
          noFaceStartTimeRef.current = null;
        } else if (count > 1) {
          // Multiple faces detected — reset missing face timer & trigger violation immediately
          noFaceStartTimeRef.current = null;
          if (onViolationRef.current) {
            onViolationRef.current(`Multiple faces detected (${count} faces)`, count);
          }
        }
      } catch (err) {
        console.warn("[AIFaceDetection] Detection loop frame error:", err);
      } finally {
        isDetectingRef.current = false;
      }
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isModelLoading, modelError, intervalMs, gracePeriodMs, videoRef]);

  return {
    faceCount,
    isModelLoading,
    modelError,
    videoRef,
    stream,
  };
}

export default useAIFaceDetection;
