import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  X,
  Sparkles,
  Briefcase,
  Coffee,
} from 'lucide-react';
import type { CalendarEvent } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DaybreakAgendaTimelineProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
}

const DEFAULT_HOURS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

export const DaybreakAgendaTimeline: React.FC<DaybreakAgendaTimelineProps> = ({
  isOpen,
  onToggleOpen,
  events,
  onAddEvent,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [category, setCategory] = useState<CalendarEvent['category']>('work');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddEvent({
      title: title.trim(),
      startTime,
      endTime,
      category,
      color:
        category === 'deep-work'
          ? '#9333EA'
          : category === 'break'
          ? '#FBBF24'
          : category === 'meeting'
          ? '#3B82F6'
          : '#10B981',
    });
    setTitle('');
    setIsAdding(false);
  };

  const getEventCategoryIcon = (cat: CalendarEvent['category']) => {
    switch (cat) {
      case 'deep-work':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'break':
        return <Coffee className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Briefcase className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const now = new Date();
  const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="w-72 lg:w-80 bg-card border-r border-border h-full flex flex-col justify-between p-4 shrink-0 select-none animate-in slide-in-from-left-4 duration-200">
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Agenda de Hoje
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono">
                Timeline &amp; Horários
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            title="Fechar aba de agenda"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Time Badge */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-secondary/60 border border-border text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
            <Clock className="w-3 h-3 text-primary" />
            Agora:
          </span>
          <span className="font-mono font-bold text-primary">{currentHour}</span>
        </div>

        {/* Timeline Events Scroll Area */}
        <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
          {DEFAULT_HOURS.map((hour) => {
            const hourEvents = events.filter((e) => e.startTime.startsWith(hour.slice(0, 2)));

            return (
              <div key={hour} className="group relative flex items-start gap-3 py-1.5">
                <span className="w-11 text-[11px] font-mono text-muted-foreground shrink-0 pt-0.5">
                  {hour}
                </span>

                <div className="flex-1 min-w-0 border-l-2 border-border/70 pl-2.5 space-y-1.5 group-hover:border-primary/50 transition-colors">
                  {hourEvents.length > 0 ? (
                    hourEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2 rounded-xl border border-border text-xs space-y-1 transition-all bg-background/80 hover:bg-secondary/70 shadow-sm"
                        style={{ borderLeftColor: evt.color || '#F97316', borderLeftWidth: '3px' }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-foreground truncate text-[11px]">
                            {evt.title}
                          </span>
                          {getEventCategoryIcon(evt.category)}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {evt.startTime} - {evt.endTime}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-4 border-b border-dashed border-border/40" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Add Event Section */}
      <div className="pt-3 border-t border-border space-y-2">
        {isAdding ? (
          <form onSubmit={handleCreate} className="space-y-2 bg-secondary/50 p-2.5 rounded-2xl border border-border text-xs">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do evento..."
              className="h-8 text-xs"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-7 text-[11px] font-mono px-2"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-7 text-[11px] font-mono px-2"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CalendarEvent['category'])}
              className="w-full h-7 bg-background border border-border rounded-xl px-2 text-[11px] text-foreground focus:outline-none"
            >
              <option value="work">Trabalho</option>
              <option value="deep-work">Deep Work</option>
              <option value="break">Pausa / Almoço</option>
              <option value="meeting">Reunião</option>
            </select>
            <div className="flex items-center gap-1">
              <Button type="submit" size="sm" className="h-7 text-xs flex-1">
                Salvar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="w-full text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>Adicionar Bloco de Horário</span>
          </Button>
        )}
      </div>
    </div>
  );
};
