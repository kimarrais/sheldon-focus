import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import type { DailyTask } from '@shared/types';
import arrowLeftSvg from '../../assets/figma/v2/arrow-left-01.svg';
import panelLeftSvg from '../../assets/figma/v2/panel-left.svg';
import utensilsSvg from '../../assets/figma/v2/utensils.svg';

export interface AgendaEvent {
  id: string;
  title: string;
  startHour: string;
  endHour: string;
  slotHour: number;
  durationMinutes: number;
  icon?: string;
  completed?: boolean;
  linkedTaskId?: string;
  tickTickTaskId?: string;
  tickTickProjectId?: string;
}

export const DEFAULT_AGENDA_EVENTS: AgendaEvent[] = [
  {
    id: 'ev-1',
    title: 'Rotina Matinal',
    startHour: '08:00',
    endHour: '08:40',
    slotHour: 8,
    durationMinutes: 40,
  },
  {
    id: 'ev-2',
    title: 'Revisão de arte',
    startHour: '10:00',
    endHour: '11:00',
    slotHour: 10,
    durationMinutes: 60,
  },
  {
    id: 'ev-3',
    title: 'Almoço',
    startHour: '12:00',
    endHour: '13:00',
    slotHour: 12,
    durationMinutes: 60,
  },
  {
    id: 'ev-4',
    title: 'Planejamento',
    startHour: '14:00',
    endHour: '15:00',
    slotHour: 14,
    durationMinutes: 60,
  },
];

const START_HOUR = 6; // 06:00
const END_HOUR = 22; // 22:00
const SLOT_HEIGHT = 44; // scaled ~80% px per hour
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TOTAL_TIMELINE_HEIGHT = HOURS.length * SLOT_HEIGHT;

const EVENTS_STORAGE_KEY = 'sheldon_calendar_events_v2';

function parseMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return START_HOUR * 60;
  return h * 60 + m;
}

