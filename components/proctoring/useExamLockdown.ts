"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Examora Proctoring Violation Types
 */
export type ViolationType =
  | "tab_switch"
  | "blur"
  | "ai_overlay"
  | "devtools"
  | "blocked_input"
  | "fullscreen_exit"
  | "mobile_back";

/**
 * Options configuration for the Exam Lockdown Hook
 */
export interface ExamLockdownOptions {
  /** Exam session token used for logging violations to API endpoint */
  token?: string;
  /** Maximum allowed warnings before triggering termination. Default: 3 */
  maxWarnings?: number;
  /** Async or sync callback fired AFTER the 3-beep warning sequence completes */
  onTerminate?: () => Promise<void> | void;
  /** Callback fired on every violation warning */
  onWarning?: (
    warningCount: number,
    violationType: ViolationType | string,
    details?: string
  ) => void;
  /** Whether lockdown enforcement is active. Default: true */
  enabled?: boolean;
  /** API endpoint template for violation sync. Default: /api/v1/exam-session/${token}/violation */
  violationEndpoint?: string;
  /** Screen URL to redirect after exam termination. Default: /exam/terminated */
  terminatedRedirectUrl?: string;
  /** Request and enforce fullscreen mode. Default: true */
  enableFullscreen?: boolean;
}

/**
 * Return interface for the useExamLockdown hook
 */
export interface ExamLockdownReturn {
  /** Current violation warning count */
  warnings: number;
  /** Whether the exam session has been terminated */
  terminated: boolean;
  /** Whether the document is currently in fullscreen mode */
  isFullscreen: boolean;
  /** Function to manually request cross-browser fullscreen */
  requestFullscreen: () => Promise<void>;
  /** Function to reset warning count */
  resetWarnings: () => void;
  /** Function to manually trigger a proctoring violation */
  triggerViolation: (
    violationType: ViolationType | string,
    details?: string
  ) => void;
}

/* ========================================================================== */
/* CONSTANTS & HEURISTICS                                                     */
/* ========================================================================== */

const DEFAULT_MAX_WARNINGS = 3;
const VIOLATION_COOLDOWN_MS = 600;
const DEVTOOLS_CHECK_INTERVAL_MS = 1000;
const DEVTOOLS_SIZE_DELTA_PX = 200;

/** Keywords used to detect injected AI assistant and floating overlay widgets */
const AI_OVERLAY_KEYWORDS = [
  "gemini",
  "chatgpt",
  "chat-gpt",
  "gpt",
  "copilot",
  "claude",
  "perplexity",
  "bard",
  "ai-assistant",
  "ai_overlay",
  "floating",
  "overlay",
  "chatbot",
  "chatbox",
  "widget",
];

/* ========================================================================== */
/* REQUIREMENT 1: 3-BEEP WARNING SYSTEM (Web Audio API)                        */
/* ========================================================================== */

/**
 * Plays exactly THREE loud beeps (800Hz, 300ms intervals) using the Web Audio API
 * (`AudioContext`, `OscillatorNode`) BEFORE any auto-submission/termination.
 * Does NOT rely on HTML5 audio files. Returns a Promise that resolves when all beeps complete.
 */
