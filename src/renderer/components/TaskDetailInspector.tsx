import React, { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Plus,
  Play,
  Tag,
  Trash2,
  X,
  Folder,
} from 'lucide-react';
import type { DailyTask, SubTaskItem } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TaskDetailInspectorProps {
  task: DailyTask | null;
  onClose: () => void;
  onUpdateTask: (taskId: string, patch: Partial<DailyTask>) => void;
  onToggleTask: (taskId: string) => void;
  onStartFocus: (task: DailyTask) => void;
  availableLists: string[];
}

export const TaskDetailInspector: React.FC<TaskDetailInspectorProps> = ({
  task,
  onClose,
  onUpdateTask,
  onToggleTask,
  onStartFocus,
  availableLists,
}) => {
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  if (!task) return null;

  const handleTitleChange = (val: string) => {
    onUpdateTask(task.id, { title: val });
  };

  const handleDescChange = (val: string) => {
    onUpdateTask(task.id, { description: val });
  };

  const handleListChange = (list: string) => {
    onUpdateTask(task.id, { listName: list, project: list });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if (!tag) return;
    const currentTags = task.tags || [];
    if (!currentTags.includes(tag)) {
      onUpdateTask(task.id, { tags: [...currentTags, tag] });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = task.tags || [];
    onUpdateTask(task.id, {
      tags: currentTags.filter((t) => t !== tagToRemove),
    });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    const subTitle = newSubtaskTitle.trim();
    if (!subTitle) return;
    const newSub: SubTaskItem = {
      id: `sub-${Date.now()}`,
      title: subTitle,
      completed: false,
    };
    onUpdateTask(task.id, {
      subtasks: [...(task.subtasks || []), newSub],
    });
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
  };

  const handleToggleSubtask = (subId: string) => {
    const updated = (task.subtasks || []).map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    onUpdateTask(task.id, { subtasks: updated });
  };

  const handleRemoveSubtask = (subId: string) => {
    const updated = (task.subtasks || []).map((s) => s).filter((s) => s.id !== subId);
    onUpdateTask(task.id, { subtasks: updated });
  };

  return (
    <div className="w-80 lg:w-96 bg-card border-l border-border h-full flex flex-col justify-between overflow-y-auto p-5 shrink-0 select-none animate-in slide-in-from-right-4 duration-200">
      <div className="space-y-5">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleTask(task.id)}
              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-muted-foreground/50 hover:border-primary'
              }`}
            >
              {task.completed && <Check className="w-4 h-4 stroke-[3]" />}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{task.dueLabel || 'Hoje'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Title (Editable) */}
        <div>
          <textarea
            value={task.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            rows={2}
            className="w-full bg-transparent text-lg font-bold text-foreground resize-none border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors"
            placeholder="Título da tarefa..."
          />
        </div>

        {/* List / Project Selector & Tags */}
        <div className="space-y-2.5 pt-1 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <Folder className="w-3.5 h-3.5 text-primary" />
              Lista
            </span>
            <select
              value={task.listName || task.project}
              onChange={(e) => handleListChange(e.target.value)}
              className="bg-secondary/70 border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
            >
              {availableLists.map((list) => (
                <option key={list} value={list}>
                  {list}
                </option>
              ))}
            </select>
          </div>

          {/* Tags Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Tag className="w-3.5 h-3.5 text-[#FBBF24]" />
                Tags
              </span>
              <button
                type="button"
                onClick={() => setIsAddingTag((prev) => !prev)}
                className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(task.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-semibold text-foreground"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}

              {isAddingTag && (
                <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                  <Input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Tag..."
                    className="h-6 w-24 text-[11px] px-2 py-0"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="h-6 px-2 text-[10px]">
                    OK
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Subtasks / Checklist */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Subtarefas / Checklist ({task.subtasks?.filter((s) => s.completed).length || 0}/
              {task.subtasks?.length || 0})
            </span>
            <button
              type="button"
              onClick={() => setIsAddingSubtask((prev) => !prev)}
              className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Item
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {(task.subtasks || []).map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-secondary/50 text-xs"
              >
                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={sub.completed}
                    onChange={() => handleToggleSubtask(sub.id)}
                    className="rounded border-border text-primary focus:ring-0"
                  />
                  <span
                    className={`truncate ${
                      sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {sub.title}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => handleRemoveSubtask(sub.id)}
                  className="text-muted-foreground/60 hover:text-red-400 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {isAddingSubtask && (
              <form onSubmit={handleAddSubtask} className="flex items-center gap-1 mt-1">
                <Input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Nova subtarefa..."
                  className="h-8 text-xs"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-8 px-2.5">
                  Add
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Description / Notes */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <label className="text-xs text-muted-foreground font-medium block">
            Descrição / Anotações
          </label>
          <textarea
            value={task.description || ''}
            onChange={(e) => handleDescChange(e.target.value)}
            rows={4}
            className="w-full bg-secondary/50 border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            placeholder="Adicionar notas, links ou detalhes da tarefa..."
          />
        </div>
      </div>

      {/* Bottom Start Focus Action */}
      <div className="pt-4 border-t border-border">
        <Button
          type="button"
          onClick={() => onStartFocus(task)}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary to-[#EA580C] text-primary-foreground font-bold text-xs shadow-orange-glow flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Iniciar Foco Pomodoro ({task.estimatedMinutes}m)</span>
        </Button>
      </div>
    </div>
  );
};
