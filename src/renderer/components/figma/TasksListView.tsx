import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, PlayIcon } from '@hugeicons/core-free-icons';
import { Tag } from 'lucide-react';
import type { DailyTask } from '@shared/types';

interface TasksListViewProps {
  tasks: DailyTask[];
  selectedTaskId?: string | null;
  onToggleTask: (taskId: string) => void;
  onStartFocus: (task: DailyTask) => void;
  onSelectTask?: (task: DailyTask) => void;
  onSelectTagFilter?: (tag: string) => void;
}

function getTagBadgeStyle(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.includes('sem tag')) {
    return 'bg-slate-200/75 dark:bg-white/10 text-slate-600 dark:text-white/70';
  }
  if (lower.includes('errands')) {
    return 'bg-[#FEB14A]/20 text-[#9A670E] dark:text-[#FCD34D]';
  }
  if (lower.includes('sidework') || lower.includes('work') || lower.includes('dev')) {
    return 'bg-[#0EA5E9]/15 text-[#0369A1] dark:text-[#38BDF8]';
  }
  if (lower.includes('routine') || lower.includes('rotina') || lower.includes('hábito')) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  }
  return 'bg-[#FB7213]/[0.14] text-[#FB7213]';
}

export const TasksListView: React.FC<TasksListViewProps> = ({
  tasks,
  selectedTaskId,
  onToggleTask,
  onStartFocus,
  onSelectTask,
  onSelectTagFilter,
}) => {
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});

  // Group Today tasks cleanly by Tag (primary tag -> fallback 'Sem tags')
  const groupedByTag = useMemo(() => {
    const groupsMap = new Map<string, DailyTask[]>();

    for (const task of tasks) {
      const primaryTag = task.tags && task.tags.length > 0 ? task.tags[0] : 'Sem tags';
      const bucket = groupsMap.get(primaryTag);
      if (bucket) bucket.push(task);
      else groupsMap.set(primaryTag, [task]);
    }

    // Keep tagged groups ordered before "Sem tags"
    return Array.from(groupsMap.entries()).sort(([a], [b]) => {
      if (a === 'Sem tags' && b !== 'Sem tags') return 1;
      if (b === 'Sem tags' && a !== 'Sem tags') return -1;
      return a.localeCompare(b);
    });
  }, [tasks]);

  const toggleGroup = (tagKey: string) => {
    setCollapsedTags((prev) => ({ ...prev, [tagKey]: !prev[tagKey] }));
  };

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto sheldon-scroll flex flex-col gap-3 pr-1 select-none">
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-[12px] text-[#6D6D6D] dark:text-white/50">
          Nenhuma tarefa encontrada na visão Hoje. Adicione uma tarefa acima ou sincronize o TickTick!
        </div>
      ) : (
        groupedByTag.map(([tagLabel, groupTasks]) => {
          const isCollapsed = Boolean(collapsedTags[tagLabel]);
          return (
            <div key={tagLabel} className="flex flex-col gap-1.5">
              {/* Tag Section Header */}
              <button
                type="button"
                onClick={() => toggleGroup(tagLabel)}
                className="flex items-center justify-between px-1 py-1 rounded-lg hover:bg-[#F5F6FA] dark:hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className={`transition-transform duration-150 text-[#6D6D6D] dark:text-white/50 ${
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={2} />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide ${getTagBadgeStyle(
                      tagLabel
                    )}`}
                  >
                    <Tag className="size-2.5 shrink-0" />
                    {tagLabel}
                  </span>
                </div>

                <span className="text-[10.5px] font-semibold text-[#6D6D6D] dark:text-white/45 tabular-nums px-1">
                  {groupTasks.length}
                </span>
              </button>

              {/* Tasks inside Tag Group */}
              {!isCollapsed && (
                <div className="flex flex-col gap-1.5 pl-1">
                  {groupTasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className={`bg-[#F5F6FA] dark:bg-[#26282E] hover:bg-[#ECEEF5]/90 dark:hover:bg-[#2D3038] rounded-[11px] px-3 py-2 flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer group border ${
                          isSelected
                            ? 'border-[#FB7213]/80 bg-[#FCE5D9]/35 dark:bg-[#FB7213]/12'
                            : 'border-transparent hover:border-[#E5E7EB] dark:hover:border-white/10'
                        } ${task.completed ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            aria-label={`Concluir ${task.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(task.id);
                            }}
                            className={`size-3.5 rounded-[4px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
                              task.completed
                                ? 'bg-[#0572AD] border-[#0572AD] text-white'
                                : 'border-[#D5D9E2] dark:border-white/25 hover:border-[#FB7213] bg-white dark:bg-transparent'
                            }`}
                          >
                            {task.completed && (
                              <span className="text-[9px] font-bold leading-none">✓</span>
                            )}
                          </button>

                          <div className="flex flex-col min-w-0">
                            <span
                              className={`text-[12px] font-medium truncate leading-snug ${
                                task.completed
                                  ? 'line-through text-[#6D6D6D]'
                                  : 'text-[#242424] dark:text-white'
                              }`}
                            >
                              {task.title}
                            </span>

                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {task.scheduledTime && (
                                <span className="text-[9.5px] font-semibold text-[#0572AD] dark:text-[#60B3E5] tabular-nums">
                                  🕒 {task.scheduledTime}
                                </span>
                              )}
                              {task.dueLabel && (
                                <span
                                  className={`text-[9.5px] font-normal ${
                                    task.dueLabel.toLowerCase().includes('atraso')
                                      ? 'text-[#E05555]'
                                      : 'text-[#6D6D6D] dark:text-white/55'
                                  }`}
                                >
                                  {task.dueLabel}
                                </span>
                              )}
                              {task.tags?.slice(1).map((extraTag) => (
                                <button
                                  key={extraTag}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectTagFilter?.(extraTag);
                                  }}
                                  className="text-[9px] font-semibold text-[#6D6D6D] dark:text-white/65 bg-white dark:bg-white/10 px-1.5 py-0.2 rounded-full hover:text-[#FB7213]"
                                >
                                  #{extraTag}
                                </button>
                              ))}
                              {task.listName && task.listName !== tagLabel && (
                                <span className="text-[9.5px] text-[#6D6D6D] dark:text-white/40 truncate">
                                  • {task.listName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {task.estimatedMinutes && (
                            <span className="text-[10px] text-[#6D6D6D] dark:text-white/50 font-medium tabular-nums">
                              {task.estimatedMinutes}m
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartFocus(task);
                            }}
                            title="Iniciar foco"
                            className="size-7 rounded-[8px] bg-[#FB7213] hover:bg-[#E06209] text-white flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95"
                          >
                            <HugeiconsIcon icon={PlayIcon} size={12} className="ml-0.5" />
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
  );
};
