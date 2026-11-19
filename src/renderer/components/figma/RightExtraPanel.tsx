import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarLeft01Icon, SidebarRight01Icon } from '@hugeicons/core-free-icons';
import type { DailyTask, ReminderItem } from '@shared/types';
import calendarSvg from '../../assets/figma/v2/calendar-03.svg';
import bellSvg from '../../assets/figma/v2/bell.svg';
import notebookPenSvg from '../../assets/figma/v2/notebook-pen.svg';
import { AgendaTimeline, type AgendaEvent } from './AgendaTimeline';
import { RemindersPanel } from './RemindersPanel';
import { NotesPanel } from './NotesPanel';

export type RightDrawerTab = 'calendar' | 'reminders' | 'notes';

interface RightExtraPanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenTab?: (tab: RightDrawerTab) => void;
  tasks?: DailyTask[];
  onUpdateTaskSchedule?: (
    taskId: string,
    startTime: string,
    durationMinutes: number
  ) => void;
  reminders: ReminderItem[];
  onCreateReminder: (title: string, time: string) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onStartEventFocus: (event: AgendaEvent) => void;
}

const DRAWER_TABS: { id: RightDrawerTab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Calendário', icon: calendarSvg },
  { id: 'reminders', label: 'Lembretes', icon: bellSvg },
  { id: 'notes', label: 'Notas', icon: notebookPenSvg },
];

export const RightExtraPanel: React.FC<RightExtraPanelProps> = ({
  isOpen,
  onToggleOpen,
  tasks = [],
  onUpdateTaskSchedule,
  reminders,
  onCreateReminder,
  onToggleReminder,
  onDeleteReminder,
  onStartEventFocus,
}) => {
  const [activeTab, setActiveTab] = useState<RightDrawerTab>('calendar');

  const handleOpenWithTab = (tab: RightDrawerTab) => {
    setActiveTab(tab);
    if (!isOpen) onToggleOpen();
  };

  // Collapsed State: sleek outer button dock so the user can reopen anytime from the outside
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0 select-none pt-0.5">
        <button
          type="button"
          onClick={onToggleOpen}
          title="Expandir painel lateral (Calendário, Lembretes e Notas)"
          className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] hover:bg-[#FECCAA]/45 dark:hover:bg-[#2A2C32] size-[42px] rounded-[12px] shadow-[0_2px_12px_rgba(16,24,40,0.04)] flex items-center justify-center text-[#242424] dark:text-white/80 hover:text-[#FB7213] transition-all active:scale-95"
        >
          <HugeiconsIcon icon={SidebarLeft01Icon} size={18} strokeWidth={1.9} />
        </button>

        <div className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[14px] p-1 shadow-[0_2px_12px_rgba(16,24,40,0.04)] flex flex-col gap-1">
          {DRAWER_TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleOpenWithTab(tab.id)}
                title={`Abrir ${tab.label}`}
                className={`size-[36px] rounded-[10px] flex items-center justify-center transition-all hover:bg-[#F5F6FA] dark:hover:bg-[#2A2C32] active:scale-95 ${
                  isSelected ? 'bg-[#FCE5D9]/65 dark:bg-[#FB7213]/20 ring-1 ring-[#FB7213]/30' : ''
                }`}
              >
                <img src={tab.icon} width={18} height={18} alt={tab.label} className="block dark:invert" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside
      aria-label="Painel extra lateral"
      className="w-[280px] xl:w-[318px] h-full shrink-0 flex flex-col gap-2.5 min-h-0 select-none animate-drawer-in"
    >
      {/* Top Switcher Pills Row + Outer Collapse Toggle Button */}
      <div className="flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {DRAWER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`h-[42px] xl:h-[44px] rounded-[12px] bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] shadow-[0_2px_10px_rgba(16,24,40,0.03)] flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 ${
                  isActive
                    ? 'px-3 gap-1.5 ring-1 ring-[#FB7213]/40 text-[#242424] dark:text-white'
                    : 'w-[42px] xl:w-[44px] px-0 hover:bg-white/90 dark:hover:bg-[#2A2C32] hover:-translate-y-0.5 text-[#6D6D6D] dark:text-white/60'
                }`}
              >
                <img
                  src={tab.icon}
                  width={19}
                  height={19}
                  alt={tab.label}
                  className={`block shrink-0 transition-transform duration-200 dark:invert ${
                    isActive ? 'scale-105' : 'opacity-80'
                  }`}
                />
                {isActive && (
                  <span className="text-[12.5px] font-medium text-[#242424] dark:text-white whitespace-nowrap animate-drawer-in">
                    {tab.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Outer Collapse Button */}
        <button
          type="button"
          onClick={onToggleOpen}
          title="Ocultar painel direito"
          className="h-[42px] xl:h-[44px] w-[38px] rounded-[12px] bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] hover:bg-[#FECCAA]/45 dark:hover:bg-[#2A2C32] shadow-[0_2px_10px_rgba(16,24,40,0.03)] flex items-center justify-center text-[#6D6D6D] dark:text-white/70 hover:text-[#FB7213] transition-all active:scale-95 shrink-0"
        >
          <HugeiconsIcon icon={SidebarRight01Icon} size={18} strokeWidth={1.9} />
        </button>
      </div>

      {/* Animated Content Card Below */}
      <div key={activeTab} className="flex-1 min-h-0 flex flex-col animate-drawer-in">
        {activeTab === 'calendar' && (
          <AgendaTimeline
            tasks={tasks}
            onUpdateTaskSchedule={onUpdateTaskSchedule}
            onStartEventFocus={onStartEventFocus}
            onToggleCollapse={onToggleOpen}
          />
        )}

        {activeTab === 'reminders' && (
          <RemindersPanel
            reminders={reminders}
            onCreateReminder={onCreateReminder}
            onToggleReminder={onToggleReminder}
            onDeleteReminder={onDeleteReminder}
            onToggleCollapse={onToggleOpen}
          />
        )}

        {activeTab === 'notes' && <NotesPanel onToggleCollapse={onToggleOpen} />}
      </div>
    </aside>
  );
};
