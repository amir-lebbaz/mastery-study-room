"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Flame, Coffee } from "lucide-react";
import { TimerMode, RoomState } from "@/types";
import { soundService } from "@/lib/audio";
import { syncEngine } from "@/lib/supabase";

interface PomodoroHeroCardProps {
  roomState: RoomState;
  setRoomState: React.Dispatch<React.SetStateAction<RoomState>>;
  isHost: boolean;
  onTimeUpdate?: (formattedTime: string, isRunning: boolean) => void;
}

export const PomodoroHeroCard: React.FC<PomodoroHeroCardProps> = ({
  roomState,
  setRoomState,
  isHost,
  onTimeUpdate,
}) => {
  const { timer_mode, timer_ends_at, paused_remaining_seconds, is_running } = roomState;

  // Local helper to compute remaining seconds with zero DB writes
  const computeSecondsRemaining = (): number => {
    if (!is_running) {
      return paused_remaining_seconds ?? roomState.timer_seconds_remaining ?? (timer_mode === "focus" ? 3000 : 600);
    }
    if (timer_ends_at) {
      const diff = Math.floor((new Date(timer_ends_at).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return paused_remaining_seconds ?? 3000;
  };

  const [displaySeconds, setDisplaySeconds] = useState<number>(computeSecondsRemaining);

  const totalSeconds = timer_mode === "focus" ? 3000 : 600; // 50m or 10m
  const progressRatio = Math.max(0, Math.min(1, 1 - displaySeconds / totalSeconds));

  // Circular ring measurements
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Local 1-second countdown loop (ZERO DB writes while running)
  useEffect(() => {
    const current = computeSecondsRemaining();
    setDisplaySeconds(current);
    if (onTimeUpdate) {
      onTimeUpdate(formatTime(current), is_running);
    }

    let interval: NodeJS.Timeout;
    if (is_running) {
      interval = setInterval(() => {
        const remaining = computeSecondsRemaining();
        setDisplaySeconds(remaining);
        if (onTimeUpdate) {
          onTimeUpdate(formatTime(remaining), true);
        }

        if (remaining <= 0) {
          // Switch modes automatically
          const nextMode: TimerMode = timer_mode === "focus" ? "break" : "focus";
          const nextDuration = nextMode === "focus" ? 3000 : 600;

          if (nextMode === "break") {
            soundService.playBreakChime();
          } else {
            soundService.playFocusResumeChime();
          }

          if (isHost) {
            const updatedState: RoomState = {
              ...roomState,
              timer_mode: nextMode,
              timer_ends_at: new Date(Date.now() + nextDuration * 1000).toISOString(),
              paused_remaining_seconds: null,
              is_running: true,
            };
            setRoomState(updatedState);
            syncEngine.saveRoomState(updatedState);
          }
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [is_running, timer_ends_at, paused_remaining_seconds, timer_mode, isHost]);

  const toggleTimer = () => {
    soundService.playSignalPing();

    if (!is_running) {
      // Start or Resume
      const durationToRun = paused_remaining_seconds ?? (timer_mode === "focus" ? 3000 : 600);
      const endsAt = new Date(Date.now() + durationToRun * 1000).toISOString();
      const updatedState: RoomState = {
        ...roomState,
        is_running: true,
        timer_ends_at: endsAt,
        paused_remaining_seconds: null,
      };
      setRoomState(updatedState);
      syncEngine.saveRoomState(updatedState);
    } else {
      // Pause
      const currentRemaining = computeSecondsRemaining();
      const updatedState: RoomState = {
        ...roomState,
        is_running: false,
        timer_ends_at: null,
        paused_remaining_seconds: currentRemaining,
      };
      setRoomState(updatedState);
      syncEngine.saveRoomState(updatedState);
    }
  };

  const resetTimer = () => {
    soundService.playSignalPing();
    const duration = timer_mode === "focus" ? 3000 : 600;
    const updatedState: RoomState = {
      ...roomState,
      timer_ends_at: null,
      paused_remaining_seconds: duration,
      is_running: false,
    };
    setRoomState(updatedState);
    syncEngine.saveRoomState(updatedState);
  };

  const switchMode = (mode: TimerMode) => {
    soundService.playSignalPing();
    const duration = mode === "focus" ? 3000 : 600;
    const updatedState: RoomState = {
      ...roomState,
      timer_mode: mode,
      timer_ends_at: null,
      paused_remaining_seconds: duration,
      is_running: false,
    };
    setRoomState(updatedState);
    syncEngine.saveRoomState(updatedState);
  };

  return (
    <div className="bg-midnight-ink text-spectral-white rounded-3xl p-5 shadow-md border border-midnight-ink/50 flex flex-col justify-between relative overflow-hidden transition-all h-full min-h-[195px]">
      {/* Subtle background ambient glow */}
      <div
        className={`absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-all ${
          timer_mode === "focus" ? "bg-stormy-slate/20" : "bg-eerie-sage/25"
        }`}
      />

      {/* Top Row: Mode Badge & Control Pills */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {timer_mode === "focus" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stormy-slate/30 text-spectral-white border border-stormy-slate/40">
              <Flame className="w-3.5 h-3.5 text-eerie-sage" />
              <span>تركيز عميق (50 دقيقة)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-eerie-sage/30 text-spectral-white border border-eerie-sage/60 animate-pulse">
              <Coffee className="w-3.5 h-3.5 text-eerie-sage" />
              <span>استراحة قصيرة (10 دقائق)</span>
            </span>
          )}
        </div>

        {/* Mode Switch Buttons (Host only, or sync badge for Guest) */}
        {isHost ? (
          <div className="flex items-center gap-1 bg-black/25 p-0.5 rounded-full text-xs font-medium">
            <button
              onClick={() => switchMode("focus")}
              className={`px-2.5 py-0.5 rounded-full transition-all text-xs ${
                timer_mode === "focus"
                  ? "bg-spectral-white text-midnight-ink font-bold shadow-xs"
                  : "text-spectral-white/70 hover:text-spectral-white"
              }`}
            >
              50 د
            </button>
            <button
              onClick={() => switchMode("break")}
              className={`px-2.5 py-0.5 rounded-full transition-all text-xs ${
                timer_mode === "break"
                  ? "bg-eerie-sage text-midnight-ink font-bold shadow-xs"
                  : "text-spectral-white/70 hover:text-spectral-white"
              }`}
            >
              10 د
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-eerie-sage px-2.5 py-0.5 rounded-full bg-black/30 font-bold border border-eerie-sage/30">
            بإدارة أمير 👑
          </span>
        )}
      </div>

      {/* Center: Circular Progress & Time Display */}
      <div className="flex items-center justify-between my-2 z-10 gap-3">
        <div className="flex flex-col">
          <span className="text-3xl sm:text-4xl font-mono font-black tracking-tight text-spectral-white">
            {formatTime(displaySeconds)}
          </span>
          <span className="text-xs text-silver-fog font-medium mt-0.5 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                is_running ? "bg-emerald-400 animate-pulse" : "bg-stormy-slate"
              }`}
            />
            <span>{is_running ? "متزامن مباشرة مع الجميع" : "المؤقت متوقف مؤقتاً"}</span>
          </span>
        </div>

        {/* Circular SVG Ring */}
        <div className="relative flex items-center justify-center">
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 90 90">
            <circle
              cx="45"
              cy="45"
              r={radius}
              stroke="#536372"
              strokeWidth="5"
              fill="transparent"
              className="opacity-25"
            />
            <circle
              cx="45"
              cy="45"
              r={radius}
              stroke="#899C96"
              strokeWidth="5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-linear"
            />
          </svg>

          {/* Controls overlay in center */}
          <div className="absolute flex items-center justify-center">
            {isHost ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTimer}
                  className="w-8 h-8 rounded-full bg-spectral-white text-midnight-ink flex items-center justify-center hover:bg-white active:scale-90 transition-all shadow-md"
                  title={is_running ? "إيقاف مؤقت" : "بدء المؤقت"}
                >
                  {is_running ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={resetTimer}
                  className="w-6 h-6 rounded-full bg-stormy-slate/40 text-spectral-white hover:bg-stormy-slate/60 flex items-center justify-center active:scale-90 transition-all"
                  title="إعادة تعيين المؤقت"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-black/30 border border-stormy-slate/30 flex items-center justify-center text-eerie-sage text-xs font-bold"
                title="المؤقت متزامن مع صاحب الغرفة (أمير)"
              >
                {timer_mode === "focus" ? (
                  <Flame className="w-4 h-4 text-eerie-sage animate-pulse" />
                ) : (
                  <Coffee className="w-4 h-4 text-eerie-sage animate-bounce" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
