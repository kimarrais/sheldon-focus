import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { PersistedAppSettings, WarningLogItem, WatcherConfig } from '../shared/types';

const MAX_INFRACTIONS = 500;

export const DEFAULT_APP_SETTINGS: PersistedAppSettings = {
  tickTickToken: '',
  theme: 'light',
  workHoursEnabled: false,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
  vacationModeEnabled: false,
  vacationStartDate: '',
  vacationEndDate: '',
  lunchLockEnabled: false,
  lunchStartTime: '12:00',
  lunchEndTime: '13:30',
  autoLaunchEnabled: false,
};

export const DEFAULT_BLACKLIST: string[] = [
  'SleepingDogs.exe',
  'Steam.exe',
  'Valorant.exe',
  'LeagueClient.exe',
  'EldenRing.exe',
];

export const DEFAULT_WATCHER_CONFIG: WatcherConfig = {
  pollIntervalMs: 4000,
  graceSeconds: 60,
  guillotineSeconds: 300,
  fullscreenBlockEnabled: true,
  forcedTaskkillEnabled: true,
};

interface PersistedState {
  blacklist: string[];
  infractions: WarningLogItem[];
  watcherConfig: WatcherConfig;
  islandIntroPlayed: boolean;
  quickNote: string;
  appSettings: PersistedAppSettings;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeWatcherConfig(input: Partial<WatcherConfig>, base: WatcherConfig): WatcherConfig {
  return {
    pollIntervalMs: clampNumber(input.pollIntervalMs, 3000, 5000, base.pollIntervalMs),
    graceSeconds: clampNumber(input.graceSeconds, 5, 30 * 60, base.graceSeconds),
    guillotineSeconds: clampNumber(input.guillotineSeconds, 10, 60 * 60, base.guillotineSeconds),
    fullscreenBlockEnabled:
      typeof input.fullscreenBlockEnabled === 'boolean'
        ? input.fullscreenBlockEnabled
        : base.fullscreenBlockEnabled,
    forcedTaskkillEnabled:
      typeof input.forcedTaskkillEnabled === 'boolean'
        ? input.forcedTaskkillEnabled
        : base.forcedTaskkillEnabled,
  };
}

function sanitizeAppSettings(
  input: Partial<PersistedAppSettings> | undefined,
  base: PersistedAppSettings
): PersistedAppSettings {
  const src = input ?? {};
  const validHHMM = (v: unknown, fallback: string) =>
    typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : fallback;
  const validDate = (v: unknown, fallback: string) =>
    typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(v) || v === '') ? v : fallback;

  return {
    tickTickToken: typeof src.tickTickToken === 'string' ? src.tickTickToken : base.tickTickToken,
    theme: src.theme === 'dark' || src.theme === 'light' ? src.theme : base.theme,
    workHoursEnabled:
      typeof src.workHoursEnabled === 'boolean' ? src.workHoursEnabled : base.workHoursEnabled,
    workHoursStart: validHHMM(src.workHoursStart, base.workHoursStart),
    workHoursEnd: validHHMM(src.workHoursEnd, base.workHoursEnd),
    vacationModeEnabled:
      typeof src.vacationModeEnabled === 'boolean'
        ? src.vacationModeEnabled
        : base.vacationModeEnabled,
    vacationStartDate: validDate(src.vacationStartDate, base.vacationStartDate),
    vacationEndDate: validDate(src.vacationEndDate, base.vacationEndDate),
    lunchLockEnabled:
      typeof src.lunchLockEnabled === 'boolean' ? src.lunchLockEnabled : base.lunchLockEnabled,
    lunchStartTime: validHHMM(src.lunchStartTime, base.lunchStartTime),
    lunchEndTime: validHHMM(src.lunchEndTime, base.lunchEndTime),
    autoLaunchEnabled:
      typeof src.autoLaunchEnabled === 'boolean' ? src.autoLaunchEnabled : base.autoLaunchEnabled,
  };
}

/**
 * Tiny synchronous JSON store persisted in `userData`.
 * Holds the process blacklist, the infraction history (Black Mirror), watcher config, and app settings.
 */
export class SheldonStore {
  private readonly filePath: string;
  private state: PersistedState;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'sheldon-focus-store.json');
    this.state = this.load();
  }

  private defaults(): PersistedState {
    return {
      blacklist: [...DEFAULT_BLACKLIST],
      infractions: [],
      watcherConfig: { ...DEFAULT_WATCHER_CONFIG },
      islandIntroPlayed: false,
      quickNote: '',
      appSettings: { ...DEFAULT_APP_SETTINGS },
    };
  }

  private load(): PersistedState {
    try {
      if (!fs.existsSync(this.filePath)) return this.defaults();
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Partial<PersistedState>;
      return {
        blacklist: Array.isArray(raw.blacklist)
          ? raw.blacklist.filter((x): x is string => typeof x === 'string')
          : [...DEFAULT_BLACKLIST],
        infractions: Array.isArray(raw.infractions) ? raw.infractions.slice(0, MAX_INFRACTIONS) : [],
        watcherConfig: sanitizeWatcherConfig(raw.watcherConfig ?? {}, DEFAULT_WATCHER_CONFIG),
        islandIntroPlayed: typeof raw.islandIntroPlayed === 'boolean' ? raw.islandIntroPlayed : false,
        quickNote: typeof raw.quickNote === 'string' ? raw.quickNote : '',
        appSettings: sanitizeAppSettings(raw.appSettings, DEFAULT_APP_SETTINGS),
      };
    } catch (err) {
      console.error('[Sheldon Store] Falha ao carregar store, usando padrões:', err);
      return this.defaults();
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[Sheldon Store] Falha ao salvar store:', err);
    }
  }

  getBlacklist(): string[] {
    return [...this.state.blacklist];
  }

  setBlacklist(list: string[]): string[] {
    this.state.blacklist = [...list];
    this.save();
    return this.getBlacklist();
  }

  getInfractions(): WarningLogItem[] {
    return [...this.state.infractions];
  }

  addInfraction(item: WarningLogItem): void {
    this.state.infractions = [item, ...this.state.infractions].slice(0, MAX_INFRACTIONS);
    this.save();
  }

  clearInfractions(): void {
    this.state.infractions = [];
    this.save();
  }

  getWatcherConfig(): WatcherConfig {
    return { ...this.state.watcherConfig };
  }

  updateWatcherConfig(patch: Partial<WatcherConfig>): WatcherConfig {
    this.state.watcherConfig = sanitizeWatcherConfig(patch, this.state.watcherConfig);
    this.save();
    return this.getWatcherConfig();
  }

  getIslandIntroPlayed(): boolean {
    return Boolean(this.state.islandIntroPlayed);
  }

  setIslandIntroPlayed(played: boolean): void {
    this.state.islandIntroPlayed = Boolean(played);
    this.save();
  }

  getQuickNote(): string {
    return this.state.quickNote || '';
  }

  setQuickNote(note: string): void {
    this.state.quickNote = note;
    this.save();
  }

  getAppSettings(): PersistedAppSettings {
    return { ...this.state.appSettings };
  }

  updateAppSettings(patch: Partial<PersistedAppSettings>): PersistedAppSettings {
    this.state.appSettings = sanitizeAppSettings(patch, this.state.appSettings);
    this.save();
    return this.getAppSettings();
  }
}
