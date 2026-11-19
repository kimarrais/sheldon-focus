import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PauseIcon, PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
import type { DailyTask } from '@shared/types';
import arrowDownSvg from '../../assets/figma/v2/arrow-down-01.svg';
import volumeSvg from '../../assets/figma/v2/volume-02.svg';
import pipSvg from '../../assets/figma/v2/picture-in-picture-01.svg';
import fullScreenSvg from '../../assets/figma/v2/full-screen.svg';
import filterSvg from '../../assets/figma/v2/filter-horizontal.svg';

interface FloatingFocusBarProps {
  tasks: DailyTask[];
  selectedTask: DailyTask | null;
  onSelectTask: (task: DailyTask | null) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStopFocus: () => void;
  remainingSeconds: number;
  totalSeconds: number;
  onOpenFullscreenFocus: () => void;
  onTogglePipWidget: () => void;
  onSetPresetMinutes?: (minutes: number) => void;
}

const TimerGaugeRing: React.FC<{ progress: number }> = ({ progress }) => {
  const size = 23;
  const strokeWidth = 2.4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = progress <= 0 ? 0 : Math.max(0.04, Math.min(1, progress));
  const dashOffset = circumference * (1 - normalized);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="stroke-[#2D2E30] dark:stroke-[#D6D8E0]"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {normalized > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#FB7213"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          fill="none"
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      )}
    </svg>
  );
};

