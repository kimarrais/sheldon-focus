import React from 'react';
import { Play, Pause, X, Maximize2 } from 'lucide-react';
import type { DailyTask } from '@shared/types';

interface InAppFloatingWidgetProps {
  task: DailyTask | null;
  remainingSeconds: number;
  isRunning: boolean;
  isVisible: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  onExpand: () => void;
}

export const InAppFloatingWidget: React.FC<InAppFloatingWidgetProps> = ({
  task,
  remainingSeconds,
  isRunning,
  isVisible,
  onTogglePlay,
  onClose,
  onExpand,
}) => {
  if (!isVisible || !task) return null;

  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  const timerStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <aside
      aria-label="Widget flutuante de foco Sheldon"
      className="fixed bottom-6 right-6 z-40 w-72 bg-[#120B1C]/95 border border-purple-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300 text-white select-none"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-purple-500/20">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-purple-400'}`} />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300">
            Sheldon Focus Timer
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExpand}
            title="Expandir sessão de foco"
            className="p-1 rounded-lg text-purple-300/70 hover:text-white hover:bg-purple-500/20 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fechar widget flutuante (Reativar nas configurações)"
            className="p-1 rounded-lg text-purple-300/70 hover:text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs font-semibold text-slate-200 truncate" title={task.title}>
        {task.title}
      </div>

      <div className="flex items-center justify-between mt-2 pt-1">
        <div className="font-mono text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_0_12px_rgba(192,38,211,0.6)]">
          {timerStr}
        </div>

        <button
          type="button"
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition-all"
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Iniciar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
