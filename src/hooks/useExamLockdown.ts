"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Examora Exam Lockdown Hook
 *
 * Hardens the student exam page against every common "cheating surface":
 *  - Tab switches / window minimization  (visibilitychange + blur)
 *  - Mobile hardware back button         (history.pushState + popstate)
 *  - AI overlay / chat widgets           (MutationObserver + DOM heuristics)
 *  - Developer tools                     (size delta + debugger timing trap)
 *  - Copy / paste / cut / right-click    (event preventDefault + keydown)
 *
 * When the violation counter reaches `maxWarnings`, the hook plays the
 * 3-beep Web Audio warning sequence (800 Hz, 300 ms intervals) and then
 * fires `onViolation` — the caller's auto-submission / termination handler.
 */

export type ViolationReason =
  | "tab_switch"
  | "app_switch"
  | "minimize"
  | "mobile_button"
  | "ai_overlay"
  | "devtools"
  | "screen_capture"
  | "keyboard_shortcut"
  | "input_blocked";

export interface ViolationContext {
  /** Total violation count at the moment of auto-submission. */
  warnings: number;
  /** Human-readable detail for logging / audit trails. */
  description?: string;
}

export interface ExamLockdownOptions {
  /** Maximum allowed violations before the beep + auto-submit sequence. Default: 3 */
  maxWarnings?: number;
  /** Whether lockdown enforcement is active. Default: true */
  enabled?: boolean;
  /** Fired on every violation with the updated count. */
  onWarning?: (warnings: number, reason: ViolationReason, description?: string) => void;
  /**
   * Fired AFTER the 3-beep sequence completes. This is the callback that
   * performs the final auto-submission API call and terminates the session.
   */
  onViolation?: (reason: ViolationReason, ctx: ViolationContext) => void;
  /** Fired when the termination sequence completes (final state). */
  onTerminate?: (reason: ViolationReason) => void;
  /** Number of beeps played before auto-submission. Default: 3 */
  beepCount?: number;
  /** Frequency of each beep in Hz. Default: 800 */
  beepFrequencyHz?: number;
  /** Gap between consecutive beeps in ms. Default: 300 */
  beepIntervalMs?: number;
  /** Detect injected AI overlay / floating widgets. Default: true */
  detectAIOverlays?: boolean;
  /** Detect developer tools via size delta + debugger trap. Default: true */
  detectDevTools?: boolean;
  /** Block cut / copy / paste / right-click and shortcut combos. Default: true */
  blockInput?: boolean;
  /** Block the mobile hardware back button. Default: true */
  blockMobileBack?: boolean;
  /** Request and enforce fullscreen on mount. Default: true */
  enableFullscreen?: boolean;
}

export type LockdownState = "active" | "beeping" | "terminated";

export interface ExamLockdownReturn {
  /** Current violation count (0..maxWarnings). */
  warnings: number;
  /** True once the termination sequence has fired. */
  terminated: boolean;
  /** Lifecycle state: active → beeping → terminated. */
  state: LockdownState;
  /** Whether the page is currently in fullscreen. */
  isFullscreen: boolean;
  /** Request fullscreen on the document element (user gesture required). */
  requestFullscreen: () => Promise<void>;
  /** Reset the violation counter (e.g. after a teacher clears a session). */
  resetWarnings: () => void;
  /** Manually trigger the beep + auto-submit sequence. */
  terminate: (reason?: ViolationReason) => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_MAX_WARNINGS = 3;
const DEFAULT_BEEP_COUNT = 3;
const DEFAULT_BEEP_FREQUENCY_HZ = 800;
const DEFAULT_BEEP_INTERVAL_MS = 300;
/** Debounce window that de-duplicates overlapping event listeners. */
const VIOLATION_COOLDOWN_MS = 800;
/** Polling cadence for devtools detection. */
const DEVTOOLS_CHECK_INTERVAL_MS = 1000;
/** Execution stall (ms) that implies a debugger breakpoint is active. */
const DEBUGGER_TRAP_THRESHOLD_MS = 100;
/** Devtools docked-detect when the outer/inner window delta exceeds this. */
const DEVTOOLS_SIZE_DELTA_PX = 200;
/** Debounce for the MutationObserver flood-control. */
const OVERLAY_OBSERVER_DEBOUNCE_MS = 800;

/** Class/id keywords that AI chat widgets commonly use. */
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
  "widget",
  "chatbox",
  "chat-bot",
  "chatbot",
  "fab-button",
];

const BLOCKED_SHORTCUTS: Record<string, ViolationReason> = {
  c: "keyboard_shortcut",
  v: "keyboard_shortcut",
  a: "keyboard_shortcut",
  p: "keyboard_shortcut",
};

