import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Clock01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import type { ReminderItem } from '@shared/types';
import panelLeftSvg from '../../assets/figma/v2/panel-left.svg';

interface RemindersPanelProps {
  reminders: ReminderItem[];
  onCreateReminder: (title: string, time: string) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onToggleCollapse?: () => void;
}

export const RemindersPanel: React.FC<RemindersPanelProps> = ({
  reminders,
  onCreateReminder,
  onToggleReminder,
  onDeleteReminder,
  onToggleCollapse,
}) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');
  const [timeDraft, setTimeDraft] = useState<string>('10:00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = titleDraft.trim();
    if (!clean) return;
    onCreateReminder(clean, timeDraft || '10:00');
    setTitleDraft('');
    setIsCreating(false);
  };

  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.time.localeCompare(b.time);
  });

  return (
    <div
      className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] flex flex-col px-3 py-3 select-none flex-1 min-h-0 overflow-hidden"
      aria-label="Lembretes"
    >
      {/* Header matching Calendar style: Title on left, Criar + Collapse on right */}
      <div className="flex items-center justify-between w-full mb-2.5 shrink-0 gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[12px] font-semibold text-[#242424] dark:text-white">Lembretes</h3>
          <span className="text-[10px] text-[#6D6D6D] dark:text-[#9CA3AF]">
            {reminders.filter((r) => !r.completed).length} ativos
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCreating((prev) => !prev)}
            className="h-[28px] px-2.5 rounded-[8px] bg-[#FB7213] hover:bg-[#E06209] active:scale-95 text-white text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs"
          >
            <HugeiconsIcon icon={Add01Icon} size={12} strokeWidth={2.2} />
            <span>Criar</span>
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

      {/* Inline Reminder Creator */}
      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="mb-2.5 p-2.5 rounded-[12px] bg-[#F5F6FA] dark:bg-[#27292F] border border-[#E7E5F0] dark:border-white/10 flex flex-col gap-2 shrink-0 animate-drawer-in"
        >
          <input
            type="text"
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="Do que você quer lembrar?"
            className="bg-white dark:bg-[#1B1C20] rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-medium text-[#242424] dark:text-white placeholder:text-[#6D6D6D]/70 border border-[#E7E5F0] dark:border-white/10 outline-none focus:border-[#FB7213]"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 bg-white dark:bg-[#1B1C20] rounded-[8px] px-2 py-1 border border-[#E7E5F0] dark:border-white/10 text-[11px] text-[#242424] dark:text-white">
              <HugeiconsIcon icon={Clock01Icon} size={12} className="text-[#FB7213]" />
              <input
                type="time"
                value={timeDraft}
                onChange={(e) => setTimeDraft(e.target.value)}
                className="bg-transparent outline-none font-medium tabular-nums"
              />
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setTitleDraft('');
                }}
                className="px-2 py-1 rounded-[7px] text-[10.5px] font-medium text-[#6D6D6D] dark:text-white/60 hover:text-[#242424] dark:hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 rounded-[8px] bg-[#FB7213] hover:bg-[#E06209] text-white text-[10.5px] font-semibold"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Simple Kanban-style Reminder Blocks */}
      <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll pr-0.5">
        <div className="bg-[#F4EDE5]/65 dark:bg-[#25262B] rounded-[13px] p-2 flex flex-col gap-1.5">
          {sortedReminders.length === 0 ? (
            <div className="bg-white dark:bg-[#1B1C20] rounded-[10px] p-3 text-center text-[11px] text-[#6D6D6D] dark:text-white/55">
              Nenhum lembrete por aqui. Clique em &quot;Criar&quot; acima.
            </div>
          ) : (
            sortedReminders.map((rem) => (
              <div
                key={rem.id}
                onClick={() => onToggleReminder(rem.id)}
                className={`bg-white dark:bg-[#1B1C20] border border-transparent dark:border-white/[0.05] rounded-[10px] p-2.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all cursor-pointer flex items-start gap-2 group ${
                  rem.completed ? 'opacity-60' : ''
                }`}
              >
                <button
                  type="button"
                  aria-label={`Marcar lembrete ${rem.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleReminder(rem.id);
                  }}
                  className={`size-3.5 mt-0.5 rounded-[4px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
                    rem.completed
                      ? 'bg-[#0572AD] border-[#0572AD] text-white'
                      : 'bg-white dark:bg-transparent border-[#E7E5F0] dark:border-white/25 hover:border-[#FB7213]'
                  }`}
                >
                  {rem.completed && <span className="text-[9px] font-bold leading-none">✓</span>}
                </button>

                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <p
                    className={`text-[11.5px] font-medium leading-snug ${
                      rem.completed ? 'line-through text-[#6D6D6D]' : 'text-[#242424] dark:text-white'
                    }`}
                  >
                    {rem.title}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[#0572AD] dark:text-[#60B3E5] tabular-nums">
                    <HugeiconsIcon icon={Clock01Icon} size={11} strokeWidth={2} />
                    <span>{rem.time}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteReminder(rem.id);
                  }}
                  title="Excluir lembrete"
                  className="opacity-0 group-hover:opacity-100 size-5 rounded-md hover:bg-[#E05555]/10 text-[#6D6D6D] hover:text-[#E05555] flex items-center justify-center transition-all shrink-0"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
