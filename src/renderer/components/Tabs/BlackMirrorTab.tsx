import React, { useState } from 'react';
import {
  Clock,
  Flame,
  Skull,
  ShieldAlert,
  Terminal,
  TrendingUp,
  Zap,
  PlusCircle,
} from 'lucide-react';
import type { TimelineBlock, WarningLogItem } from '@shared/types';
import { SHELDON_MOODS } from '@/lib/sheldon-moods';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface BlackMirrorTabProps {
  warnings: WarningLogItem[];
  timelineBlocks: TimelineBlock[];
  onSimulateViolation: () => void;
}

export const BlackMirrorTab: React.FC<BlackMirrorTabProps> = ({
  warnings,
  timelineBlocks,
  onSimulateViolation,
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    timelineBlocks[2]?.id || timelineBlocks[0]?.id || ''
  );

  const totalMinutesTracked = timelineBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const productiveMinutes = timelineBlocks
    .filter((b) => b.category === 'deep-work' || b.category === 'ticktick-sync')
    .reduce((acc, b) => acc + b.durationMinutes, 0);
  const wastedMinutes = timelineBlocks
    .filter((b) => b.category === 'procrastination')
    .reduce((acc, b) => acc + b.durationMinutes, 0);

  const focusEfficiency =
    totalMinutesTracked > 0
      ? Math.round((productiveMinutes / (productiveMinutes + wastedMinutes || 1)) * 100)
      : 100;

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const selectedBlock =
    timelineBlocks.find((b) => b.id === selectedBlockId) || timelineBlocks[0];

  const getCategoryColor = (category: TimelineBlock['category']) => {
    switch (category) {
      case 'deep-work':
        return 'bg-gradient-to-b from-[#FF8429] to-[#F97316] border-[#FDBA74] text-[#2A1506]';
      case 'ticktick-sync':
        return 'bg-emerald-500/85 border-emerald-300 text-[#0B2218]';
      case 'procrastination':
        return 'bg-red-500 border-red-300 text-white';
      case 'lunch-lock':
        return 'bg-[#FDE6C4] border-[#FBBF24] text-[#3B2314]';
      default:
        return 'bg-secondary border-border text-foreground';
    }
  };

  const getCategoryLabel = (category: TimelineBlock['category']) => {
    switch (category) {
      case 'deep-work':
        return 'Deep Work (Foco Puro)';
      case 'ticktick-sync':
        return 'TickTick Pomodoro';
      case 'procrastination':
        return 'Distração Detectada';
      case 'lunch-lock':
        return 'PC Bloqueado (Almoço)';
      default:
        return 'Pausa / Ocioso';
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header Banner */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-card via-card to-[#FCE5D9]/60 dark:to-[#24160E]">
        <div className="flex items-center gap-4">
          <img
            src={SHELDON_MOODS.angry.avatar}
            alt="Sheldon Auditor"
            className="w-14 h-14 rounded-2xl object-contain shadow-orange-glow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="uppercase tracking-wider">
                Black Mirror • Telemetria
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">
                Auditoria Implacável do Dia
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-foreground mt-1">
              Verdade Nua e Crua Sobre o Seu Tempo
            </h1>
          </div>
        </div>

        <Button
          type="button"
          variant="destructive"
          onClick={onSimulateViolation}
          className="self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Simular Tentativa de Abrir Jogo 😾</span>
        </Button>
      </Card>

      {/* Top Metrics Grid: Productive vs Wasted */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Tempo Produtivo
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center text-[#F97316]">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#FB7213]">
            {formatDuration(productiveMinutes)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-semibold">+18% vs. ontem</span>
            <span className="text-muted-foreground font-mono">Meta: 6h 00m</span>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Tempo Perdido (Distrações)
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-red-400">
            {formatDuration(wastedMinutes)}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Tolerância máx: 30m</span>
            <span className="text-[#FBBF24] font-mono">Vigiado</span>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Taxa de Foco Real
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-foreground">
            {focusEfficiency}%
          </div>
          <Progress value={focusEfficiency} className="h-2" />
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Abates / Advertências
            </span>
            <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center text-[#F97316]">
              <Skull className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#F97316]">
            {warnings.length} ocorrências
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              {warnings.filter((w) => w.severity === 'terminated').length} processos mortos
            </span>
            <span className="text-muted-foreground font-mono">taskkill /F</span>
          </div>
        </Card>
      </div>

      {/* Horizontal Activity Timeline */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#F97316]" />
              <span>Timeline Horizontal de Atividades (08:00 — 18:00)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique em qualquer bloco da linha do tempo para inspecionar a janela ativa e o veredito do Sheldon.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F97316]" />
              Deep Work
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              TickTick
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              Procrastinação
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FDE6C4]" />
              Almoço Bloqueado
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-14 w-full bg-background p-1.5 rounded-2xl border border-border flex items-stretch gap-1.5 overflow-x-auto">
            {timelineBlocks.map((block) => {
              const widthPercent = Math.max(
                (block.durationMinutes / (totalMinutesTracked || 1)) * 100,
                7
              );
              const isSelected = selectedBlock?.id === block.id;

              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setSelectedBlockId(block.id)}
                  style={{ width: `${widthPercent}%` }}
                  className={`group relative rounded-xl border px-2.5 flex flex-col justify-center items-start overflow-hidden transition-all duration-200 ${getCategoryColor(
                    block.category
                  )} ${
                    isSelected
                      ? 'ring-2 ring-white scale-[1.01] z-10'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <span className="text-[11px] font-bold truncate w-full text-left">
                    {block.label}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 truncate w-full text-left">
                    {block.startTime} - {block.endTime}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between text-[11px] font-mono text-muted-foreground px-1">
            <span>08:00</span>
            <span>10:00</span>
            <span>12:00 (Almoço)</span>
            <span>14:00</span>
            <span>16:00</span>
            <span>18:00</span>
          </div>
        </div>

        {selectedBlock && (
          <div className="p-4 rounded-2xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-[#F97316]">
                  [{selectedBlock.startTime} → {selectedBlock.endTime}]
                </span>
                <span className="text-sm font-bold text-foreground">
                  {selectedBlock.label}
                </span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {getCategoryLabel(selectedBlock.category)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{selectedBlock.details}</p>
            </div>

            <Badge variant="cream" className="font-mono text-xs px-3 py-1.5 shrink-0">
              Duração: {selectedBlock.durationMinutes} min
            </Badge>
          </div>
        )}
      </Card>

      {/* Warning & Taskkill Audit Log */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#F97316]" />
              <span>Log de Advertências &amp; Intervenções do Sheldon</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Histórico de executáveis interceptados em background pelo monitor de processos.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            Hoje • {warnings.length} registros
          </Badge>
        </div>

        <div className="space-y-2.5">
          {warnings.map((item) => {
            const avatarForSeverity =
              item.severity === 'terminated'
                ? SHELDON_MOODS.angry.avatar
                : item.severity === 'critical'
                ? SHELDON_MOODS.crying.avatar
                : SHELDON_MOODS.neutral.avatar;

            const badgeVariant =
              item.severity === 'terminated'
                ? 'destructive'
                : item.severity === 'critical'
                ? 'tear'
                : 'warning';

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-background border border-border hover:border-[#F97316]/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3.5">
                  <img
                    src={avatarForSeverity}
                    alt={item.severity}
                    className="w-11 h-11 rounded-xl object-contain shrink-0 mt-0.5 shadow-sm"
                  />

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.timestamp}
                      </span>
                      <Badge variant="cream" className="font-mono text-xs">
                        {item.executable}
                      </Badge>
                      <span className="text-xs text-foreground font-semibold">
                        — {item.windowTitle}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      “{item.sheldonComment}”
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <Badge variant={badgeVariant} className="px-3 py-1 font-mono text-xs">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {item.actionTaken}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