/* ------------------------------------------------------------------ */
/* Web Audio — 3-beep warning sequence (no audio files)                */
/* ------------------------------------------------------------------ */

/**
 * Resolves a cross-browser AudioContext constructor.
 */
const getAudioContextConstructor = (): (typeof AudioContext) | undefined => {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
};

/**
 * Plays `count` loud square-wave beeps (800 Hz by default) with the given
 * gap between beeps, then resolves. Uses a single shared AudioContext and
 * zero external assets.
 */
const playBeepSequence = (count: number, frequencyHz: number, intervalMs: number): Promise<void> => {
  return new Promise((resolve) => {
    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass || typeof window === "undefined") {
      resolve();
      return;
    }

    const ctx = new AudioContextClass();
    let beepsPlayed = 0;

    const playNextBeep = () => {
      if (beepsPlayed >= count) {
        void ctx.close().catch(() => {});
        resolve();
        return;
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequencyHz, ctx.currentTime);

      // Loud, sharp envelope: instant attack, fast exponential decay.
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);

      beepsPlayed += 1;
      window.setTimeout(playNextBeep, intervalMs);
    };

    // `resume()` satisfies browser autoplay policies (exam pages already
    // had a user gesture when entering the exam).
    void ctx.resume().then(playNextBeep).catch(() => {
      ctx.close().catch(() => {});
      resolve();
    });
  });
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const isFullscreenActive = (): boolean => {
  if (typeof document === "undefined") return false;
  const doc = document as unknown as {
    fullscreenElement?: Element | null;
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
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
    console.warn("[ExamLockdown] Fullscreen request rejected or failed:", err);
  }
};

/**
 * Heuristic: does this element look like an injected floating AI widget?
 * Requires BOTH a keyword hit on its identity AND a floating layout style
 * (fixed/absolute position with a high z-index), which keeps false
 * positives low.
 */