function formatMinutesToHHMM(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDatePt(date: Date): { dayDate: string; weekday: string } {
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const months = [
    'Jan.',
    'Fev.',
    'Mar.',
    'Abr.',
    'Mai.',
    'Jun.',
    'Jul.',
    'Ago.',
    'Set.',
    'Out.',
    'Nov.',
    'Dez.',
  ];
  const day = String(date.getDate()).padStart(2, '0');
  return {
    dayDate: `${day} de ${months[date.getMonth()]} de ${date.getFullYear()}`,
    weekday: days[date.getDay()],
  };
}

interface AgendaTimelineProps {
  tasks?: DailyTask[];
  onUpdateTaskSchedule?: (
    taskId: string,
    startTime: string,
    durationMinutes: number
  ) => void;
  onStartEventFocus?: (event: AgendaEvent) => void;
  onToggleCollapse?: () => void;
}

export const AgendaTimeline: React.FC<AgendaTimelineProps> = ({
  tasks = [],
  onUpdateTaskSchedule,
  onStartEventFocus,
  onToggleCollapse,
}) => {
  const [manualEvents, setManualEvents] = useState<AgendaEvent[]>(() => {
    try {
      const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AgendaEvent[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage error
    }
    return DEFAULT_AGENDA_EVENTS;
  });

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftTaskId, setDraftTaskId] = useState<string>('');
  const [draftStart, setDraftStart] = useState<string>('09:00');
  const [draftEnd, setDraftEnd] = useState<string>('10:00');

  // Drag-resize state for adjusting event duration seamlessly
  const [resizePreview, setResizePreview] = useState<{
    eventId: string;
    durationMinutes: number;
    endHour: string;
  } | null>(null);
  const resizeSessionRef = useRef<{
    ev: AgendaEvent;
    startY: number;
    initialDuration: number;
    latestDuration: number;
    latestEndHour: string;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(manualEvents));
    } catch {
      // ignore storage error
    }
  }, [manualEvents]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nowMin = parseMinutes(currentTimeStr);
    const clampedMin = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, nowMin));
    const offsetPx = ((clampedMin - START_HOUR * 60) / 60) * SLOT_HEIGHT;
    el.scrollTop = Math.max(0, offsetPx - 120);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // Merge manual events with Today's scheduled TickTick/app tasks
  const displayEvents: AgendaEvent[] = useMemo(() => {
    const isViewingToday = isSameLocalDay(selectedDate, new Date());
    if (!isViewingToday) {
      return manualEvents;
    }

    const linkedTaskIds = new Set(manualEvents.map((e) => e.linkedTaskId).filter(Boolean));
    const taskEvents: AgendaEvent[] = tasks
      .filter((t) => !t.completed && Boolean(t.scheduledTime) && !linkedTaskIds.has(t.id))
      .map((t) => {
        const startHour = t.scheduledTime!;
        const startMin = parseMinutes(startHour);
        const dur = Math.max(15, t.estimatedMinutes || 30);
        const endHour = formatMinutesToHHMM(startMin + dur);
        return {
          id: `task-ev-${t.id}`,
          title: t.title,
          startHour,
          endHour,
          slotHour: Math.floor(startMin / 60),
          durationMinutes: dur,
          completed: t.completed,
          linkedTaskId: t.id,
          tickTickTaskId: t.tickTickId,
          tickTickProjectId: t.tickTickProjectId,
        };
      });

    return [...manualEvents, ...taskEvents];
  }, [manualEvents, tasks, selectedDate]);

  // Global mouse listeners while resizing an event block's bottom edge
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      const deltaY = e.clientY - session.startY;
      const deltaMin = Math.round(((deltaY / SLOT_HEIGHT) * 60) / 15) * 15;
      const startMin = parseMinutes(session.ev.startHour);
      const maxDur = Math.max(15, (END_HOUR + 1) * 60 - startMin);
      const nextDuration = Math.max(15, Math.min(maxDur, session.initialDuration + deltaMin));
      const nextEndHour = formatMinutesToHHMM(startMin + nextDuration);

      session.latestDuration = nextDuration;
      session.latestEndHour = nextEndHour;

      setResizePreview({
        eventId: session.ev.id,
        durationMinutes: nextDuration,
        endHour: nextEndHour,
      });
    };

    const handleMouseUp = () => {
      const session = resizeSessionRef.current;
      if (!session) return;
      resizeSessionRef.current = null;
      setResizePreview(null);

      const { ev, latestDuration, latestEndHour } = session;
      if (latestDuration === ev.durationMinutes) return;

      if (ev.linkedTaskId) {
        onUpdateTaskSchedule?.(ev.linkedTaskId, ev.startHour, latestDuration);
      }

      if (!ev.id.startsWith('task-ev-')) {
        setManualEvents((prev) =>
          prev.map((item) =>
            item.id === ev.id
              ? { ...item, durationMinutes: latestDuration, endHour: latestEndHour }
              : item
          )
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onUpdateTaskSchedule]);

  const beginResizeEvent = (e: React.MouseEvent, ev: AgendaEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeSessionRef.current = {
      ev,
      startY: e.clientY,
      initialDuration: ev.durationMinutes,
      latestDuration: ev.durationMinutes,
      latestEndHour: ev.endHour,
    };
    setResizePreview({
      eventId: ev.id,
      durationMinutes: ev.durationMinutes,
      endHour: ev.endHour,
    });
  };

  const handleScrollActivity = () => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 900);
  };

  const shiftDay = (delta: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      return next;
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const linkedTask = tasks.find((t) => t.id === draftTaskId);
    const title = (draftTitle.trim() || linkedTask?.title || '').trim();
    if (!title) return;

    const startMin = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, parseMinutes(draftStart)));
    const endMin = Math.max(startMin + 15, Math.min((END_HOUR + 1) * 60, parseMinutes(draftEnd)));
    const duration = endMin - startMin;

    if (linkedTask) {
      onUpdateTaskSchedule?.(linkedTask.id, formatMinutesToHHMM(startMin), duration);
    } else {
      const nextEvent: AgendaEvent = {
        id: `ev-${Date.now()}`,
        title,
        startHour: formatMinutesToHHMM(startMin),
        endHour: formatMinutesToHHMM(endMin),
        slotHour: Math.floor(startMin / 60),
        durationMinutes: duration,
      };
      setManualEvents((prev) => [...prev, nextEvent]);
    }

    setDraftTitle('');
    setDraftTaskId('');
    setShowAddForm(false);
  };

  const dateDisplay = formatDatePt(selectedDate);
  const nowMinutes = parseMinutes(currentTimeStr);
  const minBound = START_HOUR * 60;
  const maxBound = END_HOUR * 60 + 59;
  const isWithinDay = nowMinutes >= minBound && nowMinutes <= maxBound;
  const currentTimeTop =
    ((Math.max(minBound, Math.min(maxBound, nowMinutes)) - minBound) / 60) * SLOT_HEIGHT + 10;

  const schedulableTasks = tasks.filter((t) => !t.completed);

  return (
    <div
      className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] flex flex-col px-3 py-3 select-none flex-1 min-h-0 overflow-hidden"
      aria-label="Agenda diária"
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-2.5 shrink-0 gap-1.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              title="Voltar para hoje"
              className="flex items-center gap-1 group text-left"
            >
              <span className="text-[12px] font-semibold text-[#242424] dark:text-white group-hover:text-[#FB7213] transition-colors truncate">
                {dateDisplay.dayDate}
              </span>
              <div className="-rotate-90 shrink-0 flex items-center justify-center">
                <img src={arrowLeftSvg} width={10} height={10} alt="" className="block dark:invert" />
              </div>
            </button>

            <div className="flex items-center gap-0.5 ml-0.5">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                title="Dia anterior"
                className="size-4.5 rounded-md hover:bg-[#F5F6FA] dark:hover:bg-white/10 text-[#6D6D6D] dark:text-white/60 hover:text-[#242424] dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={11} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                title="Próximo dia"
                className="size-4.5 rounded-md hover:bg-[#F5F6FA] dark:hover:bg-white/10 text-[#6D6D6D] dark:text-white/60 hover:text-[#242424] dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={11} strokeWidth={2} />
              </button>
            </div>
          </div>
          <span className="text-[10px] text-[#6D6D6D] dark:text-[#9CA3AF] font-normal">
            {dateDisplay.weekday}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            title="Agendar bloco ou tarefa TickTick"
            className={`size-[28px] rounded-[7px] flex items-center justify-center transition-all active:scale-95 ${
              showAddForm
                ? 'bg-[#FB7213] text-white'
                : 'bg-[#F5F6FA] dark:bg-[#2A2C32] hover:bg-[#FECCAA]/50 dark:hover:bg-[#FB7213]/25 text-[#242424] dark:text-white'
            }`}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2.2} />
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="bg-[#E5E7EB]/85 dark:bg-[#2A2C32] hover:bg-[#D5D8E0] dark:hover:bg-[#353841] size-[28px] rounded-[7px] flex items-center justify-center transition-all active:scale-95"
              title="Ocultar painel direito"
            >
              <img src={panelLeftSvg} width={16} height={16} alt="Recolher" className="block dark:invert" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Add / Link TickTick Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddEvent}
          className="mb-2.5 p-2.5 rounded-[12px] bg-[#F5F6FA] dark:bg-[#26282E] border border-[#E7E5F0] dark:border-white/10 flex flex-col gap-1.5 shrink-0"
        >
          {schedulableTasks.length > 0 && (
            <select
              value={draftTaskId}
              onChange={(e) => {
                const id = e.target.value;
                setDraftTaskId(id);
                const found = schedulableTasks.find((t) => t.id === id);
                if (found) setDraftTitle(found.title);
              }}
              className="bg-white dark:bg-[#191A1E] rounded-[8px] px-2 py-1 text-[10.5px] font-medium text-[#242424] dark:text-white border border-[#E7E5F0] dark:border-white/10 outline-none"
            >
              <option value="">Novo bloco ou vincular tarefa TickTick...</option>
              {schedulableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tickTickId ? '🔄 ' : '• '}
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            autoFocus={!draftTaskId}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Nome do evento (ex: Deep Work)"
            className="bg-white dark:bg-[#191A1E] rounded-[8px] px-2.5 py-1 text-[11px] font-medium text-[#242424] dark:text-white border border-[#E7E5F0] dark:border-white/10 outline-none focus:border-[#FB7213]"
          />
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white dark:bg-[#191A1E] rounded-[8px] px-1.5 py-1 border border-[#E7E5F0] dark:border-white/10 flex-1">
              <HugeiconsIcon icon={Clock01Icon} size={11} className="text-[#6D6D6D] shrink-0" />
              <input
                type="time"
                min="06:00"
                max="22:00"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="text-[10.5px] font-medium text-[#242424] dark:text-white bg-transparent outline-none w-full"
              />
            </div>
            <span className="text-[10px] text-[#6D6D6D]">até</span>
            <div className="flex items-center gap-1 bg-white dark:bg-[#191A1E] rounded-[8px] px-1.5 py-1 border border-[#E7E5F0] dark:border-white/10 flex-1">
              <input
                type="time"
                min="06:15"
                max="22:59"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="text-[10.5px] font-medium text-[#242424] dark:text-white bg-transparent outline-none w-full"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1 rounded-[8px] bg-[#FB7213] hover:bg-[#E06209] text-white text-[10.5px] font-semibold shrink-0"
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Timeline Scroll Area (06:00 -> 22:00) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScrollActivity}
        onWheel={handleScrollActivity}
        className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden calendar-scroll pr-1 ${
          isScrolling ? 'is-scrolling' : ''
        }`}
      >
        <div className="relative w-full" style={{ height: `${TOTAL_TIMELINE_HEIGHT + 16}px` }}>
          {/* Horizontal Hour Lines */}
          {HOURS.map((h, i) => (
            <div
              key={`line-${h}`}
              style={{ top: `${i * SLOT_HEIGHT + 10}px` }}
              className="absolute left-[38px] right-0 h-px bg-[#E0E3E8] dark:bg-white/[0.08] pointer-events-none"
            />
          ))}

          {/* Hour Labels Column */}
          <div className="absolute left-0 top-0 w-[34px] flex flex-col pointer-events-none">
            {HOURS.map((h) => (
              <div
                key={`label-${h}`}
                style={{ height: `${SLOT_HEIGHT}px` }}
                className="flex items-start justify-center pt-[3px] text-[9.5px] font-medium text-[#242424] dark:text-white/60 tabular-nums"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Events Layer with Draggable Bottom Resize Handles */}
          <div className="absolute left-[42px] right-0 top-0 bottom-0">
            {displayEvents.map((ev) => {
              const activeResize =
                resizePreview && resizePreview.eventId === ev.id ? resizePreview : null;
              const startMin = parseMinutes(ev.startHour);
              const duration = activeResize
                ? activeResize.durationMinutes
                : Math.max(15, ev.durationMinutes || parseMinutes(ev.endHour) - startMin || 45);
              const endHourLabel = activeResize ? activeResize.endHour : ev.endHour;
              const clampedStart = Math.max(START_HOUR * 60, startMin);
              const topPx = ((clampedStart - START_HOUR * 60) / 60) * SLOT_HEIGHT + 12;
              const heightPx = Math.max(28, (duration / 60) * SLOT_HEIGHT - 3);
              const isTickTick = Boolean(ev.tickTickTaskId || ev.linkedTaskId);

              return (
                <div
                  key={ev.id}
                  style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  className={`absolute left-0 right-1 rounded-[10px] px-2.5 pt-1 pb-2 flex items-center gap-2 shadow-xs hover:shadow-sm transition-colors duration-150 group overflow-hidden ${
                    isTickTick
                      ? 'bg-[#FCE5D9] hover:bg-[#fad8c7] dark:bg-[#3A2318] dark:hover:bg-[#492B1D] border border-[#FB7213]/30'
                      : 'bg-[#DFF3FE] hover:bg-[#cdecfc] dark:bg-[#192F42] dark:hover:bg-[#1E3950]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onStartEventFocus?.({ ...ev, durationMinutes: duration, endHour: endHourLabel })}
                    title={`Focar em ${ev.title} (${duration} min)${
                      isTickTick ? ' • Sincronizado com TickTick (arraste a borda inferior para redimensionar)' : ' • Arraste a borda inferior para redimensionar'
                    }`}
                    className="flex items-center gap-2 flex-1 min-w-0 h-full text-left cursor-pointer"
                  >
                    <div className="shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <img src={utensilsSvg} width={12} height={12} alt="" className="block dark:invert" />
                    </div>
                    <div
                      className={`flex flex-col min-w-0 flex-1 leading-tight ${
                        isTickTick
                          ? 'text-[#7C2D12] dark:text-[#FDBA74]'
                          : 'text-[#034163] dark:text-[#93C5FD]'
                      }`}
                    >
                      <span className="text-[10.5px] font-bold truncate">
                        {isTickTick && '🔄 '}
                        {ev.title}
                      </span>
                      <span className="text-[8.5px] font-medium opacity-80 tabular-nums">
                        {ev.startHour} - {endHourLabel} · {duration}m
                      </span>
                    </div>
                  </button>

                  {!ev.id.startsWith('task-ev-') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setManualEvents((prev) => prev.filter((item) => item.id !== ev.id));
                      }}
                      title="Remover evento"
                      className="opacity-0 group-hover:opacity-100 size-4.5 rounded-md hover:bg-white/75 dark:hover:bg-black/30 text-current opacity-70 hover:text-[#E05555] text-[11px] font-bold flex items-center justify-center shrink-0 transition-all"
                    >
                      ×
                    </button>
                  )}

                  {/* Bottom Drag Resize Handle (15-min snap, syncs TickTick) */}
                  <div
                    onMouseDown={(e) => beginResizeEvent(e, ev)}
                    title="Arraste para aumentar ou diminuir a duração (salva no TickTick)"
                    className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="w-7 h-[2.5px] rounded-full bg-current opacity-45" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Time Indicator Pill & Line */}
          {isWithinDay && (
            <div
              style={{ top: `${currentTimeTop - 10}px` }}
              className="absolute left-0 right-0 h-[20px] flex items-center z-10 pointer-events-none transition-all duration-500 ease-out"
            >
              <div className="bg-[#2D2E30] dark:bg-white text-white dark:text-[#242424] text-[9.5px] font-semibold px-1.5 py-0.5 rounded-[34px] shadow-sm flex items-center justify-center shrink-0 tabular-nums">
                {currentTimeStr}
              </div>
              <div className="flex-1 h-[1.5px] bg-[#2D2E30] dark:bg-white rounded-r-[16px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
