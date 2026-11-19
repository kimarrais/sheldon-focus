import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PauseIcon, PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
import {
  SkipForward,
  X,
  ExternalLink,
  ChevronDown,
  Flame,
} from 'lucide-react';
import type { DailyTask } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PomodoroFocusModalProps {
  task: DailyTask | null;
  isOpen: boolean;
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  onTogglePlay: () => void;
  onStopFocus: () => void;
  onClose: () => void;
  onCompleteTask: (taskId: string) => void;
  onOpenFloatingWidget: () => void;
}

export const PomodoroFocusModal: React.FC<PomodoroFocusModalProps> = ({
  task,
  isOpen,
  isRunning,
  remainingSeconds,
  totalSeconds,
  onTogglePlay,
  onStopFocus,
  onClose,
  onCompleteTask,
  onOpenFloatingWidget,
}) => {
  if (!isOpen) return null;

  const safeTotal = Math.max(1, totalSeconds);
  const safeRemaining = Math.max(0, remainingSeconds);
  const elapsedSeconds = Math.max(0, safeTotal - safeRemaining);
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / safeTotal) * 100));

  const formatHMS = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStopAndClose = () => {
    onStopFocus();
    onClose();
  };

  const handleSkip = () => {
    if (task) onCompleteTask(task.id);
    onStopFocus();
    onClose();
  };

  const handleSendToFloatingWidget = () => {
    onOpenFloatingWidget();
    onClose();
  };

  const TICK_COUNT = 72;
  const activeTicksCount = Math.round((progressPercent / 100) * TICK_COUNT);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center select-none overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between z-10">
          <Badge variant="cream" className="text-xs font-mono px-3 py-1 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-primary" />
            Focus Session
          </Badge>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendToFloatingWidget}
              title="Minimizar para Dynamic Island no Desktop"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar tela cheia (mantém timer ativo)"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task Title Banner */}
        <div className="mt-4 text-center z-10 max-w-md">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {task ? `${task.listName || task.project} • ${task.priority.toUpperCase()}` : 'FOCO LIVRE'}
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-1 truncate">
            {task ? task.title : 'Escolha uma tarefa'}
          </h2>
        </div>

        {/* Radial Tick Dial */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-6 flex items-center justify-center z-10">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {Array.from({ length: TICK_COUNT }).map((_, i) => {
              const angle = (i / TICK_COUNT) * 360;
              const isActive = i <= activeTicksCount;
              return (
                <div
                  key={i}
                  className="absolute w-1 origin-bottom transition-colors duration-300"
                  style={{
                    height: '50%',
                    transform: `rotate(${angle}deg)`,
                  }}
                >
                  <div
                    className={`w-1 h-3 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'bg-[#FB7213] shadow-[0_0_8px_#FB7213]'
                        : 'bg-muted/80'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-center text-center p-6 rounded-full bg-card/95 shadow-inner z-20 w-44 h-44 sm:w-48 sm:h-48 border border-border/80">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isRunning ? 'Em Andamento' : 'Pausado'}
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground tracking-tight my-1 tabular-nums">
              {formatHMS(safeRemaining)}
            </div>
            <div className="text-xs font-mono font-bold text-[#FB7213]">
              {progressPercent}% concluído
            </div>
            <span className="text-[11px] text-muted-foreground mt-1">
              Restam {formatHMS(safeRemaining)}
            </span>
          </div>
        </div>

        {/* Selected Task Pill */}
        <div className="w-full max-w-xs flex items-center justify-between px-4 py-2.5 rounded-2xl bg-secondary/60 border border-border text-xs z-10">
          <div className="truncate flex-1">
            <span className="text-muted-foreground mr-1.5 font-medium">Tarefa:</span>
            <span className="font-semibold text-foreground">
              {task ? task.title : 'Escolha uma tarefa'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-center gap-5 mt-6 z-10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleStopAndClose}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <HugeiconsIcon icon={StopIcon} size={16} />
            <span>Parar</span>
          </Button>

          <button
            type="button"
            onClick={onTogglePlay}
            title={isRunning ? 'Pausar foco' : 'Continuar foco'}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
              isRunning
                ? 'bg-[#FB7213] text-white shadow-orange-glow'
                : 'bg-[#2D2E30] text-white'
            }`}
          >
            {isRunning ? (
              <HugeiconsIcon icon={PauseIcon} size={28} strokeWidth={2.2} />
            ) : (
              <HugeiconsIcon icon={PlayIcon} size={28} strokeWidth={2} className="ml-0.5" />
            )}
          </button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="w-4 h-4" />
            <span>Concluir</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
