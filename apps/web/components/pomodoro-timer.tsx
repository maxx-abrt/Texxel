"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

type TimerMode = "focus" | "shortBreak" | "longBreak";

interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLong: number;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLong: 4,
  soundEnabled: true,
};

const MODE_COLORS: Record<TimerMode, { accent: string; bg: string; text: string; track: string }> = {
  focus: {
    accent: "stroke-foreground",
    bg: "bg-background",
    text: "text-foreground",
    track: "stroke-muted-foreground/8",
  },
  shortBreak: {
    accent: "stroke-emerald-500",
    bg: "bg-background",
    text: "text-emerald-600 dark:text-emerald-400",
    track: "stroke-emerald-500/8",
  },
  longBreak: {
    accent: "stroke-violet-500",
    bg: "bg-background",
    text: "text-violet-600 dark:text-violet-400",
    track: "stroke-violet-500/8",
  },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
    osc.type = "sine";
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
}

export function PomodoroTimer({ onClose }: { onClose?: () => void }) {
  const t = useTranslations("pomodoro");
  const [settings, setSettings] = useState<PomodoroSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("bureau-pomodoro");
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_SETTINGS;
  });

  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState(settings.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalTime = mode === "focus"
    ? settings.focusMinutes * 60
    : mode === "shortBreak"
      ? settings.shortBreakMinutes * 60
      : settings.longBreakMinutes * 60;

  const progress = totalTime > 0 ? 1 - timeLeft / totalTime : 0;

  useEffect(() => {
    localStorage.setItem("bureau-pomodoro", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          if (settings.soundEnabled) playNotificationSound();
          handleSessionComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, settings.soundEnabled]);

  const handleSessionComplete = useCallback(() => {
    if (mode === "focus") {
      const next = sessionsCompleted + 1;
      setSessionsCompleted(next);
      if (next % settings.sessionsBeforeLong === 0) {
        setMode("longBreak");
        setTimeLeft(settings.longBreakMinutes * 60);
      } else {
        setMode("shortBreak");
        setTimeLeft(settings.shortBreakMinutes * 60);
      }
    } else {
      setMode("focus");
      setTimeLeft(settings.focusMinutes * 60);
    }
  }, [mode, sessionsCompleted, settings]);

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(
      newMode === "focus"
        ? settings.focusMinutes * 60
        : newMode === "shortBreak"
          ? settings.shortBreakMinutes * 60
          : settings.longBreakMinutes * 60,
    );
  };

  const reset = () => { setIsRunning(false); setTimeLeft(totalTime); };
  const skip = () => { setIsRunning(false); handleSessionComplete(); };

  const adjustTime = (delta: number) => {
    if (isRunning) return;
    const key = mode === "focus" ? "focusMinutes" : mode === "shortBreak" ? "shortBreakMinutes" : "longBreakMinutes";
    const next = Math.max(1, Math.min(120, settings[key] + delta));
    setSettings((s) => ({ ...s, [key]: next }));
    setTimeLeft(next * 60);
  };

  const colors = MODE_COLORS[mode];

  // SVG ring — thin, elegant
  const size = 200;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className={cn("flex flex-col h-full select-none", colors.bg)}>
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
        <div className="flex items-center gap-3">
          {(["focus", "shortBreak", "longBreak"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "text-[11px] font-medium tracking-wide transition-all duration-200 pb-0.5",
                mode === m
                  ? cn("border-b border-current", colors.text)
                  : "text-muted-foreground/40 hover:text-muted-foreground/70",
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            {settings.soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center: ring + time */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              className={colors.track}
            />
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={cn(colors.accent, "transition-all duration-1000 ease-linear")}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Time display — large, clean, monospace-like */}
            <span className={cn(
              "text-[42px] font-extralight tracking-tight tabular-nums leading-none",
              colors.text,
            )}>
              {formatTime(timeLeft)}
            </span>

            {/* Adjust time buttons (only when paused) */}
            {!isRunning && (
              <div className="flex items-center gap-4 mt-3">
                <button
                  onClick={() => adjustTime(-5)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 text-muted-foreground/50 hover:text-foreground hover:border-border transition-all"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums w-12 text-center">
                  {settings[mode === "focus" ? "focusMinutes" : mode === "shortBreak" ? "shortBreakMinutes" : "longBreakMinutes"]} min
                </span>
                <button
                  onClick={() => adjustTime(5)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 text-muted-foreground/50 hover:text-foreground hover:border-border transition-all"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Session dots */}
        <div className="flex items-center gap-2 mt-5">
          {Array.from({ length: settings.sessionsBeforeLong }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all duration-300",
                i < (sessionsCompleted % settings.sessionsBeforeLong)
                  ? mode === "focus" ? "bg-foreground" : mode === "shortBreak" ? "bg-emerald-500" : "bg-violet-500"
                  : "bg-muted-foreground/15",
              )}
            />
          ))}
        </div>
      </div>

      {/* Bottom controls — minimal */}
      <div className="flex items-center justify-center gap-5 px-5 pb-6 shrink-0">
        <button
          onClick={reset}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          title={t("reset")}
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          onClick={() => setIsRunning(!isRunning)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]",
            isRunning
              ? "bg-foreground/5 border border-border/60 text-foreground"
              : "bg-foreground text-background",
          )}
        >
          {isRunning
            ? <Pause className="h-5 w-5" />
            : <Play className="h-5 w-5 ml-0.5" />
          }
        </button>

        <button
          onClick={skip}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          title={t("skip")}
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
