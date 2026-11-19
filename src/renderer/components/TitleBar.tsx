import React from 'react';
import { Minus, Square, X, ShieldAlert, ShieldCheck, Sparkles, Sun, Moon, Laptop } from 'lucide-react';
import type { SheldonVisualState } from '@shared/types';
import { getSheldonMood, SHELDON_MOOD_ORDER, SHELDON_MOODS } from '@/lib/sheldon-moods';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface TitleBarProps {
  sheldonState: SheldonVisualState;
  onToggleSheldonState: () => void;
  onSetSheldonState?: (state: SheldonVisualState) => void;
  isSentinelActive: boolean;
  patienceLevel: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onToggleFloatingWidget?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  sheldonState,
  onToggleSheldonState,
  onSetSheldonState,
  isSentinelActive,
  patienceLevel,
  theme = 'dark',
  onToggleTheme,
  onToggleFloatingWidget,
}) => {
  const handleMinimize = () => {
    window.sheldonAPI?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.sheldonAPI?.toggleMaximizeWindow();
  };

  const handleCloseToTray = () => {
    window.sheldonAPI?.closeToTray();
  };

  const currentMood = getSheldonMood(sheldonState);

  return (
    <header className="h-14 bg-background/95 backdrop-blur border-b border-border px-4 flex items-center justify-between select-none app-drag z-30 shrink-0">
      {/* Left: Sheldon Kawaii App-Icon Badge & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSheldonState}
          title="Clique para alternar entre as 5 expressões do Sheldon"
          className="app-no-drag group relative flex items-center gap-2.5 p-1 pr-3 rounded-2xl bg-card border border-border hover:border-[#F97316]/70 transition-all duration-200 shadow-sm"
        >
          <div className="relative w-8 h-8 rounded-xl overflow-hidden shadow-orange-glow-sm">
            <img
              src={currentMood.avatar}
              alt={currentMood.label}
              className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold tracking-wide text-[#FDE6C4]">
              Sheldon Focus
            </span>
            <Badge variant={currentMood.badgeVariant} className="px-2 py-0 text-[10px]">
              {currentMood.emoji} {currentMood.shortLabel}
            </Badge>
          </div>
        </button>

        {/* Mini Quick-Expression Switcher */}
        {onSetSheldonState && (
          <div className="hidden xl:flex items-center gap-1 p-1 rounded-2xl bg-card/80 border border-border app-no-drag">
            {SHELDON_MOOD_ORDER.map((stateId) => {
              const meta = SHELDON_MOODS[stateId];
              const active = sheldonState === stateId;
              return (
                <button
                  key={stateId}
                  type="button"
                  onClick={() => onSetSheldonState(stateId)}
                  title={`Expressão: ${meta.label}`}
                  className={`w-7 h-7 rounded-xl overflow-hidden p-0.5 transition-all ${
                    active
                      ? 'bg-[#F97316]/25 ring-2 ring-[#F97316] scale-105'
                      : 'opacity-60 hover:opacity-100 hover:bg-secondary'
                  }`}
                >
                  <img
                    src={meta.avatar}
                    alt={meta.shortLabel}
                    className="w-full h-full object-contain"
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="hidden lg:flex items-center gap-2.5 text-xs text-muted-foreground">
          <Separator orientation="vertical" className="h-4" />
          <span className="font-semibold text-[#FDE6C4]/90">
            Juiz Felino Anti-Procrastinação
          </span>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            shadcn/ui • Kawaii Edition
          </Badge>
        </div>
      </div>

      {/* Center: Live Sentinel Status Pill + Patience Pill */}
      <div className="hidden md:flex items-center gap-2.5">
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${
            isSentinelActive
              ? 'bg-[#F97316]/15 border-[#F97316] text-[#FDBA74] shadow-orange-glow-sm'
              : 'bg-card border-border text-muted-foreground'
          }`}
        >
          {isSentinelActive ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-[#F97316] animate-pulse" />
              <span>Sentinela Ativo • Monitorando</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Sentinela em Espera</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
          <span className="text-muted-foreground">Paciência:</span>
          <span
            className={`font-mono font-bold ${
              patienceLevel >= 65
                ? 'text-emerald-400'
                : patienceLevel >= 35
                ? 'text-[#FBBF24]'
                : 'text-red-400'
            }`}
          >
            {patienceLevel}%
          </span>
        </div>
      </div>

      {/* Right: Window Controls & Quick Actions */}
      <div className="flex items-center gap-1.5 app-no-drag">
        {onToggleTheme && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Alternar para tema Escuro' : 'Alternar para tema Claro (Timeyfi)'}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-purple-400" />
            ) : (
              <Sun className="w-4 h-4 text-[#FBBF24]" />
            )}
          </Button>
        )}

        {onToggleFloatingWidget && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleFloatingWidget}
            title="Abrir Widget Flutuante no Desktop"
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary"
          >
            <Laptop className="w-4 h-4" />
          </Button>
        )}

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleMinimize}
          title="Minimizar janela"
          className="h-8 w-8 rounded-xl"
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleMaximize}
          title="Maximizar / Restaurar"
          className="h-8 w-8 rounded-xl"
        >
          <Square className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCloseToTray}
          title="Fechar para a Bandeja do Sistema"
          className="h-8 w-8 rounded-xl hover:bg-[#F97316] hover:text-[#2A1506]"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
