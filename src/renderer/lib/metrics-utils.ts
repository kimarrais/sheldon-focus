import type {
  ActivityEventRecord,
  ActivityRecord,
  MetricsSummary,
  TopAppStat,
  TrackableCategory,
} from '@shared/types';

export interface CategoryTheme {
  label: string;
  shortLabel: string;
  group: 'focus' | 'neutral' | 'distraction' | 'idle';
  barColor: string;
  barGradient: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
}

/**
 * Semantic category palette:
 * - Purple / Highlight: Deep Work, Design, Dev
 * - Blue: Comunicação, Neutro
 * - Red / Orange: Distração
 * - Dark Muted Gray: Idle
 */
export const CATEGORY_THEMES: Record<TrackableCategory, CategoryTheme> = {
  'Deep Work': {
    label: 'Deep Work',
    shortLabel: 'Deep Work',
    group: 'focus',
    barColor: '#7C3AED',
    barGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    badgeBg: 'bg-violet-500/12 dark:bg-violet-500/20',
    badgeText: 'text-violet-700 dark:text-violet-300',
    badgeBorder: 'border-violet-500/30',
    dotColor: '#7C3AED',
  },
  Dev: {
    label: 'Desenvolvimento',
    shortLabel: 'Dev',
    group: 'focus',
    barColor: '#6366F1',
    barGradient: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
    badgeBg: 'bg-indigo-500/12 dark:bg-indigo-500/20',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    dotColor: '#6366F1',
  },
  Design: {
    label: 'Design',
    shortLabel: 'Design',
    group: 'focus',
    barColor: '#A855F7',
    barGradient: 'linear-gradient(135deg, #C084FC 0%, #9333EA 100%)',
    badgeBg: 'bg-purple-500/12 dark:bg-purple-500/20',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-500/30',
    dotColor: '#A855F7',
  },
  'Comunicação': {
    label: 'Comunicação',
    shortLabel: 'Comunicação',
    group: 'neutral',
    barColor: '#3B82F6',
    barGradient: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)',
    badgeBg: 'bg-blue-500/12 dark:bg-blue-500/20',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-500/30',
    dotColor: '#3B82F6',
  },
  Neutro: {
    label: 'Neutro',
    shortLabel: 'Neutro',
    group: 'neutral',
    barColor: '#0EA5E9',
    barGradient: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
    badgeBg: 'bg-sky-500/12 dark:bg-sky-500/20',
    badgeText: 'text-sky-700 dark:text-sky-300',
    badgeBorder: 'border-sky-500/30',
    dotColor: '#0EA5E9',
  },
  'Distração': {
    label: 'Distração',
    shortLabel: 'Distração',
    group: 'distraction',
    barColor: '#EF4444',
    barGradient: 'linear-gradient(135deg, #F97316 0%, #DC2626 100%)',
    badgeBg: 'bg-red-500/12 dark:bg-red-500/20',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-500/30',
    dotColor: '#EF4444',
  },
  Idle: {
    label: 'Ocioso / Pausa',
    shortLabel: 'Idle',
    group: 'idle',
    barColor: '#475569',
    barGradient: 'linear-gradient(135deg, #64748B 0%, #334155 100%)',
    badgeBg: 'bg-slate-500/12 dark:bg-slate-500/25',
    badgeText: 'text-slate-600 dark:text-slate-300',
    badgeBorder: 'border-slate-500/30',
    dotColor: '#475569',
  },
};

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function shiftDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map((v) => Number.parseInt(v, 10));
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((v) => Number.parseInt(v, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const today = getTodayDateString();
  const yesterday = shiftDateString(today, -1);

  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  const label = `${String(dt.getDate()).padStart(2, '0')} de ${months[dt.getMonth()]}, ${dt.getFullYear()}`;
  if (dateStr === today) return `Hoje • ${label}`;
  if (dateStr === yesterday) return `Ontem • ${label}`;
  return label;
}

export function formatDurationCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const totalMinutes = Math.floor(s / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h 00m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDurationMinutes(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} seg`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatClockHHMM(timestampMs: number): string {
  const d = new Date(timestampMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatClockHHMMSS(timestampMs: number): string {
  const d = new Date(timestampMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0'
  )}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function formatCompactCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(Math.max(0, Math.round(count)));
}

export function getDayMidnightBounds(dateStr: string): { startMs: number; endMs: number } {
  const [y, m, d] = dateStr.split('-').map((v) => Number.parseInt(v, 10));
  const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  const end = new Date(y, (m || 1) - 1, (d || 1) + 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export interface PositionedTimelineBlock {
  block: ActivityRecord;
  leftPercent: number;
  widthPercent: number;
  clampedStart: number;
  clampedEnd: number;
}

/**
 * Computes exact percentage left & width coordinates of an activity block
 * within a visible time window [rangeStartMs, rangeEndMs].
 */
export function computeTimelineBlocksGeometry(
  blocks: ActivityRecord[],
  rangeStartMs: number,
  rangeEndMs: number
): PositionedTimelineBlock[] {
  const totalSpan = Math.max(1, rangeEndMs - rangeStartMs);
  const positioned: PositionedTimelineBlock[] = [];

  for (const block of blocks) {
    if (block.endTime <= rangeStartMs || block.startTime >= rangeEndMs) {
      continue;
    }

    const clampedStart = Math.max(rangeStartMs, block.startTime);
    const clampedEnd = Math.min(rangeEndMs, block.endTime);
    if (clampedEnd <= clampedStart) continue;

    const leftPercent = ((clampedStart - rangeStartMs) / totalSpan) * 100;
    const rawWidthPercent = ((clampedEnd - clampedStart) / totalSpan) * 100;

    positioned.push({
      block,
      leftPercent: Math.max(0, Math.min(100, leftPercent)),
      widthPercent: Math.max(0.18, Math.min(100 - leftPercent, rawWidthPercent)),
      clampedStart,
      clampedEnd,
    });
  }

  return positioned;
}

/**
 * Coalesces rapid back-to-back segments of the exact same app/domain/category
 * separated by tiny gaps (<= 3s) for cleaner 24h track rendering without altering
 * underlying DB rows.
 */
export function coalesceBlocksForTrack(blocks: ActivityRecord[]): ActivityRecord[] {
  if (blocks.length <= 1) return blocks;
  const merged: ActivityRecord[] = [];

  for (const curr of blocks) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.category === curr.category &&
      prev.appName.toLowerCase() === curr.appName.toLowerCase() &&
      (prev.domain || '').toLowerCase() === (curr.domain || '').toLowerCase() &&
      curr.startTime - prev.endTime <= 3000
    ) {
      const nextEnd = Math.max(prev.endTime, curr.endTime);
      merged[merged.length - 1] = {
        ...prev,
        endTime: nextEnd,
        durationSeconds: Math.max(1, Math.round((nextEnd - prev.startTime) / 1000)),
        windowTitle: curr.windowTitle || prev.windowTitle,
        isOngoing: Boolean(prev.isOngoing || curr.isOngoing),
      };
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

export function getAppVisualToken(appName: string, domain: string | null): {
  abbr: string;
  bg: string;
  fg: string;
} {
  const key = (domain || appName).toLowerCase();
  if (key.includes('code') || key.includes('cursor') || key.includes('windsurf')) {
    return { abbr: 'VS', bg: 'bg-indigo-500/15', fg: 'text-indigo-600 dark:text-indigo-300' };
  }
  if (key.includes('figma')) {
    return { abbr: 'Fg', bg: 'bg-purple-500/15', fg: 'text-purple-600 dark:text-purple-300' };
  }
  if (key.includes('github')) {
    return { abbr: 'GH', bg: 'bg-slate-800/10 dark:bg-white/10', fg: 'text-slate-800 dark:text-slate-200' };
  }
  if (key.includes('youtube')) {
    return { abbr: 'YT', bg: 'bg-red-500/15', fg: 'text-red-600 dark:text-red-300' };
  }
  if (key.includes('notion')) {
    return { abbr: 'Nt', bg: 'bg-violet-500/15', fg: 'text-violet-700 dark:text-violet-300' };
  }
  if (key.includes('slack')) {
    return { abbr: 'Sl', bg: 'bg-blue-500/15', fg: 'text-blue-600 dark:text-blue-300' };
  }
  if (key.includes('x.com') || key.includes('twitter')) {
    return { abbr: 'X', bg: 'bg-orange-500/15', fg: 'text-orange-600 dark:text-orange-300' };
  }
  if (key.includes('whatsapp') || key.includes('discord') || key.includes('teams')) {
    return { abbr: 'Msg', bg: 'bg-sky-500/15', fg: 'text-sky-600 dark:text-sky-300' };
  }
  if (key.includes('ausente') || key.includes('idle')) {
    return { abbr: 'AFK', bg: 'bg-slate-500/15', fg: 'text-slate-600 dark:text-slate-300' };
  }
  const clean = (domain || appName).replace(/^www\./, '').trim();
  const abbr = clean.slice(0, 2).toUpperCase() || 'AP';
  return { abbr, bg: 'bg-slate-500/12', fg: 'text-slate-700 dark:text-slate-300' };
}

/**
 * Fallback dataset used ONLY when running in pure browser Vite preview
 * without the Electron IPC preload bridge.
 */
export function buildPreviewDemoMetrics(dateStr: string): {
  timeline: ActivityRecord[];
  summary: MetricsSummary;
  topApps: TopAppStat[];
  events: ActivityEventRecord[];
} {
  const { startMs } = getDayMidnightBounds(dateStr);
  const at = (h: number, m: number) => startMs + (h * 60 + m) * 60 * 1000;

  const mk = (
    id: number,
    sh: number,
    sm: number,
    eh: number,
    em: number,
    appName: string,
    windowTitle: string,
    domain: string | null,
    url: string | null,
    projectName: string | null,
    fileName: string | null,
    category: TrackableCategory,
    isProductive: boolean
  ): ActivityRecord => {
    const startTime = at(sh, sm);
    const endTime = at(eh, em);
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    const activeInputSeconds =
      category === 'Idle' ? 0 : Math.round(durationSeconds * (isProductive ? 0.82 : 0.45));
    return {
      id,
      appName,
      executableName: category === 'Idle' ? '' : `${appName}.exe`,
      processPath: category === 'Idle' ? '' : `C:\\Apps\\${appName}.exe`,
      processId: 1000 + id,
      windowTitle,
      url,
      domain,
      projectName,
      fileName,
      category,
      isProductive,
      startTime,
      endTime,
      durationSeconds,
      activeInputSeconds,
      passiveSeconds: Math.max(0, durationSeconds - activeInputSeconds),
      keystrokesCount: category === 'Idle' ? 0 : Math.round(activeInputSeconds * 1.4),
      mouseClicksCount: category === 'Idle' ? 0 : Math.round(activeInputSeconds * 0.25),
      scrollEventsCount: category === 'Idle' ? 0 : Math.round(durationSeconds * 0.15),
    };
  };

  const timeline: ActivityRecord[] = [
    mk(1, 8, 15, 9, 5, 'Code', 'ActivityTracker.ts - sheldon-focus - Visual Studio Code', null, null, 'sheldon-focus', 'ActivityTracker.ts', 'Dev', true),
    mk(2, 9, 5, 9, 22, 'Slack', '#engineering - Workspace Sheldon', null, null, 'Workspace Sheldon', '#engineering', 'Comunicação', false),
    mk(3, 9, 22, 10, 48, 'Figma', 'Sheldon Metrics 24h UI - Figma', 'figma.com', 'https://www.figma.com/file/sheldon-ui', 'Sheldon Metrics 24h UI', 'Design System', 'Design', true),
    mk(4, 10, 48, 11, 2, 'Google Chrome', 'YouTube - Lo-fi & Tech Reviews', 'youtube.com', 'https://www.youtube.com/watch?v=demo', 'youtube.com', 'Lo-fi & Tech Reviews', 'Distração', false),
    mk(5, 11, 2, 12, 5, 'Code', 'Database.ts - sheldon-focus - Visual Studio Code', null, null, 'sheldon-focus', 'Database.ts', 'Dev', true),
    mk(6, 12, 5, 13, 0, 'Ausente/Pausa', 'Usuário ausente (pausa para almoço)', null, null, null, null, 'Idle', false),
    mk(7, 13, 0, 14, 18, 'Google Chrome', 'sheldon-focus Pull Request #42 - GitHub', 'github.com', 'https://github.com/sheldon/focus/pull/42', 'sheldon/focus', 'pull/42', 'Dev', true),
    mk(8, 14, 18, 14, 34, 'Google Chrome', 'Feed / X - Twitter', 'x.com', 'https://x.com/home', 'x.com', 'Feed / X', 'Distração', false),
    mk(9, 14, 34, 15, 50, 'Notion', 'Arquitetura SQLite & IPC Spec - Notion', 'notion.so', 'https://www.notion.so/arquitetura-sqlite', 'notion.so', 'Arquitetura SQLite & IPC Spec', 'Deep Work', true),
    mk(10, 15, 50, 16, 15, 'Microsoft Edge', 'Daily Standup - Google Meet', 'meet.google.com', 'https://meet.google.com/abc-defg-hij', 'meet.google.com', 'Daily Standup', 'Comunicação', false),
    mk(11, 16, 15, 17, 42, 'Code', 'MetricsView.tsx - sheldon-focus - Visual Studio Code', null, null, 'sheldon-focus', 'MetricsView.tsx', 'Dev', true),
  ];

  let deepWorkSeconds = 0;
  let communicationSeconds = 0;
  let neutralSeconds = 0;
  let distractionSeconds = 0;
  let idleSeconds = 0;
  let productiveSeconds = 0;
  let distractionCount = 0;
  let activeInputSeconds = 0;
  let passiveSeconds = 0;
  let keystrokesCount = 0;
  let mouseClicksCount = 0;

  for (const item of timeline) {
    if (item.category === 'Deep Work' || item.category === 'Dev' || item.category === 'Design') {
      deepWorkSeconds += item.durationSeconds;
    } else if (item.category === 'Comunicação') {
      communicationSeconds += item.durationSeconds;
    } else if (item.category === 'Neutro') {
      neutralSeconds += item.durationSeconds;
    } else if (item.category === 'Distração') {
      distractionSeconds += item.durationSeconds;
      distractionCount += 1;
    } else if (item.category === 'Idle') {
      idleSeconds += item.durationSeconds;
    }
    if (item.isProductive) productiveSeconds += item.durationSeconds;
    if (item.category !== 'Idle') {
      activeInputSeconds += item.activeInputSeconds;
      passiveSeconds += item.passiveSeconds;
      keystrokesCount += item.keystrokesCount;
      mouseClicksCount += item.mouseClicksCount;
    }
  }

  const totalActiveSeconds =
    deepWorkSeconds + communicationSeconds + neutralSeconds + distractionSeconds;
  const focusPercentage = Math.round((productiveSeconds / totalActiveSeconds) * 100);
  const sheldonScore = 86;

  const grouped = new Map<string, TopAppStat>();
  for (const b of timeline) {
    if (b.category === 'Idle') continue;
    const key = b.domain || b.appName;
    const prev = grouped.get(key);
    if (prev) {
      prev.totalSeconds += b.durationSeconds;
      prev.activeInputSeconds += b.activeInputSeconds;
      prev.keystrokesCount += b.keystrokesCount;
      prev.mouseClicksCount += b.mouseClicksCount;
      prev.sessionCount += 1;
    } else {
      grouped.set(key, {
        key,
        appName: b.appName,
        executableName: b.executableName,
        processPath: b.processPath,
        domain: b.domain,
        category: b.category,
        isProductive: b.isProductive,
        totalSeconds: b.durationSeconds,
        activeInputSeconds: b.activeInputSeconds,
        keystrokesCount: b.keystrokesCount,
        mouseClicksCount: b.mouseClicksCount,
        percentageOfActive: 0,
        percentageOfDay: 0,
        sessionCount: 1,
      });
    }
  }

  const topApps = [...grouped.values()]
    .map((item) => ({
      ...item,
      percentageOfActive: Math.round((item.totalSeconds / totalActiveSeconds) * 1000) / 10,
      percentageOfDay: Math.round((item.totalSeconds / 86400) * 1000) / 10,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const events: ActivityEventRecord[] = [...timeline].reverse().map((b, i) => ({
    id: i + 1,
    clientEventId: `demo-ev-${i + 1}`,
    eventType: b.category === 'Idle' ? 'idle_start' : b.url ? 'url_change' : 'window_switch',
    appName: b.appName,
    executableName: b.executableName,
    windowTitle: b.windowTitle,
    url: b.url,
    domain: b.domain,
    projectName: b.projectName,
    fileName: b.fileName,
    category: b.category,
    occurredAt: b.startTime,
    durationMs: b.durationSeconds * 1000,
    keystrokesCount: b.keystrokesCount,
    mouseClicksCount: b.mouseClicksCount,
    scrollEventsCount: b.scrollEventsCount,
  }));

  return {
    timeline,
    summary: {
      date: dateStr,
      totalActiveSeconds,
      productiveSeconds,
      deepWorkSeconds,
      communicationSeconds,
      neutralSeconds,
      distractionSeconds,
      idleSeconds,
      activeInputSeconds,
      passiveSeconds,
      keystrokesCount,
      mouseClicksCount,
      contextSwitchesCount: events.length,
      longestFocusStreakSeconds: 5220,
      distractionCount,
      focusPercentage,
      sheldonScore,
      categoryBreakdown: [
        { category: 'Dev', seconds: 19380, percentage: 56.9 },
        { category: 'Design', seconds: 5160, percentage: 15.2 },
        { category: 'Deep Work', seconds: 4560, percentage: 13.4 },
        { category: 'Comunicação', seconds: 2520, percentage: 7.4 },
        { category: 'Distração', seconds: 1800, percentage: 5.3 },
      ],
      topProjects: [
        { projectName: 'sheldon-focus', category: 'Dev', totalSeconds: 12000, activeInputSeconds: 9840, sessionCount: 3 },
        { projectName: 'Sheldon Metrics 24h UI', category: 'Design', totalSeconds: 5160, activeInputSeconds: 4231, sessionCount: 1 },
        { projectName: 'sheldon/focus', category: 'Dev', totalSeconds: 4680, activeInputSeconds: 3837, sessionCount: 1 },
      ],
    },
    topApps,
    events,
  };
}
