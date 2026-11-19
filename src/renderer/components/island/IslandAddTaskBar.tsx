import React, { useEffect, useRef, useState } from 'react';
import type { TaskPriority } from '@shared/types';
import plusSvg from '../../assets/figma/island/plus.svg';
import calendarSvg from '../../assets/figma/island/calendar-03.svg';
import tagSvg from '../../assets/figma/island/tag-01.svg';
import flagSvg from '../../assets/figma/island/flag-03.svg';
import folderSvg from '../../assets/figma/island/folder-closed.svg';
import ellipsisSvg from '../../assets/figma/island/ellipsis.svg';
import { IslandNotchFrame } from './IslandNotchFrame';

interface IslandAddTaskBarProps {
  onSubmitTask: (payload: {
    title: string;
    project: string;
    estimatedMinutes: number;
    priority: TaskPriority;
    tags: string[];
    scheduledTime?: string;
  }) => void;
  onClose: () => void;
}

type ActivePopover = 'calendar' | 'tag' | 'flag' | 'folder' | 'more' | null;

const PROJECT_OPTIONS = ['Routine', 'Errands 🔥', 'SideWork 💻', 'Sem tags', 'Hábito de hoje'];
const TAG_OPTIONS = ['Foco', 'UX', 'Errands 🍕', 'SideWork 💻', 'Routine', 'Saúde'];
const DURATION_OPTIONS = [15, 25, 45, 60];

