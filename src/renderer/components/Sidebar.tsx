import React from 'react';
import {
  Sunrise,
  Activity,
  Cat,
  Sliders,
  Lock,
  Sparkles,
} from 'lucide-react';
import type { SheldonVisualState, TabId } from '@shared/types';
import {
  getSheldonMood,
  SHELDON_MOOD_ORDER,
  SHELDON_MOODS,
} from '@/lib/sheldon-moods';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  sheldonState: SheldonVisualState;
  onToggleSheldonState: () => void;
  onSetSheldonState: (state: SheldonVisualState) => void;
  completedTasksCount: number;
  totalTasksCount: number;
  warningsCount: number;
  lunchSchedule: string;
}

interface NavItemConfig {
  id: TabId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'tear' | 'cream';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  sheldonState,
  onSetSheldonState,
  completedTasksCount,
  totalTasksCount,
  warningsCount,
  lunchSchedule,
}) => {
  const currentMood = getSheldonMood(sheldonState);

  const navItems: NavItemConfig[] = [
    {
      id: 'daybreak',
      title: 'Daybreak',
      subtitle: 'Iniciar Dia & Tarefas',
      icon: Sunrise,
      badge: `${completedTasksCount}/${totalTasksCount}`,
      badgeVariant: 'cream',
    },
    {
      id: 'black-mirror',
      title: 'Black Mirror',
      subtitle: 'Dashboard & Auditoria',
      icon: Activity,
      badge: warningsCount > 0 ? `${warningsCount} alerta(s)` : undefined,
      badgeVariant: 'destructive',
    },
    {
      id: 'sheldon-mood',
      title: "Sheldon's Mood",
      subtitle: '5 Expressões & Sachês',
      icon: Cat,
      badge: `${currentMood.emoji} ${currentMood.shortLabel}`,
      badgeVariant: currentMood.badgeVariant,
    },
    {
      id: 'settings-leash',
      title: 'Settings & Leash',
      subtitle: 'Regras & Blacklist',
      icon: Sliders,
    },
  ];

  return (
    <aside className="w-72 bg-background border-r border-border flex flex-col justify-between p-4 shrink-0 select-none">
      {/* Top Section: Navigation Tabs */}
      <div className="space-y-4">
        <div className="px-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Menu do Sheldon
          </p>
          <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full group flex items-center justify-between px-3.5 py-3 rounded-2xl border text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-card border-[#F97316] text-foreground shadow-orange-glow-sm'
                    : 'bg-transparent border-transparent text-muted-foreground hover:bg-card/70 hover:border-border hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                      isActive
                        ? 'bg-gradient-to-b from-[#FF8429] to-[#F97316] border-[#FDBA74] text-[#2A1506] shadow-sm'
                        : 'bg-card border-border text-muted-foreground group-hover:text-[#F97316] group-hover:border-[#F97316]/40'
                    }`}
                  >
                    <Icon className="w-4 h-4 stroke-[2.3]" />
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-bold leading-tight truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <Badge
                    variant={item.badgeVariant ?? 'default'}
                    className="ml-2 px-2 py-0.5 text-[10px] font-mono shrink-0"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Timeyfi-Style "Minhas Listas" Section (Image 5) */}
        <div className="pt-2 border-t border-border/70 space-y-2">
          <div className="px-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Minhas Listas (TickTick)
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">4 listas</span>
          </div>

          <div className="space-y-1">
            {[
              { name: 'Errands', color: '#F97316', count: '8' },
              { name: 'Work', color: '#3B82F6', count: '1' },
              { name: 'Hábito de hoje', color: '#10B981', count: '2' },
              { name: 'Personal & Life', color: '#EC4899', count: '3' },
            ].map((list) => (
              <button
                key={list.name}
                type="button"
                onClick={() => onSelectTab('daybreak')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-all"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                  <span className="font-semibold truncate">{list.name}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {list.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Lunch Lock + Sheldon 5-Expression Live Card */}
      <div className="space-y-3">
        {/* Lunch Lock Status */}
        <Card className="p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center text-[#FBBF24]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Almoço Sagrado
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {lunchSchedule}
              </div>
            </div>
          </div>
          <Badge variant="success" className="text-[10px] font-mono uppercase">
            Armado
          </Badge>
        </Card>

        {/* Sheldon Live Mascot Card with 5-Mood Dock */}
        <Card className="p-3.5 rounded-2xl space-y-3 bg-gradient-to-b from-card to-[#1F1510]">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-orange-glow-sm">
              <img
                src={currentMood.avatar}
                alt={currentMood.label}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-[#FDE6C4] truncate">
                  {currentMood.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                {currentMood.tagline}
              </p>
            </div>
          </div>

          {/* 5 Kawaii Avatars Dock */}
          <div className="pt-1 border-t border-border/80">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Expressões do Sheldon</span>
              <span className="font-mono text-[#FBBF24]">5 humores</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SHELDON_MOOD_ORDER.map((moodId) => {
                const m = SHELDON_MOODS[moodId];
                const isSelected = sheldonState === moodId;
                return (
                  <button
                    key={moodId}
                    type="button"
                    onClick={() => onSetSheldonState(moodId)}
                    title={`${m.emoji} ${m.label}`}
                    className={`group relative aspect-square rounded-xl p-0.5 transition-all ${
                      isSelected
                        ? 'bg-[#F97316]/25 ring-2 ring-[#F97316] scale-105 shadow-orange-glow-sm'
                        : 'bg-background/70 hover:bg-secondary opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={m.avatar}
                      alt={m.shortLabel}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </aside>
  );
};
