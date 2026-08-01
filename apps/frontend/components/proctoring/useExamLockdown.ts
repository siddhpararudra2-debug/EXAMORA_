"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface ExamLockdownOptions {
  /** Maximum number of allowed violations before triggering onTerminate. Default: 3 */
  maxWarnings?: number;
  /** Callback fired when total warnings reach maxWarnings */
  onTerminate?: () => void;
  /** Optional callback fired on every warning violation */
  onWarning?: (warningCount: number, reason: string) => void;
  /** Whether lockdown enforcement is active. Default: true */
  enabled?: boolean;
}

export interface ExamLockdownReturn {
  warnings: number;
  isFullscreen: boolean;
  requestFullscreen: () => Promise<void>;
  resetWarnings: () => void;
}

/**
 * Checks if the document is currently in fullscreen mode (cross-browser).
 */
const isFullscreenActive = (): boolean => {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
      (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
  );
};

/**
 * Requests fullscreen mode on the document element (cross-browser).
 */
const requestFullscreen = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const docEl = document.documentElement as unknown as {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };

  try {
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
    }
  } catch (err) {
    console.warn("[ExamLockdown] Fullscreen request rejected or failed:", err);
  }
};

/**
 * Plays a short warning beep sound using the Web Audio API without external assets.
 */
const playBeepSound = (): void => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz beep

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    // Clean up AudioContext after sound finishes
    setTimeout(() => {
      if (ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
    }, 400);
  } catch (err) {
    console.warn("[ExamLockdown] Web Audio API playback error:", err);
  }
};

/**
 * Core Browser Lockdown Hook for Examora.
 * Enforces fullscreen mode, tab switch detection, and keyboard/mouse blocking.
 */
export function useExamLockdown(
  optionsOrMaxWarnings: number | ExamLockdownOptions = 3,
  onTerminateCallback?: () => void
): ExamLockdownReturn {
  let maxWarnings = 3;
  let onTerminate: (() => void) | undefined;
  let onWarning: ((warningCount: number, reason: string) => void) | undefined;
  let enabled = true;

  if (typeof optionsOrMaxWarnings === "number") {
    maxWarnings = optionsOrMaxWarnings;
    onTerminate = onTerminateCallback;
  } else if (optionsOrMaxWarnings && typeof optionsOrMaxWarnings === "object") {
    maxWarnings = optionsOrMaxWarnings.maxWarnings ?? 3;
    onTerminate = optionsOrMaxWarnings.onTerminate;
    onWarning = optionsOrMaxWarnings.onWarning;
    enabled = optionsOrMaxWarnings.enabled ?? true;
  }

  const [warnings, setWarnings] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const lastWarningTimeRef = useRef<number>(0);
  const onTerminateRef = useRef(onTerminate);
  const onWarningRef = useRef(onWarning);
  const maxWarningsRef = useRef(maxWarnings);

  useEffect(() => {
    onTerminateRef.current = onTerminate;
    onWarningRef.current = onWarning;
    maxWarningsRef.current = maxWarnings;
  }, [onTerminate, onWarning, maxWarnings]);

  const triggerWarning = useCallback((reason: string) => {
    const now = Date.now();
    // 500ms cooldown to prevent duplicate triggers from overlapping event listeners
    if (now - lastWarningTimeRef.current < 500) {
      return;
    }
    lastWarningTimeRef.current = now;

    playBeepSound();

    setWarnings((prevWarnings) => {
      const nextCount = prevWarnings + 1;

      if (onWarningRef.current) {
        onWarningRef.current(nextCount, reason);
      }

      if (nextCount >= maxWarningsRef.current) {
        if (onTerminateRef.current) {
          onTerminateRef.current();
        }
      }
      return nextCount;
    });
  }, []);

  const resetWarnings = useCallback(() => {
    setWarnings(0);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let hasBeenFullscreen = isFullscreenActive();
    setIsFullscreen(hasBeenFullscreen);

    // Step 2: Request fullscreen on mount
    requestFullscreen().then(() => {
      const active = isFullscreenActive();
      setIsFullscreen(active);
      if (active) {
        hasBeenFullscreen = true;
      }
    });

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      const currentlyFullscreen = isFullscreenActive();
      setIsFullscreen(currentlyFullscreen);

      if (currentlyFullscreen) {
        hasBeenFullscreen = true;
      } else if (hasBeenFullscreen) {
        triggerWarning("Exited fullscreen mode");
      }
    };

    // Step 3: Page Visibility API (Tab/Window switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning("Tab or window switch detected");
      }
    };

    // Step 4: Right-click contextmenu blocking
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerWarning("Right-click context menu disabled");
    };

    // Step 4: Keyboard blocking (F12, Ctrl+Shift+I, Ctrl+C, Ctrl+V, Ctrl+P, PrintScreen, Alt+Tab)
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const keyCode = e.keyCode;

      const isF12 = key === "f12" || keyCode === 123;
      const isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (key === "i" || keyCode === 73);
      const isCtrlC = (e.ctrlKey || e.metaKey) && (key === "c" || keyCode === 67);
      const isCtrlV = (e.ctrlKey || e.metaKey) && (key === "v" || keyCode === 86);
      const isCtrlP = (e.ctrlKey || e.metaKey) && (key === "p" || keyCode === 80);
      const isPrintScreen = key === "printscreen" || keyCode === 44;
      const isAltTab = e.altKey && (key === "tab" || keyCode === 9);

      if (isF12 || isCtrlShiftI || isCtrlC || isCtrlV || isCtrlP || isPrintScreen || isAltTab) {
        e.preventDefault();
        e.stopPropagation();

        let shortcutName = "Blocked keyboard shortcut";
        if (isF12) shortcutName = "F12 Developer Tools";
        else if (isCtrlShiftI) shortcutName = "Ctrl+Shift+I Developer Tools";
        else if (isCtrlC) shortcutName = "Copy (Ctrl+C)";
        else if (isCtrlV) shortcutName = "Paste (Ctrl+V)";
        else if (isCtrlP) shortcutName = "Print (Ctrl+P)";
        else if (isPrintScreen) shortcutName = "PrintScreen";
        else if (isAltTab) shortcutName = "Alt+Tab Window Switch";

        triggerWarning(shortcutName);
      }
    };

    // Attach event listeners
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, triggerWarning]);

  return {
    warnings,
    isFullscreen,
    requestFullscreen,
    resetWarnings,
  };
}

export default useExamLockdown;