export const FloatingFocusBar: React.FC<FloatingFocusBarProps> = ({
  tasks,
  selectedTask,
  onSelectTask,
  isRunning,
  onTogglePlay,
  onStopFocus,
  remainingSeconds,
  totalSeconds,
  onOpenFullscreenFocus,
  onTogglePipWidget,
  onSetPresetMinutes,
}) => {
  const [showTaskDropdown, setShowTaskDropdown] = useState<boolean>(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const formatTime = (secs: number) => {
    const safe = Math.max(0, Math.floor(secs));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const safeTotal = Math.max(1, totalSeconds);
  const hasActiveProgress = isRunning || remainingSeconds < safeTotal;
  const elapsedRatio = hasActiveProgress
    ? Math.max(0.03, Math.min(1, (safeTotal - remainingSeconds) / safeTotal))
    : 0;
  const canStop = Boolean(selectedTask) || isRunning || remainingSeconds !== safeTotal;

  return (
    <div className="bg-[#2D2E30] dark:bg-white text-white dark:text-[#242424] h-[54px] w-full rounded-[16px] shadow-[0_10px_28px_rgba(16,24,40,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] p-1.5 flex items-center justify-between gap-2 shrink-0 select-none relative z-30 border border-transparent dark:border-white">
      {/* Left Section: Play/Pause + Stop + Timer + Task Selector */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            title={isRunning ? 'Pausar foco' : 'Iniciar / Continuar foco'}
            aria-label={isRunning ? 'Pausar foco' : 'Iniciar foco'}
            className="bg-[#404244] dark:bg-[#EFEFF3] hover:bg-[#4E5154] dark:hover:bg-[#E4E6EC] active:scale-95 transition-all duration-150 size-[40px] rounded-[11px] flex items-center justify-center shrink-0 text-white dark:text-[#242424] group"
          >
            {isRunning ? (
              <HugeiconsIcon
                icon={PauseIcon}
                size={18}
                strokeWidth={2.1}
                className="text-[#FB7213] group-hover:scale-110 transition-transform"
              />
            ) : (
              <HugeiconsIcon
                icon={PlayIcon}
                size={18}
                strokeWidth={1.9}
                className="text-white dark:text-[#242424] ml-0.5 group-hover:scale-110 transition-transform"
              />
            )}
          </button>

          {/* Stop Button */}
          <button
            type="button"
            onClick={onStopFocus}
            disabled={!canStop}
            title="Parar foco e deselecionar tarefa"
            aria-label="Parar foco"
            className={`size-[40px] rounded-[11px] flex items-center justify-center shrink-0 transition-all duration-150 group ${
              canStop
                ? 'bg-[#404244] dark:bg-[#EFEFF3] hover:bg-[#E05555]/25 text-white dark:text-[#242424] hover:text-[#FF8A8A] dark:hover:text-[#DC2626] active:scale-95 cursor-pointer'
                : 'bg-[#404244]/55 dark:bg-[#EFEFF3]/65 text-white/30 dark:text-[#242424]/25 cursor-not-allowed'
            }`}
          >
            <HugeiconsIcon
              icon={StopIcon}
              size={16}
              strokeWidth={2}
              className={canStop ? 'group-hover:scale-110 transition-transform' : ''}
            />
          </button>

          {/* Timer Block */}
          <div className="bg-[#404244] dark:bg-[#EFEFF3] h-[40px] rounded-[12px] px-2.5 flex items-center justify-center gap-1.5 shrink-0">
            <TimerGaugeRing progress={elapsedRatio} />
            <span className="text-[15px] xl:text-[16px] font-semibold text-white dark:text-[#242424] tracking-wide tabular-nums">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="bg-[#5E6064] dark:bg-[#D1D5DB] h-[14px] w-[1.5px] rounded-full shrink-0" />

        {/* Task Selector Dropdown */}
        <div className="relative min-w-0 flex-1 max-w-[260px]">
          <button
            type="button"
            onClick={() => {
              setShowTaskDropdown((prev) => !prev);
              setShowPresetsMenu(false);
            }}
            className="flex items-center gap-1 hover:bg-white/5 dark:hover:bg-black/5 px-1.5 py-1 rounded-[10px] transition-colors text-left w-full"
          >
            <span className="text-[11.5px] xl:text-[12.5px] font-medium text-white dark:text-[#242424] truncate">
              {selectedTask ? selectedTask.title : 'Escolha uma tarefa'}
            </span>
            <div
              className={`shrink-0 flex items-center justify-center transition-transform duration-200 ${
                showTaskDropdown ? 'rotate-0' : '-rotate-90'
              }`}
            >
              <img
                src={arrowDownSvg}
                width={13}
                height={13}
                alt="Selecionar"
                className="block dark:invert"
              />
            </div>
          </button>

          {showTaskDropdown && (
            <div className="absolute left-0 bottom-[54px] bg-[#2D2E30] dark:bg-white text-white dark:text-[#242424] rounded-[14px] border border-white/10 dark:border-[#E5E7EB] shadow-2xl py-1.5 w-64 sm:w-72 max-h-64 overflow-y-auto sheldon-scroll z-50 flex flex-col text-xs">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-white/50 dark:text-[#6D6D6D] uppercase tracking-wider border-b border-white/10 dark:border-[#E5E7EB]">
                Selecione a tarefa para foco
              </div>

              {selectedTask && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectTask(null);
                    setShowTaskDropdown(false);
                  }}
                  className="px-3 py-1.5 text-left text-[11px] font-medium text-white/60 dark:text-[#6D6D6D] hover:bg-white/10 dark:hover:bg-[#F5F6FA] hover:text-white dark:hover:text-[#242424] border-b border-white/5 dark:border-[#F1F3F7]"
                >
                  × Limpar seleção (Escolha uma tarefa)
                </button>
              )}

              {tasks.filter((t) => !t.completed).length === 0 ? (
                <div className="px-3.5 py-2.5 text-[11px] text-white/40 dark:text-[#6D6D6D]">
                  Nenhuma tarefa pendente.
                </div>
              ) : (
                tasks
                  .filter((t) => !t.completed)
                  .map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => {
                        onSelectTask(t);
                        setShowTaskDropdown(false);
                      }}
                      className={`px-3 py-1.5 text-left hover:bg-white/10 dark:hover:bg-[#F5F6FA] flex items-center justify-between gap-2 transition-colors ${
                        selectedTask?.id === t.id
                          ? 'bg-[#FB7213]/20 text-[#FB7213] font-semibold'
                          : 'text-white/90 dark:text-[#242424]'
                      }`}
                    >
                      <span className="truncate text-[11.5px]">{t.title}</span>
                      {t.estimatedMinutes && (
                        <span className="text-[10px] text-white/45 dark:text-[#6D6D6D] shrink-0">
                          {t.estimatedMinutes}m
                        </span>
                      )}
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Volume, PiP, Fullscreen, Filter Controls */}
      <div className="bg-[#404244] dark:bg-[#EFEFF3] rounded-[9px] p-1 flex items-center gap-1 shrink-0 relative">
        <button
          type="button"
          onClick={() => setIsMuted((prev) => !prev)}
          title={isMuted ? 'Áudio desativado' : 'Som ambiente ativo'}
          className={`bg-[#2D2E30] dark:bg-white hover:bg-[#383A3C] dark:hover:bg-[#F7F8FA] active:scale-95 size-[30px] rounded-[7.5px] flex items-center justify-center transition-all ${
            isMuted ? 'opacity-45' : 'opacity-100'
          }`}
        >
          <img src={volumeSvg} width={16} height={16} alt="Volume" className="block shrink-0 dark:invert" />
        </button>

        <div className="bg-[#5E6064] dark:bg-[#D1D5DB] h-[14px] w-[1.5px] rounded-full shrink-0" />

        <button
          type="button"
          onClick={onTogglePipWidget}
          title="Alternar Dynamic Island / Mini-Widget no Desktop"
          className="bg-[#2D2E30] dark:bg-white hover:bg-[#383A3C] dark:hover:bg-[#F7F8FA] active:scale-95 size-[30px] rounded-[7.5px] flex items-center justify-center transition-all"
        >
          <img src={pipSvg} width={16} height={16} alt="PiP" className="block shrink-0 dark:invert" />
        </button>

        <button
          type="button"
          onClick={onOpenFullscreenFocus}
          title="Modo Foco em Tela Cheia"
          className="bg-[#2D2E30] dark:bg-white hover:bg-[#383A3C] dark:hover:bg-[#F7F8FA] active:scale-95 size-[30px] rounded-[7.5px] flex items-center justify-center transition-all"
        >
          <img
            src={fullScreenSvg}
            width={16}
            height={16}
            alt="Tela Cheia"
            className="block shrink-0 dark:invert"
          />
        </button>

        <div className="bg-[#5E6064] dark:bg-[#D1D5DB] h-[14px] w-[1.5px] rounded-full shrink-0" />

        <button
          type="button"
          onClick={() => {
            setShowPresetsMenu((prev) => !prev);
            setShowTaskDropdown(false);
          }}
          title="Duração da sessão"
          className="bg-[#2D2E30] dark:bg-white hover:bg-[#383A3C] dark:hover:bg-[#F7F8FA] active:scale-95 size-[30px] rounded-[7.5px] flex items-center justify-center transition-all"
        >
          <img src={filterSvg} width={16} height={16} alt="Presets" className="block shrink-0 dark:invert" />
        </button>

        {showPresetsMenu && (
          <div className="absolute right-0 bottom-[54px] bg-[#2D2E30] dark:bg-white text-white dark:text-[#242424] rounded-[12px] border border-white/10 dark:border-[#E5E7EB] shadow-2xl py-1.5 w-44 z-50 flex flex-col text-xs">
            <div className="px-3 py-1 text-[10px] font-semibold text-white/50 dark:text-[#6D6D6D] uppercase tracking-wider border-b border-white/10 dark:border-[#E5E7EB]">
              Tempo de Foco:
            </div>
            {[15, 25, 45, 60, 90].map((mins) => (
              <button
                type="button"
                key={mins}
                onClick={() => {
                  onSetPresetMinutes?.(mins);
                  setShowPresetsMenu(false);
                }}
                className="px-3 py-1.5 text-left text-white/90 dark:text-[#242424] hover:bg-white/10 dark:hover:bg-[#F5F6FA] flex items-center justify-between"
              >
                <span>{mins} minutos</span>
                {mins === 25 && <span className="text-[10px] text-[#FB7213] font-semibold">Pomodoro</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