const isSuspiciousOverlayElement = (el: Element): boolean => {
  const id = el.id || "";
  const className = typeof el.className === "string" ? el.className : "";
  const role = el.getAttribute("role") || "";
  const ariaLabel = el.getAttribute("aria-label") || "";
  const dataAttrs = Array.from(el.attributes)
    .filter((attr) => attr.name.startsWith("data-"))
    .map((attr) => attr.name)
    .join(" ");

  const haystack = `${el.tagName} ${className} ${id} ${role} ${ariaLabel} ${dataAttrs}`.toLowerCase();
  if (!AI_OVERLAY_KEYWORDS.some((keyword) => haystack.includes(keyword))) return false;

  const style = window.getComputedStyle(el);
  if (style.position !== "fixed" && style.position !== "absolute") return false;
  const zIndex = Number.parseInt(style.zIndex, 10);
  if (!Number.isNaN(zIndex) && zIndex < 999) return false;
  return true;
};

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useExamLockdown(
  optionsOrMaxWarnings: number | ExamLockdownOptions = DEFAULT_MAX_WARNINGS,
  onTerminateCallback?: () => void,
): ExamLockdownReturn {
  const [warnings, setWarnings] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const [state, setState] = useState<LockdownState>("active");
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ---------------- Backwards-compatible option parsing ------------- */
  const options: ExamLockdownOptions =
    typeof optionsOrMaxWarnings === "number"
      ? { maxWarnings: optionsOrMaxWarnings, onTerminate: onTerminateCallback }
      : optionsOrMaxWarnings;

  /* ---------------- Refs (avoid stale closures in listeners) --------- */
  const maxWarningsRef = useRef(options.maxWarnings ?? DEFAULT_MAX_WARNINGS);
  const enabledRef = useRef(options.enabled ?? true);
  const onWarningRef = useRef(options.onWarning);
  const onViolationRef = useRef(options.onViolation);
  const onTerminateRef = useRef(options.onTerminate);
  const beepCountRef = useRef(options.beepCount ?? DEFAULT_BEEP_COUNT);
  const beepFrequencyRef = useRef(options.beepFrequencyHz ?? DEFAULT_BEEP_FREQUENCY_HZ);
  const beepIntervalRef = useRef(options.beepIntervalMs ?? DEFAULT_BEEP_INTERVAL_MS);
  const detectAIOverlaysRef = useRef(options.detectAIOverlays ?? true);
  const detectDevToolsRef = useRef(options.detectDevTools ?? true);
  const blockInputRef = useRef(options.blockInput ?? true);
  const blockMobileBackRef = useRef(options.blockMobileBack ?? true);
  const enableFullscreenRef = useRef(options.enableFullscreen ?? true);

  const warningsRef = useRef(0);
  const terminatedRef = useRef(false);
  const lastViolationTimeRef = useRef(0);
  const hasBeenFullscreenRef = useRef(false);
  const beepTimeoutRef = useRef<number | null>(null);
  const devtoolsIntervalRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const overlayDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    maxWarningsRef.current = options.maxWarnings ?? DEFAULT_MAX_WARNINGS;
    enabledRef.current = options.enabled ?? true;
    onWarningRef.current = options.onWarning;
    onViolationRef.current = options.onViolation;
    onTerminateRef.current = options.onTerminate;
    beepCountRef.current = options.beepCount ?? DEFAULT_BEEP_COUNT;
    beepFrequencyRef.current = options.beepFrequencyHz ?? DEFAULT_BEEP_FREQUENCY_HZ;
    beepIntervalRef.current = options.beepIntervalMs ?? DEFAULT_BEEP_INTERVAL_MS;
    detectAIOverlaysRef.current = options.detectAIOverlays ?? true;
    detectDevToolsRef.current = options.detectDevTools ?? true;
    blockInputRef.current = options.blockInput ?? true;
    blockMobileBackRef.current = options.blockMobileBack ?? true;
    enableFullscreenRef.current = options.enableFullscreen ?? true;
  }, [options]);

  /**
   * Ends the session: 3-beep warning → onViolation (auto-submission) → onTerminate.
   * Idempotent — the sequence can only run once per session.
   */
  const terminate = useCallback(
    (reason: ViolationReason = "app_switch", description?: string) => {
      if (terminatedRef.current || !enabledRef.current) return;
      terminatedRef.current = true;
      setState("beeping");

      const fire = () => {
        setState("terminated");
        setTerminated(true);
        onViolationRef.current?.(reason, { warnings: warningsRef.current, description });
        onTerminateRef.current?.(reason);
      };

      const { beepCount, beepFrequency, beepInterval } = {
        beepCount: beepCountRef.current,
        beepFrequency: beepFrequencyRef.current,
        beepInterval: beepIntervalRef.current,
      };

      // Play the full warning sequence BEFORE calling the auto-submit handler.
      void playBeepSequence(beepCount, beepFrequency, beepInterval).then(fire);
    },
    [],
  );

  /**
   * Records a violation. Intermediate violations only play a single short
   * feedback beep; reaching maxWarnings escalates into the full 3-beep +
   * auto-submission sequence.
   */
  const triggerViolation = useCallback(
    (reason: ViolationReason, description?: string) => {
      if (terminatedRef.current || !enabledRef.current) return;

      const now = Date.now();
      if (now - lastViolationTimeRef.current < VIOLATION_COOLDOWN_MS) return;
      lastViolationTimeRef.current = now;

      const nextCount = warningsRef.current + 1;
      warningsRef.current = nextCount;
      setWarnings(nextCount);

      onWarningRef.current?.(nextCount, reason, description);

      if (nextCount >= maxWarningsRef.current) {
        terminate(reason, description);
      } else {
        void playBeepSequence(1, beepFrequencyRef.current, 0);
      }
    },
    [terminate],
  );

  const resetWarnings = useCallback(() => {
    warningsRef.current = 0;
    setWarnings(0);
    // Only re-arm when the auto-submission callback has not fired yet.
    if (!onViolationRef.current || state !== "terminated") {
      terminatedRef.current = false;
      setTerminated(false);
      setState("active");
    }
  }, [state]);

  /* ------------------------------------------------------------------ */
  /* Main effect: attach every detector                                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!enabledRef.current || typeof window === "undefined") return;

    /* ---------- Fullscreen ---------- */
    if (enableFullscreenRef.current) {
      hasBeenFullscreenRef.current = isFullscreenActive();
      setIsFullscreen(hasBeenFullscreenRef.current);
      void requestFullscreen().then(() => {
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
        triggerViolation("minimize", "Fullscreen mode was exited");
      }
    };

    /* ---------- Tab / window switch ---------- */
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation("tab_switch", "Tab or window switch detected");
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden) {
        triggerViolation("app_switch", "Window focus lost (Alt+Tab or app switch)");
      }
    };

    /* ---------- Mobile hardware back button ---------- */
    const handlePopState = () => {
      if (!blockMobileBackRef.current) return;
      // Immediately re-inject the sentinel so the back button stays blocked.
      window.history.pushState({ examLockdown: true }, document.title, window.location.href);
      triggerViolation("mobile_button", "Mobile hardware back button pressed");
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!blockMobileBackRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    /* ---------- AI overlay detection ---------- */
    const scanForOverlays = () => {
      const candidates: Element[] = Array.from(document.querySelectorAll<HTMLElement>("div, section, aside"));
      for (const el of candidates) {
        if (isSuspiciousOverlayElement(el)) {
          triggerViolation("ai_overlay", `AI overlay / floating widget detected (${el.tagName}#${el.id || el.className || "anonymous"})`);
          break;
        }
      }
    };

    const scheduleOverlayScan = () => {
      if (overlayDebounceRef.current !== null) window.clearTimeout(overlayDebounceRef.current);
      overlayDebounceRef.current = window.setTimeout(scanForOverlays, OVERLAY_OBSERVER_DEBOUNCE_MS);
    };

    const handleMutations = (mutations: MutationRecord[]) => {
      if (!detectAIOverlaysRef.current) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (isSuspiciousOverlayElement(node as Element)) {
            triggerViolation("ai_overlay", "AI overlay / floating widget injected into the page");
            return;
          }
        }
      }
      scheduleOverlayScan();
    };

    if (detectAIOverlaysRef.current) {
      const observer = new MutationObserver(handleMutations);
      observer.observe(document.body, { childList: true, subtree: true });
      observerRef.current = observer;
      scanForOverlays(); // catch overlays injected before the exam started
    }

    /* ---------- DevTools detection ---------- */
    const handleDevToolsCheck = () => {
      if (!detectDevToolsRef.current) return;

      // 1) Docked devtools widen the gap between outer and inner viewport.
      const sizeDelta = window.outerWidth - window.innerWidth;
      if (sizeDelta > DEVTOOLS_SIZE_DELTA_PX) {
        triggerViolation("devtools", `Developer tools detected (viewport delta ${sizeDelta}px)`);
        return;
      }

      // 2) Debugger trap: while devtools are open, the `debugger` statement
      //    halts this context, making the elapsed time far exceed 100 ms.
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const elapsed = performance.now() - start;
      if (elapsed > DEBUGGER_TRAP_THRESHOLD_MS) {
        triggerViolation("devtools", `Developer tools detected (debugger trap stalled ${Math.round(elapsed)}ms)`);
      }
    };

    if (detectDevToolsRef.current) {
      devtoolsIntervalRef.current = window.setInterval(handleDevToolsCheck, DEVTOOLS_CHECK_INTERVAL_MS);
    }

    /* ---------- Input blocking ---------- */
    const BLOCKED_EVENTS = ["cut", "copy", "paste", "contextmenu"] as const;

    const handleBlockedEvent = (e: Event) => {
      if (!blockInputRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const type = e.type;
      triggerViolation("input_blocked", type === "contextmenu" ? "Right-click context menu disabled" : `${type} operation blocked`);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!blockInputRef.current) return;
      const key = e.key.toLowerCase();
      const modifier = e.ctrlKey || e.metaKey;

      const isDevShortcut = key === "f12" || (modifier && e.shiftKey && key === "i");
      const isPrintScreen = key === "printscreen";
      const isAltTab = e.altKey && key === "tab";
      const isBlockedModifierCombo = modifier && key in BLOCKED_SHORTCUTS;

      if (isDevShortcut || isPrintScreen || isAltTab || isBlockedModifierCombo) {
        e.preventDefault();
        e.stopPropagation();
        const label = isDevShortcut ? (key === "f12" ? "F12" : "Ctrl+Shift+I") : isPrintScreen ? "PrintScreen" : isAltTab ? "Alt+Tab" : `Ctrl/Cmd+${key.toUpperCase()}`;
        triggerViolation("keyboard_shortcut", `Blocked keyboard shortcut: ${label}`);
      }
    };

    /* ---------- Attach listeners ---------- */
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown, true);
    BLOCKED_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleBlockedEvent, true));

    if (blockMobileBackRef.current) {
      // Sentinel entry so the first hardware-back press is intercepted.
      window.history.pushState({ examLockdown: true }, document.title, window.location.href);
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown, true);
      BLOCKED_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleBlockedEvent, true));

      observerRef.current?.disconnect();
      if (devtoolsIntervalRef.current !== null) window.clearInterval(devtoolsIntervalRef.current);
      if (overlayDebounceRef.current !== null) window.clearTimeout(overlayDebounceRef.current);
      if (beepTimeoutRef.current !== null) window.clearTimeout(beepTimeoutRef.current);
    };
  }, [triggerViolation]);

  return {
    warnings,
    terminated,
    state,
    isFullscreen,
    requestFullscreen,
    resetWarnings,
    terminate,
  };
}

export default useExamLockdown;
