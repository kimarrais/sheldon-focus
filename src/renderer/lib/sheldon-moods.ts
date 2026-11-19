import type { SheldonVisualState } from '@shared/types';
import sheldonNeutral from '../assets/sheldon-neutral.png';
import sheldonCool from '../assets/sheldon-cool.png';
import sheldonHappy from '../assets/sheldon-happy.png';
import sheldonCrying from '../assets/sheldon-crying.png';
import sheldonAngry from '../assets/sheldon-angry.png';

export interface SheldonMoodMeta {
  id: SheldonVisualState;
  label: string;
  shortLabel: string;
  emoji: string;
  avatar: string;
  tagline: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'tear' | 'cream';
  ringClass: string;
}

export const SHELDON_MOODS: Record<SheldonVisualState, SheldonMoodMeta> = {
  neutral: {
    id: 'neutral',
    label: 'Curioso & Atento',
    shortLabel: 'Atento',
    emoji: '🐱',
    avatar: sheldonNeutral,
    tagline: 'Olhinhos brilhando de olho em cada janela que você abre...',
    badgeVariant: 'cream',
    ringClass: 'ring-[#FBBF24]/60 shadow-orange-glow-sm',
  },
  cool: {
    id: 'cool',
    label: 'Sentinela Blindado',
    shortLabel: 'Blindado',
    emoji: '😎',
    avatar: sheldonCool,
    tagline: 'Óculos escuros ativados. Zero distrações passam por mim hoje.',
    badgeVariant: 'default',
    ringClass: 'ring-[#F97316] shadow-orange-glow',
  },
  happy: {
    id: 'happy',
    label: 'Feliz & Ronronando',
    shortLabel: 'Radiante',
    emoji: '😸',
    avatar: sheldonHappy,
    tagline: 'Orgulhoso do seu foco! Continue assim para ganhar mais sachês.',
    badgeVariant: 'success',
    ringClass: 'ring-emerald-400/80 shadow-[0_0_26px_-4px_rgba(52,211,153,0.45)]',
  },
  crying: {
    id: 'crying',
    label: 'Chorando de Decepção',
    shortLabel: 'Chorando',
    emoji: '😿',
    avatar: sheldonCrying,
    tagline: 'Você prometeu que ia focar hoje... por que abriu distração?',
    badgeVariant: 'tear',
    ringClass: 'ring-sky-400/80 shadow-[0_0_26px_-4px_rgba(56,189,248,0.45)]',
  },
  angry: {
    id: 'angry',
    label: 'Pistola • Modo Taskkill',
    shortLabel: 'Pistola',
    emoji: '😾',
    avatar: sheldonAngry,
    tagline: 'Paciência esgotada! Fechando seu jogo à força em 3, 2, 1...',
    badgeVariant: 'destructive',
    ringClass: 'ring-red-500 shadow-[0_0_32px_-4px_rgba(239,68,68,0.55)]',
  },
};

export const SHELDON_MOOD_ORDER: SheldonVisualState[] = [
  'happy',
  'cool',
  'neutral',
  'crying',
  'angry',
];

export function getSheldonMood(state: SheldonVisualState): SheldonMoodMeta {
  return SHELDON_MOODS[state] ?? SHELDON_MOODS.happy;
}

export function getNextSheldonMood(current: SheldonVisualState): SheldonVisualState {
  const idx = SHELDON_MOOD_ORDER.indexOf(current);
  return SHELDON_MOOD_ORDER[(idx + 1) % SHELDON_MOOD_ORDER.length];
}

