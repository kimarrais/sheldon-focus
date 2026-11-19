import React, { useState } from 'react';
import {
  Heart,
  Fish,
  Zap,
  Shield,
  Sparkles,
  Play,
  BookOpen,
  Briefcase,
  Code,
  Palette,
} from 'lucide-react';
import type { SheldonVisualState } from '@shared/types';
import {
  getSheldonMood,
  SHELDON_MOOD_ORDER,
  SHELDON_MOODS,
} from '@/lib/sheldon-moods';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SheldonMoodTabProps {
  sheldonState: SheldonVisualState;
  onSetSheldonState: (state: SheldonVisualState) => void;
  patienceLevel: number;
  snacksAvailable: number;
  onFeedSheldon: () => void;
  onStartCustomFocus?: (category: string, minutes: number) => void;
}

const SHELDON_QUOTES: Record<SheldonVisualState, string[]> = {
  neutral: [
    'Estou pronto para focar com você! Vamos configurar um timer?',
    'Estou de olho nos seus processos abertos... não inventa de abrir a Steam!',
    'Olhinhos atentos, foco apontado. Qual tarefa vamos triturar agora?',
  ],
  cool: [
    'Modo Sentinela blindado. Seus jogos não têm a menor chance contra minhas garras.',
    'Óculos escuros no rosto: zero procrastinação, produtividade nível Boss.',
    'Cada minuto de foco profundo é um sachê gourmet garantido pro final do dia.',
  ],
  happy: [
    'Nham! Sachê delicioso e tarefas concluídas! Você é o melhor humano do mundo! 😸',
    'Sensação incrível de missão cumprida! Continue assim e eu ronrono alto!',
    'Lista de tarefas sendo aniquilada! Isso merece um sachê de salmão!',
  ],
  crying: [
    'Snif... você abriu distração de novo? Minhas lágrimas estão inundando o teclado!',
    'Por que você procrastina quando me prometeu foco? Salve seu trabalho logo!',
    'Conclua uma tarefa rápida na aba Daybreak para secar minhas lágrimas, por favor...',
  ],
  angry: [
    'Você ignorou o aviso?! O cronômetro da guilhotina já está correndo!',
    'Mais 30 segundos desse jogo e eu mesmo dou taskkill /F no seu executável!',
    'Eu não negocio com procrastinadores. Feche isso agora ou o PC vai trancar!',
  ],
};

const FOCUS_CATEGORIES = [
  { id: 'work', label: 'Trabalho', icon: Briefcase, color: '#3B82F6' },
  { id: 'study', label: 'Estudo', icon: BookOpen, color: '#10B981' },
  { id: 'coding', label: 'Programação', icon: Code, color: '#9333EA' },
  { id: 'creative', label: 'Criativo', icon: Palette, color: '#EC4899' },
];

const DURATION_PRESETS = [15, 25, 30, 45, 60];

