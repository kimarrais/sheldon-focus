import React, { useState } from 'react';
import type { DailyTask, TaskPriority } from '@shared/types';
import plusSvg from '../../assets/figma/v2/plus.svg';
import listSvg from '../../assets/figma/v2/list.svg';
import kanbanSvg from '../../assets/figma/v2/kanban.svg';
import refreshSvg from '../../assets/figma/v2/refresh-04.svg';
import sortingSvg from '../../assets/figma/v2/sorting-02.svg';
import slidersSvg from '../../assets/figma/v2/sliders-vertical.svg';
import { KanbanBoard } from './KanbanBoard';
import { TasksListView } from './TasksListView';

interface TarefasCardProps {
  tasks: DailyTask[];
  selectedTaskId?: string | null;
  onToggleTask: (taskId: string) => void;
  onAddTask: (
    title: string,
    project: string,
    estimatedMinutes: number,
    priority: TaskPriority,
    tags?: string[],
    description?: string
  ) => void;
  onStartFocus: (task: DailyTask) => void;
  onSelectTask?: (task: DailyTask) => void;
  onSyncTickTick: () => void;
  isSyncing: boolean;
}

export const TarefasCard: React.FC<TarefasCardProps> = ({
  tasks,
  selectedTaskId,
  onToggleTask,
  onAddTask,
  onStartFocus,
  onSelectTask,
  onSyncTickTick,
  isSyncing,
}) => {
  // Default view is ALWAYS 'list' as requested (Hoje view grouped by Tags)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [quickInput, setQuickInput] = useState<string>('');
  const [quickTag, setQuickTag] = useState<string>('Foco');
  const [sortBy, setSortBy] = useState<'default' | 'priority' | 'time'>('default');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [showSortMenu, setShowSortMenu] = useState<boolean>(false);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const cleanTag = quickTag.trim();
    onAddTask(
      quickInput.trim(),
      cleanTag || 'Hoje',
      25,
      'medium',
      cleanTag ? [cleanTag] : [],
      'Criada rapidamente pela barra Hoje'
    );
    setQuickInput('');
  };

  const handleAddColumnTask = (projectName: string, title: string) => {
    const priority: TaskPriority = projectName.includes('Routine') ? 'high' : 'medium';
    const tag = projectName.replace(/[^\w\sÀ-ÿ]/g, '').trim() || 'Errands';
    onAddTask(title, projectName, 25, priority, [tag]);
  };

  const filteredTasks = tasks
    .filter((t) => {
      if (!filterTag) return true;
      return t.tags?.includes(filterTag) || t.project === filterTag;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const pWeight: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
        return (pWeight[b.priority] || 1) - (pWeight[a.priority] || 1);
      }
      if (sortBy === 'time') {
        return (b.estimatedMinutes || 0) - (a.estimatedMinutes || 0);
      }
      return 0;
    });

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags || []).filter(Boolean)));

  return (
    <section
      className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] flex flex-col p-3.5 xl:p-4 flex-1 min-h-0 select-none overflow-hidden relative"
      aria-label="Tarefas de hoje"
    >
      {/* Top Header & Action Bar */}
      <div className="flex flex-col gap-2.5 w-full mb-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[13.5px] font-semibold text-[#242424] dark:text-white">
              Tarefas de hoje
            </h2>
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F6FA] dark:bg-[#2A2C32] text-[#6D6D6D] dark:text-white/65 tabular-nums">
              {tasks.filter((t) => !t.completed).length} abertas
            </span>
          </div>
          {filterTag && (
            <button
              type="button"
              onClick={() => setFilterTag(null)}
              className="text-[10px] font-semibold text-[#FB7213] bg-[#FB7213]/10 px-2 py-0.5 rounded-full hover:bg-[#FB7213]/20 transition-colors"
            >
              Filtro: #{filterTag} ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full">
          {/* Quick Add Input Pill */}
          <form
            onSubmit={handleQuickAdd}
            className="bg-[#F5F6FA] dark:bg-[#26282E] focus-within:ring-2 focus-within:ring-[#FB7213]/35 rounded-[12px] px-3 py-2 flex items-center gap-2 flex-1 min-w-[140px] transition-all"
          >
            <button
              type="submit"
              className="shrink-0 flex items-center justify-center opacity-75 hover:opacity-100 hover:scale-110 active:scale-95 transition-all"
              title="Adicionar tarefa"
            >
              <img src={plusSvg} width={19} height={19} alt="Adicionar" className="block shrink-0 dark:invert" />
            </button>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Adicionar uma tarefa para hoje..."
              className="bg-transparent border-none outline-none text-[12px] xl:text-[13px] font-medium text-[#242424] dark:text-white placeholder:text-[#6D6D6D] dark:placeholder:text-white/45 w-full min-w-0"
            />
            {quickInput.trim().length > 0 && (
              <input
                type="text"
                value={quickTag}
                onChange={(e) => setQuickTag(e.target.value)}
                aria-label="Tag da tarefa"
                placeholder="#tag"
                className="w-[82px] bg-white dark:bg-[#191A1E] border border-[#E7E5F0] dark:border-white/10 rounded-[7px] px-2 py-0.5 text-[10.5px] font-semibold text-[#242424] dark:text-white outline-none shrink-0"
              />
            )}
          </form>

          {/* View Mode Toggle (List default vs Kanban) */}
          <div className="bg-[#F5F6FA] dark:bg-[#26282E] p-1 rounded-[11px] flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Visualização em Lista (Agrupada por Tags)"
              className={`p-1.5 rounded-[7px] transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#191A1E] shadow-xs text-[#242424] dark:text-white'
                  : 'text-[#6D6D6D] hover:text-[#242424] dark:hover:text-white'
              }`}
            >
              <img src={listSvg} width={18} height={18} alt="Lista" className="block shrink-0 dark:invert" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              title="Visualização em Kanban"
              className={`p-1.5 rounded-[7px] transition-all duration-200 ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#191A1E] shadow-xs text-[#242424] dark:text-white'
                  : 'text-[#6D6D6D] hover:text-[#242424] dark:hover:text-white'
              }`}
            >
              <img src={kanbanSvg} width={18} height={18} alt="Kanban" className="block shrink-0 dark:invert" />
            </button>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={onSyncTickTick}
            disabled={isSyncing}
            className="bg-[#F5F6FA] dark:bg-[#26282E] hover:bg-[#ECEEF5] dark:hover:bg-[#2F323A] active:scale-95 rounded-[11px] px-2.5 py-2 flex items-center gap-1.5 shrink-0 transition-all font-medium text-[12px] text-[#242424] dark:text-white"
            title="Sincronizar tarefas de Hoje com TickTick"
          >
            <img
              src={refreshSvg}
              width={18}
              height={18}
              alt="Sync"
              className={`block shrink-0 dark:invert ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sync'}</span>
          </button>

          {/* Sorting Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSortMenu((prev) => !prev);
                setShowFilterMenu(false);
              }}
              title="Ordenar tarefas"
              className={`bg-[#F5F6FA] dark:bg-[#26282E] hover:bg-[#ECEEF5] dark:hover:bg-[#2F323A] active:scale-95 rounded-[11px] p-2 flex items-center justify-center shrink-0 transition-all ${
                sortBy !== 'default' ? 'ring-2 ring-[#FB7213]' : ''
              }`}
            >
              <img src={sortingSvg} width={18} height={18} alt="Ordenar" className="block shrink-0 dark:invert" />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-10 bg-white dark:bg-[#191A1E] rounded-[12px] shadow-lg border border-[#E7E5F0] dark:border-white/10 py-1 w-40 z-30 flex flex-col text-[11.5px]">
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('default');
                    setShowSortMenu(false);
                  }}
                  className={`px-3 py-1.5 text-left hover:bg-[#F5F6FA] dark:hover:bg-white/10 ${
                    sortBy === 'default' ? 'font-bold text-[#FB7213]' : 'text-[#242424] dark:text-white'
                  }`}
                >
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('priority');
                    setShowSortMenu(false);
                  }}
                  className={`px-3 py-1.5 text-left hover:bg-[#F5F6FA] dark:hover:bg-white/10 ${
                    sortBy === 'priority' ? 'font-bold text-[#FB7213]' : 'text-[#242424] dark:text-white'
                  }`}
                >
                  Maior Prioridade
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('time');
                    setShowSortMenu(false);
                  }}
                  className={`px-3 py-1.5 text-left hover:bg-[#F5F6FA] dark:hover:bg-white/10 ${
                    sortBy === 'time' ? 'font-bold text-[#FB7213]' : 'text-[#242424] dark:text-white'
                  }`}
                >
                  Tempo Estimado
                </button>
              </div>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowFilterMenu((prev) => !prev);
                setShowSortMenu(false);
              }}
              title="Filtrar por Tags"
              className={`bg-[#F5F6FA] dark:bg-[#26282E] hover:bg-[#ECEEF5] dark:hover:bg-[#2F323A] active:scale-95 rounded-[11px] p-2 flex items-center justify-center shrink-0 transition-all ${
                filterTag ? 'ring-2 ring-[#FB7213]' : ''
              }`}
            >
              <img src={slidersSvg} width={18} height={18} alt="Filtros" className="block shrink-0 dark:invert" />
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 top-10 bg-white dark:bg-[#191A1E] rounded-[12px] shadow-lg border border-[#E7E5F0] dark:border-white/10 py-1 w-44 z-30 flex flex-col text-[11.5px] max-h-56 overflow-y-auto sheldon-scroll">
                <button
                  type="button"
                  onClick={() => {
                    setFilterTag(null);
                    setShowFilterMenu(false);
                  }}
                  className={`px-3 py-1.5 text-left hover:bg-[#F5F6FA] dark:hover:bg-white/10 ${
                    filterTag === null ? 'font-bold text-[#FB7213]' : 'text-[#242424] dark:text-white'
                  }`}
                >
                  Todas as tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setFilterTag(tag);
                      setShowFilterMenu(false);
                    }}
                    className={`px-3 py-1.5 text-left hover:bg-[#F5F6FA] dark:hover:bg-white/10 truncate ${
                      filterTag === tag ? 'font-bold text-[#FB7213]' : 'text-[#242424] dark:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main List (Default) or Kanban Content */}
      <div className="flex-1 flex flex-col w-full min-h-0">
        {viewMode === 'list' ? (
          <TasksListView
            tasks={filteredTasks}
            selectedTaskId={selectedTaskId}
            onToggleTask={onToggleTask}
            onStartFocus={onStartFocus}
            onSelectTask={onSelectTask}
            onSelectTagFilter={(tag) => setFilterTag((prev) => (prev === tag ? null : tag))}
          />
        ) : (
          <KanbanBoard
            tasks={filteredTasks}
            selectedTaskId={selectedTaskId}
            onToggleTask={onToggleTask}
            onStartFocus={onStartFocus}
            onSelectTask={onSelectTask}
            onAddTaskToColumn={handleAddColumnTask}
          />
        )}
      </div>
    </section>
  );
};
