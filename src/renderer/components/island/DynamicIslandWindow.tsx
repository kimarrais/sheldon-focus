import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Square } from 'lucide-react';
import type {
  DailyTask,
  DynamicIslandAction,
  DynamicIslandNotification,
  DynamicIslandState,
  TabId,
  TaskPriority,
} from '@shared/types';
import { INITIAL_TICKTICK_TASKS } from '../../lib/ticktick-service';
import { DEFAULT_AGENDA_EVENTS } from '../figma/AgendaTimeline';
import playSvg from '../../assets/figma/island/play.svg';
import arrowDownSvg from '../../assets/figma/island/arrow-down-01.svg';
import { IslandNotchFrame } from './IslandNotchFrame';
import { SheldonIslandCat } from './SheldonIslandCat';
import { IslandExpandedPanel } from './IslandExpandedPanel';
import { IslandAddTaskBar } from './IslandAddTaskBar';
import { IslandNotificationBar } from './IslandNotificationBar';

type IslandViewMode = 'normal' | 'expanded' | 'add-task';
type IntroPhase = 'hidden' | 'drop' | 'cat-pop' | 'expand-text' | 'done';

const GREETING_TEXT = 'Bom dia, Kim! Vamos trabalhar?';

const FALLBACK_STATE: DynamicIslandState = {
  tasks: INITIAL_TICKTICK_TASKS,
  agendaEvents: DEFAULT_AGENDA_EVENTS.map((ev) => ({
    id: ev.id,
    title: ev.title,
    startHour: ev.startHour,
    endHour: ev.endHour,
    durationMinutes: ev.durationMinutes,
    completed: ev.completed,
  })),
  selectedTaskId: null,
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  isRunning: false,
  cycleCount: 1,
  sheldonState: 'happy',
  isSentinelActive: false,
  warningsCount: 0,
  patienceLevel: 82,
  focusSecondsElapsed: 0,
  quickNote: '',
  introPlayed: false,
  replayIntroNonce: 0,
  activeNotification: null,
  isVisible: true,
  alwaysOnTop: true,
  nowPlaying: null,
};

