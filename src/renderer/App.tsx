import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DailyTask,
  DynamicIslandAction,
  DynamicIslandNotification,
  ReminderItem,
  SentinelScheduleStatus,
  SheldonLeashSettings,
  SheldonVisualState,
  TabId,
  TaskPriority,
  WarningLogItem,
} from '@shared/types';
import { getNextSheldonMood } from './lib/sheldon-moods';
import {
  INITIAL_TICKTICK_TASKS,
  hasValidTickTickToken,
  syncTickTickTasks,
  createTickTickTask,
  updateTickTickTask,
  markTickTickTaskComplete,
} from './lib/ticktick-service';
import { WindowTitleBar } from './components/figma/WindowTitleBar';
import { SidebarNav } from './components/figma/SidebarNav';
import { DEFAULT_AGENDA_EVENTS } from './components/figma/AgendaTimeline';
import { RightExtraPanel } from './components/figma/RightExtraPanel';
import { TarefasCard } from './components/figma/TarefasCard';
import { FloatingFocusBar } from './components/figma/FloatingFocusBar';
import { BlockerTab } from './components/Tabs/BlockerTab';
import { MetricsView } from './components/MetricsView';
import { SheldonMoodTab } from './components/Tabs/SheldonMoodTab';
import { SettingsLeashTab } from './components/Tabs/SettingsLeashTab';
import { PomodoroFocusModal } from './components/PomodoroFocusModal';
import { InAppFloatingWidget } from './components/InAppFloatingWidget';
import { AppIntroAnimation } from './components/figma/AppIntroAnimation';

const REMINDERS_STORAGE_KEY = 'sheldon_reminders_v2';
const RIGHT_PANEL_STORAGE_KEY = 'sheldon_right_panel_open_v2';
const LEFT_SIDEBAR_COLLAPSED_KEY = 'sheldon_left_sidebar_collapsed_v2';

const INITIAL_REMINDERS: ReminderItem[] = [
  {
    id: 'rem-1',
    title: 'Beber 500ml de água',
    time: '10:00',
    completed: false,
    createdAt: Date.now() - 3000,
  },
  {
    id: 'rem-2',
    title: 'Alongar postura e descansar os olhos',
    time: '15:00',
    completed: false,
    createdAt: Date.now() - 2000,
  },
  {
    id: 'rem-3',
    title: 'Revisar tarefas concluídas do dia',
    time: '18:00',
    completed: false,
    createdAt: Date.now() - 1000,
  },
];

const INITIAL_WARNINGS: WarningLogItem[] = [
  {
    id: 'warn-1',
    timestamp: '10:42:18',
    executable: 'SleepingDogs.exe',
    windowTitle: 'Sleeping Dogs: Definitive Edition',
    severity: 'terminated',
    actionTaken: 'Taskkill Forçado (Aviso 2/2)',
    sheldonComment:
      'Achou mesmo que ia ser policial disfarçado em Hong Kong às 10h da manhã de uma segunda-feira?',
  },
  {
    id: 'warn-2',
    timestamp: '09:18:04',
    executable: 'Steam.exe',
    windowTitle: 'Steam Store — Promoções da Semana',
    severity: 'warning',
    actionTaken: 'Aviso #1 • Janela Minimizada',
    sheldonComment:
      'Sua biblioteca já tem 84 jogos que você nunca abriu. Volte para o VS Code agora.',
  },
  {
    id: 'warn-3',
    timestamp: '14:11:50',
    executable: 'Valorant.exe',
    windowTitle: 'VALORANT — Riot Client',
    severity: 'critical',
    actionTaken: 'Overlay Fullscreen Acionado',
    sheldonComment:
      'O único headshot hoje será no seu prazo de entrega se não fechar isso em 5 segundos.',
  },
];

