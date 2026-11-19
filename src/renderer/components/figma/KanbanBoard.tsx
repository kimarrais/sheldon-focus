import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, PlayIcon } from '@hugeicons/core-free-icons';
import type { DailyTask } from '@shared/types';

interface KanbanBoardProps {
  tasks: DailyTask[];
  selectedTaskId?: string | null;
  onToggleTask: (taskId: string) => void;
  onStartFocus: (task: DailyTask) => void;
  onSelectTask?: (task: DailyTask) => void;
  onAddTaskToColumn?: (columnName: string, title: string) => void;
}

interface ColumnDef {
  id: string;
  title: string;
  bgColor: string;
  badgeBg: string;
  projectValue: string;
  filter: (task: DailyTask) => boolean;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'errands',
    title: 'Errands',
    bgColor: 'bg-[#E4F2FC] dark:bg-[#1A2632]',
    badgeBg: 'bg-white dark:bg-black/35',
    projectValue: 'Errands 🔥',
    filter: (t) =>
      (t.project === 'Errands' ||
        t.project === 'Errands 🔥' ||
        (t.tags?.some((tag) => tag.includes('Errands')) ?? false)) &&
      t.project !== 'Routine',
  },
  {
    id: 'habito',
    title: 'Hábitos de hoje',
    bgColor: 'bg-[#F4EDE5] dark:bg-[#26221E]',
    badgeBg: 'bg-white dark:bg-black/35',
    projectValue: 'Hábito de hoje',
    filter: (t) => t.project === 'Hábito de hoje' || (t.tags?.includes('Hábito') ?? false),
  },
  {
    id: 'sidework',
    title: 'SideWork',
    bgColor: 'bg-[#FDEBCC] dark:bg-[#292319]',
    badgeBg: 'bg-white/60 dark:bg-black/35',
    projectValue: 'SideWork 💻',
    filter: (t) =>
      t.project === 'SideWork' ||
      t.project === 'SideWork 💻' ||
      t.project === 'Design App' ||
      (t.tags?.some((tag) => tag.includes('SideWork') || tag.includes('Design App')) ?? false),
  },
  {
    id: 'routine-inbox',
    title: 'Rotina & Caixa',
    bgColor: 'bg-[#FCE5D9] dark:bg-[#291E1C]',
    badgeBg: 'bg-white dark:bg-black/35',
    projectValue: 'Routine',
    filter: (t) =>
      t.project === 'Routine' ||
      t.project === 'Sem tags' ||
      t.project === 'Caixa de Entrada' ||
      (t.tags?.length === 0 && t.project !== 'Hábito de hoje'),
  },
];

function getTagPillClass(tag: string, idx: number): string {
  const lower = tag.toLowerCase();
  if (lower.includes('errands')) return 'bg-[#FEB14A]/20 text-[#B07A1A]';
  if (lower.includes('sidework') || lower.includes('design') || lower.includes('hábito'))
    return 'bg-[#FB7213]/[0.13] text-[#FB7213]';
  if (lower.includes('home') || lower.includes('casa') || lower.includes('ux') || lower.includes('research') || lower.includes('idiomas'))
    return 'bg-[#0572AD]/[0.13] text-[#0572AD]';
  if (lower.includes('routine') || lower.includes('health') || lower.includes('saúde') || lower.includes('learning') || lower.includes('personal') || lower.includes('pessoal'))
    return 'bg-[#55321E]/[0.13] text-[#55321E]';

  const palette = [
    'bg-[#FB7213]/[0.13] text-[#FB7213]',
    'bg-[#0572AD]/[0.13] text-[#0572AD]',
    'bg-[#55321E]/[0.13] text-[#55321E]',
    'bg-[#FEB14A]/20 text-[#B07A1A]',
  ];
  return palette[idx % palette.length];
}

