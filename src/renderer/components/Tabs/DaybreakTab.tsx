import React, { useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { CalendarEvent, DailyTask, SheldonVisualState, TaskPriority } from '@shared/types';
import { getSheldonMood } from '@/lib/sheldon-moods';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DaybreakAgendaTimeline } from '@/components/DaybreakAgendaTimeline';
import { TaskDetailInspector } from '@/components/TaskDetailInspector';

interface DaybreakTabProps {
  tasks: DailyTask[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, project: string, estimatedMinutes: number, priority: TaskPriority, tags?: string[], description?: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<DailyTask>) => void;
  isSentinelActive: boolean;
  onToggleSentinel: () => void;
  sheldonState: SheldonVisualState;
  focusSecondsElapsed: number;
  onStartFocus: (task: DailyTask) => void;
  onSyncTickTick: () => Promise<void>;
  isSyncingTickTick: boolean;
  tickTickConnected: boolean;
}

const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal-1',
    title: 'Daily Standup & Prioridades do Dia',
    startTime: '09:00',
    endTime: '09:30',
    category: 'meeting',
    color: '#3B82F6',
  },
  {
    id: 'cal-2',
    title: 'Deep Work: Foco Total no Código',
    startTime: '10:30',
    endTime: '12:00',
    category: 'deep-work',
    color: '#9333EA',
  },
  {
    id: 'cal-3',
    title: 'Bloqueio de Almoço do Sheldon',
    startTime: '12:00',
    endTime: '13:00',
    category: 'break',
    color: '#FBBF24',
  },
  {
    id: 'cal-4',
    title: 'Revisão de PRs & Backlog TickTick',
    startTime: '14:30',
    endTime: '16:00',
    category: 'work',
    color: '#10B981',
  },
  {
    id: 'cal-5',
    title: 'Alinhamento de Tarefas & Planejamento',
    startTime: '17:00',
    endTime: '17:45',
    category: 'personal',
    color: '#EC4899',
  },
];

