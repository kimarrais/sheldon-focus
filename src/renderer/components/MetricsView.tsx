import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  ExternalLink,
  FileCode2,
  Filter,
  Flame,
  FolderGit2,
  Globe,
  Keyboard,
  Layers,
  LogOut,
  MousePointerClick,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ActivityEventRecord,
  ActivityEventType,
  ActivityRecord,
  CategoryRule,
  MetricsSummary,
  ReclassifyActivityPayload,
  RuleMatchField,
  SupabaseSyncStatus,
  TopAppStat,
  TrackableCategory,
  TrackerStatus,
  WarningLogItem,
} from '@shared/types';
import { SHELDON_MOODS } from '@/lib/sheldon-moods';
import {
  CATEGORY_THEMES,
  buildPreviewDemoMetrics,
  coalesceBlocksForTrack,
  computeTimelineBlocksGeometry,
  formatClockHHMM,
  formatClockHHMMSS,
  formatCompactCount,
  formatDurationCompact,
  formatDurationMinutes,
  formatReadableDate,
  getAppVisualToken,
  getDayMidnightBounds,
  getTodayDateString,
  shiftDateString,
  type PositionedTimelineBlock,
} from '@/lib/metrics-utils';
import { BlackMirrorTab } from '@/components/Tabs/BlackMirrorTab';

type TimelinePreset = '24h' | 'active' | 'morning' | 'afternoon' | 'night';

interface MetricsViewProps {
  warnings?: WarningLogItem[];
  onSimulateViolation?: () => void;
}

const ALL_CATEGORIES: TrackableCategory[] = [
  'Deep Work',
  'Dev',
  'Design',
  'Comunicação',
  'Neutro',
  'Distração',
  'Idle',
];

const TRACK_LANES: Array<{
  id: 'focus' | 'neutral' | 'distraction' | 'idle';
  label: string;
  dotColor: string;
  categories: TrackableCategory[];
}> = [
  {
    id: 'focus',
    label: 'Deep Work / Dev / Design',
    dotColor: '#7C3AED',
    categories: ['Deep Work', 'Dev', 'Design'],
  },
  {
    id: 'neutral',
    label: 'Comunicação & Neutro',
    dotColor: '#3B82F6',
    categories: ['Comunicação', 'Neutro'],
  },
  {
    id: 'distraction',
    label: 'Distrações',
    dotColor: '#EF4444',
    categories: ['Distração'],
  },
  {
    id: 'idle',
    label: 'Ocioso / Pausas',
    dotColor: '#475569',
    categories: ['Idle'],
  },
];

const EVENT_TYPE_LABELS: Record<
  ActivityEventType,
  { label: string; colorClass: string }
> = {
  window_switch: {
    label: 'Troca de Janela',
    colorClass: 'bg-blue-500/12 text-blue-600 dark:text-blue-300 border-blue-500/30',
  },
  url_change: {
    label: 'Nova URL',
    colorClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-300 border-violet-500/30',
  },
  file_change: {
    label: 'Arquivo / Aba',
    colorClass: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
  },
  idle_start: {
    label: 'Início Pausa',
    colorClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  },
  idle_end: {
    label: 'Retorno Ativo',
    colorClass: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  },
};

/* ------------------------------------------------------------------ */
/* Native OS Icon & Site Favicon Cache                                 */
/* ------------------------------------------------------------------ */

const rendererExeIconCache = new Map<string, string | null>();
const inflightIconPromises = new Map<string, Promise<string | null>>();

function fetchCachedExeIcon(processPath: string): Promise<string | null> {
  const key = processPath.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (rendererExeIconCache.has(key)) {
    return Promise.resolve(rendererExeIconCache.get(key) ?? null);
  }
  const existing = inflightIconPromises.get(key);
  if (existing) return existing;

  const api = window.sheldonAPI;
  if (!api?.getAppIcon) return Promise.resolve(null);

  const p = api
    .getAppIcon(processPath)
    .then((dataUrl) => {
      rendererExeIconCache.set(key, dataUrl);
      inflightIconPromises.delete(key);
      return dataUrl;
    })
    .catch(() => {
      rendererExeIconCache.set(key, null);
      inflightIconPromises.delete(key);
      return null;
    });

  inflightIconPromises.set(key, p);
  return p;
}

const AppIconBadge: React.FC<{
  appName: string;
  domain: string | null;
  processPath?: string;
  size?: 'sm' | 'md';
}> = React.memo(({ appName, domain, processPath = '', size = 'md' }) => {
  const [exeIcon, setExeIcon] = useState<string | null>(() => {
    const key = processPath.trim().toLowerCase();
    return key ? rendererExeIconCache.get(key) ?? null : null;
  });
  const [faviconFailed, setFaviconFailed] = useState<boolean>(false);

  useEffect(() => {
    setFaviconFailed(false);
  }, [domain]);

  useEffect(() => {
    let active = true;
    if (!processPath) {
      setExeIcon(null);
      return;
    }
    const key = processPath.trim().toLowerCase();
    if (rendererExeIconCache.has(key)) {
      setExeIcon(rendererExeIconCache.get(key) ?? null);
      return;
    }
    void fetchCachedExeIcon(processPath).then((res) => {
      if (active) setExeIcon(res);
    });
    return () => {
      active = false;
    };
  }, [processPath]);

  const token = getAppVisualToken(appName, domain);
  const dim =
    size === 'sm' ? 'w-7 h-7 text-[10px] rounded-lg' : 'w-9 h-9 text-[11px] rounded-xl';
  const imgDim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  // Prefer crisp website favicon for web domains (ignoring localhost ports)
  const cleanHost = domain ? domain.split(':')[0] : null;
  const showFavicon =
    Boolean(cleanHost) &&
    cleanHost !== 'localhost' &&
    cleanHost !== '127.0.0.1' &&
    !faviconFailed;

  if (showFavicon && cleanHost) {
    return (
      <div
        className={`${dim} bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 border border-border/70 overflow-hidden`}
      >
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
            cleanHost
          )}&sz=64`}
          alt={cleanHost}
          onError={() => setFaviconFailed(true)}
          className={`${imgDim} object-contain rounded-xs`}
        />
      </div>
    );
  }

  if (exeIcon) {
    return (
      <div
        className={`${dim} bg-secondary/80 flex items-center justify-center shrink-0 border border-border/70 overflow-hidden`}
      >
        <img
          src={exeIcon}
          alt={appName}
          className={`${imgDim} object-contain`}
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim} ${token.bg} ${token.fg} font-mono font-extrabold flex items-center justify-center shrink-0 border border-border/60`}
    >
      {token.abbr}
    </div>
  );
});
AppIconBadge.displayName = 'AppIconBadge';

const SheldonScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const ringColor =
    clamped >= 75 ? '#7C3AED' : clamped >= 50 ? '#3B82F6' : '#EF4444';

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-border/70"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-extrabold font-mono tabular-nums text-foreground">
        {clamped}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 24h Rize-Style Interactive Timeline                                */
/* ------------------------------------------------------------------ */