function getDueColorClass(dueLabel?: string, completed?: boolean): string {
  if (completed) return 'text-[#0572AD]';
  if (!dueLabel) return 'text-[#6D6D6D]';
  const lower = dueLabel.toLowerCase();
  if (lower.includes('atraso') || lower.includes('overdue')) return 'text-[#E05555]';
  if (lower.includes('hoje') || lower.includes('today')) return 'text-[#0572AD]';
  return 'text-[#6D6D6D]';
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  selectedTaskId,
  onToggleTask,
  onStartFocus,
  onSelectTask,
  onAddTaskToColumn,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<string>('');

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleConfirmInlineAdd = (col: ColumnDef) => {
    const trimmed = inlineDraft.trim();
    if (trimmed) {
      onAddTaskToColumn?.(col.projectValue, trimmed);
    }
    setInlineDraft('');
    setAddingColumnId(null);
  };

  // Catch any uncategorized tasks so nothing ever gets hidden
  const matchedIds = new Set<string>();
  const colTasksMap = COLUMNS.map((col) => {
    const list = tasks.filter((t) => {
      if (matchedIds.has(t.id)) return false;
      if (col.filter(t)) {
        matchedIds.add(t.id);
        return true;
      }
      return false;
    });
    return { col, list };
  });

  const leftover = tasks.filter((t) => !matchedIds.has(t.id));
  if (leftover.length > 0) {
    colTasksMap[colTasksMap.length - 1].list.push(...leftover);
  }

  return (
    <div className="w-full flex-1 min-h-0 overflow-x-auto overflow-y-hidden sheldon-scroll pb-1 select-none">
      <div className="flex items-stretch gap-2.5 h-full min-w-[590px] w-full">
        {colTasksMap.map(({ col, list: colTasks }) => {
          const highTasks = colTasks.filter((t) => t.priority === 'high');
          const medTasks = colTasks.filter((t) => t.priority === 'medium');
          const lowTasks = colTasks.filter((t) => t.priority === 'low' || !t.priority);

          const groups = [
            { key: `${col.id}-high`, label: 'Alta', list: highTasks },
            { key: `${col.id}-med`, label: 'Média', list: medTasks },
            { key: `${col.id}-low`, label: col.id === 'routine-inbox' ? 'Sem tag / Baixa' : 'Baixa', list: lowTasks },
          ].filter((g) => g.list.length > 0);

          const isAddingHere = addingColumnId === col.id;

          return (
            <div
              key={col.id}
              className={`${col.bgColor} rounded-[16px] px-2.5 py-3 flex-1 min-w-[140px] flex flex-col gap-2.5 h-full min-h-0 overflow-hidden transition-colors`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11.5px] font-bold text-[#242424] dark:text-white truncate">
                    {col.title}
                  </span>
                  <span
                    className={`${col.badgeBg} text-[#6D6D6D] dark:text-white/75 text-[10px] font-semibold px-[6px] py-[2px] rounded-full leading-none shrink-0`}
                  >
                    {colTasks.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAddingColumnId(isAddingHere ? null : col.id);
                    setInlineDraft('');
                  }}
                  title={`Adicionar tarefa em ${col.title}`}
                  className="size-5 rounded-md bg-white/55 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50 text-[#6D6D6D] dark:text-white/75 hover:text-[#FB7213] flex items-center justify-center transition-all active:scale-95 shrink-0"
                >
                  <HugeiconsIcon icon={Add01Icon} size={12} strokeWidth={2.2} />
                </button>
              </div>

              {/* Inline Add Task Form (replaces unsupported Electron prompt) */}
              {isAddingHere && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleConfirmInlineAdd(col);
                  }}
                  className="bg-white rounded-[12px] p-2 shadow-sm border border-[#FB7213]/40 flex flex-col gap-1.5 shrink-0"
                >
                  <input
                    type="text"
                    autoFocus
                    value={inlineDraft}
                    onChange={(e) => setInlineDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setAddingColumnId(null);
                        setInlineDraft('');
                      }
                    }}
                    placeholder="Nome da tarefa..."
                    className="w-full text-[12px] font-medium text-[#242424] placeholder:text-[#6D6D6D]/70 bg-transparent outline-none px-1"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingColumnId(null);
                        setInlineDraft('');
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium text-[#6D6D6D] hover:text-[#242424]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-0.5 rounded-md bg-[#FB7213] hover:bg-[#E06209] text-white text-[10px] font-semibold"
                    >
                      Adicionar
                    </button>
                  </div>
                </form>
              )}

              {/* Scrollable Cards Area */}
              <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll pr-0.5 flex flex-col gap-3">
                {colTasks.length === 0 ? (
                  <div className="bg-white/60 rounded-[12px] p-4 text-center text-[11px] text-[#6D6D6D]">
                    Nenhuma tarefa nesta coluna.
                  </div>
                ) : col.id === 'habito' ? (
                  <div className="flex flex-col gap-2">
                    {colTasks.map((task) => {
                      const isSelected = selectedTaskId === task.id;
                      return (
                        <div
                          key={task.id}
                          onClick={() => onSelectTask?.(task)}
                          className={`bg-white rounded-[12px] p-2.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col gap-2 group relative ${
                            isSelected ? 'ring-2 ring-[#FB7213]' : ''
                          } ${task.completed ? 'opacity-75' : ''}`}
                        >
                          <div className="flex items-start gap-2 relative">
                            <button
                              type="button"
                              aria-label={`Concluir ${task.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTask(task.id);
                              }}
                              className={`size-4 mt-0.5 rounded-[4px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
                                task.completed
                                  ? 'bg-[#0572AD] border-[#0572AD] text-white'
                                  : 'bg-white border-[#E7E5F0] hover:border-[#FB7213]'
                              }`}
                            >
                              {task.completed && (
                                <span className="text-[10px] font-bold leading-none">✓</span>
                              )}
                            </button>

                            <p
                              className={`flex-1 text-[12.5px] font-medium leading-snug ${
                                task.completed ? 'text-[#6D6D6D] line-through' : 'text-[#242424]'
                              }`}
                            >
                              {task.title}
                            </p>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartFocus(task);
                              }}
                              title="Iniciar foco nesta tarefa"
                              className="opacity-0 group-hover:opacity-100 absolute right-0 top-0 size-6 rounded-full bg-[#FB7213] hover:bg-[#E06209] text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                            >
                              <HugeiconsIcon icon={PlayIcon} size={11} className="ml-0.5" />
                            </button>
                          </div>

                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((tag, idx) => (
                                <span
                                  key={tag}
                                  className={`px-[7px] py-[2px] rounded-full text-[10px] font-semibold leading-tight ${getTagPillClass(
                                    tag,
                                    idx
                                  )}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <p
                            className={`text-[11px] font-normal ${getDueColorClass(
                              task.dueLabel,
                              task.completed
                            )}`}
                          >
                            {task.completed ? 'Concluído hoje' : task.dueLabel || 'Hoje'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  groups.map((group) => {
                    const isGroupCollapsed = collapsedGroups[group.key];
                    return (
                      <div key={group.key} className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="flex items-center gap-1 text-[11px] text-[#6D6D6D] hover:text-[#242424] transition-colors text-left pb-0.5"
                        >
                          <span className="font-semibold">{group.label}</span>
                          <span className="font-medium opacity-80">{group.list.length}</span>
                        </button>

                        {!isGroupCollapsed && (
                          <div className="flex flex-col gap-2">
                            {group.list.map((task) => {
                              const isSelected = selectedTaskId === task.id;
                              return (
                                <div
                                  key={task.id}
                                  onClick={() => onSelectTask?.(task)}
                                  className={`bg-white dark:bg-[#17181C] dark:border dark:border-white/[0.06] rounded-[10px] p-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col gap-1.5 group relative ${
                                    isSelected ? 'ring-2 ring-[#FB7213]' : ''
                                  } ${task.completed ? 'opacity-65' : ''}`}
                                >
                                  <div className="flex items-start gap-1.5 relative">
                                    <button
                                      type="button"
                                      aria-label={`Concluir ${task.title}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleTask(task.id);
                                      }}
                                      className={`size-3.5 mt-0.5 rounded-[4px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
                                        task.completed
                                          ? 'bg-[#0572AD] border-[#0572AD] text-white'
                                          : 'bg-white dark:bg-transparent border-[#E7E5F0] dark:border-white/25 hover:border-[#FB7213]'
                                      }`}
                                    >
                                      {task.completed && (
                                        <span className="text-[9px] font-bold leading-none">✓</span>
                                      )}
                                    </button>

                                    <p
                                      className={`flex-1 text-[11px] font-medium leading-snug line-clamp-2 ${
                                        task.completed
                                          ? 'text-[#6D6D6D] line-through'
                                          : 'text-[#242424] dark:text-white'
                                      }`}
                                    >
                                      {task.title}
                                    </p>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onStartFocus(task);
                                      }}
                                      title="Iniciar foco nesta tarefa"
                                      className="opacity-0 group-hover:opacity-100 absolute right-0 top-0 size-5 rounded-full bg-[#FB7213] hover:bg-[#E06209] text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                                    >
                                      <HugeiconsIcon icon={PlayIcon} size={10} className="ml-0.5" />
                                    </button>
                                  </div>

                                  {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.map((tag, idx) => (
                                        <span
                                          key={tag}
                                          className={`px-[7px] py-[2px] rounded-full text-[10px] font-semibold leading-tight ${getTagPillClass(
                                            tag,
                                            idx
                                          )}`}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <p
                                    className={`text-[11px] font-normal ${getDueColorClass(
                                      task.dueLabel || task.listName,
                                      task.completed
                                    )}`}
                                  >
                                    {task.completed
                                      ? 'Concluído hoje'
                                      : task.dueLabel || task.listName || 'Sem prazo'}
                                  </p>
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
          );
        })}
      </div>
    </div>
  );
};