export const SheldonMoodTab: React.FC<SheldonMoodTabProps> = ({
  sheldonState,
  onSetSheldonState,
  patienceLevel,
  snacksAvailable,
  onFeedSheldon,
  onStartCustomFocus,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('work');
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [feedToast, setFeedToast] = useState<string | null>(null);

  const currentMood = getSheldonMood(sheldonState);
  const quotesList = SHELDON_QUOTES[sheldonState] || SHELDON_QUOTES.neutral;
  const activeQuote = quotesList[quoteIdx % quotesList.length];

  const handleNextQuote = () => {
    setQuoteIdx((prev) => prev + 1);
  };

  const handleFeed = () => {
    if (snacksAvailable <= 0) {
      setFeedToast('Sem sachês no estoque! Conclua tarefas no Daybreak para ganhar sachês.');
      setTimeout(() => setFeedToast(null), 3000);
      return;
    }
    onFeedSheldon();
    setFeedToast('Nham! Sheldon devorou o sachê, ficou radiante (+15% Humor) 😸');
    setTimeout(() => setFeedToast(null), 3000);
  };

  const handleStartFocus = () => {
    if (onStartCustomFocus) {
      onStartCustomFocus(selectedCategory, selectedMinutes);
    }
  };

  return (
    <div className="space-y-6 pb-8 select-none max-w-4xl mx-auto">
      {/* 1. Main Mascot Stage (Desktop representation of Image 2) */}
      <div className="relative rounded-3xl overflow-hidden border border-border bg-gradient-to-b from-[#161226] via-[#100B1A] to-[#0A0712] p-8 sm:p-12 shadow-2xl flex flex-col items-center text-center">
        {/* Soft glowing ambient platform aura (Image 2) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-12 left-12 w-2 h-2 rounded-full bg-blue-300 blur-xs animate-ping" />
        <div className="absolute top-20 right-16 w-3 h-3 rounded-full bg-purple-300 blur-xs animate-pulse" />
        <div className="absolute bottom-24 left-20 w-2.5 h-2.5 rounded-full bg-pink-300 blur-xs" />

        {/* Sheldon Name & Header Pill */}
        <div className="z-10 flex items-center gap-2 mb-4">
          <Badge variant="cream" className="text-xs font-bold uppercase tracking-wider px-3.5 py-1">
            🐾 Sheldon
          </Badge>
          <Badge variant={currentMood.badgeVariant} className="text-xs font-mono">
            {currentMood.emoji} {currentMood.label}
          </Badge>
        </div>

        {/* Mascot Speech Bubble (Image 2) */}
        <div
          onClick={handleNextQuote}
          title="Clique para outra frase do Sheldon"
          className="relative z-10 max-w-md bg-card/90 border border-border/90 px-5 py-3 rounded-2xl shadow-lg mb-6 cursor-pointer hover:border-primary transition-all group"
        >
          <p className="text-sm font-bold text-foreground leading-relaxed">
            "{activeQuote}"
          </p>
          <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-1 opacity-70 group-hover:opacity-100">
            <Sparkles className="w-3 h-3 text-primary" /> Clique para conversar com Sheldon
          </span>

          {/* Speech bubble pointer triangle */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-r border-b border-border/90 rotate-45" />
        </div>

        {/* Centered Mascot Hero Avatar (Image 2 Center) */}
        <div className="relative z-10 my-2 group">
          {/* Subtle pedestal glow */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-8 bg-purple-500/30 rounded-full blur-md" />

          <div
            className={`w-52 h-52 sm:w-60 sm:h-60 rounded-[44px] overflow-hidden p-2 transition-transform duration-500 group-hover:scale-105 animate-float-slow drop-shadow-[0_15px_35px_rgba(168,85,247,0.35)]`}
          >
            <img
              src={currentMood.avatar}
              alt={currentMood.label}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* 2. Mascot Stat Attribute Cards (Directly underneath, Image 2 style) */}
        <div className="z-10 grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full max-w-2xl mt-6">
          {/* Hunger / Sachê card */}
          <div className="p-3.5 rounded-2xl bg-card/85 border border-border text-left space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Fish className="w-3.5 h-3.5 text-primary" />
              <span>Sachês (Fome)</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-foreground">
              {snacksAvailable} un
            </div>
            <p className="text-[10px] text-muted-foreground">Disponíveis no estoque</p>
          </div>

          {/* Happiness / Patience card */}
          <div className="p-3.5 rounded-2xl bg-card/85 border border-border text-left space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Humor / Paciência</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-[#FBBF24]">
              {patienceLevel}%
            </div>
            <Progress value={patienceLevel} className="h-1.5 mt-1" />
          </div>

          {/* Focus Energy */}
          <div className="p-3.5 rounded-2xl bg-card/85 border border-border text-left space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Energia de Foco</span>
            </div>
            <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              92%
            </div>
            <p className="text-[10px] text-muted-foreground">Pronto para Deep Work</p>
          </div>

          {/* Strictness Level */}
          <div className="p-3.5 rounded-2xl bg-card/85 border border-border text-left space-y-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Shield className="w-3.5 h-3.5 text-purple-500" />
              <span>Nível de Rigor</span>
            </div>
            <div className="text-sm font-extrabold uppercase text-purple-600 dark:text-purple-300 pt-1">
              Sentinela Boss
            </div>
            <p className="text-[10px] text-muted-foreground">Caçador de processos</p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="z-10 flex items-center justify-center gap-3 mt-6 flex-wrap">
          <Button
            type="button"
            size="lg"
            onClick={handleFeed}
            className="rounded-2xl px-6 font-bold text-xs bg-gradient-to-r from-primary to-[#EA580C] shadow-orange-glow flex items-center gap-2"
          >
            <Fish className="w-4 h-4" />
            <span>Alimentar Sheldon (+15% Humor)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleStartFocus}
            className="rounded-2xl px-6 font-bold text-xs flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current text-primary" />
            <span>Iniciar Sessão ({selectedMinutes}m)</span>
          </Button>
        </div>

        {feedToast && (
          <div className="z-20 mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold animate-in fade-in">
            {feedToast}
          </div>
        )}
      </div>

      {/* 3. Category & Duration Config (Image 2 Focus Session panel) */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-extrabold text-foreground">
            O que você vai focar agora?
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione uma categoria e a duração para o seu próximo bloco de trabalho profundo.
          </p>
        </div>

        {/* Category Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {FOCUS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-primary/15 border-primary text-foreground shadow-orange-glow-sm'
                    : 'bg-background border-border hover:bg-secondary/70 text-muted-foreground'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: cat.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-foreground">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Duration Selector Chips */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground block">
            Tempo de Foco (Minutos)
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {DURATION_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setSelectedMinutes(mins)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                  selectedMinutes === mins
                    ? 'bg-primary text-primary-foreground border-primary shadow-orange-glow-sm'
                    : 'bg-background border-border text-foreground hover:bg-secondary'
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. 5 Expressões do Sheldon Dock (Quick Preview) */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            As 5 Expressões Oficiais do Sheldon
          </span>
          <Badge variant="cream" className="font-mono text-[10px]">
            Kawaii Icon Edition
          </Badge>
        </div>

        <div className="grid grid-cols-5 gap-2.5">
          {SHELDON_MOOD_ORDER.map((moodId) => {
            const m = SHELDON_MOODS[moodId];
            const isSelected = sheldonState === moodId;

            return (
              <button
                key={moodId}
                type="button"
                onClick={() => onSetSheldonState(moodId)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-primary/20 border-primary ring-2 ring-primary scale-105 shadow-orange-glow-sm'
                    : 'bg-background border-border hover:bg-secondary opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={m.avatar}
                  alt={m.shortLabel}
                  className="w-12 h-12 object-contain rounded-xl"
                />
                <span className="text-[11px] font-bold text-foreground">
                  {m.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