export const playThreeBeepWarningSequence = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) {
        console.warn("[ExamLockdown] Web Audio API not supported in this browser.");
        resolve();
        return;
      }

      const ctx = new AudioContextClass();

      // Resume context to pass browser autoplay restrictions
      const resumeCtx = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();

      resumeCtx
        .then(() => {
          const totalBeeps = 3;
          const beepFrequency = 800; // 800Hz tone
          const beepDuration = 0.2; // 200ms tone duration
          const intervalMs = 300; // 300ms start-to-start interval

          let beepsPlayed = 0;

          const playNextBeep = () => {
            if (beepsPlayed >= totalBeeps) {
              setTimeout(() => {
                if (ctx.state !== "closed") {
                  ctx.close().catch(() => {});
                }
                resolve();
              }, 250);
              return;
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(beepFrequency, ctx.currentTime);

            // Loud envelope for warning
            gain.gain.setValueAtTime(0.7, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + beepDuration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + beepDuration);

            beepsPlayed++;

            if (beepsPlayed < totalBeeps) {
              setTimeout(playNextBeep, intervalMs);
            } else {
              setTimeout(() => {
                if (ctx.state !== "closed") {
                  ctx.close().catch(() => {});
                }
                resolve();
              }, beepDuration * 1000 + 50);
            }
          };

          playNextBeep();
        })
        .catch((err) => {
          console.warn("[ExamLockdown] AudioContext resume error:", err);
          if (ctx.state !== "closed") {
            ctx.close().catch(() => {});
          }
          resolve();
        });
    } catch (err) {
      console.warn("[ExamLockdown] Web Audio 3-beep playback error:", err);
      resolve();
    }
  });
};

/* ========================================================================== */
/* FULLSCREEN HELPERS                                                         */
/* ========================================================================== */

const isFullscreenActive = (): boolean => {
  if (typeof document === "undefined") return false;
  const doc = document as unknown as {
    fullscreenElement?: Element;
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  };
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
  );
};

const requestFullscreen = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const docEl = document.documentElement as unknown as {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };

  try {
    if (docEl.requestFullscreen) await docEl.requestFullscreen();
    else if (docEl.webkitRequestFullscreen) await docEl.webkitRequestFullscreen();
    else if (docEl.mozRequestFullScreen) await docEl.mozRequestFullScreen();
    else if (docEl.msRequestFullscreen) await docEl.msRequestFullscreen();
  } catch (err) {
    console.warn("[ExamLockdown] Fullscreen request rejected:", err);
  }
};

/* ========================================================================== */
/* REQUIREMENT 2: AI OVERLAY DETECTION HEURISTICS                             */
/* ========================================================================== */

/**
 * Checks whether an element exhibits signatures of injected AI tools / floating overlays.
 */