const INITIAL_SETTINGS: SheldonLeashSettings = {
  fullscreenBlockEnabled: true,
  forcedTaskkillEnabled: true,
  shutdownPcOnLimitEnabled: false,
  maxWarningsBeforeKill: 2,
  tickTickToken: '',
  tickTickConnected: false,
  lunchLockEnabled: true,
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  workHoursEnabled: false,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
  vacationModeEnabled: false,
  vacationStartDate: '',
  vacationEndDate: '',
  autoLaunchEnabled: false,
  blacklistedExecutables: [
    'SleepingDogs.exe',
    'Steam.exe',
    'Valorant.exe',
    'LeagueClient.exe',
    'EldenRing.exe',
  ],
  theme: 'light',
  floatingWidgetEnabled: true,
  floatingWidgetAlwaysOnTop: true,
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('hoje');
  const [sheldonState, setSheldonState] = useState<SheldonVisualState>('happy');
  const [isSentinelActive, setIsSentinelActive] = useState<boolean>(false);
  const [scheduleStatus, setScheduleStatus] = useState<SentinelScheduleStatus | null>(null);
  const [focusSecondsElapsed, setFocusSecondsElapsed] = useState<number>(8420);
  const [patienceLevel, setPatienceLevel] = useState<number>(82);
  const [snacksAvailable, setSnacksAvailable] = useState<number>(3);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(RIGHT_PANEL_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  });
  // Plays splash -> intro once per fresh cold app launch (not persisted across app restarts, not replayed from tray)
  const [showIntro, setShowIntro] = useState<boolean>(false);

  const [tasks, setTasks] = useState<DailyTask[]>(INITIAL_TICKTICK_TASKS);
  const [reminders, setReminders] = useState<ReminderItem[]>(() => {
    try {
      const saved = localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ReminderItem[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_REMINDERS;
  });
  const [warnings, setWarnings] = useState<WarningLogItem[]>(INITIAL_WARNINGS);
  const [settings, setSettings] = useState<SheldonLeashSettings>(() => {
    const savedTheme = localStorage.getItem('sheldon_theme') as 'dark' | 'light' | null;
    return {
      ...INITIAL_SETTINGS,
      theme: savedTheme || 'light',
    };
  });

  const [isSyncingTickTick, setIsSyncingTickTick] = useState<boolean>(false);

  // Unified Focus Timer State (shared across FloatingFocusBar, PomodoroFocusModal, and Dynamic Island)
  const [isFocusModalOpen, setIsFocusModalOpen] = useState<boolean>(false);
  const [floatingWidgetTask, setFloatingWidgetTask] = useState<DailyTask | null>(null);
  const [floatingTotalSec, setFloatingTotalSec] = useState<number>(25 * 60);
  const [floatingRemainingSec, setFloatingRemainingSec] = useState<number>(25 * 60);
  const [isFloatingRunning, setIsFloatingRunning] = useState<boolean>(false);
  const [cycleCount, setCycleCount] = useState<number>(1);
  const [isFloatingWidgetVisible, setIsFloatingWidgetVisible] = useState<boolean>(false);
  const [activeIslandNotification, setActiveIslandNotification] =
    useState<DynamicIslandNotification | null>(null);
  const [replayIslandIntroNonce, setReplayIslandIntroNonce] = useState<number>(0);

  const firedScheduleKeysRef = useRef<Set<string>>(new Set());
  const snoozeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const islandActionHandlerRef = useRef<(action: DynamicIslandAction) => void>(() => {});

  useEffect(() => {
    try {
      localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_KEY, String(isLeftSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isLeftSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, String(isRightPanelOpen));
    } catch {
      // ignore
    }
  }, [isRightPanelOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
    } catch {
      // ignore
    }
  }, [reminders]);

  // Theme synchronization with HTML class
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(settings.theme);
    localStorage.setItem('sheldon_theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (!window.sheldonAPI) return;
    const offMode = window.sheldonAPI.onSentinelModeChanged((active) => {
      setIsSentinelActive(active);
      setSheldonState(active ? 'cool' : 'neutral');
    });
    const offSchedule = window.sheldonAPI.onSentinelScheduleStatusChanged?.((status) => {
      setScheduleStatus(status);
      setIsSentinelActive(status.sentinelActive);
    });
    return () => {
      offMode();
      offSchedule?.();
    };
  }, []);

  const focusMinutesTotalSec = Math.floor(focusSecondsElapsed / 60) * 60;

  // Sync Desktop Dynamic Island state whenever relevant app state changes
  useEffect(() => {
    const api = window.sheldonAPI;
    if (!api?.updateDynamicIslandState) return;

    void api.updateDynamicIslandState({
      tasks,
      agendaEvents: DEFAULT_AGENDA_EVENTS.map((ev) => ({
        id: ev.id,
        title: ev.title,
        startHour: ev.startHour,
        endHour: ev.endHour,
        durationMinutes: ev.durationMinutes,
        completed: ev.completed,
      })),
      selectedTaskId: floatingWidgetTask?.id ?? null,
      remainingSeconds: floatingRemainingSec,
      totalSeconds: floatingTotalSec,
      isRunning: isFloatingRunning,
      cycleCount,
      sheldonState,
      isSentinelActive,
      warningsCount: warnings.length,
      patienceLevel,
      focusSecondsElapsed: focusMinutesTotalSec,
      activeNotification: activeIslandNotification,
      replayIntroNonce: replayIslandIntroNonce,
      isVisible: settings.floatingWidgetEnabled,
      alwaysOnTop: settings.floatingWidgetAlwaysOnTop,
    });
  }, [
    tasks,
    floatingWidgetTask,
    floatingRemainingSec,
    floatingTotalSec,
    isFloatingRunning,
    cycleCount,
    sheldonState,
    isSentinelActive,
    warnings.length,
    patienceLevel,
    focusMinutesTotalSec,
    activeIslandNotification,
    replayIslandIntroNonce,
    settings.floatingWidgetEnabled,
    settings.floatingWidgetAlwaysOnTop,
  ]);

  // Show/hide & alwaysOnTop sync for Desktop Dynamic Island
  useEffect(() => {
    const api = window.sheldonAPI;
    if (!api) return;
    if (settings.floatingWidgetEnabled) {
      void api.showDynamicIsland?.();
    } else {
      void api.hideDynamicIsland?.();
    }
    void api.setDynamicIslandAlwaysOnTop?.(settings.floatingWidgetAlwaysOnTop);
  }, [settings.floatingWidgetEnabled, settings.floatingWidgetAlwaysOnTop]);

  // Subscribe to Desktop Dynamic Island actions & tab navigation
  useEffect(() => {
    const api = window.sheldonAPI;
    if (!api) return;

    const offIsland = api.onDynamicIslandAction?.((action) => {
      islandActionHandlerRef.current(action);
    });
    const offTab = api.onNavigateTab?.((tab) => {
      setActiveTab(tab);
    });
    const offLegacy = api.onFloatingWidgetAction?.((action) => {
      if (action === 'toggle') setIsFloatingRunning((prev) => !prev);
      else if (action === 'close') {
        setIsFloatingWidgetVisible(false);
        void api.hideDynamicIsland?.();
      }
    });

    return () => {
      offIsland?.();
      offTab?.();
      offLegacy?.();
    };
  }, []);

  // Auto-dismiss active task notification after 18 seconds
  useEffect(() => {
    if (!activeIslandNotification) return;
    const timer = setTimeout(() => {
      setActiveIslandNotification(null);
    }, 18_000);
    return () => clearTimeout(timer);
  }, [activeIslandNotification]);

  useEffect(() => {
    return () => {
      snoozeTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Automatic task, agenda & reminder schedule checker
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}`;

      for (const rem of reminders) {
        if (!rem.completed && rem.time === hhmm) {
          const key = `${todayKey}-rem-${rem.id}-${hhmm}`;
          if (!firedScheduleKeysRef.current.has(key)) {
            firedScheduleKeysRef.current.add(key);
            setActiveIslandNotification({
              id: key,
              title: rem.title,
              project: 'Lembrete',
              timeLabel: rem.time,
              triggeredAt: Date.now(),
            });
            return;
          }
        }
      }

      for (const ev of DEFAULT_AGENDA_EVENTS) {
        if (ev.startHour === hhmm) {
          const key = `${todayKey}-ev-${ev.id}-${hhmm}`;
          if (!firedScheduleKeysRef.current.has(key)) {
            firedScheduleKeysRef.current.add(key);
            setActiveIslandNotification({
              id: key,
              title: ev.title,
              project: 'Agenda de hoje',
              timeLabel: `${ev.startHour} – ${ev.endHour}`,
              triggeredAt: Date.now(),
            });
            return;
          }
        }
      }

      for (const t of tasks) {
        if (t.completed) continue;
        let matchTime: string | null = null;
        if (t.scheduledTime === hhmm) {
          matchTime = t.scheduledTime;
        } else if (t.dueDate && t.dueDate.includes('T')) {
          const d = new Date(t.dueDate);
          if (!Number.isNaN(d.getTime())) {
            const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
              d.getDate()
            ).padStart(2, '0')}`;
            const dHHMM = `${String(d.getHours()).padStart(2, '0')}:${String(
              d.getMinutes()
            ).padStart(2, '0')}`;
            if (dKey === todayKey && dHHMM === hhmm) matchTime = dHHMM;
          }
        }

        if (matchTime) {
          const key = `${todayKey}-task-${t.id}-${hhmm}`;
          if (!firedScheduleKeysRef.current.has(key)) {
            firedScheduleKeysRef.current.add(key);
            setActiveIslandNotification({
              id: key,
              taskId: t.id,
              title: t.title,
              project: t.project,
              timeLabel: matchTime,
              triggeredAt: Date.now(),
            });
            return;
          }
        }
      }
    };

    checkSchedule();
    const timer = setInterval(checkSchedule, 10_000);
    return () => clearInterval(timer);
  }, [tasks, reminders]);

  // Pomodoro countdown timer (single source of truth)
  useEffect(() => {
    if (!isFloatingRunning) return;
    const interval = setInterval(() => {
      setFocusSecondsElapsed((s) => s + 1);
      setFloatingRemainingSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isFloatingRunning]);

  // Complete session cleanly when countdown reaches 0
  useEffect(() => {
    if (!isFloatingRunning || floatingRemainingSec > 0) return;
    setIsFloatingRunning(false);
    setCycleCount((c) => (c >= 4 ? 1 : c + 1));
    if (floatingWidgetTask && !floatingWidgetTask.completed) {
      handleToggleTask(floatingWidgetTask.id);
    }
  }, [isFloatingRunning, floatingRemainingSec, floatingWidgetTask]);

  // Hydrate native engine, persisted settings, auto-sync TickTick, and perform Boot Splash -> Intro handoff
  useEffect(() => {
    const api = window.sheldonAPI;

    const finishBootSequence = () => {
      const splash = document.getElementById('sheldon-boot-splash');
      const alreadyPlayed = sessionStorage.getItem('sheldon_boot_played') === '1';

      if (alreadyPlayed) {
        splash?.remove();
        void api?.notifyAppHydrated?.();
        return;
      }

      void api?.notifyAppHydrated?.();
      if (splash) {
        // Hide bottom loading bar once hydrated, then unveil full Kim intro animation seamlessly
        splash.classList.add('bar-hidden');
        setTimeout(() => {
          setShowIntro(true);
          splash.remove();
        }, 240);
      } else {
        setShowIntro(true);
      }
    };

    if (!api) {
      finishBootSequence();
      return;
    }

    let active = true;
    void Promise.all([
      api.getBlacklist(),
      api.getInfractions(),
      api.getWatcherConfig(),
      api.getPersistedSettings?.() ?? Promise.resolve(null),
      api.getSentinelScheduleStatus?.() ?? Promise.resolve(null),
    ])
      .then(async ([blacklist, infractions, config, persisted, sched]) => {
        if (!active) return;

        if (infractions && infractions.length > 0) {
          setWarnings(infractions);
        }
        if (sched) {
          setScheduleStatus(sched);
          setIsSentinelActive(sched.sentinelActive);
        }

        const savedToken = persisted?.tickTickToken ?? '';
        setSettings((prev) => ({
          ...prev,
          blacklistedExecutables:
            blacklist && blacklist.length > 0 ? blacklist : prev.blacklistedExecutables,
          fullscreenBlockEnabled: config.fullscreenBlockEnabled,
          forcedTaskkillEnabled: config.forcedTaskkillEnabled,
          tickTickToken: savedToken || prev.tickTickToken,
          tickTickConnected: hasValidTickTickToken(savedToken || prev.tickTickToken),
          theme: persisted?.theme ?? prev.theme,
          workHoursEnabled: persisted?.workHoursEnabled ?? prev.workHoursEnabled,
          workHoursStart: persisted?.workHoursStart ?? prev.workHoursStart,
          workHoursEnd: persisted?.workHoursEnd ?? prev.workHoursEnd,
          vacationModeEnabled: persisted?.vacationModeEnabled ?? prev.vacationModeEnabled,
          vacationStartDate: persisted?.vacationStartDate ?? prev.vacationStartDate,
          vacationEndDate: persisted?.vacationEndDate ?? prev.vacationEndDate,
          lunchLockEnabled: persisted?.lunchLockEnabled ?? prev.lunchLockEnabled,
          lunchStartTime: persisted?.lunchStartTime ?? prev.lunchStartTime,
          lunchEndTime: persisted?.lunchEndTime ?? prev.lunchEndTime,
          autoLaunchEnabled: persisted?.autoLaunchEnabled ?? prev.autoLaunchEnabled,
        }));

        if (hasValidTickTickToken(savedToken)) {
          const synced = await syncTickTickTasks(savedToken);
          if (active && synced.syncedLive && synced.tasks.length > 0) {
            setTasks(synced.tasks);
          }
        }
      })
      .finally(() => {
        if (active) finishBootSequence();
      });

    const offInfraction = api.onInfraction((item) => {
      setWarnings((prev) => [item, ...prev]);
      setPatienceLevel((prev) => Math.max(10, prev - (item.severity === 'terminated' ? 25 : 12)));
      setSheldonState(item.severity === 'terminated' ? 'angry' : 'crying');
    });

    const offStatus = api.onPunishmentStatus((status) => {
      if (status.punishments.length > 0) {
        const hasGuillotine = status.punishments.some((p) => p.stage !== 'warning');
        setSheldonState(hasGuillotine ? 'angry' : 'crying');
      }
    });

    return () => {
      active = false;
      offInfraction();
      offStatus();
    };
  }, []);

  // Increment Focus Timer when Sentinel Mode is active
  useEffect(() => {
    if (!isSentinelActive) return;
    const interval = setInterval(() => {
      setFocusSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSentinelActive]);

  const handleToggleSheldonState = () => {
    setSheldonState((prev) => getNextSheldonMood(prev));
  };

  const handleToggleSentinel = () => {
    if (scheduleStatus?.lockedByWorkHours && isSentinelActive) {
      return;
    }
    const next = !isSentinelActive;
    setIsSentinelActive(next);
    setSheldonState(next ? 'cool' : 'neutral');
    void window.sheldonAPI?.setSentinelMode(next);
  };

  const handleToggleTheme = () => {
    setSettings((prev) => {
      const nextTheme = prev.theme === 'dark' ? 'light' : 'dark';
      void window.sheldonAPI?.updatePersistedSettings?.({ theme: nextTheme });
      return { ...prev, theme: nextTheme };
    });
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const nextCompleted = !task.completed;
        if (nextCompleted) {
          setSnacksAvailable((s) => s + 1);
          setPatienceLevel((p) => Math.min(100, p + 12));
          setSheldonState('happy');
          void markTickTickTaskComplete(
            settings.tickTickToken,
            task.id,
            task.tickTickProjectId
          );
        }
        return { ...task, completed: nextCompleted };
      })
    );
  };

  const handleAddTask = async (
    title: string,
    project: string,
    estimatedMinutes: number,
    priority: TaskPriority,
    tags?: string[],
    description?: string,
    scheduledTime?: string
  ): Promise<DailyTask> => {
    let startDate: string | undefined;
    let dueDate: string | undefined;
    let isAllDay: boolean | undefined;

    if (scheduledTime) {
      const [hStr, mStr] = scheduledTime.split(':');
      const startObj = new Date();
      startObj.setHours(Number(hStr) || 9, Number(mStr) || 0, 0, 0);
      const endObj = new Date(startObj.getTime() + (estimatedMinutes || 30) * 60000);
      startDate = startObj.toISOString();
      dueDate = endObj.toISOString();
      isAllDay = false;
    }

    const newTask = await createTickTickTask(settings.tickTickToken, {
      title,
      projectId: project === 'Hoje' ? undefined : project,
      content: description,
      desc: description,
      priority: priority === 'high' ? 5 : priority === 'medium' ? 3 : 0,
      tags: tags || [],
      startDate,
      dueDate,
      isAllDay,
    });

    newTask.estimatedMinutes = estimatedMinutes || 30;
    if (!newTask.project) newTask.project = project;
    if (!newTask.tags || newTask.tags.length === 0) newTask.tags = tags || [];
    newTask.scheduledTime = scheduledTime;
    newTask.dueLabel = scheduledTime ? `Hoje às ${scheduledTime}` : 'Hoje';
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  };

  const handleUpdateTaskSchedule = useCallback(
    (taskId: string, startTime: string, durationMinutes: number) => {
      const [hStr, mStr] = startTime.split(':');
      const startObj = new Date();
      startObj.setHours(Number(hStr) || 9, Number(mStr) || 0, 0, 0);
      const endObj = new Date(startObj.getTime() + Math.max(15, durationMinutes) * 60000);
      const startISO = startObj.toISOString();
      const dueISO = endObj.toISOString();

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          if (t.tickTickId && hasValidTickTickToken(settings.tickTickToken)) {
            void updateTickTickTask(settings.tickTickToken, {
              id: t.tickTickId,
              projectId: t.tickTickProjectId || 'inbox',
              startDate: startISO,
              dueDate: dueISO,
              isAllDay: false,
            });
          }
          return {
            ...t,
            scheduledTime: startTime,
            estimatedMinutes: durationMinutes,
            startDate: startISO,
            dueDate: dueISO,
            isAllDay: false,
          };
        })
      );
    },
    [settings.tickTickToken]
  );

  const handleSyncTickTick = async () => {
    setIsSyncingTickTick(true);
    try {
      const res = await syncTickTickTasks(settings.tickTickToken);
      if (res.tasks) {
        setTasks(res.tasks);
        setSheldonState('happy');
        setPatienceLevel((prev) => Math.min(100, prev + 10));
      }
    } catch (err) {
      console.warn('[TickTick Sync Error]:', err);
    } finally {
      setIsSyncingTickTick(false);
    }
  };

  /** Play / Pause without ever resetting remainingSeconds or deselecting task */
  const handleTogglePlay = useCallback(() => {
    setFloatingRemainingSec((prev) => (prev <= 0 ? floatingTotalSec : prev));
    setIsFloatingRunning((prev) => !prev);
  }, [floatingTotalSec]);

  /** Stop focus completely: pauses timer, deselects task, resets to default 25:00 */
  const handleStopFocus = useCallback(() => {
    setIsFloatingRunning(false);
    setFloatingWidgetTask(null);
    setFloatingTotalSec(25 * 60);
    setFloatingRemainingSec(25 * 60);
  }, []);

  const handleSelectFocusTask = useCallback(
    (task: DailyTask | null) => {
      if (!task) {
        handleStopFocus();
        return;
      }
      if (floatingWidgetTask?.id === task.id) return;
      const sec = (task.estimatedMinutes || 25) * 60;
      setFloatingWidgetTask(task);
      setFloatingTotalSec(sec);
      setFloatingRemainingSec(sec);
      setIsFloatingRunning(false);
    },
    [floatingWidgetTask, handleStopFocus]
  );

  const handleStartFocus = (task: DailyTask) => {
    const isSameTaskWithRemaining =
      floatingWidgetTask?.id === task.id && floatingRemainingSec > 0;
    if (!isSameTaskWithRemaining) {
      const sec = (task.estimatedMinutes || 25) * 60;
      setFloatingWidgetTask(task);
      setFloatingTotalSec(sec);
      setFloatingRemainingSec(sec);
    }
    setIsFloatingRunning(true);
  };

  const handleStartCustomFocus = (category: string, minutes: number) => {
    const customTask: DailyTask = {
      id: `custom-focus-${Date.now()}`,
      title: `Sessão de Foco: ${category}`,
      project: category,
      estimatedMinutes: minutes,
      completed: false,
      priority: 'high',
      syncedFromTickTick: false,
    };
    const sec = minutes * 60;
    setFloatingWidgetTask(customTask);
    setFloatingTotalSec(sec);
    setFloatingRemainingSec(sec);
    setIsFloatingRunning(true);
    setIsFocusModalOpen(true);
  };

  const handleOpenFloatingWidget = () => {
    setIsFloatingWidgetVisible(true);
    if (window.sheldonAPI) {
      void window.sheldonAPI.showDynamicIsland?.();
    }
  };

  const handleCreateReminder = (title: string, time: string) => {
    const newRem: ReminderItem = {
      id: `rem-${Date.now()}`,
      title,
      time,
      completed: false,
      createdAt: Date.now(),
    };
    setReminders((prev) => [newRem, ...prev]);
  };

  const handleToggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleTestIslandNotification = useCallback(() => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}`;
    const candidate =
      floatingWidgetTask ||
      tasks.find((t) => !t.completed) || {
        id: 'test-task',
        title: 'Sessão de Foco • Sheldon Focus',
        project: 'Trabalho 💻',
        estimatedMinutes: 25,
        completed: false,
        priority: 'high' as const,
        syncedFromTickTick: false,
      };

    void window.sheldonAPI?.showDynamicIsland?.();
    setActiveIslandNotification({
      id: `test-notif-${Date.now()}`,
      taskId: candidate.id,
      title: candidate.title,
      project: candidate.project,
      timeLabel: hhmm,
      triggeredAt: Date.now(),
    });
  }, [floatingWidgetTask, tasks]);

  const handleReplayIslandIntro = useCallback(async () => {
    await window.sheldonAPI?.setIslandIntroPlayed?.(false);
    await window.sheldonAPI?.showDynamicIsland?.();
    setReplayIslandIntroNonce((n) => n + 1);
  }, []);

  // Keep latest Dynamic Island action handler fresh without re-subscribing IPC
  islandActionHandlerRef.current = (action: DynamicIslandAction) => {
    switch (action.type) {
      case 'toggle-play':
        handleTogglePlay();
        break;
      case 'stop-focus':
        handleStopFocus();
        break;
      case 'select-task': {
        if (!action.taskId) {
          handleStopFocus();
          break;
        }
        const found = tasks.find((t) => t.id === action.taskId);
        if (found) {
          handleSelectFocusTask(found);
        }
        break;
      }
      case 'toggle-task-complete':
        handleToggleTask(action.taskId);
        break;
      case 'add-task':
        void handleAddTask(
          action.title,
          action.project,
          action.estimatedMinutes,
          action.priority,
          action.tags,
          undefined,
          action.scheduledTime
        ).then((created) => {
          const sec = (created.estimatedMinutes || 25) * 60;
          setFloatingWidgetTask(created);
          setFloatingTotalSec(sec);
          setFloatingRemainingSec(sec);
        });
        break;
      case 'set-preset-minutes': {
        const sec = action.minutes * 60;
        setFloatingTotalSec(sec);
        setFloatingRemainingSec(sec);
        break;
      }
      case 'start-event-focus': {
        const ev = DEFAULT_AGENDA_EVENTS.find((item) => item.id === action.eventId);
        if (ev) {
          const sec = (ev.durationMinutes || 30) * 60;
          const eventTask: DailyTask = {
            id: `event-focus-${ev.id}`,
            title: ev.title,
            project: 'Agenda',
            estimatedMinutes: ev.durationMinutes,
            completed: false,
            priority: 'high',
            syncedFromTickTick: false,
          };
          setFloatingWidgetTask(eventTask);
          setFloatingTotalSec(sec);
          setFloatingRemainingSec(sec);
          setIsFloatingRunning(true);
        }
        break;
      }
      case 'toggle-sentinel':
        handleToggleSentinel();
        break;
      case 'open-main-window':
        if (action.tab) setActiveTab(action.tab);
        break;
      case 'notification-focus': {
        setActiveIslandNotification(null);
        const found = action.notification.taskId
          ? tasks.find((t) => t.id === action.notification.taskId)
          : null;
        const focusTask: DailyTask = found || {
          id: action.notification.taskId || `notif-task-${Date.now()}`,
          title: action.notification.title,
          project: action.notification.project || 'Agenda',
          estimatedMinutes: 25,
          completed: false,
          priority: 'high',
          syncedFromTickTick: false,
        };
        const sec = (focusTask.estimatedMinutes || 25) * 60;
        setFloatingWidgetTask(focusTask);
        setFloatingTotalSec(sec);
        setFloatingRemainingSec(sec);
        setIsFloatingRunning(true);
        break;
      }
      case 'notification-snooze': {
        const snoozed = action.notification;
        setActiveIslandNotification(null);
        const timer = setTimeout(() => {
          const now = new Date();
          const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}`;
          setActiveIslandNotification({
            ...snoozed,
            timeLabel: `${hhmm} (Adiado)`,
            triggeredAt: Date.now(),
          });
        }, 5 * 60_000);
        snoozeTimersRef.current.push(timer);
        break;
      }
      case 'notification-dismiss':
        setActiveIslandNotification(null);
        break;
      case 'mark-intro-played':
      case 'update-quick-note':
        break;
    }
  };

  const handleSimulateViolation = () => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const randomExe =
      settings.blacklistedExecutables[
        Math.floor(Math.random() * settings.blacklistedExecutables.length)
      ] || 'SleepingDogs.exe';

    const newWarning: WarningLogItem = {
      id: `warn-${Date.now()}`,
      timestamp: timeStr,
      executable: randomExe,
      windowTitle: `Tentativa de Execução Detectada (${randomExe})`,
      severity: 'terminated',
      actionTaken: 'Taskkill Imediato',
      sheldonComment: `Você clicou em ${randomExe} achando que eu estava dormindo? Processo eliminado!`,
    };

    setWarnings((prev) => [newWarning, ...prev]);
    setPatienceLevel((prev) => Math.max(10, prev - 18));
    setSheldonState('angry');
  };

  const handleFeedSheldon = () => {
    if (snacksAvailable <= 0) return;
    setSnacksAvailable((prev) => prev - 1);
    setPatienceLevel((prev) => Math.min(100, prev + 15));
    setSheldonState('happy');
  };

  const handleUpdateSettings = (updated: Partial<SheldonLeashSettings>) => {
    setSettings((prev) => ({ ...prev, ...updated }));

    const api = window.sheldonAPI;
    if (!api) return;

    const persistPatch: Record<string, unknown> = {};
    if (updated.tickTickToken !== undefined) persistPatch.tickTickToken = updated.tickTickToken;
    if (updated.theme !== undefined) persistPatch.theme = updated.theme;
    if (updated.workHoursEnabled !== undefined) persistPatch.workHoursEnabled = updated.workHoursEnabled;
    if (updated.workHoursStart !== undefined) persistPatch.workHoursStart = updated.workHoursStart;
    if (updated.workHoursEnd !== undefined) persistPatch.workHoursEnd = updated.workHoursEnd;
    if (updated.vacationModeEnabled !== undefined) {
      persistPatch.vacationModeEnabled = updated.vacationModeEnabled;
    }
    if (updated.vacationStartDate !== undefined) {
      persistPatch.vacationStartDate = updated.vacationStartDate;
    }
    if (updated.vacationEndDate !== undefined) persistPatch.vacationEndDate = updated.vacationEndDate;
    if (updated.lunchLockEnabled !== undefined) persistPatch.lunchLockEnabled = updated.lunchLockEnabled;
    if (updated.lunchStartTime !== undefined) persistPatch.lunchStartTime = updated.lunchStartTime;
    if (updated.lunchEndTime !== undefined) persistPatch.lunchEndTime = updated.lunchEndTime;
    if (updated.autoLaunchEnabled !== undefined) persistPatch.autoLaunchEnabled = updated.autoLaunchEnabled;

    if (Object.keys(persistPatch).length > 0) {
      void api.updatePersistedSettings?.(persistPatch);
    }

    if (
      updated.fullscreenBlockEnabled !== undefined ||
      updated.forcedTaskkillEnabled !== undefined
    ) {
      void api.updateWatcherConfig({
        fullscreenBlockEnabled: updated.fullscreenBlockEnabled,
        forcedTaskkillEnabled: updated.forcedTaskkillEnabled,
      });
    }

    if (updated.blacklistedExecutables) {
      const next = updated.blacklistedExecutables;
      const prevLower = settings.blacklistedExecutables.map((x) => x.toLowerCase());
      const nextLower = next.map((x) => x.toLowerCase());
      const added = next.filter((x) => !prevLower.includes(x.toLowerCase()));
      const removed = settings.blacklistedExecutables.filter(
        (x) => !nextLower.includes(x.toLowerCase())
      );

      void (async () => {
        let canonical: string[] | null = null;
        for (const exe of added) {
          try {
            canonical = await api.addToBlacklist(exe);
          } catch (err) {
            console.warn('[Sheldon] Executável rejeitado:', err);
          }
        }
        for (const exe of removed) {
          canonical = await api.removeFromBlacklist(exe);
        }
        const finalList = canonical ?? (await api.getBlacklist());
        setSettings((prev) => ({ ...prev, blacklistedExecutables: finalList }));
      })();
    }
  };

  return (
    <div className="h-screen w-screen bg-[#F5F6FA] dark:bg-[#141518] text-[#242424] dark:text-[#F3F4F6] flex flex-col overflow-hidden font-sans select-none antialiased">
      {/* Full-Width Borderless Draggable Top Titlebar */}
      <WindowTitleBar />

      {/* 3-Column Figma Layout (scaled ~80%) */}
      <main className="flex-1 min-h-0 px-3.5 xl:px-5 pb-3.5 pt-0 flex items-stretch gap-3 xl:gap-4 overflow-hidden">
        {/* Column 1: Collapsible Left Sidebar */}
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          sheldonState={sheldonState}
          onToggleSheldonMood={handleToggleSheldonState}
          isSentinelActive={isSentinelActive}
          onToggleSentinel={handleToggleSentinel}
          warningsCount={warnings.length}
          isCollapsed={isLeftSidebarCollapsed}
          onToggleCollapsed={() => setIsLeftSidebarCollapsed((prev) => !prev)}
          scheduleStatus={scheduleStatus}
        />

        {/* Column 2: Main Workspace + Bottom Focus Bar */}
        <div className="flex-1 min-w-0 h-full flex flex-col gap-2.5 min-h-0 overflow-hidden">
          {/* Active Tab Content Card */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {(activeTab === 'hoje' || activeTab === 'daybreak') && (
              <TarefasCard
                tasks={tasks}
                selectedTaskId={floatingWidgetTask?.id ?? null}
                onToggleTask={handleToggleTask}
                onAddTask={handleAddTask}
                onStartFocus={handleStartFocus}
                onSelectTask={(task) => handleSelectFocusTask(task)}
                onSyncTickTick={handleSyncTickTick}
                isSyncing={isSyncingTickTick}
              />
            )}

            {(activeTab === 'metricas' || activeTab === 'black-mirror') && (
              <div className="bg-card border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] p-4 xl:p-5 flex-1 min-h-0 overflow-y-auto sheldon-scroll">
                <MetricsView
                  warnings={warnings}
                  onSimulateViolation={handleSimulateViolation}
                />
              </div>
            )}

            {activeTab === 'bloquear' && (
              <BlockerTab
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                isSentinelActive={isSentinelActive}
                onToggleSentinel={handleToggleSentinel}
                onSimulateViolation={handleSimulateViolation}
                scheduleStatus={scheduleStatus}
              />
            )}

            {(activeTab === 'sheldon' || activeTab === 'sheldon-mood') && (
              <div className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] p-4 xl:p-5 flex-1 min-h-0 overflow-y-auto sheldon-scroll">
                <SheldonMoodTab
                  sheldonState={sheldonState}
                  onSetSheldonState={setSheldonState}
                  patienceLevel={patienceLevel}
                  snacksAvailable={snacksAvailable}
                  onFeedSheldon={handleFeedSheldon}
                  onStartCustomFocus={handleStartCustomFocus}
                />
              </div>
            )}

            {(activeTab === 'configuracoes' || activeTab === 'settings-leash') && (
              <div className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] p-4 xl:p-5 flex-1 min-h-0 overflow-y-auto sheldon-scroll">
                <SettingsLeashTab
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onToggleTheme={handleToggleTheme}
                  onTestFloatingWidget={() => {
                    setIsFloatingWidgetVisible(true);
                    handleUpdateSettings({ floatingWidgetEnabled: true });
                    void window.sheldonAPI?.showDynamicIsland?.();
                  }}
                  onCloseFloatingWidget={() => {
                    setIsFloatingWidgetVisible(false);
                    handleUpdateSettings({ floatingWidgetEnabled: false });
                    void window.sheldonAPI?.hideDynamicIsland?.();
                  }}
                  onReplayIntro={() => setShowIntro(true)}
                  onTestIslandNotification={handleTestIslandNotification}
                  onReplayIslandIntro={() => {
                    void handleReplayIslandIntro();
                  }}
                />
              </div>
            )}
          </div>

          {/* Bottom Focus Control Bar inside Center Column */}
          <FloatingFocusBar
            tasks={tasks}
            selectedTask={floatingWidgetTask}
            onSelectTask={handleSelectFocusTask}
            isRunning={isFloatingRunning}
            onTogglePlay={handleTogglePlay}
            onStopFocus={handleStopFocus}
            remainingSeconds={floatingRemainingSec}
            totalSeconds={floatingTotalSec}
            onOpenFullscreenFocus={() => setIsFocusModalOpen(true)}
            onTogglePipWidget={() => {
              if (window.sheldonAPI) {
                const nextEnabled = !settings.floatingWidgetEnabled;
                handleUpdateSettings({ floatingWidgetEnabled: nextEnabled });
                if (nextEnabled) {
                  void window.sheldonAPI.showDynamicIsland?.();
                } else {
                  void window.sheldonAPI.hideDynamicIsland?.();
                }
              } else {
                setIsFloatingWidgetVisible((prev) => !prev);
              }
            }}
            onSetPresetMinutes={(mins) => {
              const sec = mins * 60;
              setFloatingTotalSec(sec);
              setFloatingRemainingSec(sec);
            }}
          />
        </div>

        {/* Column 3: Collapsible Right Extra Panel */}
        <RightExtraPanel
          isOpen={isRightPanelOpen}
          onToggleOpen={() => setIsRightPanelOpen((prev) => !prev)}
          tasks={tasks}
          onUpdateTaskSchedule={handleUpdateTaskSchedule}
          reminders={reminders}
          onCreateReminder={handleCreateReminder}
          onToggleReminder={handleToggleReminder}
          onDeleteReminder={handleDeleteReminder}
          onStartEventFocus={(ev) => {
            const eventTask: DailyTask = {
              id: ev.linkedTaskId || `event-focus-${ev.id}`,
              title: ev.title,
              project: 'Agenda',
              estimatedMinutes: ev.durationMinutes,
              completed: false,
              priority: 'high',
              syncedFromTickTick: Boolean(ev.tickTickTaskId),
            };
            handleStartFocus(eventTask);
          }}
        />
      </main>

      {/* Shared Pomodoro Fullscreen Modal (never resets timer independently) */}
      <PomodoroFocusModal
        task={floatingWidgetTask}
        isOpen={isFocusModalOpen}
        isRunning={isFloatingRunning}
        remainingSeconds={floatingRemainingSec}
        totalSeconds={floatingTotalSec}
        onTogglePlay={handleTogglePlay}
        onStopFocus={handleStopFocus}
        onClose={() => setIsFocusModalOpen(false)}
        onCompleteTask={handleToggleTask}
        onOpenFloatingWidget={handleOpenFloatingWidget}
      />

      {/* In-App Floating Mini-Widget (browser preview fallback only) */}
      <InAppFloatingWidget
        task={floatingWidgetTask}
        remainingSeconds={floatingRemainingSec}
        isRunning={isFloatingRunning}
        isVisible={!window.sheldonAPI && isFloatingWidgetVisible && settings.floatingWidgetEnabled}
        onTogglePlay={handleTogglePlay}
        onClose={() => {
          setIsFloatingWidgetVisible(false);
          window.sheldonAPI?.hideFloatingWidget();
        }}
        onExpand={() => setIsFocusModalOpen(true)}
      />

      {/* App Opening Cinematic Animation (plays once per fresh boot after loading splash hides) */}
      {showIntro && (
        <AppIntroAnimation
          onComplete={() => {
            setShowIntro(false);
            sessionStorage.setItem('sheldon_boot_played', '1');
          }}
        />
      )}
    </div>
  );
};
