import React, { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  Clock,
  CalendarDays,
  Music2,
  Plus,
  Gauge,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ExternalLink,
  X,
} from 'lucide-react';
import type { DailyTask, DynamicIslandState, TabId, TaskPriority } from '@shared/types';
import { IslandNotchFrame } from './IslandNotchFrame';

type ExpandedMode = 'meu-espaco' | 'musica' | 'foco' | 'agenda' | 'adicionar' | 'insights';

const DOCK_TABS: {
  id: ExpandedMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'meu-espaco', label: 'Hoje', Icon: CheckSquare },
  { id: 'musica', label: 'Música', Icon: Music2 },
  { id: 'foco', label: 'Foco', Icon: Clock },
  { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
  { id: 'adicionar', label: 'Nova tarefa', Icon: Plus },
  { id: 'insights', label: 'Resumo', Icon: Gauge },
];

interface IslandExpandedPanelProps {
  state: DynamicIslandState;
  selectedTask: DailyTask | null;
  onTogglePlay: () => void;
  onStopFocus: () => void;
  onSelectTask: (taskId: string) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onCreateTaskQuick: (payload: {
    title: string;
    project: string;
    estimatedMinutes: number;
    priority: TaskPriority;
    tags: string[];
    scheduledTime?: string;
  }) => void;
  onSetPresetMinutes: (minutes: number) => void;
  onStartEventFocus: (eventId: string) => void;
  onChangeQuickNote: (text: string) => void;
  onToggleSentinel: () => void;
  onOpenMainWindow: (tab?: TabId) => void;
  onCollapse: () => void;
}