export const IslandAddTaskBar: React.FC<IslandAddTaskBarProps> = ({ onSubmitTask, onClose }) => {
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('Errands 🔥');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [tags, setTags] = useState<string[]>(['Foco']);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(25);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void window.sheldonAPI?.focusDynamicIsland();
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    onSubmitTask({
      title: trimmed,
      project,
      estimatedMinutes,
      priority,
      tags,
      scheduledTime: scheduledTime || undefined,
    });
    setTitle('');
    onClose();
  };

  const toggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]));
  };

  const setQuickTimeInMinutes = (offsetMin: number) => {
    const d = new Date(Date.now() + offsetMin * 60_000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    setScheduledTime(`${hh}:${mm}`);
  };

  const priorityLabel = priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa';

  return (
    <div className="flex flex-col items-center">
      <IslandNotchFrame
        ariaLabel="Adicionar tarefa na Dynamic Island"
        className="w-[564px] max-w-[calc(100vw-80px)] h-[42px] px-[12px] py-[6px] flex items-center justify-between gap-2.5"
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-[12px] flex-1 min-w-0">
          <button
            type="submit"
            title="Salvar tarefa (Enter)"
            className="shrink-0 size-[20px] flex items-center justify-center rounded-md hover:bg-white/10 active:scale-90 transition-all"
          >
            <img src={plusSvg} alt="Adicionar" width={19} height={19} className="size-[19px]" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="Adicionar uma tarefa..."
            className="w-full bg-transparent border-none outline-none font-['Plus_Jakarta_Sans'] font-medium text-[13px] text-[#F8F9FB] placeholder:text-[#F8F9FB]/60 leading-normal"
          />
        </form>

        <div className="flex items-center gap-[9px] shrink-0">
          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'calendar' ? null : 'calendar'))}
            title={scheduledTime ? `Agendada para ${scheduledTime}` : 'Agendar horário'}
            className={`relative size-[20px] rounded-md flex items-center justify-center transition-all hover:scale-110 ${
              scheduledTime || activePopover === 'calendar' ? 'ring-1 ring-[#FB7213] bg-[#FB7213]/20' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <img src={calendarSvg} alt="Agenda" width={18} height={18} className="size-[18px]" />
            {scheduledTime && (
              <span className="absolute -top-1 -right-1 size-1.5 rounded-full bg-[#FB7213]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'tag' ? null : 'tag'))}
            title={`Tags: ${tags.join(', ') || 'Nenhuma'}`}
            className={`size-[20px] rounded-md flex items-center justify-center transition-all hover:scale-110 ${
              activePopover === 'tag' ? 'ring-1 ring-[#FB7213] bg-[#FB7213]/20' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <img src={tagSvg} alt="Tags" width={18} height={18} className="size-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'flag' ? null : 'flag'))}
            title={`Prioridade: ${priorityLabel}`}
            className={`relative size-[20px] rounded-md flex items-center justify-center transition-all hover:scale-110 ${
              priority === 'high' || activePopover === 'flag' ? 'ring-1 ring-[#FB7213] bg-[#FB7213]/20' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <img src={flagSvg} alt="Prioridade" width={18} height={18} className="size-[18px]" />
            {priority === 'high' && (
              <span className="absolute -top-1 -right-1 size-1.5 rounded-full bg-rose-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'folder' ? null : 'folder'))}
            title={`Projeto: ${project}`}
            className={`size-[20px] rounded-md flex items-center justify-center transition-all hover:scale-110 ${
              activePopover === 'folder' ? 'ring-1 ring-[#FB7213] bg-[#FB7213]/20' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <img src={folderSvg} alt="Pasta" width={18} height={18} className="size-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => setActivePopover((p) => (p === 'more' ? null : 'more'))}
            title={`Duração: ${estimatedMinutes} min • Mais opções`}
            className={`size-[20px] rounded-md flex items-center justify-center transition-all hover:scale-110 ${
              activePopover === 'more' ? 'ring-1 ring-[#FB7213] bg-[#FB7213]/20' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <img src={ellipsisSvg} alt="Mais opções" width={18} height={18} className="size-[18px]" />
          </button>
        </div>
      </IslandNotchFrame>

      {/* Secondary interactive metadata popovers */}
      {activePopover && (
        <div
          data-island-interactive="true"
          className="-mt-3 bg-[#000000] border border-white/10 rounded-[13px] px-3 py-2.5 shadow-2xl text-white flex items-center gap-2.5 flex-wrap max-w-[540px]"
        >
          {activePopover === 'calendar' && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white/70 font-medium">Lembrar às:</span>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-[#1D1E22] text-white rounded-md px-2 py-0.5 text-[11px] outline-none border border-white/10"
              />
              <button
                type="button"
                onClick={() => setQuickTimeInMinutes(1)}
                className="px-2 py-0.5 rounded-md bg-[#FB7213]/20 text-[#FB7213] hover:bg-[#FB7213]/30 font-semibold transition-colors"
              >
                Daqui 1 min
              </button>
              {scheduledTime && (
                <button
                  type="button"
                  onClick={() => setScheduledTime('')}
                  className="px-2 py-0.5 rounded-md bg-[#1D1E22] text-white/70 hover:text-white"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          {activePopover === 'tag' && (
            <div className="flex items-center gap-1 flex-wrap text-[11px]">
              <span className="text-white/70 font-medium mr-1">Tags:</span>
              {TAG_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                    tags.includes(t)
                      ? 'bg-[#FB7213] text-white'
                      : 'bg-[#1D1E22] text-white/80 hover:bg-[#2A2B30]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {activePopover === 'flag' && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-white/70 font-medium">Prioridade:</span>
              {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
                    priority === p
                      ? 'bg-[#FB7213] text-white'
                      : 'bg-[#1D1E22] text-white/80 hover:bg-[#2A2B30]'
                  }`}
                >
                  {p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'}
                </button>
              ))}
            </div>
          )}

          {activePopover === 'folder' && (
            <div className="flex items-center gap-1 flex-wrap text-[11px]">
              <span className="text-white/70 font-medium mr-1">Projeto:</span>
              {PROJECT_OPTIONS.map((proj) => (
                <button
                  key={proj}
                  type="button"
                  onClick={() => setProject(proj)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    project === proj
                      ? 'bg-[#FB7213] text-white'
                      : 'bg-[#1D1E22] text-white/80 hover:bg-[#2A2B30]'
                  }`}
                >
                  {proj}
                </button>
              ))}
            </div>
          )}

          {activePopover === 'more' && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-white/70 font-medium">Duração:</span>
              {DURATION_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setEstimatedMinutes(mins)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    estimatedMinutes === mins
                      ? 'bg-[#FB7213] text-white'
                      : 'bg-[#1D1E22] text-white/80 hover:bg-[#2A2B30]'
                  }`}
                >
                  {mins} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="ml-1.5 px-2.5 py-0.5 rounded-md bg-[#FB7213] hover:bg-[#e5650c] text-white font-semibold"
              >
                Criar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
