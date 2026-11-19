import React, { useEffect } from 'react';
import { Bell, Play, Clock, X } from 'lucide-react';
import type { DynamicIslandNotification } from '@shared/types';
import { IslandNotchFrame } from './IslandNotchFrame';

interface IslandNotificationBarProps {
  notification: DynamicIslandNotification;
  onStartFocus: (notification: DynamicIslandNotification) => void;
  onSnooze: (notification: DynamicIslandNotification) => void;
  onDismiss: (id: string) => void;
}

function playSoftNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 gentle chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.38);
    });
  } catch {
    // Ignore audio errors if blocked
  }
}

export const IslandNotificationBar: React.FC<IslandNotificationBarProps> = ({
  notification,
  onStartFocus,
  onSnooze,
  onDismiss,
}) => {
  useEffect(() => {
    playSoftNotificationChime();
  }, [notification.id, notification.triggeredAt]);

  return (
    <IslandNotchFrame
      ariaLabel={`Notificação de tarefa: ${notification.title}`}
      className="min-w-[370px] max-w-[530px] h-[56px] px-[10px] py-[6px] flex items-center justify-between gap-2.5 animate-[islandNotifSlide_320ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
    >
      <style>{`
        @keyframes islandNotifSlide {
          from {
            transform: translateY(-14px) scale(0.96);
            opacity: 0;
          }
          to {
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
        }
        @keyframes bellRing {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(16deg); }
          30% { transform: rotate(-14deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
      `}</style>

      {/* Left: Animated orange Bell tile */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="size-[38px] rounded-[10px] bg-[#FB7213]/15 border border-[#FB7213]/40 flex items-center justify-center shrink-0">
          <Bell className="size-4 text-[#FB7213] animate-[bellRing_1.4s_ease-in-out_infinite]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-[#FB7213] uppercase tracking-wider leading-tight">
            <span>Hora da tarefa</span>
            <span className="text-white/40">•</span>
            <span className="font-mono">{notification.timeLabel}</span>
          </div>
          <p className="font-['Plus_Jakarta_Sans'] font-semibold text-[12.5px] text-white truncate leading-snug">
            {notification.title}
          </p>
          {notification.project && (
            <p className="text-[9.5px] text-white/55 truncate leading-tight">
              {notification.project}
            </p>
          )}
        </div>
      </div>

      {/* Right: Action Pills */}
      <div className="flex items-center gap-[5px] shrink-0">
        <button
          type="button"
          onClick={() => onStartFocus(notification)}
          className="h-[28px] px-2.5 rounded-[8px] bg-[#FB7213] hover:bg-[#e5650c] active:scale-95 text-white text-[11px] font-semibold flex items-center gap-1 transition-all"
        >
          <Play className="size-3 fill-current" />
          <span>Focar</span>
        </button>

        <button
          type="button"
          onClick={() => onSnooze(notification)}
          title="Adiar 5 minutos"
          className="h-[28px] px-2 rounded-[8px] bg-[#1D1E22] hover:bg-[#2A2B30] active:scale-95 text-white/90 text-[11px] font-medium flex items-center gap-1 transition-all"
        >
          <Clock className="size-3 text-white/75" />
          <span>+5m</span>
        </button>

        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          title="Dispensar"
          className="size-[28px] rounded-[8px] bg-[#1D1E22] hover:bg-[#2A2B30] active:scale-95 text-white/70 hover:text-white flex items-center justify-center transition-all"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </IslandNotchFrame>
  );
};