function formatTimer(secs: number): string {
  const safe = Math.max(0, Math.floor(secs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const IslandExpandedPanel: React.FC<IslandExpandedPanelProps> = ({
  state,
  selectedTask,
  onTogglePlay,
  onStopFocus,
  onSelectTask,
  onToggleTaskComplete,
  onCreateTaskQuick,
  onSetPresetMinutes,
  onStartEventFocus,
  onChangeQuickNote,
  onToggleSentinel,
  onOpenMainWindow,
  onCollapse,
}) => {
  const [mode, setMode] = useState<ExpandedMode>('meu-espaco');
  const [noteValue, setNoteValue] = useState<string>(state.quickNote || '');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium');
  const [quickTag, setQuickTag] = useState('Foco');
  const [quickMins, setQuickMins] = useState(25);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [localMediaPos, setLocalMediaPos] = useState<number>(state.nowPlaying?.positionSeconds ?? 0);

  const wheelLockRef = useRef<number>(0);

  useEffect(() => {
    setNoteValue(state.quickNote || '');
  }, [state.quickNote]);

  // Smoothly track SMTC playback elapsed seconds when playing
  useEffect(() => {
    setLocalMediaPos(state.nowPlaying?.positionSeconds ?? 0);
  }, [state.nowPlaying?.positionSeconds, state.nowPlaying?.title, state.nowPlaying?.updatedAt]);

  useEffect(() => {
    if (!state.nowPlaying?.available || state.nowPlaying.status !== 'playing') return;
    const timer = setInterval(() => {
      setLocalMediaPos((p) => {
        const dur = state.nowPlaying?.durationSeconds || 0;
        if (dur > 0 && p + 1 > dur) return dur;
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.nowPlaying?.available, state.nowPlaying?.status, state.nowPlaying?.durationSeconds]);

  const pendingTasks = state.tasks.filter((t) => !t.completed);
  const completedCount = state.tasks.length - pendingTasks.length;
  const totalMinutes = Math.max(1, Math.round(state.totalSeconds / 60));
  const focusMinutesToday = Math.floor(state.focusSecondsElapsed / 60);
  const canStopTimer = Boolean(selectedTask) || state.isRunning || state.remainingSeconds < state.totalSeconds;

  // Scroll ONLY works when hovering directly over the top dock icons container
  const handleDockWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const dominant = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(dominant) < 6) return;

    const now = Date.now();
    if (now - wheelLockRef.current < 180) return;
    wheelLockRef.current = now;

    const idx = DOCK_TABS.findIndex((t) => t.id === mode);
    const nextIdx =
      dominant > 0 ? (idx + 1) % DOCK_TABS.length : (idx - 1 + DOCK_TABS.length) % DOCK_TABS.length;
    setMode(DOCK_TABS[nextIdx].id);
  };

  const handleNoteChange = (next: string) => {
    setNoteValue(next);
    onChangeQuickNote(next);
  };

  const handleMediaAction = async (action: 'play-pause' | 'next' | 'prev') => {
    if (mediaBusy || !window.sheldonAPI?.mediaControlAction) return;
    setMediaBusy(true);
    try {
      await window.sheldonAPI.mediaControlAction(action);
    } finally {
      setMediaBusy(false);
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean) return;
    onCreateTaskQuick({
      title: clean,
      project: 'Hoje',
      estimatedMinutes: quickMins,
      priority: quickPriority,
      tags: quickTag ? [quickTag] : [],
    });
    setQuickTitle('');
    setMode('meu-espaco');
  };

  const nowPlaying = state.nowPlaying;
  const mediaDur = Math.max(0, nowPlaying?.durationSeconds || 0);
  const mediaPos = Math.min(mediaDur || localMediaPos, Math.max(0, localMediaPos));
  const mediaProgress = mediaDur > 0 ? Math.min(100, (mediaPos / mediaDur) * 100) : 0;
  const mediaRemaining = mediaDur > 0 ? Math.max(0, mediaDur - mediaPos) : 0;

  return (
    <IslandNotchFrame
      ariaLabel="Painel expandido da Dynamic Island"
      className="w-[820px] max-w-[calc(100vw-80px)] h-[238px] px-[14px] py-[8px] flex flex-col justify-between"
    >
      {/* Top Dock Bar (Apple/reference inspired: left-aligned icon buttons, NO date, NO settings) */}
      <div className="h-[30px] flex items-center justify-between gap-2 shrink-0">
        <div
          onWheel={handleDockWheel}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5"
          title="Role aqui sobre os ícones para alternar"
        >
          {DOCK_TABS.map(({ id, label, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`h-[26px] rounded-[9px] flex items-center gap-1.5 transition-all duration-200 shrink-0 ${
                  active
                    ? 'bg-[#1D1E22] border border-white/10 text-white px-2.5 text-[11px] font-semibold'
                    : 'w-[26px] justify-center text-white/55 hover:text-white hover:bg-white/10'
                }`}
                title={label}
              >
                <Icon className={`size-[13.5px] shrink-0 ${active ? 'text-white' : ''}`} />
                {active && <span className="whitespace-nowrap">{label}</span>}
              </button>
            );
          })}
        </div>

        {/* Right: Playing EQ indicator + Open main app + Collapse */}
        <div className="flex items-center gap-1.5 shrink-0">
          {nowPlaying?.available && nowPlaying.status === 'playing' && (
            <button
              type="button"
              onClick={() => setMode('musica')}
              title={`${nowPlaying.title} — ${nowPlaying.artist}`}
              className="h-[24px] px-2 rounded-[8px] bg-white/[0.06] hover:bg-white/[0.12] flex items-center gap-1 transition-colors"
            >
              <span className="w-[2px] h-[8px] bg-[#FB7213] rounded-full animate-pulse" />
              <span className="w-[2px] h-[12px] bg-[#1DB954] rounded-full animate-pulse" />
              <span className="w-[2px] h-[6px] bg-[#FB7213] rounded-full animate-pulse" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenMainWindow('hoje')}
            title="Abrir janela principal do Sheldon"
            className="h-[24px] px-2 rounded-[8px] bg-white/[0.07] hover:bg-white/[0.14] text-white/75 hover:text-white flex items-center gap-1 text-[10px] font-medium transition-colors"
          >
            <ExternalLink className="size-3" />
            <span>Abrir</span>
          </button>

          <button
            type="button"
            onClick={onCollapse}
            title="Recolher ilha (Esc)"
            className="size-[24px] rounded-[8px] bg-white/[0.07] hover:bg-white/[0.14] text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 pt-2 pb-1">
        {mode === 'meu-espaco' && (
          <div className="h-full flex items-stretch gap-[7px]">
            {/* Card 1: Tarefas de hoje (#E4F2FC) */}
            <div className="w-[248px] min-w-0 h-full bg-[#E4F2FC] rounded-[13px] p-[9px] flex flex-col justify-between shrink-0">
              <div className="px-0.5 flex items-center justify-between">
                <span className="font-semibold text-[11.5px] text-[#242424]">Tarefas de hoje</span>
                <span className="font-medium text-[9.5px] text-[#034163]">
                  {pendingTasks.length} {pendingTasks.length === 1 ? 'pendente' : 'pendentes'}
                </span>
              </div>

              <div className="flex flex-col gap-[6px] overflow-y-auto flex-1 my-1.5 pr-0.5 island-scroll">
                {pendingTasks.length === 0 ? (
                  <div className="bg-white/85 rounded-[7px] h-[42px] px-2.5 flex items-center text-[10.5px] text-[#034163] font-medium">
                    Tudo concluído por hoje!
                  </div>
                ) : (
                  pendingTasks.slice(0, 6).map((task) => {
                    const isSelected = selectedTask?.id === task.id;
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task.id)}
                        className={`bg-white rounded-[7px] shrink-0 px-2 py-1.5 flex items-start gap-2 cursor-pointer transition-all hover:bg-white/95 ${
                          isSelected ? 'ring-1 ring-[#FB7213]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`Concluir ${task.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTaskComplete(task.id);
                          }}
                          className="mt-[2px] size-[10.5px] rounded-full border-[1.2px] border-[#6D6D6D] hover:border-[#FB7213] hover:bg-[#FB7213]/20 shrink-0 transition-colors"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[10.5px] leading-tight text-[#242424] truncate">
                            {task.title}
                          </p>
                          <p className="text-[9px] leading-tight text-[#6D6D6D] truncate mt-0.5">
                            {task.tags && task.tags.length > 0 ? `#${task.tags[0]}` : task.project}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-0.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('adicionar')}
                  className="font-medium text-[10px] text-[#034163] hover:underline"
                >
                  + Adicionar tarefa
                </button>
                <span className="font-medium text-[9.5px] text-[#034163]">
                  {completedCount} de {state.tasks.length}
                </span>
              </div>
            </div>

            {/* Card 2: Pomodoro (#F4EDE5) */}
            <div className="w-[152px] h-full bg-[#F4EDE5] rounded-[13px] px-[11px] py-[9px] flex flex-col justify-between shrink-0">
              <div>
                <p className="font-semibold text-[11.5px] text-[#242424]">Pomodoro</p>
                <p
                  className="text-[9.5px] text-[#6D6D6D] truncate mt-0.5"
                  title={selectedTask?.title || 'Escolha uma tarefa'}
                >
                  {selectedTask ? selectedTask.title : 'Escolha uma tarefa'}
                </p>
              </div>

              <p className="font-semibold text-[29px] leading-none text-[#55321E] text-center tabular-nums">
                {formatTimer(state.remainingSeconds)}
              </p>

              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1 w-full">
                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="flex-1 bg-[#FB7213] hover:bg-[#e5650c] h-[28px] rounded-[9px] font-semibold text-[10.5px] text-white transition-all"
                  >
                    {state.isRunning ? 'Pausar' : 'Iniciar'}
                  </button>
                  {canStopTimer && (
                    <button
                      type="button"
                      onClick={onStopFocus}
                      title="Parar e zerar"
                      className="size-[28px] rounded-[9px] bg-[#55321E]/15 hover:bg-rose-500 hover:text-white text-[#55321E] flex items-center justify-center transition-colors shrink-0"
                    >
                      <Square className="size-3 fill-current" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const presets = [15, 25, 45, 60];
                    const next = presets[(presets.indexOf(totalMinutes) + 1) % presets.length] ?? 25;
                    onSetPresetMinutes(next);
                  }}
                  className="text-[9.5px] text-[#55321E] hover:underline"
                >
                  Ciclo {state.cycleCount}/4 · {totalMinutes}m
                </button>
              </div>
            </div>

            {/* Card 3: Nota rápida (#FDEBCC) */}
            <div className="w-[176px] h-full bg-[#FDEBCC] rounded-[13px] px-[11px] py-[9px] flex flex-col justify-between shrink-0">
              <div>
                <p className="font-semibold text-[11.5px] text-[#242424]">Nota rápida</p>
                <p className="text-[9.5px] text-[#624004] mt-0.5">Ideias rápidas</p>
              </div>

              <div className="relative flex-1 my-1.5">
                <textarea
                  value={noteValue}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    void window.sheldonAPI?.focusDynamicIsland();
                  }}
                  placeholder="Escreva uma ideia ou lembrete..."
                  className="w-full h-full resize-none bg-transparent border-none outline-none text-[10.5px] leading-snug text-[#624004] placeholder:text-[#624004]/60"
                />
              </div>

              <p className="text-[9px] text-[#624004]/75">Sincronizado</p>
            </div>

            {/* Card 4: Agenda (#FCE5D9) */}
            <div className="flex-1 min-w-[180px] h-full bg-[#FCE5D9] rounded-[13px] p-[9px] flex flex-col justify-between">
              <div className="px-0.5 flex items-center justify-between">
                <span className="font-semibold text-[11.5px] text-[#242424]">Agenda</span>
                <button
                  type="button"
                  onClick={() => setMode('agenda')}
                  className="text-[9.5px] font-medium text-[#FB7213] hover:underline"
                >
                  Ver tudo
                </button>
              </div>

              <div className="flex flex-col gap-[4px] flex-1 my-1.5 overflow-hidden">
                {state.agendaEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onStartEventFocus(ev.id)}
                    className="bg-white hover:bg-white/90 rounded-[7px] h-[35px] w-full flex items-center gap-2 pr-2 text-left transition-colors shrink-0"
                  >
                    <span className="w-[3px] h-[22px] rounded-full bg-[#FB7213] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[10px] leading-tight text-[#242424] truncate">
                        {ev.title}
                      </p>
                      <p className="text-[9px] leading-tight text-[#6D6D6D]">
                        {ev.startHour} – {ev.endHour}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onOpenMainWindow('hoje')}
                className="px-0.5 text-left font-medium text-[9.5px] text-[#FB7213] hover:underline"
              >
                Abrir calendário
              </button>
            </div>
          </div>
        )}

        {mode === 'musica' && (
          <div className="h-full flex items-center justify-center px-3">
            {nowPlaying?.available ? (
              <div className="w-full max-w-[740px] flex items-center gap-5">
                {/* Album cover art */}
                <div className="size-[112px] rounded-[14px] bg-[#161618] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-xl">
                  {nowPlaying.thumbnailBase64 ? (
                    <img
                      src={nowPlaying.thumbnailBase64}
                      alt={nowPlaying.album || nowPlaying.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Music2 className="size-9 text-white/30" />
                  )}
                </div>

                {/* Track Info + Scrubber + Media Controls */}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-[112px] py-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-white truncate leading-tight">
                        {nowPlaying.title}
                      </h3>
                      <p className="text-[12px] text-white/55 truncate mt-0.5">
                        {nowPlaying.artist}
                        {nowPlaying.album ? ` — ${nowPlaying.album}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.08] text-[10px] font-medium text-white/75">
                      <span
                        className={`size-1.5 rounded-full ${
                          nowPlaying.isSpotify ? 'bg-[#1DB954]' : 'bg-[#FB7213]'
                        }`}
                      />
                      {nowPlaying.sourceApp}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-2.5 my-1">
                    <span className="text-[10.5px] font-medium text-white/55 tabular-nums w-[32px]">
                      {formatTimer(mediaPos)}
                    </span>
                    <div className="flex-1 h-[4px] bg-white/15 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-[width] duration-300 ease-linear"
                        style={{ width: `${mediaProgress}%` }}
                      />
                    </div>
                    <span className="text-[10.5px] font-medium text-white/55 tabular-nums w-[38px] text-right">
                      {mediaDur > 0 ? `-${formatTimer(mediaRemaining)}` : '--:--'}
                    </span>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex items-center justify-center gap-6">
                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => void handleMediaAction('prev')}
                      title="Faixa anterior"
                      className="size-[30px] rounded-full hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      <SkipBack className="size-4 fill-current" />
                    </button>

                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => void handleMediaAction('play-pause')}
                      title={nowPlaying.status === 'playing' ? 'Pausar' : 'Reproduzir'}
                      className="size-[36px] rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {nowPlaying.status === 'playing' ? (
                        <Pause className="size-4 fill-current" />
                      ) : (
                        <Play className="size-4 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => void handleMediaAction('next')}
                      title="Próxima faixa"
                      className="size-[30px] rounded-full hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      <SkipForward className="size-4 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center gap-2 py-4">
                <div className="size-11 rounded-2xl bg-white/[0.07] border border-white/10 flex items-center justify-center">
                  <Music2 className="size-5 text-white/45" />
                </div>
                <p className="text-[12.5px] font-medium text-white/80">Nenhuma música detectada no Windows</p>
                <p className="text-[10.5px] text-white/45 max-w-[360px]">
                  Inicie a reprodução no Spotify (ou navegador/player) e os controles aparecerão aqui em tempo real.
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'foco' && (
          <div className="h-full flex items-stretch gap-[8px]">
            <div className="flex-1 bg-[#F4EDE5] rounded-[13px] p-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6D6D6D]">
                  Sessão Atual
                </p>
                <p className="text-[15px] font-bold text-[#242424] truncate mt-0.5">
                  {selectedTask ? selectedTask.title : 'Escolha uma tarefa para focar'}
                </p>
                <div className="flex items-center gap-1.5 mt-2.5">
                  {[15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onSetPresetMinutes(mins)}
                      className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-colors ${
                        totalMinutes === mins
                          ? 'bg-[#FB7213] text-white'
                          : 'bg-white text-[#55321E] hover:bg-white/80'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[34px] font-semibold text-[#55321E] tabular-nums leading-none">
                  {formatTimer(state.remainingSeconds)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="bg-[#FB7213] hover:bg-[#e5650c] text-white font-semibold text-[11px] px-4 py-2 rounded-[10px]"
                  >
                    {state.isRunning ? 'Pausar Foco' : 'Iniciar Foco'}
                  </button>
                  {canStopTimer && (
                    <button
                      type="button"
                      onClick={onStopFocus}
                      title="Parar foco"
                      className="size-[32px] rounded-[10px] bg-white hover:bg-rose-500 hover:text-white text-[#55321E] flex items-center justify-center transition-colors"
                    >
                      <Square className="size-3.5 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-[260px] bg-[#FCE5D9] rounded-[13px] p-3.5 flex flex-col justify-between shrink-0">
              <div>
                <p className="text-[12px] font-semibold text-[#242424]">Modo Sentinela</p>
                <p className="text-[10.5px] text-[#6D6D6D] mt-0.5 leading-snug">
                  {state.isSentinelActive
                    ? 'Sheldon bloqueando distrações. Rastreamento contínuo ativo.'
                    : 'Sem bloqueio de distrações. Rastreamento continua ativo.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleSentinel}
                  className={`flex-1 h-[30px] rounded-[9px] text-[11px] font-semibold transition-colors ${
                    state.isSentinelActive ? 'bg-[#000000] text-white' : 'bg-white text-[#242424]'
                  }`}
                >
                  {state.isSentinelActive ? 'Sentinela ATIVO' : 'Ativar Sentinela'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMainWindow('bloquear')}
                  className="h-[30px] px-2.5 rounded-[9px] bg-white text-[#FB7213] text-[11px] font-semibold"
                >
                  Regras
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'agenda' && (
          <div className="h-full bg-[#FCE5D9] rounded-[13px] p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-[#242424]">Agenda de hoje</span>
              <button
                type="button"
                onClick={() => onOpenMainWindow('hoje')}
                className="text-[10.5px] font-semibold text-[#FB7213] hover:underline"
              >
                Abrir calendário completo →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1 island-scroll">
              {state.agendaEvents.length === 0 ? (
                <div className="col-span-2 flex items-center justify-center text-[11px] text-[#6D6D6D]">
                  Nenhum bloco agendado hoje.
                </div>
              ) : (
                state.agendaEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onStartEventFocus(ev.id)}
                    className="bg-white hover:bg-white/90 rounded-[9px] px-3 py-2 flex items-center gap-2.5 text-left transition-colors"
                  >
                    <span className="w-[3px] h-[24px] rounded-full bg-[#FB7213] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[11px] text-[#242424] truncate">{ev.title}</p>
                      <p className="text-[9.5px] text-[#6D6D6D]">
                        {ev.startHour} – {ev.endHour} · {ev.durationMinutes} min
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {mode === 'adicionar' && (
          <form
            onSubmit={handleQuickAddSubmit}
            className="h-full bg-[#16171A] border border-white/10 rounded-[13px] p-3.5 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="size-4 text-[#FB7213] shrink-0" />
              <input
                type="text"
                autoFocus
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onClick={() => void window.sheldonAPI?.focusDynamicIsland()}
                placeholder="Qual a próxima tarefa para Hoje?"
                className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-white placeholder:text-white/45"
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setQuickPriority(p)}
                    className={`px-2 py-1 rounded-[7px] text-[10px] font-medium transition-colors ${
                      quickPriority === p
                        ? 'bg-[#FB7213] text-white'
                        : 'bg-white/[0.07] text-white/70 hover:text-white'
                    }`}
                  >
                    {p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'}
                  </button>
                ))}

                <span className="w-px h-3.5 bg-white/15 mx-1" />

                {[15, 25, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setQuickMins(m)}
                    className={`px-2 py-1 rounded-[7px] text-[10px] font-medium transition-colors ${
                      quickMins === m
                        ? 'bg-white text-black'
                        : 'bg-white/[0.07] text-white/70 hover:text-white'
                    }`}
                  >
                    {m}m
                  </button>
                ))}

                <span className="w-px h-3.5 bg-white/15 mx-1" />

                <input
                  type="text"
                  value={quickTag}
                  onChange={(e) => setQuickTag(e.target.value)}
                  onClick={() => void window.sheldonAPI?.focusDynamicIsland()}
                  placeholder="#tag"
                  className="w-[74px] bg-white/[0.07] rounded-[7px] px-2 py-1 text-[10px] text-white placeholder:text-white/40 outline-none"
                />
              </div>

              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-[8px] bg-[#FB7213] hover:bg-[#e5650c] text-white text-[11px] font-semibold transition-colors"
              >
                Criar tarefa
              </button>
            </div>
          </form>
        )}

        {mode === 'insights' && (
          <div className="h-full grid grid-cols-4 gap-[7px]">
            <div className="bg-[#E4F2FC] rounded-[13px] p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-semibold text-[#034163]">Tarefas de hoje</span>
              <div>
                <p className="text-[26px] font-bold text-[#242424] leading-none">
                  {completedCount}/{state.tasks.length}
                </p>
                <p className="text-[10px] text-[#034163] mt-1">{pendingTasks.length} pendentes</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenMainWindow('hoje')}
                className="text-left text-[10px] font-semibold text-[#034163] hover:underline"
              >
                Ver lista →
              </button>
            </div>

            <div className="bg-[#F4EDE5] rounded-[13px] p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-semibold text-[#55321E]">Foco acumulado</span>
              <div>
                <p className="text-[26px] font-bold text-[#55321E] leading-none">
                  {Math.floor(focusMinutesToday / 60)}h{String(focusMinutesToday % 60).padStart(2, '0')}
                </p>
                <p className="text-[10px] text-[#6D6D6D] mt-1">Tempo focado</p>
              </div>
              <span className="text-[10px] font-medium text-[#55321E]">Ciclo {state.cycleCount}/4</span>
            </div>

            <div className="bg-[#FDEBCC] rounded-[13px] p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-semibold text-[#624004]">Paciência Sheldon</span>
              <div>
                <p className="text-[26px] font-bold text-[#624004] leading-none">{state.patienceLevel}%</p>
                <p className="text-[10px] text-[#624004]/80 mt-1">Humor: {state.sheldonState}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenMainWindow('sheldon')}
                className="text-left text-[10px] font-semibold text-[#624004] hover:underline"
              >
                Abrir Sheldon →
              </button>
            </div>

            <div className="bg-[#FCE5D9] rounded-[13px] p-3 flex flex-col justify-between">
              <span className="text-[10.5px] font-semibold text-[#FB7213]">Black Mirror</span>
              <div>
                <p className="text-[26px] font-bold text-[#242424] leading-none">{state.warningsCount}</p>
                <p className="text-[10px] text-[#6D6D6D] mt-1">Infrações</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenMainWindow('metricas')}
                className="text-left text-[10px] font-semibold text-[#FB7213] hover:underline"
              >
                Ver métricas →
              </button>
            </div>
          </div>
        )}
      </div>
    </IslandNotchFrame>
  );
};