interface HoveredBlockState {
  block: ActivityRecord;
  clientX: number;
  clientY: number;
}

interface Timeline24hSectionProps {
  date: string;
  blocks: ActivityRecord[];
  selectedAppFilter: string | null;
  selectedProjectFilter: string | null;
  onSelectBlock: (block: ActivityRecord) => void;
}

const Timeline24hSection: React.FC<Timeline24hSectionProps> = React.memo(
  ({
    date,
    blocks,
    selectedAppFilter,
    selectedProjectFilter,
    onSelectBlock,
  }) => {
    const [preset, setPreset] = useState<TimelinePreset>('active');
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [hovered, setHovered] = useState<HoveredBlockState | null>(null);
    const [nowMs, setNowMs] = useState<number>(() => Date.now());
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const id = setInterval(() => setNowMs(Date.now()), 30_000);
      return () => clearInterval(id);
    }, []);

    const { startMs: dayStartMs, endMs: dayEndMs } = useMemo(
      () => getDayMidnightBounds(date),
      [date]
    );

    const { rangeStartMs, rangeEndMs, startHour, endHour } = useMemo(() => {
      const hourMs = 3600 * 1000;
      if (preset === '24h') {
        return {
          rangeStartMs: dayStartMs,
          rangeEndMs: dayEndMs,
          startHour: 0,
          endHour: 24,
        };
      }
      if (preset === 'morning') {
        return {
          rangeStartMs: dayStartMs + 6 * hourMs,
          rangeEndMs: dayStartMs + 13 * hourMs,
          startHour: 6,
          endHour: 13,
        };
      }
      if (preset === 'afternoon') {
        return {
          rangeStartMs: dayStartMs + 12 * hourMs,
          rangeEndMs: dayStartMs + 19 * hourMs,
          startHour: 12,
          endHour: 19,
        };
      }
      if (preset === 'night') {
        return {
          rangeStartMs: dayStartMs + 18 * hourMs,
          rangeEndMs: dayEndMs,
          startHour: 18,
          endHour: 24,
        };
      }

      if (blocks.length === 0) {
        return {
          rangeStartMs: dayStartMs + 8 * hourMs,
          rangeEndMs: dayStartMs + 20 * hourMs,
          startHour: 8,
          endHour: 20,
        };
      }
      const earliest = blocks[0].startTime;
      const latest = blocks[blocks.length - 1].endTime;
      const firstH = Math.max(
        0,
        Math.floor((earliest - dayStartMs) / hourMs) - 1
      );
      const lastH = Math.min(
        24,
        Math.max(firstH + 4, Math.ceil((latest - dayStartMs) / hourMs) + 1)
      );
      return {
        rangeStartMs: dayStartMs + firstH * hourMs,
        rangeEndMs: dayStartMs + lastH * hourMs,
        startHour: firstH,
        endHour: lastH,
      };
    }, [preset, blocks, dayStartMs, dayEndMs]);

    const hourTicks = useMemo(() => {
      const ticks: number[] = [];
      const step = endHour - startHour > 14 && zoomLevel === 1 ? 2 : 1;
      for (let h = startHour; h <= endHour; h += step) {
        ticks.push(h);
      }
      return ticks;
    }, [startHour, endHour, zoomLevel]);

    const coalescedBlocks = useMemo(
      () => coalesceBlocksForTrack(blocks),
      [blocks]
    );

    const masterPositioned = useMemo(
      () => computeTimelineBlocksGeometry(coalescedBlocks, rangeStartMs, rangeEndMs),
      [coalescedBlocks, rangeStartMs, rangeEndMs]
    );

    const lanePositionedMap = useMemo(() => {
      const result: Record<string, PositionedTimelineBlock[]> = {};
      for (const lane of TRACK_LANES) {
        const laneSet = new Set(lane.categories);
        result[lane.id] = masterPositioned.filter((item) =>
          laneSet.has(item.block.category)
        );
      }
      return result;
    }, [masterPositioned]);

    const isToday = date === getTodayDateString();
    const nowMarkerPercent =
      isToday && nowMs >= rangeStartMs && nowMs <= rangeEndMs
        ? ((nowMs - rangeStartMs) / Math.max(1, rangeEndMs - rangeStartMs)) * 100
        : null;

    const handleBlockHover = useCallback(
      (block: ActivityRecord, e: React.MouseEvent<HTMLButtonElement>) => {
        setHovered({
          block,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      },
      []
    );

    const matchesFilter = useCallback(
      (block: ActivityRecord) => {
        if (selectedAppFilter) {
          const key = (block.domain || block.appName).toLowerCase();
          if (key !== selectedAppFilter.toLowerCase()) return false;
        }
        if (selectedProjectFilter) {
          if (
            (block.projectName || '').toLowerCase() !==
            selectedProjectFilter.toLowerCase()
          ) {
            return false;
          }
        }
        return true;
      },
      [selectedAppFilter, selectedProjectFilter]
    );

    const tooltipPosition = useMemo(() => {
      if (!hovered) return { left: 0, top: 0 };
      const width = 340;
      const height = 192;
      const pad = 16;
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

      let left = hovered.clientX + 14;
      if (left + width + pad > winW) {
        left = Math.max(pad, hovered.clientX - width - 14);
      }
      let top = hovered.clientY - height - 14;
      if (top < pad) {
        top = Math.min(winH - height - pad, hovered.clientY + 18);
      }
      return { left, top };
    }, [hovered]);

    return (
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        {/* Timeline Header & Zoom Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-300">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-[15px] font-bold text-foreground tracking-tight">
                Linha do Tempo de Atividade Contínua (24h)
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                {String(startHour).padStart(2, '0')}:00 – {String(endHour).padStart(2, '0')}:00
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Passe o mouse para ver URL exata, projeto/arquivo e cadência ativa. Clique em qualquer bloco para inspecionar ou reclassificar.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center p-1 rounded-xl bg-secondary border border-border text-xs">
              {(
                [
                  { id: 'active', label: 'Horas Ativas' },
                  { id: '24h', label: '24h' },
                  { id: 'morning', label: 'Manhã' },
                  { id: 'afternoon', label: 'Tarde' },
                  { id: 'night', label: 'Noite' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreset(item.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    preset === item.id
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary border border-border">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                title="Reduzir zoom"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-40 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 text-foreground tabular-nums">
                {zoomLevel.toFixed(1)}x
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(4, z + 0.5))}
                disabled={zoomLevel >= 4}
                title="Ampliar zoom"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-40 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Semantic Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-muted-foreground pb-1 border-b border-border/60">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" />
              Deep Work / Dev / Design
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6]" />
              Comunicação / Neutro
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
              Distrações
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#475569]" />
              Ocioso / Pausas
            </span>
          </div>
          <span className="font-mono text-[11px]">
            {masterPositioned.length} blocos renderizados
          </span>
        </div>

        {/* Scrollable 24h Canvas */}
        <div ref={scrollRef} className="w-full overflow-x-auto sheldon-scroll pb-2">
          <div
            style={{ width: `${zoomLevel * 100}%`, minWidth: '720px' }}
            className="space-y-2.5 relative"
          >
            {/* Hour Tick Ruler */}
            <div className="relative h-6 border-b border-border/80 select-none">
              {hourTicks.map((h) => {
                const tickMs = dayStartMs + h * 3600 * 1000;
                const leftPct =
                  ((tickMs - rangeStartMs) / Math.max(1, rangeEndMs - rangeStartMs)) * 100;
                const isLast = h === endHour;
                return (
                  <div
                    key={h}
                    style={{
                      left: `${leftPct}%`,
                      transform: isLast
                        ? 'translateX(-100%)'
                        : leftPct > 0
                        ? 'translateX(-50%)'
                        : 'none',
                    }}
                    className="absolute top-0 text-[10px] font-mono text-muted-foreground tabular-nums"
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                );
              })}
            </div>

            {/* Master Continuous Chronological Track */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground">
                  Fluxo Contínuo do Dia
                </span>
                {(selectedAppFilter || selectedProjectFilter) && (
                  <span className="text-[11px] font-mono text-violet-600 dark:text-violet-300">
                    Destacando: {selectedProjectFilter || selectedAppFilter}
                  </span>
                )}
              </div>

              <div className="relative h-12 w-full rounded-xl bg-secondary/75 border border-border overflow-hidden">
                {hourTicks.map((h) => {
                  const tickMs = dayStartMs + h * 3600 * 1000;
                  const leftPct =
                    ((tickMs - rangeStartMs) / Math.max(1, rangeEndMs - rangeStartMs)) * 100;
                  return (
                    <div
                      key={`grid-master-${h}`}
                      style={{ left: `${leftPct}%` }}
                      className="absolute top-0 bottom-0 w-px bg-border/60 pointer-events-none"
                    />
                  );
                })}

                {masterPositioned.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    Nenhuma atividade registrada neste intervalo.
                  </div>
                ) : (
                  masterPositioned.map((item, idx) => {
                    const theme = CATEGORY_THEMES[item.block.category];
                    const isMatch = matchesFilter(item.block);
                    return (
                      <button
                        key={`master-${item.block.id}-${item.block.startTime}-${idx}`}
                        type="button"
                        onClick={() => onSelectBlock(item.block)}
                        onMouseEnter={(e) => handleBlockHover(item.block, e)}
                        onMouseMove={(e) => handleBlockHover(item.block, e)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          left: `${item.leftPercent}%`,
                          width: `${item.widthPercent}%`,
                          minWidth: '3px',
                          background: theme.barGradient,
                        }}
                        className={`absolute top-1 bottom-1 rounded-[6px] border border-white/20 transition-all cursor-pointer flex items-center px-1.5 overflow-hidden text-left ${
                          isMatch
                            ? 'opacity-95 hover:opacity-100 hover:brightness-110 hover:z-20 hover:ring-2 hover:ring-white/80'
                            : 'opacity-20'
                        }`}
                      >
                        {item.widthPercent > 5 && (
                          <span className="text-[10px] font-bold text-white truncate drop-shadow-xs">
                            {item.block.projectName || item.block.domain || item.block.appName}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}

                {nowMarkerPercent !== null && (
                  <div
                    style={{ left: `${nowMarkerPercent}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-[#FB7213] z-30 pointer-events-none shadow-[0_0_8px_rgba(251,114,19,0.75)]"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#FB7213] -translate-x-[3px] -translate-y-0.5" />
                  </div>
                )}
              </div>
            </div>

            {/* Stacked Category Swimlanes */}
            <div className="space-y-1.5 pt-1">
              {TRACK_LANES.map((lane) => {
                const items = lanePositionedMap[lane.id] || [];
                const laneSeconds = items.reduce(
                  (acc, it) =>
                    acc + Math.max(1, Math.round((it.clampedEnd - it.clampedStart) / 1000)),
                  0
                );

                return (
                  <div key={lane.id} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-3 xl:col-span-2 flex items-center justify-between gap-1.5 pr-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: lane.dotColor }}
                        />
                        <span className="text-[11px] font-medium text-muted-foreground truncate">
                          {lane.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                        {formatDurationCompact(laneSeconds)}
                      </span>
                    </div>

                    <div className="col-span-9 xl:col-span-10 relative h-7 rounded-lg bg-secondary/45 border border-border/70 overflow-hidden">
                      {hourTicks.map((h) => {
                        const tickMs = dayStartMs + h * 3600 * 1000;
                        const leftPct =
                          ((tickMs - rangeStartMs) / Math.max(1, rangeEndMs - rangeStartMs)) * 100;
                        return (
                          <div
                            key={`grid-${lane.id}-${h}`}
                            style={{ left: `${leftPct}%` }}
                            className="absolute top-0 bottom-0 w-px bg-border/45 pointer-events-none"
                          />
                        );
                      })}

                      {items.map((item, idx) => {
                        const theme = CATEGORY_THEMES[item.block.category];
                        const isMatch = matchesFilter(item.block);
                        return (
                          <button
                            key={`lane-${lane.id}-${item.block.id}-${item.block.startTime}-${idx}`}
                            type="button"
                            onClick={() => onSelectBlock(item.block)}
                            onMouseEnter={(e) => handleBlockHover(item.block, e)}
                            onMouseMove={(e) => handleBlockHover(item.block, e)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                              left: `${item.leftPercent}%`,
                              width: `${item.widthPercent}%`,
                              minWidth: '3px',
                              backgroundColor: theme.barColor,
                            }}
                            className={`absolute top-1 bottom-1 rounded-[4px] transition-all cursor-pointer ${
                              isMatch
                                ? 'opacity-90 hover:opacity-100 hover:brightness-110 hover:z-20'
                                : 'opacity-20'
                            }`}
                          />
                        );
                      })}

                      {nowMarkerPercent !== null && (
                        <div
                          style={{ left: `${nowMarkerPercent}%` }}
                          className="absolute top-0 bottom-0 w-px bg-[#FB7213]/70 z-20 pointer-events-none"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Surgical Floating Tooltip */}
        {hovered && (
          <div
            style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
            className="fixed z-50 w-[340px] pointer-events-none rounded-2xl border border-slate-700/75 bg-slate-950/95 text-slate-100 p-3.5 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start gap-2.5">
              <AppIconBadge
                appName={hovered.block.appName}
                domain={hovered.block.domain}
                processPath={hovered.block.processPath}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">
                    {hovered.block.appName}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${CATEGORY_THEMES[hovered.block.category].barColor}33`,
                      color: '#F8FAFC',
                      border: `1px solid ${CATEGORY_THEMES[hovered.block.category].barColor}88`,
                    }}
                  >
                    {hovered.block.category}
                  </span>
                </div>

                {(hovered.block.url || hovered.block.domain) && (
                  <div className="text-[11px] font-mono text-violet-300 truncate mt-0.5">
                    {hovered.block.url || hovered.block.domain}
                  </div>
                )}

                {(hovered.block.projectName || hovered.block.fileName) && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-sky-300 mt-1 truncate">
                    {hovered.block.projectName && (
                      <span>📁 {hovered.block.projectName}</span>
                    )}
                    {hovered.block.fileName && (
                      <span className="truncate">📄 {hovered.block.fileName}</span>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 leading-snug">
                  {hovered.block.windowTitle || hovered.block.appName}
                </p>

                {hovered.block.category !== 'Idle' && (
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-400">
                    <span>
                      Ativo: <b className="text-emerald-300">{formatDurationCompact(hovered.block.activeInputSeconds)}</b>
                    </span>
                    <span>
                      Passivo: <b className="text-slate-200">{formatDurationCompact(hovered.block.passiveSeconds)}</b>
                    </span>
                    <span>
                      ⌨ {formatCompactCount(hovered.block.keystrokesCount)} • 🖱{' '}
                      {formatCompactCount(hovered.block.mouseClicksCount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-300">
                    {formatClockHHMMSS(hovered.block.startTime)} –{' '}
                    {formatClockHHMMSS(hovered.block.endTime)}
                  </span>
                  <span className="font-bold text-emerald-300">
                    {formatDurationMinutes(hovered.block.durationSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }
);
Timeline24hSection.displayName = 'Timeline24hSection';

/* ------------------------------------------------------------------ */
/* Surgical Block Inspector & Reclassify Modal                         */
/* ------------------------------------------------------------------ */

interface ReclassifyModalProps {
  block: ActivityRecord;
  onClose: () => void;
  onConfirm: (payload: ReclassifyActivityPayload) => Promise<void>;
}

const ReclassifyModal: React.FC<ReclassifyModalProps> = ({
  block,
  onClose,
  onConfirm,
}) => {
  const [category, setCategory] = useState<TrackableCategory>(block.category);
  const [applyToday, setApplyToday] = useState<boolean>(true);
  const [createRule, setCreateRule] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const handleSave = async (
    chosenCategory: TrackableCategory,
    isProductiveOverride?: boolean
  ) => {
    setSaving(true);
    try {
      await onConfirm({
        id: block.id,
        category: chosenCategory,
        isProductive: isProductiveOverride,
        applyToSameTargetToday: applyToday,
        createRule,
        matchField: block.domain ? 'domain' : 'app_name',
        pattern: block.domain || block.appName,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto sheldon-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AppIconBadge
              appName={block.appName}
              domain={block.domain}
              processPath={block.processPath}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">
                Inspetor Cirúrgico &amp; Reclassificação
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {block.appName}
                {block.executableName ? ` (${block.executableName} • PID ${block.processId})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full Surgical Telemetry Box */}
        <div className="p-3.5 rounded-xl bg-secondary/70 border border-border text-xs space-y-2">
          <div className="font-semibold text-foreground break-words">
            {block.windowTitle || block.appName}
          </div>

          {block.url && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-violet-600 dark:text-violet-300 break-all">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{block.url}</span>
            </div>
          )}

          {(block.projectName || block.fileName) && (
            <div className="flex items-center flex-wrap gap-3 text-[11px] font-mono text-foreground">
              {block.projectName && (
                <span className="inline-flex items-center gap-1">
                  <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                  {block.projectName}
                </span>
              )}
              {block.fileName && (
                <span className="inline-flex items-center gap-1">
                  <FileCode2 className="w-3.5 h-3.5 text-sky-500" />
                  {block.fileName}
                </span>
              )}
            </div>
          )}

          {block.processPath && (
            <div className="text-[10px] font-mono text-muted-foreground truncate" title={block.processPath}>
              Binário: {block.processPath}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 font-mono text-[11px]">
            <div>
              <div className="text-[10px] text-muted-foreground">Janela exata</div>
              <div className="font-bold text-foreground">
                {formatClockHHMMSS(block.startTime)}–{formatClockHHMMSS(block.endTime)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Ativo vs Passivo</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-300">
                {formatDurationCompact(block.activeInputSeconds)} /{' '}
                {formatDurationCompact(block.passiveSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Interações</div>
              <div className="font-bold text-foreground">
                ⌨ {block.keystrokesCount} • 🖱 {block.mouseClicksCount}
              </div>
            </div>
          </div>
        </div>

        {/* 1-Click Focus vs Distraction Shortcuts */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave('Deep Work', true)}
            className="px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Marcar como Foco</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave('Distração', false)}
            className="px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 border border-red-500/35 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Marcar Distração</span>
          </button>
        </div>

        {/* Category Picker */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Ou escolha uma categoria específica
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const theme = CATEGORY_THEMES[cat];
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                    active
                      ? 'border-violet-500 bg-violet-500/12 text-foreground ring-1 ring-violet-500/40'
                      : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: theme.barColor }}
                  />
                  <span className="truncate">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-foreground">
            <input
              type="checkbox"
              checked={applyToday}
              onChange={(e) => setApplyToday(e.target.checked)}
              className="rounded border-border accent-violet-600"
            />
            <span>Aplicar para todas as sessões de "{block.domain || block.appName}" hoje</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-foreground">
            <input
              type="checkbox"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="rounded border-border accent-violet-600"
            />
            <span>Salvar regra automática no SQLite para capturas futuras</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave(category)}
            className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Aplicar Categoria'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Category Rules Modal                                                */
/* ------------------------------------------------------------------ */

interface RulesModalProps {
  rules: CategoryRule[];
  onClose: () => void;
  onAddRule: (rule: Omit<CategoryRule, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteRule: (id: number) => Promise<void>;
}

const RulesModal: React.FC<RulesModalProps> = ({
  rules,
  onClose,
  onAddRule,
  onDeleteRule,
}) => {
  const [pattern, setPattern] = useState('');
  const [matchField, setMatchField] = useState<RuleMatchField>('domain');
  const [category, setCategory] = useState<TrackableCategory>('Deep Work');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    setBusy(true);
    try {
      await onAddRule({
        pattern: pattern.trim(),
        matchField,
        category,
        isProductive:
          category === 'Deep Work' || category === 'Dev' || category === 'Design',
        priority: 500,
        enabled: true,
      });
      setPattern('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[82vh] flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Tag className="w-4 h-4 text-violet-500" />
              <span>Regras Automáticas de Categorização (Regex)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suporta correspondência por Domínio, URL completa, App Name ou Título da Janela.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Regex (ex: youtube\.com/watch, supabase\.com, figma)"
            className="sm:col-span-5 px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          <select
            value={matchField}
            onChange={(e) => setMatchField(e.target.value as RuleMatchField)}
            className="sm:col-span-3 px-2.5 py-2 rounded-xl bg-secondary border border-border text-xs font-semibold text-foreground outline-none"
          >
            <option value="domain">Domínio</option>
            <option value="url">URL Completa</option>
            <option value="app_name">App Name</option>
            <option value="window_title">Título da Janela</option>
            <option value="any">Qualquer campo</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TrackableCategory)}
            className="sm:col-span-2 px-2.5 py-2 rounded-xl bg-secondary border border-border text-xs font-semibold text-foreground outline-none"
          >
            {ALL_CATEGORIES.filter((c) => c !== 'Idle').map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy || !pattern.trim()}
            className="sm:col-span-2 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll space-y-1.5 pr-1">
          {rules.map((rule) => {
            const theme = CATEGORY_THEMES[rule.category];
            return (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="px-2 py-0.5 rounded-md bg-card border border-border font-mono text-[10px] text-muted-foreground shrink-0">
                    {rule.matchField}
                  </span>
                  <span className="font-mono text-foreground truncate" title={rule.pattern}>
                    {rule.pattern}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                  >
                    {rule.category}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    p{rule.priority}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onDeleteRule(rule.id)}
                    title="Remover regra"
                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Supabase Cloud Sync & Auth Modal                                    */
/* ------------------------------------------------------------------ */

interface SupabaseSyncModalProps {
  status: SupabaseSyncStatus | null;
  onClose: () => void;
  onStatusUpdated: (status: SupabaseSyncStatus) => void;
}

const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  status,
  onClose,
  onStatusUpdated,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'otp'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = window.sheldonAPI;
    if (!api) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      if (mode === 'signin') {
        const res = await api.supabaseSignIn(email, password);
        onStatusUpdated(res.status);
        if (!res.ok) setErr(res.error || 'Falha no login');
        else setMsg('Conectado! Sincronização em nuvem iniciada.');
      } else if (mode === 'signup') {
        const res = await api.supabaseSignUp(email, password);
        onStatusUpdated(res.status);
        if (!res.ok) {
          setErr(res.error || 'Falha ao criar conta');
        } else if (res.needsEmailConfirmation) {
          setMsg('Verifique seu e-mail e digite o código OTP de 6 dígitos (ou clique no link).');
          setMode('otp');
        } else {
          setMsg('Conta criada e sincronizada com o Supabase!');
        }
      } else {
        const res = await api.supabaseVerifyOtp(email, otpToken);
        onStatusUpdated(res.status);
        if (!res.ok) setErr(res.error || 'Código inválido');
        else setMsg('E-mail verificado! Sincronização iniciada.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    const api = window.sheldonAPI;
    if (!api) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.supabaseSyncNow();
      onStatusUpdated(res.status);
      if (res.error) setErr(res.error);
      else setMsg(`${res.synced} registros sincronizados com PostgreSQL.`);
    } finally {
      setBusy(false);
    }
  };

  const handleAnonymous = async () => {
    const api = window.sheldonAPI;
    if (!api) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.supabaseSignInAnonymously();
      onStatusUpdated(res.status);
      if (!res.ok) {
        setErr(
          `${res.error || 'Login anônimo desativado'}. Você pode entrar com e-mail/senha abaixo ou habilitar "Allow anonymous sign-ins" no painel Supabase.`
        );
      } else {
        setMsg('Sessão anônima autenticada e sincronizada!');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    const api = window.sheldonAPI;
    if (!api) return;
    setBusy(true);
    try {
      const next = await api.supabaseSignOut();
      onStatusUpdated(next);
      setMsg('Desconectado da nuvem (dados locais continuam salvos em SQLite).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Supabase PostgreSQL • Cloud Sync
              </h3>
              <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[270px]">
                {status?.configured
                  ? status?.projectUrl || 'Configurado via .env'
                  : 'Não configurado (.env)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Queue Status Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/60 border border-border text-center">
          <div>
            <div className="text-[10px] text-muted-foreground">Sincronizados</div>
            <div className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-300">
              {status?.syncedActivitiesCount ?? 0}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Pendentes</div>
            <div className="text-sm font-extrabold font-mono text-amber-600 dark:text-amber-300">
              {(status?.pendingActivitiesCount ?? 0) + (status?.pendingEventsCount ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Dispositivo</div>
            <div className="text-[11px] font-mono font-bold text-foreground truncate px-1">
              {status?.deviceId || 'local'}
            </div>
          </div>
        </div>

        {status?.authenticated ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                Conectado como: {status.email || (status.isAnonymous ? 'Sessão Anônima' : status.userId)}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                Último sync:{' '}
                {status.lastSyncAt
                  ? formatClockHHMMSS(status.lastSyncAt)
                  : 'Aguardando primeiro envio'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSyncNow()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy || status.syncing ? 'animate-spin' : ''}`} />
                <span>Sincronizar Agora</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSignOut()}
                className="px-3 py-2.5 rounded-xl bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-red-500 flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="inline-flex w-full p-1 rounded-xl bg-secondary border border-border text-xs">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${
                  mode === 'signin'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${
                  mode === 'signup'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground'
                }`}
              >
                Criar Conta
              </button>
              <button
                type="button"
                onClick={() => setMode('otp')}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${
                  mode === 'otp'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground'
                }`}
              >
                Código OTP
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {mode === 'otp' ? (
                <input
                  type="text"
                  required
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  placeholder="Código de 6 dígitos enviado por e-mail"
                  className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              ) : (
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha (mín. 6 caracteres)"
                  className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {busy
                  ? 'Autenticando...'
                  : mode === 'signin'
                  ? 'Conectar e Sincronizar'
                  : mode === 'signup'
                  ? 'Criar Conta no Supabase'
                  : 'Confirmar Código'}
              </button>
            </form>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAnonymous()}
                className="text-[11px] font-semibold text-violet-600 dark:text-violet-300 hover:underline"
              >
                Tentar login anônimo rápido
              </button>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <span>Abrir Painel Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {msg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
            {msg}
          </div>
        )}
        {(err || status?.lastError) && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
            {err || status?.lastError}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main MetricsView Component                                          */
/* ------------------------------------------------------------------ */

export const MetricsView: React.FC<MetricsViewProps> = ({
  warnings = [],
  onSimulateViolation,
}) => {
  const [subView, setSubView] = useState<'telemetry' | 'black-mirror'>('telemetry');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [timeline, setTimeline] = useState<ActivityRecord[]>([]);
  const [events, setEvents] = useState<ActivityEventRecord[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [topApps, setTopApps] = useState<TopAppStat[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseSyncStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoPreview, setIsDemoPreview] = useState<boolean>(false);

  // Interactive UI states
  const [selectedAppFilter, setSelectedAppFilter] = useState<string | null>(null);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null);
  const [rightLogMode, setRightLogMode] = useState<'sessions' | 'events'>('sessions');
  const [logSearch, setLogSearch] = useState<string>('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<TrackableCategory | 'ALL'>('ALL');
  const [logDescending, setLogDescending] = useState<boolean>(true);
  const [hideMicroEntries, setHideMicroEntries] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<ActivityRecord | null>(null);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);

  const fetchMetrics = useCallback(async (targetDate: string, silent = false) => {
    if (!silent) setLoading(true);
    const api = window.sheldonAPI;

    if (!api?.getDayTimeline) {
      const demo = buildPreviewDemoMetrics(targetDate);
      setTimeline(demo.timeline);
      setSummary(demo.summary);
      setTopApps(demo.topApps);
      setEvents(demo.events);
      setIsDemoPreview(true);
      setLoading(false);
      return;
    }

    try {
      const [tl, sum, apps, evs, status, ruleList, sbStatus] = await Promise.all([
        api.getDayTimeline(targetDate),
        api.getMetricsSummary(targetDate),
        api.getTopApps(targetDate, 25),
        api.getDayEvents(targetDate, 200),
        api.getTrackerStatus(),
        api.getCategoryRules(),
        api.getSupabaseSyncStatus(),
      ]);
      setTimeline(tl);
      setSummary(sum);
      setTopApps(apps);
      setEvents(evs);
      setTrackerStatus(status);
      setRules(ruleList);
      setSupabaseStatus(sbStatus);
      setIsDemoPreview(false);
    } catch (err) {
      console.error('[MetricsView] Falha ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics(selectedDate);
  }, [selectedDate, fetchMetrics]);

  // Live updates via IPC + smooth 3s refresh when viewing Today
  useEffect(() => {
    const api = window.sheldonAPI;
    if (!api) return;

    const isViewingToday = selectedDate === getTodayDateString();
    const offMetrics = api.onMetricsUpdated?.((status) => {
      setTrackerStatus(status);
      if (isViewingToday) {
        void fetchMetrics(selectedDate, true);
      }
    });
    const offSupabase = api.onSupabaseStatusChanged?.((sb) => {
      setSupabaseStatus(sb);
    });

    const liveInterval = isViewingToday
      ? setInterval(() => {
          void fetchMetrics(selectedDate, true);
        }, 3000)
      : null;

    return () => {
      offMetrics?.();
      offSupabase?.();
      if (liveInterval) clearInterval(liveInterval);
    };
  }, [selectedDate, fetchMetrics]);

  const handleReclassifyConfirm = async (payload: ReclassifyActivityPayload) => {
    const api = window.sheldonAPI;
    if (!api?.reclassifyActivity) {
      setTimeline((prev) =>
        prev.map((b) =>
          b.id === payload.id
            ? {
                ...b,
                category: payload.category,
                isProductive:
                  typeof payload.isProductive === 'boolean'
                    ? payload.isProductive
                    : payload.category === 'Deep Work' ||
                      payload.category === 'Dev' ||
                      payload.category === 'Design',
              }
            : b
        )
      );
      return;
    }

    await api.reclassifyActivity(payload);
    await fetchMetrics(selectedDate, true);
  };

  const handleAddRule = async (rule: Omit<CategoryRule, 'id' | 'createdAt'>) => {
    if (!window.sheldonAPI?.upsertCategoryRule) return;
    const updated = await window.sheldonAPI.upsertCategoryRule(rule);
    setRules(updated);
  };

  const handleDeleteRule = async (id: number) => {
    if (!window.sheldonAPI?.deleteCategoryRule) return;
    const updated = await window.sheldonAPI.deleteCategoryRule(id);
    setRules(updated);
  };

  const filteredSessions = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    const list = timeline.filter((item) => {
      if (hideMicroEntries && item.durationSeconds < 10) return false;
      if (logCategoryFilter !== 'ALL' && item.category !== logCategoryFilter) return false;
      if (selectedAppFilter) {
        const key = (item.domain || item.appName).toLowerCase();
        if (key !== selectedAppFilter.toLowerCase()) return false;
      }
      if (selectedProjectFilter) {
        if (
          (item.projectName || '').toLowerCase() !==
          selectedProjectFilter.toLowerCase()
        ) {
          return false;
        }
      }
      if (q) {
        const hay = `${item.appName} ${item.domain || ''} ${item.url || ''} ${
          item.projectName || ''
        } ${item.fileName || ''} ${item.windowTitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return logDescending ? [...list].reverse() : list;
  }, [
    timeline,
    logSearch,
    logCategoryFilter,
    selectedAppFilter,
    selectedProjectFilter,
    logDescending,
    hideMicroEntries,
  ]);

  const filteredEvents = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return events.filter((ev) => {
      if (logCategoryFilter !== 'ALL' && ev.category !== logCategoryFilter) return false;
      if (selectedAppFilter) {
        const key = (ev.domain || ev.appName).toLowerCase();
        if (key !== selectedAppFilter.toLowerCase()) return false;
      }
      if (selectedProjectFilter) {
        if (
          (ev.projectName || '').toLowerCase() !==
          selectedProjectFilter.toLowerCase()
        ) {
          return false;
        }
      }
      if (q) {
        const hay = `${ev.appName} ${ev.domain || ''} ${ev.url || ''} ${
          ev.projectName || ''
        } ${ev.fileName || ''} ${ev.windowTitle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, logSearch, logCategoryFilter, selectedAppFilter, selectedProjectFilter]);

  const scoreInfo = useMemo(() => {
    const score = summary?.sheldonScore ?? 0;
    if (!summary || summary.totalActiveSeconds === 0) {
      return {
        label: 'Aguardando Dados',
        avatar: SHELDON_MOODS.neutral.avatar,
        tone: 'text-muted-foreground',
      };
    }
    if (score >= 82) {
      return {
        label: 'Foco Cirúrgico',
        avatar: SHELDON_MOODS.cool.avatar,
        tone: 'text-violet-600 dark:text-violet-300',
      };
    }
    if (score >= 60) {
      return {
        label: 'Ritmo Consistente',
        avatar: SHELDON_MOODS.happy.avatar,
        tone: 'text-blue-600 dark:text-blue-300',
      };
    }
    if (score >= 40) {
      return {
        label: 'Atenção Fragmentada',
        avatar: SHELDON_MOODS.crying.avatar,
        tone: 'text-amber-600 dark:text-amber-300',
      };
    }
    return {
      label: 'Procrastinação Crítica',
      avatar: SHELDON_MOODS.angry.avatar,
      tone: 'text-red-600 dark:text-red-300',
    };
  }, [summary]);

  if (subView === 'black-mirror') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center p-1 rounded-xl bg-secondary border border-border text-xs">
            <button
              type="button"
              onClick={() => setSubView('telemetry')}
              className="px-3 py-1.5 rounded-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Telemetria 24h (Rize)
            </button>
            <button
              type="button"
              onClick={() => setSubView('black-mirror')}
              className="px-3 py-1.5 rounded-lg font-bold bg-card text-foreground shadow-xs border border-border/60"
            >
              Auditoria Black Mirror ({warnings.length})
            </button>
          </div>
        </div>
        <BlackMirrorTab
          warnings={warnings}
          timelineBlocks={[]}
          onSimulateViolation={onSimulateViolation || (() => {})}
        />
      </div>
    );
  }

  const totalActiveSec = summary?.totalActiveSeconds ?? 0;
  const productiveSec = summary?.productiveSeconds ?? 0;
  const distractionSec = summary?.distractionSeconds ?? 0;
  const idleSec = summary?.idleSeconds ?? 0;
  const focusPct = summary?.focusPercentage ?? 0;
  const distractionCount = summary?.distractionCount ?? 0;
  const score = summary?.sheldonScore ?? 0;
  const activeInputSec = summary?.activeInputSeconds ?? 0;
  const passiveSec = summary?.passiveSeconds ?? 0;
  const inputActiveRatio =
    totalActiveSec > 0 ? Math.min(100, Math.round((activeInputSec / totalActiveSec) * 100)) : 0;
  const isToday = selectedDate === getTodayDateString();

  return (
    <div className="space-y-5 pb-6 select-none">
      {/* Browser Preview Alert */}
      {isDemoPreview && (
        <div className="p-3 rounded-xl bg-amber-500/12 border border-amber-500/35 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>
            <b>Modo Preview Web:</b> Para capturar 100% das suas janelas reais, URLs do navegador, cadência de input e sincronizar com o Supabase, abra pelo Electron (<code className="font-mono font-bold">npm run electron:dev</code>).
          </span>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              Métricas Cirúrgicas &amp; Linha do Tempo 24h
            </h1>

            {!isDemoPreview && trackerStatus?.running && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  trackerStatus.isIdle
                    ? 'bg-slate-500/15 border-slate-500/30 text-slate-600 dark:text-slate-300'
                    : 'bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    trackerStatus.isIdle ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                {trackerStatus.isIdle ? (
                  <span>Ausente / Pausa</span>
                ) : (
                  <span className="max-w-[300px] truncate">
                    Ao vivo:{' '}
                    {trackerStatus.currentSession?.domain ||
                      trackerStatus.currentSession?.appName ||
                      'Monitorando'}
                    {trackerStatus.currentSession?.fileName
                      ? ` • ${trackerStatus.currentSession.fileName}`
                      : ''}
                  </span>
                )}
              </span>
            )}

            {!isDemoPreview && !trackerStatus?.running && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-semibold text-muted-foreground">
                <PauseCircle className="w-3 h-3" />
                Rastreamento Pausado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Captura Win32 + URL real (UIAutomation) + cadência de input + SQLite local + PostgreSQL Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Supabase Cloud Sync Pill */}
          {!isDemoPreview && (
            <button
              type="button"
              onClick={() => setShowSupabaseModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                supabaseStatus?.authenticated
                  ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-secondary border-border text-foreground hover:bg-card'
              }`}
            >
              {supabaseStatus?.authenticated ? (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>
                    Supabase ({supabaseStatus.syncedActivitiesCount} sync)
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Conectar Supabase</span>
                </>
              )}
            </button>
          )}

          {/* Date Selector */}
          <div className="inline-flex items-center rounded-xl bg-secondary border border-border p-1 gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateString(d, -1))}
              title="Dia anterior"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <label className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-card cursor-pointer text-xs font-semibold text-foreground transition-colors">
              <Calendar className="w-3.5 h-3.5 text-violet-500" />
              <span>{formatReadableDate(selectedDate)}</span>
              <input
                type="date"
                value={selectedDate}
                max={getTodayDateString()}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>

            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateString(d, 1))}
              disabled={isToday}
              title="Próximo dia"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-35 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fetchMetrics(selectedDate)}
            title="Atualizar métricas"
            className="p-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isDemoPreview && (
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-semibold text-foreground hover:bg-card transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5 text-violet-500" />
              <span>Regras ({rules.length})</span>
            </button>
          )}

          <div className="inline-flex items-center p-1 rounded-xl bg-secondary border border-border text-xs">
            <button
              type="button"
              onClick={() => setSubView('telemetry')}
              className="px-2.5 py-1 rounded-lg font-bold bg-card text-foreground shadow-xs border border-border/60"
            >
              Telemetria 24h
            </button>
            <button
              type="button"
              onClick={() => setSubView('black-mirror')}
              className="px-2.5 py-1 rounded-lg font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#FB7213]" />
              <span>Infrações ({warnings.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Tempo Total Ativo + Cadência Ativo vs Passivo */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between gap-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Tempo Total Ativo
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/12 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl xl:text-[26px] font-extrabold font-mono tabular-nums text-foreground">
                {formatDurationCompact(totalActiveSec)}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Ocioso: {formatDurationCompact(idleSec)}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-300 font-semibold">
                  Interação real: {inputActiveRatio}% ({formatDurationCompact(activeInputSec)})
                </span>
                <span>Leitura: {formatDurationCompact(passiveSec)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${inputActiveRatio}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Foco Profundo / Produtivo */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between gap-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Foco Profundo / Produtivo
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/12 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-300">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl xl:text-[26px] font-extrabold font-mono tabular-nums text-violet-600 dark:text-violet-300">
                {formatDurationCompact(productiveSec)}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-500/12 text-violet-700 dark:text-violet-300 font-mono">
                {focusPct}% do dia
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
              <span>Maior streak: {formatDurationCompact(summary?.longestFocusStreakSeconds ?? 0)}</span>
              <span>{summary?.contextSwitchesCount ?? 0} trocas</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(100, focusPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Tempo em Distrações */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between gap-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Tempo em Distrações
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center text-red-600 dark:text-red-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl xl:text-[26px] font-extrabold font-mono tabular-nums text-red-600 dark:text-red-400">
              {formatDurationCompact(distractionSec)}
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1.5">
              <span className="font-semibold text-orange-600 dark:text-orange-300">
                {distractionCount}{' '}
                {distractionCount === 1 ? 'interrupção' : 'interrupções'}
              </span>
              <span className="text-muted-foreground font-mono">
                {totalActiveSec > 0
                  ? `${Math.round((distractionSec / totalActiveSec) * 100)}% do ativo`
                  : '0%'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mt-1.5">
              <span className="inline-flex items-center gap-1">
                <Keyboard className="w-3 h-3" />
                {formatCompactCount(summary?.keystrokesCount ?? 0)} teclas
              </span>
              <span className="inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" />
                {formatCompactCount(summary?.mouseClicksCount ?? 0)} cliques
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Pontuação de Foco do Sheldon */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0 space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              Pontuação do Sheldon
            </span>
            <div className={`text-sm font-extrabold truncate ${scoreInfo.tone}`}>
              {scoreInfo.label}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <img
                src={scoreInfo.avatar}
                alt="Sheldon Mood"
                className="w-5 h-5 rounded-md object-contain"
              />
              <span>Foco vs. Distração</span>
            </div>
          </div>
          <SheldonScoreRing score={score} />
        </div>
      </div>

      {/* Top Detected Projects / Workspaces Bar */}
      {summary && summary.topProjects.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground inline-flex items-center gap-1.5 mr-1">
            <FolderGit2 className="w-3.5 h-3.5 text-violet-500" />
            Projetos &amp; Workspaces:
          </span>
          {summary.topProjects.map((proj) => {
            const active =
              selectedProjectFilter?.toLowerCase() === proj.projectName.toLowerCase();
            return (
              <button
                key={proj.projectName}
                type="button"
                onClick={() =>
                  setSelectedProjectFilter((prev) =>
                    prev?.toLowerCase() === proj.projectName.toLowerCase()
                      ? null
                      : proj.projectName
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                  active
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-secondary/60 border-border text-foreground hover:border-violet-500/50'
                }`}
              >
                <span className="truncate max-w-[180px]">{proj.projectName}</span>
                <span className={`font-mono text-[10px] ${active ? 'text-white/85' : 'text-muted-foreground'}`}>
                  {formatDurationCompact(proj.totalSeconds)}
                </span>
              </button>
            );
          })}
          {selectedProjectFilter && (
            <button
              type="button"
              onClick={() => setSelectedProjectFilter(null)}
              className="text-[11px] font-semibold text-violet-600 dark:text-violet-300 hover:underline ml-auto"
            >
              Limpar projeto ×
            </button>
          )}
        </div>
      )}

      {/* Giant Rize-Style 24h Calendar / Timeline Track */}
      <Timeline24hSection
        date={selectedDate}
        blocks={timeline}
        selectedAppFilter={selectedAppFilter}
        selectedProjectFilter={selectedProjectFilter}
        onSelectBlock={(block) => setEditingBlock(block)}
      />

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Top Apps & Sites */}
        <section className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 shadow-sm min-h-[400px] max-h-[580px]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" />
                <span>Top Apps &amp; Sites</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ícones nativos, tempo líquido, cadência de input e % do dia.
              </p>
            </div>
            {selectedAppFilter && (
              <button
                type="button"
                onClick={() => setSelectedAppFilter(null)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/12 text-violet-700 dark:text-violet-300 border border-violet-500/30 hover:bg-violet-500/20"
              >
                Limpar filtro ×
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll space-y-2.5 pr-1">
            {topApps.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Activity className="w-7 h-7 opacity-35 mb-2" />
                <span>Nenhum aplicativo registrado para este dia ainda.</span>
              </div>
            ) : (
              topApps.map((app) => {
                const theme = CATEGORY_THEMES[app.category];
                const isSelected =
                  selectedAppFilter?.toLowerCase() === app.key.toLowerCase();
                return (
                  <button
                    key={app.key}
                    type="button"
                    onClick={() =>
                      setSelectedAppFilter((prev) =>
                        prev?.toLowerCase() === app.key.toLowerCase() ? null : app.key
                      )
                    }
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/8 ring-1 ring-violet-500/30'
                        : 'border-border/80 bg-secondary/35 hover:bg-secondary/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AppIconBadge
                          appName={app.appName}
                          domain={app.domain}
                          processPath={app.processPath}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {app.domain || app.appName}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate font-mono">
                            {app.domain ? `${app.appName} • ` : ''}
                            {app.sessionCount}x • ⌨ {formatCompactCount(app.keystrokesCount)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                        >
                          {app.category}
                        </span>
                        <div className="text-right">
                          <div className="text-xs font-extrabold font-mono tabular-nums text-foreground">
                            {formatDurationCompact(app.totalSeconds)}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-muted-foreground">
                            {app.percentageOfActive.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(2, app.percentageOfActive))}%`,
                          background: theme.barGradient,
                        }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Consolidated Sessions OR Surgical Event Stream */}
        <section className="lg:col-span-7 rounded-2xl border border-border bg-card p-5 flex flex-col gap-3.5 shadow-sm min-h-[400px] max-h-[580px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center p-0.5 rounded-xl bg-secondary border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setRightLogMode('sessions')}
                  className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    rightLogMode === 'sessions'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Sessões ({filteredSessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightLogMode('events')}
                  className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    rightLogMode === 'events'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-violet-500" />
                  <span>Stream Cirúrgico ({filteredEvents.length})</span>
                </button>
              </div>
            </div>

            {rightLogMode === 'sessions' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHideMicroEntries((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    hideMicroEntries
                      ? 'bg-violet-500/12 border-violet-500/35 text-violet-700 dark:text-violet-300'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Ocultar &lt;10s
                </button>
                <button
                  type="button"
                  onClick={() => setLogDescending((v) => !v)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary border border-border text-foreground hover:bg-card"
                >
                  {logDescending ? 'Mais recentes ↓' : 'Cronológico ↑'}
                </button>
              </div>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Buscar app, URL exata, projeto, arquivo ou título..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/35"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <select
                value={logCategoryFilter}
                onChange={(e) =>
                  setLogCategoryFilter(e.target.value as TrackableCategory | 'ALL')
                }
                className="px-2.5 py-1.5 rounded-xl bg-secondary border border-border text-xs font-semibold text-foreground outline-none"
              >
                <option value="ALL">Todas categorias</option>
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List Body */}
          <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll space-y-1.5 pr-1">
            {rightLogMode === 'sessions' ? (
              filteredSessions.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                  <Clock className="w-7 h-7 opacity-35 mb-2" />
                  <span>Nenhuma sessão encontrada com os filtros atuais.</span>
                </div>
              ) : (
                filteredSessions.map((session, idx) => {
                  const theme = CATEGORY_THEMES[session.category];
                  return (
                    <div
                      key={`log-${session.id}-${session.startTime}-${idx}`}
                      onClick={() => setEditingBlock(session)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setEditingBlock(session);
                        }
                      }}
                      className="group p-2.5 rounded-xl border border-border/75 bg-secondary/25 hover:bg-secondary/70 hover:border-violet-500/40 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-[74px] shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatClockHHMM(session.startTime)}–{formatClockHHMM(session.endTime)}
                        </div>

                        <AppIconBadge
                          appName={session.appName}
                          domain={session.domain}
                          processPath={session.processPath}
                          size="sm"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {session.domain || session.appName}
                            </span>
                            {session.projectName && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 truncate max-w-[140px]">
                                {session.projectName}
                              </span>
                            )}
                            {session.fileName && (
                              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px] hidden sm:inline">
                                • {session.fileName}
                              </span>
                            )}
                            {session.isOngoing && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold">
                                Agora
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate font-mono">
                            {session.url || session.windowTitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                        >
                          {session.category}
                        </span>
                        <span className="w-14 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                          {formatDurationCompact(session.durationSeconds)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : filteredEvents.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Zap className="w-7 h-7 opacity-35 mb-2" />
                <span>Nenhum evento granular registrado neste dia ainda.</span>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const evBadge = EVENT_TYPE_LABELS[ev.eventType];
                const theme = CATEGORY_THEMES[ev.category];
                return (
                  <div
                    key={ev.clientEventId}
                    className="p-2.5 rounded-xl border border-border/75 bg-secondary/20 flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {formatClockHHMMSS(ev.occurredAt)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${evBadge.colorClass}`}
                      >
                        {evBadge.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground truncate">
                            {ev.domain || ev.appName}
                          </span>
                          {ev.fileName && (
                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-300 truncate">
                              • {ev.fileName}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {ev.url || ev.windowTitle}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                    >
                      {ev.category}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      {editingBlock && (
        <ReclassifyModal
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onConfirm={handleReclassifyConfirm}
        />
      )}

      {showRulesModal && (
        <RulesModal
          rules={rules}
          onClose={() => setShowRulesModal(false)}
          onAddRule={handleAddRule}
          onDeleteRule={handleDeleteRule}
        />
      )}

      {showSupabaseModal && (
        <SupabaseSyncModal
          status={supabaseStatus}
          onClose={() => setShowSupabaseModal(false)}
          onStatusUpdated={(next) => setSupabaseStatus(next)}
        />
      )}
    </div>
  );
};