const isAIOverlayElement = (el: Element): boolean => {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

  const className = typeof el.className === "string" ? el.className.toLowerCase() : "";
  const id = (el.id || "").toLowerCase();
  const tagName = el.tagName.toLowerCase();
  const role = (el.getAttribute("role") || "").toLowerCase();
  const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();

  const combinedString = `${tagName} ${className} ${id} ${role} ${ariaLabel}`;

  const matchedKeyword = AI_OVERLAY_KEYWORDS.some((kw) => combinedString.includes(kw));
  if (!matchedKeyword) return false;

  // Check element layout for floating / fixed characteristics
  if (typeof window !== "undefined") {
    try {
      const style = window.getComputedStyle(el);
      const isFloating = style.position === "fixed" || style.position === "absolute";
      const zIndex = parseInt(style.zIndex, 10);
      const isHighZIndex = !isNaN(zIndex) && zIndex >= 90;

      if (isFloating || isHighZIndex || className.includes("floating") || className.includes("overlay")) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return true;
};

/* ========================================================================== */
/* MAIN HOOK IMPLEMENTATION                                                  */
/* ========================================================================== */

/**
 * Core Browser Lockdown Hook for Examora.
 * Enforces strict anti-cheat proctoring rules:
 *  1. 3-Beep warning sound via Web Audio API before termination.
 *  2. AI overlay detection via MutationObserver.
 *  3. Violation API sync to /api/v1/exam-session/${token}/violation.
 *  4. Termination flow with onTerminate execution and redirection.
 *  5. Input blocking (cut, copy, paste, contextmenu, Ctrl+C/V/A/P, F12, Alt+Tab).
 */
export function useExamLockdown(
  optionsOrMaxWarnings: number | ExamLockdownOptions = DEFAULT_MAX_WARNINGS,
  onTerminateCallback?: () => void
): ExamLockdownReturn {
  // Parse parameters for backwards compatibility
  const options: ExamLockdownOptions =
    typeof optionsOrMaxWarnings === "number"
      ? { maxWarnings: optionsOrMaxWarnings, onTerminate: onTerminateCallback }
      : optionsOrMaxWarnings || {};

  const token = options.token || "active-session";
  const maxWarnings = options.maxWarnings ?? DEFAULT_MAX_WARNINGS;
  const enabled = options.enabled ?? true;
  const violationEndpoint = options.violationEndpoint;
  const terminatedRedirectUrl = options.terminatedRedirectUrl || "/exam/terminated";
  const enableFullscreen = options.enableFullscreen ?? true;

  const [warnings, setWarnings] = useState<number>(0);
  const [terminated, setTerminated] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Mutable refs to prevent stale closures inside event listeners
  const warningsRef = useRef<number>(0);
  const isTerminatedRef = useRef<boolean>(false);
  const lastViolationTimeRef = useRef<number>(0);
  const hasBeenFullscreenRef = useRef<boolean>(false);

  const tokenRef = useRef(token);
  const maxWarningsRef = useRef(maxWarnings);
  const enabledRef = useRef(enabled);
  const onWarningRef = useRef(options.onWarning);
  const onTerminateRef = useRef(options.onTerminate);
  const violationEndpointRef = useRef(violationEndpoint);
  const terminatedRedirectUrlRef = useRef(terminatedRedirectUrl);

  useEffect(() => {
    tokenRef.current = token;
    maxWarningsRef.current = maxWarnings;
    enabledRef.current = enabled;
    onWarningRef.current = options.onWarning;
    onTerminateRef.current = options.onTerminate;
    violationEndpointRef.current = violationEndpoint;
    terminatedRedirectUrlRef.current = terminatedRedirectUrl;
  }, [
    token,
    maxWarnings,
    enabled,
    options.onWarning,
    options.onTerminate,
    violationEndpoint,
    terminatedRedirectUrl,
  ]);

  /* ========================================================================== */
  /* REQUIREMENT 4: TERMINATION SEQUENCE FLOW                                   */
  /* ========================================================================== */

  /**
   * Executes termination flow:
   * 1. Plays 3 loud beeps via Web Audio API.
   * 2. Calls onTerminate callback.
   * 3. Redirects to Exam Terminated screen.
   */
  const executeTerminationFlow = useCallback(async () => {
    if (isTerminatedRef.current) return;
    isTerminatedRef.current = true;
    setTerminated(true);

    // Requirement 1: 3-Beep Warning System before termination
    await playThreeBeepWarningSequence();

    // Call user-provided onTerminate callback
    if (onTerminateRef.current) {
      try {
        await onTerminateRef.current();
      } catch (err) {
        console.error("[ExamLockdown] Error in onTerminate callback:", err);
      }
    }

    // Redirect student to Exam Terminated screen
    if (typeof window !== "undefined") {
      window.location.href = terminatedRedirectUrlRef.current || "/exam/terminated";
    }
  }, []);

  /* ========================================================================== */
  /* REQUIREMENT 3: VIOLATION SYNC VIA FETCH POST                               */
  /* ========================================================================== */

  /**
   * Triggers a POST request to backend API with violation details.
   */
  const sendViolationSync = useCallback(
    async (violationType: string, details: string, currentWarnings: number) => {
      try {
        const sessionToken = tokenRef.current || "active-session";
        const endpoint =
          violationEndpointRef.current || `/api/v1/exam-session/${sessionToken}/violation`;

        const payload = {
          type: violationType.toUpperCase().includes("TAB") ? "TAB_SWITCH" : violationType.toUpperCase(),
          description: details,
          metadata: {
            warningsCount: currentWarnings,
            maxWarnings: maxWarningsRef.current,
            url: typeof window !== "undefined" ? window.location.href : "",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const resData = (await res.json()) as {
            data?: { terminated?: boolean; warningsCount?: number };
          };
          if (resData.data?.warningsCount !== undefined) {
            const count = resData.data.warningsCount;
            warningsRef.current = count;
            setWarnings(count);
            if (resData.data.terminated || count >= maxWarningsRef.current) {
              executeTerminationFlow();
            }
          }
        }
      } catch (err) {
        console.warn("[ExamLockdown] Failed to sync violation to server:", err);
      }
    },
    [executeTerminationFlow]
  );

  /**
   * Central violation handler with cooldown, sync, and termination check.
   */
  const triggerViolation = useCallback(
    (violationType: ViolationType | string, details?: string) => {
      if (isTerminatedRef.current || !enabledRef.current) return;

      const now = Date.now();
      // Cooldown de-duplicates overlapping event listeners
      if (now - lastViolationTimeRef.current < VIOLATION_COOLDOWN_MS) {
        return;
      }
      lastViolationTimeRef.current = now;

      const nextWarnings = warningsRef.current + 1;
      warningsRef.current = nextWarnings;
      setWarnings(nextWarnings);

      const logDetails = details || `Proctoring violation: ${violationType}`;

      // Requirement 3: Immediately sync violation to server via POST request
      sendViolationSync(violationType, logDetails, nextWarnings);

      // Fire warning callback
      if (onWarningRef.current) {
        onWarningRef.current(nextWarnings, violationType, logDetails);
      }

      // Check for max warnings threshold
      if (nextWarnings >= maxWarningsRef.current) {
        executeTerminationFlow();
      }
    },
    [sendViolationSync, executeTerminationFlow]
  );

  const resetWarnings = useCallback(() => {
    warningsRef.current = 0;
    setWarnings(0);
    isTerminatedRef.current = false;
    setTerminated(false);
  }, []);

  /* ========================================================================== */
  /* LIFECYCLE & EVENT LISTENERS                                                */
  /* ========================================================================== */

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    /* ---------------- Fullscreen enforcement ---------------- */
    if (enableFullscreen) {
      hasBeenFullscreenRef.current = isFullscreenActive();
      setIsFullscreen(hasBeenFullscreenRef.current);
      requestFullscreen().then(() => {
        const active = isFullscreenActive();
        setIsFullscreen(active);
        if (active) hasBeenFullscreenRef.current = true;
      });
    }

    const handleFullscreenChange = () => {
      const active = isFullscreenActive();
      setIsFullscreen(active);
      if (active) {
        hasBeenFullscreenRef.current = true;
      } else if (hasBeenFullscreenRef.current) {
        triggerViolation("fullscreen_exit", "Exited fullscreen mode during exam");
      }
    };

    /* ---------------- Requirement 3: Tab switch & blur detection ---------------- */
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation("tab_switch", "Tab or window switch detected");
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden) {
        triggerViolation("blur", "Window lost focus (Alt+Tab or application switch)");
      }
    };

    /* ---------------- Requirement 2: AI Overlay Detection via MutationObserver ---------------- */
    const scanExistingDOMForOverlays = () => {
      const candidates = document.querySelectorAll<HTMLElement>(
        "div, section, aside, iframe, span"
      );
      for (let i = 0; i < candidates.length; i++) {
        if (isAIOverlayElement(candidates[i])) {
          triggerViolation(
            "ai_overlay",
            `AI overlay / floating element detected on page: <${candidates[i].tagName.toLowerCase()} id="${candidates[i].id}" class="${candidates[i].className}">`
          );
          break;
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check newly added nodes
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (isAIOverlayElement(el)) {
              triggerViolation(
                "ai_overlay",
                `Injected AI overlay detected: <${el.tagName.toLowerCase()} class="${el.className}">`
              );
              return;
            }
          }
        }
        // Check attribute modifications
        if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const targetEl = mutation.target as Element;
          if (isAIOverlayElement(targetEl)) {
            triggerViolation(
              "ai_overlay",
              `Modified AI overlay attributes on <${targetEl.tagName.toLowerCase()}>`
            );
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "style"],
    });

    scanExistingDOMForOverlays();

    /* ---------------- Requirement 3 & 5: DevTools detection ---------------- */
    const checkDevTools = () => {
      const sizeDelta = window.outerWidth - window.innerWidth;
      if (sizeDelta > DEVTOOLS_SIZE_DELTA_PX) {
        triggerViolation(
          "devtools",
          `Developer tools detected (Viewport delta ${sizeDelta}px)`
        );
      }
    };

    const devToolsInterval = setInterval(checkDevTools, DEVTOOLS_CHECK_INTERVAL_MS);

    /* ---------------- REQUIREMENT 5: INPUT BLOCKING & KEYBOARD SHORTCUTS ---------------- */
    const handleBlockedInputEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      const type = e.type;
      const detail =
        type === "contextmenu"
          ? "Right-click context menu disabled"
          : `${type.toUpperCase()} operation blocked`;

      triggerViolation("blocked_input", detail);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : "";
      const keyCode = e.keyCode;
      const isModifier = e.ctrlKey || e.metaKey;

      const isCtrlC = isModifier && (key === "c" || keyCode === 67);
      const isCtrlV = isModifier && (key === "v" || keyCode === 86);
      const isCtrlA = isModifier && (key === "a" || keyCode === 65);
      const isCtrlP = isModifier && (key === "p" || keyCode === 80);
      const isF12 = key === "f12" || keyCode === 123;
      const isAltTab = e.altKey && (key === "tab" || keyCode === 9);
      const isDevToolsCombo =
        isModifier && e.shiftKey && (key === "i" || key === "j" || keyCode === 73 || keyCode === 74);
      const isViewSource = isModifier && (key === "u" || keyCode === 85);
      const isPrintScreen = key === "printscreen" || keyCode === 44;

      if (
        isCtrlC ||
        isCtrlV ||
        isCtrlA ||
        isCtrlP ||
        isF12 ||
        isAltTab ||
        isDevToolsCombo ||
        isViewSource ||
        isPrintScreen
      ) {
        e.preventDefault();
        e.stopPropagation();

        let shortcutName = "Blocked keyboard shortcut";
        if (isCtrlC) shortcutName = "Ctrl+C (Copy)";
        else if (isCtrlV) shortcutName = "Ctrl+V (Paste)";
        else if (isCtrlA) shortcutName = "Ctrl+A (Select All)";
        else if (isCtrlP) shortcutName = "Ctrl+P (Print)";
        else if (isF12) shortcutName = "F12 (Developer Tools)";
        else if (isAltTab) shortcutName = "Alt+Tab (Window Switch)";
        else if (isDevToolsCombo) shortcutName = "Ctrl+Shift+I/J (DevTools)";
        else if (isViewSource) shortcutName = "Ctrl+U (View Source)";
        else if (isPrintScreen) shortcutName = "PrintScreen";

        triggerViolation("blocked_input", shortcutName);
      }
    };

    /* ---------------- Event Listener Registration ---------------- */
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    // Requirement 5: Prevent cut, copy, paste, contextmenu
    window.addEventListener("cut", handleBlockedInputEvent, true);
    window.addEventListener("copy", handleBlockedInputEvent, true);
    window.addEventListener("paste", handleBlockedInputEvent, true);
    window.addEventListener("contextmenu", handleBlockedInputEvent, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);

      window.removeEventListener("cut", handleBlockedInputEvent, true);
      window.removeEventListener("copy", handleBlockedInputEvent, true);
      window.removeEventListener("paste", handleBlockedInputEvent, true);
      window.removeEventListener("contextmenu", handleBlockedInputEvent, true);
      window.removeEventListener("keydown", handleKeyDown, true);

      observer.disconnect();
      clearInterval(devToolsInterval);
    };
  }, [enabled, enableFullscreen, triggerViolation]);

  return {
    warnings,
    terminated,
    isFullscreen,
    requestFullscreen,
    resetWarnings,
    triggerViolation,
  };
}

export default useExamLockdown;