export const DaybreakTab: React.FC<DaybreakTabProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  isSentinelActive,
  onToggleSentinel,
  sheldonState,
  focusSecondsElapsed,
  onStartFocus,
  onSyncTickTick,
  isSyncingTickTick,
  tickTickConnected,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAgendaOpen, setIsAgendaOpen] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(INITIAL_CALENDAR_EVENTS);

  // Quick Task Add State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickProject, setQuickProject] = useState('Errands');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('medium');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  // Extract unique lists/projects
  const availableLists = Array.from(new Set(tasks.map((t) => t.listName || t.project || 'Errands')));
  if (!availableLists.includes('Errands')) availableLists.push('Errands');
  if (!availableLists.includes('Work')) availableLists.push('Work');
  if (!availableLists.includes('Hábito de hoje')) availableLists.push('Hábito de hoje');

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      t.title.toLowerCase().includes(query) ||
      (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(query))) ||
      (t.listName && t.listName.toLowerCase().includes(query))
    );
  });

  // Group tasks by listName/project (TickTick style)
  const groupedTasks: Record<string, DailyTask[]> = {};
  filteredTasks.forEach((task) => {
    const groupName = task.listName || task.project || 'Geral';
    if (!groupedTasks[groupName]) {
      groupedTasks[groupName] = [];
    }
    groupedTasks[groupName].push(task);
  });

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onAddTask(
      quickTitle.trim(),
      quickProject,
      30,
      quickPriority,
      [quickProject],
      ''
    );
    setQuickTitle('');
  };

  const handleAddCalendarEvent = (newEvent: Omit<CalendarEvent, 'id'>) => {
    setCalendarEvents((prev) => [
      ...prev,
      { ...newEvent, id: `cal-${Date.now()}` },
    ]);
  };

  const formatTimer = (totalSeconds: number): string => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="flex h-full min-h-[calc(100vh-6rem)] -m-6 lg:-m-8 overflow-hidden select-none">
      {/* 1. Left Agenda Timeline (Collapsible) */}
      <DaybreakAgendaTimeline
        isOpen={isAgendaOpen}
        onToggleOpen={() => setIsAgendaOpen(false)}
        events={calendarEvents}
        onAddEvent={handleAddCalendarEvent}
      />

      {/* 2. Center: TickTick "Hoje" Main Task Board (Image 1 Style) */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto p-5 sm:p-7 space-y-6">
        {/* Top Control Header: TickTick Hoje Style with Timeyfi search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            {!isAgendaOpen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAgendaOpen(true)}
                className="text-xs font-semibold gap-1.5"
                title="Abrir Agenda de Horários de Hoje"
              >
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Agenda</span>
              </Button>
            )}

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-orange-glow-sm">
                <img
                  src={getSheldonMood(sheldonState).avatar}
                  alt="Sheldon"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
                <span>Hoje</span>
              </h1>
              <Badge variant="cream" className="font-mono text-xs px-2.5 py-0.5">
                {completedCount}/{tasks.length} concluídas
              </Badge>
              {tickTickConnected && (
                <Badge variant="success" className="font-mono text-[10px] px-2 py-0">
                  TickTick Sync
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input (Timeyfi style header, Image 5) */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar tarefa..."
                className="h-8 pl-8 pr-3 text-xs bg-secondary/60 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-36 sm:w-44 transition-all"
              />
            </div>

            {/* Sentinel Status Button */}
            <Button
              type="button"
              variant={isSentinelActive ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleSentinel}
              className={`text-xs gap-1.5 font-bold ${
                isSentinelActive
                  ? 'bg-primary text-primary-foreground shadow-orange-glow-sm'
                  : ''
              }`}
            >
              {isSentinelActive ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Sentinela Ativo ({formatTimer(focusSecondsElapsed)})</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span>Ligar Sentinela</span>
                </>
              )}
            </Button>

            {/* Sync TickTick Button */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSyncTickTick}
              disabled={isSyncingTickTick}
              className="text-xs gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncingTickTick ? 'animate-spin' : ''}`} />
              <span>{isSyncingTickTick ? 'Sincronizando...' : 'Sincronizar TickTick'}</span>
            </Button>
          </div>
        </div>

        {/* Quick Add Task Input (TickTick inline input from Image 1) */}
        <form
          onSubmit={handleQuickAdd}
          className="relative flex items-center gap-2 bg-card border border-border focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20 rounded-2xl p-2 px-3.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Adicionar uma tarefa em Hoje (ex: Enviar relatório do sprint)..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <select
            value={quickProject}
            onChange={(e) => setQuickProject(e.target.value)}
            className="bg-secondary/70 border border-border/80 rounded-xl px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none"
          >
            {availableLists.map((list) => (
              <option key={list} value={list}>
                {list}
              </option>
            ))}
          </select>

          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
            className="bg-secondary/70 border border-border/80 rounded-xl px-2 py-1 text-xs text-foreground font-semibold focus:outline-none"
          >
            <option value="high">Alta (P1)</option>
            <option value="medium">Média (P2)</option>
            <option value="low">Baixa (P3)</option>
          </select>

          <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0 font-bold">
            Adicionar
          </Button>
        </form>

        {/* Task Groups Section (Image 1 Style) */}
        <div className="space-y-6">
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="p-8 text-center bg-card rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
              <Sparkles className="w-8 h-8 text-primary mx-auto opacity-70" />
              <p className="font-semibold text-sm">Nenhuma tarefa encontrada para Hoje.</p>
              <p className="text-xs">
                Clique em "+ Adicionar uma tarefa" acima ou sincronize com seu token do TickTick.
              </p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([groupName, groupTasks]) => {
              const isCollapsed = collapsedGroups[groupName];

              return (
                <div key={groupName} className="space-y-2">
                  {/* List Header (TickTick style: 'Errands 8', 'Work 1') */}
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(groupName)}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>{groupName}</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-secondary text-foreground">
                      {groupTasks.length}
                    </span>
                  </button>

                  {/* Task Items in this group */}
                  {!isCollapsed && (
                    <div className="space-y-1.5">
                      {groupTasks.map((task) => {
                        const isSelected = selectedTaskId === task.id;

                        // Priority color left border
                        const priorityBorderColor =
                          task.priority === 'high'
                            ? 'border-l-red-500'
                            : task.priority === 'medium'
                            ? 'border-l-amber-500'
                            : 'border-l-blue-400';

                        // Due status badge color
                        const isOverdue = task.dueLabel && task.dueLabel.includes('atraso');

                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`group relative flex items-center justify-between gap-3 p-3 rounded-2xl border border-l-4 transition-all cursor-pointer ${priorityBorderColor} ${
                              isSelected
                                ? 'bg-secondary/90 border-primary ring-1 ring-primary/30 shadow-md'
                                : 'bg-card border-border/80 hover:border-border hover:bg-secondary/40'
                            } ${task.completed ? 'opacity-60 bg-background/50' : ''}`}
                          >
                            {/* Left: Checkbox + Title */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleTask(task.id);
                                }}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                  task.completed
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-muted-foreground/40 hover:border-primary'
                                }`}
                              >
                                {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <span
                                  className={`text-sm font-semibold truncate block transition-colors ${
                                    task.completed
                                      ? 'line-through text-muted-foreground'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </div>
                            </div>

                            {/* Middle/Right: Tags, List Pills & Due Date */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* List badge */}
                              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground border border-border/60">
                                {task.listName || task.project}
                              </span>

                              {/* Tags (TickTick style: Trabalho, Estudo, etc.) */}
                              {(task.tags || []).slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-secondary/80 text-[10px] font-bold text-foreground border border-border/60"
                                >
                                  {tag}
                                </span>
                              ))}

                              {/* Due status badge */}
                              {task.dueLabel && (
                                <span
                                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                                    isOverdue
                                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                      : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                  }`}
                                >
                                  {task.dueLabel}
                                </span>
                              )}

                              {/* Quick Pomodoro Start Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartFocus(task);
                                }}
                                title="Iniciar Sessão Pomodoro nesta tarefa"
                                className="w-8 h-8 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-all opacity-80 group-hover:opacity-100"
                              >
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Right: Task Detail Inspector Panel (Image 1 Style) */}
      {selectedTask && (
        <TaskDetailInspector
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onUpdateTask={onUpdateTask}
          onToggleTask={onToggleTask}
          onStartFocus={onStartFocus}
          availableLists={availableLists}
        />
      )}
    </div>
  );
};
