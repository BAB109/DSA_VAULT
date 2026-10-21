import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const TimerContext = createContext(null);

// Audio alert sound using Web Audio API (no external file needed)
const playChimeSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First chime note (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second chime note (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.2);
    gain2.gain.setValueAtTime(0.25, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.8);
  } catch {
    // Ignore audio context errors if browser blocks autoplay
  }
};

export function TimerProvider({ children }) {
  // 'countdown' or 'stopwatch'
  const [mode, setMode] = useState('countdown');
  // Target duration in seconds (default 25 minutes = 1500s)
  const [targetDuration, setTargetDuration] = useState(25 * 60);
  // Current time in seconds (countdown remaining, or stopwatch elapsed)
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasFinished, setHasFinished] = useState(false);

  // Wall-clock tracking to prevent tab-throttling drift
  const startTimeRef = useRef(null);
  const accumulatedElapsedRef = useRef(0);
  const timerRef = useRef(null);

  // Calculate total real elapsed seconds right now
  const computeCurrentElapsedSeconds = useCallback(() => {
    let elapsed = accumulatedElapsedRef.current;
    if (startTimeRef.current) {
      elapsed += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }
    return Math.max(0, elapsed);
  }, []);

  // Update display based on wall-clock time
  const syncDisplayFromWallClock = useCallback(() => {
    const elapsed = computeCurrentElapsedSeconds();
    if (mode === 'countdown') {
      const remaining = Math.max(0, targetDuration - elapsed);
      setSeconds(remaining);
      if (remaining <= 0 && isRunning) {
        setIsRunning(false);
        setHasFinished(true);
        startTimeRef.current = null;
        accumulatedElapsedRef.current = targetDuration;
        if (soundEnabled) {
          playChimeSound();
        }
      }
    } else {
      setSeconds(elapsed);
    }
  }, [computeCurrentElapsedSeconds, mode, targetDuration, isRunning, soundEnabled]);

  // Main tick loop
  useEffect(() => {
    if (isRunning) {
      // Sync immediately when starting
      syncDisplayFromWallClock();

      timerRef.current = setInterval(() => {
        syncDisplayFromWallClock();
      }, 500); // 500ms interval for responsive wall-clock sync
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, syncDisplayFromWallClock]);

  // Prevent background tab throttling: sync instantly when tab regains focus or visibility
  useEffect(() => {
    const handleSync = () => {
      if (isRunning) {
        syncDisplayFromWallClock();
      }
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [isRunning, syncDisplayFromWallClock]);

  const startTimer = useCallback(() => {
    setHasFinished(false);
    startTimeRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    if (startTimeRef.current) {
      const segment = Math.floor((Date.now() - startTimeRef.current) / 1000);
      accumulatedElapsedRef.current += Math.max(0, segment);
      startTimeRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setHasFinished(false);
    startTimeRef.current = null;
    accumulatedElapsedRef.current = 0;
    if (mode === 'countdown') {
      setSeconds(targetDuration);
    } else {
      setSeconds(0);
    }
  }, [mode, targetDuration]);

  const setCountdownMinutes = useCallback((mins) => {
    setIsRunning(false);
    setHasFinished(false);
    setMode('countdown');
    const totalSecs = mins * 60;
    setTargetDuration(totalSecs);
    setSeconds(totalSecs);
    startTimeRef.current = null;
    accumulatedElapsedRef.current = 0;
  }, []);

  const switchToStopwatch = useCallback(() => {
    setIsRunning(false);
    setHasFinished(false);
    setMode('stopwatch');
    setSeconds(0);
    startTimeRef.current = null;
    accumulatedElapsedRef.current = 0;
  }, []);

  const addMinutes = useCallback((mins) => {
    const additionalSecs = mins * 60;
    setTargetDuration((prev) => prev + additionalSecs);
    setSeconds((prev) => prev + additionalSecs);
  }, []);

  const formatTime = useCallback((totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Time spent in minutes for problem logging (calculates exact real elapsed time)
  const getElapsedMinutes = useCallback(() => {
    const elapsedSec = computeCurrentElapsedSeconds();
    if (elapsedSec < 45) {
      // Under 45 seconds -> minimum 1 minute
      return 1;
    }
    // Round to nearest minute (e.g. 90s -> 2m, 120s -> 2m, 150s -> 3m)
    return Math.max(1, Math.round(elapsedSec / 60));
  }, [computeCurrentElapsedSeconds]);

  // Exact formatted string (e.g., "2m" or "2m 14s")
  const getElapsedFormatted = useCallback(() => {
    const elapsedSec = computeCurrentElapsedSeconds();
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    if (m === 0) return `${Math.max(1, s)}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  }, [computeCurrentElapsedSeconds]);

  return (
    <TimerContext.Provider
      value={{
        mode,
        seconds,
        targetDuration,
        isRunning,
        hasFinished,
        soundEnabled,
        setSoundEnabled,
        startTimer,
        pauseTimer,
        resetTimer,
        setCountdownMinutes,
        switchToStopwatch,
        addMinutes,
        formatTime,
        getElapsedMinutes,
        getElapsedFormatted,
        computeCurrentElapsedSeconds,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return ctx;
}