function formatTimer(secs: number): string {
  const safe = Math.max(0, Math.floor(secs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Circular orange progress ring (starts at 0% with NO orange stroke when idle/stopped) */
const TimerProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  const size = 19;
  const strokeWidth = 2;
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
        stroke="#2E3035"
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

export const DynamicIslandWindow: React.FC = () => {
  const [state, setState] = useState<DynamicIslandState>(FALLBACK_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<IslandViewMode>('normal');
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [taskMenuOpen, setTaskMenuOpen] = useState<boolean>(false);

  // Intro state ("Bom dia, Kim! Vamos trabalhar?") — plays once on very first open
  const [introPhase, setIntroPhase] = useState<IntroPhase>('done');
  const [catHappy, setCatHappy] = useState<boolean>(false);
  const [typedCount, setTypedCount] = useState<number>(0);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIgnoreRef = useRef<boolean>(true);
  const lastReplayNonceRef = useRef<number>(0);
  const introStartedOnceRef = useRef<boolean>(false);

  const dispatchAction = useCallback((action: DynamicIslandAction) => {
    if (window.sheldonAPI?.dispatchDynamicIslandAction) {
      void window.sheldonAPI.dispatchDynamicIslandAction(action);
      return;
    }

    // Standalone browser preview fallback
    setState((prev) => {
      if (action.type === 'toggle-play') return { ...prev, isRunning: !prev.isRunning };
      if (action.type === 'select-task') {
        const t = prev.tasks.find((item) => item.id === action.taskId);
        const sec = (t?.estimatedMinutes || 25) * 60;
        return { ...prev, selectedTaskId: action.taskId, remainingSeconds: sec, totalSeconds: sec };
      }
      if (action.type === 'mark-intro-played') return { ...prev, introPlayed: true };
      return prev;
    });
  }, []);

  // Hydrate & subscribe to Main -> Island state updates
  useEffect(() => {
    const api = window.sheldonAPI;
    if (!api) {
      setHydrated(true);
      return;
    }

    let active = true;
    void api.getDynamicIslandState().then((initial) => {
      if (!active || !initial) return;
      setState(initial);
      lastReplayNonceRef.current = initial.replayIntroNonce || 0;
      setHydrated(true);
    });

    const offState = api.onDynamicIslandState((nextState) => {
      setState(nextState);
    });

    const offBlur = api.onDynamicIslandBlurred(() => {
      setViewMode('normal');
      setTaskMenuOpen(false);
      setIsHovering(false);
    });

    const offMedia = api.onNowPlayingUpdated?.((media) => {
      setState((prev) => ({ ...prev, nowPlaying: media }));
    });

    return () => {
      active = false;
      offState();
      offBlur();
      offMedia?.();
    };
  }, []);

  // Trigger first-open intro animation once, or when replayed from Settings
  useEffect(() => {
    if (!hydrated) return;

    const shouldPlayFirstTime = !state.introPlayed && !introStartedOnceRef.current;
    const shouldReplay = state.replayIntroNonce > lastReplayNonceRef.current;

    if (!shouldPlayFirstTime && !shouldReplay) return;

    introStartedOnceRef.current = true;
    lastReplayNonceRef.current = state.replayIntroNonce;

    setViewMode('normal');
    setTaskMenuOpen(false);
    setIntroPhase('hidden');
    setCatHappy(false);
    setTypedCount(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let typeInterval: ReturnType<typeof setInterval> | null = null;

    // 1. Black bar drops down from top of desktop
    timers.push(
      setTimeout(() => {
        setIntroPhase('drop');
      }, 40)
    );

    // 2. Cat pops in inside the black bar
    timers.push(
      setTimeout(() => {
        setIntroPhase('cat-pop');
      }, 360)
    );

    // Morph curious face -> happy smile during pop/jump
    timers.push(
      setTimeout(() => {
        setCatHappy(true);
      }, 820)
    );

    // 3. Expand sideways and write greeting text character by character
    timers.push(
      setTimeout(() => {
        setIntroPhase('expand-text');
        let idx = 0;
        typeInterval = setInterval(() => {
          idx += 1;
          setTypedCount(idx);
          if (idx >= GREETING_TEXT.length && typeInterval) {
            clearInterval(typeInterval);
            typeInterval = null;
          }
        }, 36);
      }, 1220)
    );

    // 4. Transition cleanly into the main Standard Dynamic Island & persist introPlayed
    timers.push(
      setTimeout(() => {
        setIntroPhase('done');
        dispatchAction({ type: 'mark-intro-played' });
      }, 4300)
    );

    return () => {
      timers.forEach(clearTimeout);
      if (typeInterval) clearInterval(typeInterval);
    };
  }, [hydrated, state.introPlayed, state.replayIntroNonce, dispatchAction]);

  // Electron transparent click-through management (mousemove / mouseleave)
  useEffect(() => {
    const api = window.sheldonAPI;
    if (!api?.setDynamicIslandIgnoreMouse) return;

    const updateIgnore = (shouldIgnore: boolean) => {
      if (lastIgnoreRef.current === shouldIgnore) return;
      lastIgnoreRef.current = shouldIgnore;
      api.setDynamicIslandIgnoreMouse(shouldIgnore);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const overInteractive = Boolean(target?.closest('[data-island-interactive="true"]'));
      updateIgnore(!overInteractive);
    };

    const handleMouseLeave = () => {
      updateIgnore(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Global Escape key collapses expanded states
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (taskMenuOpen) setTaskMenuOpen(false);
        else if (viewMode !== 'normal') setViewMode('normal');
        else if (state.activeNotification) {
          dispatchAction({
            type: 'notification-dismiss',
            notificationId: state.activeNotification.id,
          });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [taskMenuOpen, viewMode, state.activeNotification, dispatchAction]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (hoverOutTimerRef.current) clearTimeout(hoverOutTimerRef.current);
    };
  }, []);

  const selectedTask: DailyTask | null = useMemo(
    () => state.tasks.find((t) => t.id === state.selectedTaskId) || null,
    [state.tasks, state.selectedTaskId]
  );

  const pendingTasks = useMemo(
    () => state.tasks.filter((t) => !t.completed),
    [state.tasks]
  );

  const handleMouseEnterSurface = () => {
    if (hoverOutTimerRef.current) {
      clearTimeout(hoverOutTimerRef.current);
      hoverOutTimerRef.current = null;
    }
    setIsHovering(true);
  };

  const handleMouseLeaveSurface = () => {
    if (hoverOutTimerRef.current) clearTimeout(hoverOutTimerRef.current);
    hoverOutTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 220);
  };

  // Single click opens Big Island (124:111); Double click opens Add a Task (122:257)
  const handleStandardClick = () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setTaskMenuOpen(false);
      setViewMode('expanded');
    }, 220);
  };

  const handleStandardDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setTaskMenuOpen(false);
    setViewMode('add-task');
  };

  const handleTogglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    dispatchAction({ type: 'toggle-play' });
  };

  const handleStopFocus = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    dispatchAction({ type: 'stop-focus' });
  };

  const handleSelectTask = (taskId: string | null) => {
    dispatchAction({ type: 'select-task', taskId });
    setTaskMenuOpen(false);
  };

  const handleAddTaskSubmit = (payload: {
    title: string;
    project: string;
    estimatedMinutes: number;
    priority: TaskPriority;
    tags: string[];
    scheduledTime?: string;
  }) => {
    dispatchAction({
      type: 'add-task',
      ...payload,
    });
  };

  const totalSec = Math.max(1, state.totalSeconds || 25 * 60);
  const hasActiveProgress = state.isRunning || state.remainingSeconds < totalSec;
  const elapsedFraction = hasActiveProgress
    ? Math.max(0.03, Math.min(1, (totalSec - state.remainingSeconds) / totalSec))
    : 0;
  const barFillPercent = hasActiveProgress
    ? Math.max(4, Math.min(100, elapsedFraction * 100))
    : 0;
  const canStop = Boolean(selectedTask) || state.isRunning || state.remainingSeconds < totalSec;

  if (!state.isVisible) return null;

  /* ---------------------------------------------------------------- */
  /* 1. First-time Intro Animation (122:111 -> 124:211 / 111:7162)    */
  /* ---------------------------------------------------------------- */
  if (introPhase !== 'done') {
    const isDropped = introPhase !== 'hidden';
    const showCat = introPhase === 'cat-pop' || introPhase === 'expand-text';
    const isExpandedGreeting = introPhase === 'expand-text';
    const visibleGreeting = GREETING_TEXT.slice(0, typedCount);

    return (
      <div className="w-screen flex justify-center items-start bg-transparent island-motion">
        <div
          className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: isDropped ? 'translateY(0)' : 'translateY(-100%)',
          }}
        >
          <IslandNotchFrame
            ariaLabel="Boas-vindas do Sheldon"
            onClick={() => {
              setIntroPhase('done');
              dispatchAction({ type: 'mark-intro-played' });
            }}
            className="h-[68px] px-[12px] py-[6px] flex items-center justify-start cursor-pointer transition-[width,padding,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: isExpandedGreeting ? 336 : 84,
              gap: isExpandedGreeting ? 12 : 0,
            }}
          >
            <div className="flex items-center justify-center shrink-0">
              {showCat ? (
                <SheldonIslandCat animateIntro happy={catHappy} />
              ) : (
                <div className="w-[56px] h-[42px]" />
              )}
            </div>

            {isExpandedGreeting && (
              <p className="font-['Plus_Jakarta_Sans'] font-medium text-[15px] leading-normal text-white whitespace-nowrap overflow-hidden">
                {visibleGreeting}
                {typedCount < GREETING_TEXT.length && (
                  <span className="inline-block w-[2px] h-[14px] bg-[#FB7213] ml-0.5 align-middle animate-pulse" />
                )}
              </p>
            )}
          </IslandNotchFrame>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* 2. Task Schedule Notification Island (with Bell test)            */
  /* ---------------------------------------------------------------- */
  if (state.activeNotification) {
    const notif: DynamicIslandNotification = state.activeNotification;
    return (
      <div className="w-screen flex justify-center items-start bg-transparent island-motion">
        <IslandNotificationBar
          notification={notif}
          onStartFocus={(n) => dispatchAction({ type: 'notification-focus', notification: n })}
          onSnooze={(n) => dispatchAction({ type: 'notification-snooze', notification: n })}
          onDismiss={(id) => dispatchAction({ type: 'notification-dismiss', notificationId: id })}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* 3. Add a Task Island (122:257) — triggered on double-click       */
  /* ---------------------------------------------------------------- */
  if (viewMode === 'add-task') {
    return (
      <div className="w-screen flex justify-center items-start bg-transparent island-motion">
        <IslandAddTaskBar
          onSubmitTask={handleAddTaskSubmit}
          onClose={() => setViewMode('normal')}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* 4. Big Expanded Island (124:111) — triggered on single-click     */
  /* ---------------------------------------------------------------- */
  if (viewMode === 'expanded') {
    return (
      <div className="w-screen flex justify-center items-start bg-transparent island-motion">
        <IslandExpandedPanel
          state={state}
          selectedTask={selectedTask}
          onTogglePlay={() => dispatchAction({ type: 'toggle-play' })}
          onStopFocus={() => dispatchAction({ type: 'stop-focus' })}
          onSelectTask={(id) => dispatchAction({ type: 'select-task', taskId: id })}
          onToggleTaskComplete={(id) => dispatchAction({ type: 'toggle-task-complete', taskId: id })}
          onCreateTaskQuick={handleAddTaskSubmit}
          onSetPresetMinutes={(mins) => dispatchAction({ type: 'set-preset-minutes', minutes: mins })}
          onStartEventFocus={(evId) => {
            dispatchAction({ type: 'start-event-focus', eventId: evId });
            setViewMode('normal');
          }}
          onChangeQuickNote={(text) => dispatchAction({ type: 'update-quick-note', text })}
          onToggleSentinel={() => dispatchAction({ type: 'toggle-sentinel' })}
          onOpenMainWindow={(tab?: TabId) => dispatchAction({ type: 'open-main-window', tab })}
          onCollapse={() => setViewMode('normal')}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* 5. Compact Timer Bar (124:498) when timer active & not hovered   */
  /* ---------------------------------------------------------------- */
  if (state.isRunning && !isHovering && !taskMenuOpen) {
    return (
      <div className="w-screen flex justify-center items-start bg-transparent island-motion">
        <IslandNotchFrame
          ariaLabel="Timer ativo na Dynamic Island"
          onMouseEnter={handleMouseEnterSurface}
          onMouseLeave={handleMouseLeaveSurface}
          onClick={handleStandardClick}
          onDoubleClick={handleStandardDoubleClick}
          className="h-[36px] px-[12px] py-[5px] flex items-center justify-center gap-[7px] cursor-pointer"
        >
          <span className="font-['Plus_Jakarta_Sans'] font-medium text-[14.5px] leading-normal text-white tabular-nums shrink-0">
            {formatTimer(state.remainingSeconds)}
          </span>
          <div className="relative bg-[#1D1E22] h-[7px] w-[264px] max-w-[50vw] rounded-[12px] overflow-hidden shrink-0">
            {barFillPercent > 0 && (
              <div
                className="bg-[#FB7213] h-[7px] rounded-[12px] transition-[width] duration-500 ease-linear"
                style={{ width: `${barFillPercent}%` }}
              />
            )}
          </div>
        </IslandNotchFrame>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* 6. Principal / Standard Island (123:109)                         */
  /* ---------------------------------------------------------------- */
  return (
    <div className="w-screen flex flex-col items-center bg-transparent island-motion">
      <IslandNotchFrame
        ariaLabel="Sheldon Dynamic Island Principal"
        onMouseEnter={handleMouseEnterSurface}
        onMouseLeave={handleMouseLeaveSurface}
        onClick={handleStandardClick}
        onDoubleClick={handleStandardDoubleClick}
        className="px-[7px] py-[6px] flex items-center justify-center cursor-pointer"
      >
        <div className="flex items-center gap-[9px]">
          {/* Left: Play/Pause button + Stop button + Ring Timer pill */}
          <div className="flex items-center gap-[5px] shrink-0">
            <button
              type="button"
              onClick={handleTogglePlay}
              onDoubleClick={(e) => e.stopPropagation()}
              title={state.isRunning ? 'Pausar foco' : 'Iniciar foco'}
              className="bg-[#1D1E22] hover:bg-[#2A2B30] active:scale-95 transition-all size-[36px] rounded-[9px] flex items-center justify-center shrink-0"
            >
              {state.isRunning ? (
                <div className="flex items-center gap-[3.5px]">
                  <span className="w-[3.5px] h-[13px] bg-white rounded-full" />
                  <span className="w-[3.5px] h-[13px] bg-white rounded-full" />
                </div>
              ) : (
                <img
                  src={playSvg}
                  alt="Play"
                  width={20}
                  height={20}
                  className="size-[20px]"
                />
              )}
            </button>

            <button
              type="button"
              disabled={!canStop}
              onClick={handleStopFocus}
              onDoubleClick={(e) => e.stopPropagation()}
              title="Parar e zerar timer"
              className={`size-[36px] rounded-[9px] flex items-center justify-center shrink-0 transition-all ${
                canStop
                  ? 'bg-[#1D1E22] hover:bg-rose-500/20 text-white/85 hover:text-rose-400 active:scale-95'
                  : 'bg-[#141518] text-white/25 cursor-default'
              }`}
            >
              <Square className="size-[13px] fill-current" />
            </button>

            <div className="bg-[#1D1E22] h-[36px] rounded-[11px] px-[9px] flex items-center gap-[7px] shrink-0">
              <TimerProgressRing progress={elapsedFraction} />
              <span className="font-['Plus_Jakarta_Sans'] font-medium text-[14.5px] leading-normal text-white tabular-nums whitespace-nowrap">
                {formatTimer(state.remainingSeconds)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="bg-[#2D2F36] w-[1.5px] h-[12px] rounded-full shrink-0" />

          {/* Right: Task selector trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTaskMenuOpen((prev) => !prev);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            title="Selecionar tarefa (Clique fora para expandir painel)"
            className="flex items-center gap-[6px] px-1.5 py-0.5 rounded-[8px] hover:bg-white/[0.07] transition-colors max-w-[205px]"
          >
            <span className="font-['Plus_Jakarta_Sans'] font-medium text-[13.5px] leading-normal text-white truncate">
              {selectedTask ? selectedTask.title : 'Escolha uma tarefa'}
            </span>
            <div
              className={`size-[14px] shrink-0 flex items-center justify-center transition-transform duration-200 ${
                taskMenuOpen ? 'rotate-0' : '-rotate-90'
              }`}
            >
              <img
                src={arrowDownSvg}
                alt="Selecionar tarefa"
                width={14}
                height={14}
                className="size-[14px]"
              />
            </div>
          </button>
        </div>
      </IslandNotchFrame>

      {/* Task Selector Dropdown directly beneath Standard Island */}
      {taskMenuOpen && (
        <div
          data-island-interactive="true"
          onMouseEnter={handleMouseEnterSurface}
          onMouseLeave={handleMouseLeaveSurface}
          className="-mt-3 w-[300px] max-w-[90vw] bg-[#000000] border border-white/10 rounded-[13px] shadow-2xl py-1.5 max-h-[220px] overflow-y-auto text-white"
        >
          <div className="px-3 py-1 flex items-center justify-between border-b border-white/10">
            <span className="text-[10px] font-semibold text-white/55 uppercase tracking-wider">
              Selecionar tarefa
            </span>
            <button
              type="button"
              onClick={() => {
                setTaskMenuOpen(false);
                setViewMode('add-task');
              }}
              className="text-[10px] font-semibold text-[#FB7213] hover:underline"
            >
              + Nova tarefa
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSelectTask(null)}
            className={`w-full px-3 py-1.5 text-left text-[11.5px] hover:bg-white/10 flex items-center justify-between transition-colors ${
              !selectedTask ? 'text-[#FB7213] font-semibold bg-[#FB7213]/10' : 'text-white/75'
            }`}
          >
            <span>Escolha uma tarefa (Foco livre 25m)</span>
          </button>

          {pendingTasks.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-white/45">Nenhuma tarefa pendente.</div>
          ) : (
            pendingTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTask(t.id)}
                className={`w-full px-3 py-1.5 text-left text-[11.5px] hover:bg-white/10 flex items-center justify-between gap-2 transition-colors ${
                  selectedTask?.id === t.id
                    ? 'text-[#FB7213] font-semibold bg-[#FB7213]/15'
                    : 'text-white/90'
                }`}
              >
                <span className="truncate">{t.title}</span>
                <span className="text-[10px] text-white/45 shrink-0">
                  {t.estimatedMinutes || 25}m
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
