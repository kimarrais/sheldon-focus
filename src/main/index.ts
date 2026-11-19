import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import fs from 'fs';
import type {
  ActivityTrackerConfig,
  CategoryRule,
  DynamicIslandAction,
  DynamicIslandState,
  NowPlayingMedia,
  PersistedAppSettings,
  PunishmentStatus,
  ReclassifyActivityPayload,
  SentinelScheduleStatus,
  SupabaseSyncStatus,
  TickTickTaskPayload,
  TickTickUpdateTaskPayload,
  TrackerStatus,
  WarningLogItem,
  WatcherConfig,
} from '../shared/types';
import { SheldonStore } from './store';
import { OverlayManager } from './overlays';
import { normalizeExecutableName, ProcessWatcher } from './watcher';
import { TickTickClient } from './ticktick';
import type { FloatingWidgetState } from './floating-widget';
import { DynamicIslandManager } from './dynamic-island';
import { ActivityDatabase, isCategoryProductiveByDefault } from './Database';
import { ActivityTracker } from './ActivityTracker';
import { SupabaseSyncService } from './SupabaseSync';
import { MediaProbe } from './MediaProbe';
import { loadEnv } from './env';

loadEnv();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let isSentinelActive = false;
let wasLockedByWorkHours = false;
const isAutostartBoot = process.argv.includes('--autostart');
let hasShownAutostartMain = false;

let store: SheldonStore | null = null;
let overlays: OverlayManager | null = null;
let watcher: ProcessWatcher | null = null;
let dynamicIsland: DynamicIslandManager | null = null;
let activityDb: ActivityDatabase | null = null;
let activityTracker: ActivityTracker | null = null;
let supabaseSync: SupabaseSyncService | null = null;
let mediaProbe: MediaProbe | null = null;
let scheduleTimer: NodeJS.Timeout | null = null;
const appIconCache = new Map<string, string | null>();

function sendToRenderer(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function parseHHMMMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function isTimeInWindow(now: Date, startHHMM: string, endHHMM: string): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = parseHHMMMinutes(startHHMM);
  const endMin = parseHHMMMinutes(endHHMM);
  if (startMin === endMin) return true;
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDateInVacation(now: Date, enabled: boolean, startDate: string, endDate: string): boolean {
  if (!enabled) return false;
  const today = toLocalYMD(now);
  if (startDate && endDate) {
    const [minD, maxD] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
    return today >= minD && today <= maxD;
  }
  if (startDate) return today >= startDate;
  if (endDate) return today <= endDate;
  return true;
}

function computeSentinelScheduleStatus(now = new Date()): SentinelScheduleStatus {
  const cfg = store?.getAppSettings();
  const workHoursEnabled = cfg?.workHoursEnabled ?? false;
  const workHoursStart = cfg?.workHoursStart ?? '09:00';
  const workHoursEnd = cfg?.workHoursEnd ?? '18:00';
  const vacationModeEnabled = cfg?.vacationModeEnabled ?? false;
  const vacationStartDate = cfg?.vacationStartDate ?? '';
  const vacationEndDate = cfg?.vacationEndDate ?? '';

  const inWorkHours = workHoursEnabled && isTimeInWindow(now, workHoursStart, workHoursEnd);
  const inVacation = isDateInVacation(now, vacationModeEnabled, vacationStartDate, vacationEndDate);
  const lockedByWorkHours = inWorkHours && !inVacation;

  return {
    sentinelActive: isSentinelActive,
    workHoursEnabled,
    workHoursStart,
    workHoursEnd,
    inWorkHours,
    vacationModeEnabled,
    vacationStartDate,
    vacationEndDate,
    inVacation,
    lockedByWorkHours,
  };
}

/** Single source of truth for Sentinel Mode: toggles the native process watcher (never stops activityTracker). */
function applySentinelMode(requestedActive: boolean): boolean {
  const schedule = computeSentinelScheduleStatus();
  const finalActive = schedule.lockedByWorkHours ? true : requestedActive;
  const changed = isSentinelActive !== finalActive;
  isSentinelActive = finalActive;
  if (finalActive) watcher?.start();
  else watcher?.stop();
  dynamicIsland?.updateState({ isSentinelActive: finalActive });
  updateTrayMenu();
  if (changed) {
    sendToRenderer('sentinel:mode-changed', finalActive);
  }
  sendToRenderer('sentinel:schedule-status', computeSentinelScheduleStatus());
  return finalActive;
}

function evaluateSentinelSchedule(): SentinelScheduleStatus {
  const schedule = computeSentinelScheduleStatus();
  if (schedule.lockedByWorkHours) {
    wasLockedByWorkHours = true;
    if (!isSentinelActive) {
      applySentinelMode(true);
    } else {
      sendToRenderer('sentinel:schedule-status', schedule);
    }
  } else {
    if (schedule.inVacation && wasLockedByWorkHours && isSentinelActive) {
      wasLockedByWorkHours = false;
      applySentinelMode(false);
    } else {
      wasLockedByWorkHours = false;
      sendToRenderer('sentinel:schedule-status', schedule);
    }
  }
  return computeSentinelScheduleStatus();
}

function initWatcherEngine(): void {
  store = new SheldonStore();
  overlays = new OverlayManager();
  watcher = new ProcessWatcher(store, overlays);
  dynamicIsland = new DynamicIslandManager(store);
  mediaProbe = new MediaProbe();

  watcher.on('status', (status: PunishmentStatus) => sendToRenderer('punishment:status', status));
  watcher.on('infraction', (item: WarningLogItem) => sendToRenderer('infraction:new', item));

  // Initialize SQLite database, continuous surgical Win32 Activity Tracker & Supabase Cloud Sync
  activityDb = new ActivityDatabase();
  activityTracker = new ActivityTracker(activityDb);
  supabaseSync = new SupabaseSyncService(activityDb);

  activityTracker.on('updated', (status: TrackerStatus) =>
    sendToRenderer('metrics:updated', status)
  );
  activityTracker.on('flushed', () => {
    if (supabaseSync?.getStatus().authenticated) {
      void supabaseSync.syncNow();
    }
  });
  supabaseSync.on('status', (status: SupabaseSyncStatus) =>
    sendToRenderer('supabase:status-changed', status)
  );

  mediaProbe.on('updated', (media: NowPlayingMedia) => {
    dynamicIsland?.updateMedia(media);
    sendToRenderer('media:updated', media);
  });

  activityTracker.start();
  void mediaProbe.start();
  void supabaseSync.init();

  evaluateSentinelSchedule();
  scheduleTimer = setInterval(() => {
    evaluateSentinelSchedule();
  }, 25000);
}

/**
 * Generates a fallback 16x16 orange badge icon if asset file is unavailable at runtime
 */
function getSheldonAssetIcon(): Electron.NativeImage {
  const possiblePaths = [
    path.join(__dirname, '../../src/renderer/assets/sheldon-happy.png'),
    path.join(__dirname, '../../dist/assets/sheldon-happy.png'),
    path.join(process.resourcesPath || '', 'assets/sheldon-happy.png'),
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        return img;
      }
    }
  }

  // Fallback 16x16 vibrant orange (#F97316) rounded badge PNG data URL
  const fallbackBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABMSURBVDhPY/z//z8DJYCRkZGRgYGBgWEYA00Aq8bRBsBoA2A0AEYbAKMNgNEGQA2A0QYwMjIyUGrAqAGjBow2AEggqAEw2gAA+SwH8d+g31cAAAAASUVORK5CYII=';
  return nativeImage.createFromDataURL(`data:image/png;base64,${fallbackBase64}`);
}

function createTrayIcon(): Electron.NativeImage {
  return getSheldonAssetIcon().resize({ width: 16, height: 16 });
}

function updateTrayMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Sheldon: Focus & Procrastination Killer',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Abrir Painel do Sheldon',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: isSentinelActive ? '🛡️ Modo Sentinela: ATIVO (Desativar)' : '🐾 Ativar Modo Sentinela',
      click: () => {
        applySentinelMode(!isSentinelActive);
      },
    },
    {
      label: '🏝️ Mostrar Dynamic Island no Desktop',
      click: () => {
        dynamicIsland?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Sair Completamente (Sob Julgamento)',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(
    isSentinelActive
      ? 'Sheldon Focus — Sentinela ATIVO (Te observando...)'
      : 'Sheldon Focus — Em background'
  );
  tray.setContextMenu(contextMenu);
}

function createSystemTray(): void {
  if (tray) return;

  const icon = createTrayIcon();
  tray = new Tray(icon);

  updateTrayMenu();

  tray.on('double-click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createMainWindow(): void {
  const persistedTheme = store?.getAppSettings().theme ?? 'light';
  const bgColor = persistedTheme === 'dark' ? '#141517' : '#F5F6FA';

  if (isAutostartBoot) {
    dynamicIsland?.show();
  }

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 920,
    minHeight: 600,
    frame: false,
    backgroundColor: bgColor,
    title: 'Sheldon: Focus & Procrastination Killer',
    icon: getSheldonAssetIcon().resize({ width: 64, height: 64 }),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!isAutostartBoot) {
      mainWindow?.show();
      mainWindow?.focus();
      dynamicIsland?.show();
    }
    console.log('🐾 [Sheldon Focus] Janela desktop e Dynamic Island carregadas!');
  });

  // Flush active in-memory session when window is minimized or closed to tray
  mainWindow.on('minimize', () => {
    activityTracker?.flushNow();
  });

  // Intercept window close to keep running in System Tray
  mainWindow.on('close', (event) => {
    activityTracker?.flushNow();
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    activityTracker?.flushNow();
    mainWindow?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  });

  ipcMain.handle('window:close-to-tray', () => {
    activityTracker?.flushNow();
    mainWindow?.hide();
  });

  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.handle('sentinel:set-mode', (_event, active: boolean) => {
    applySentinelMode(Boolean(active));
  });

  // ---------------- Blacklist ----------------
  ipcMain.handle('blacklist:get', () => store?.getBlacklist() ?? []);

  ipcMain.handle('blacklist:add', (_event, executable: unknown) => {
    if (!store) throw new Error('Store não inicializado.');
    const result = normalizeExecutableName(executable);
    if (!result.ok) throw new Error(result.error);
    const current = store.getBlacklist();
    if (current.some((x) => x.toLowerCase() === result.value.toLowerCase())) return current;
    const updated = store.setBlacklist([...current, result.value]);
    watcher?.refresh();
    return updated;
  });

  ipcMain.handle('blacklist:remove', (_event, executable: unknown) => {
    if (!store) throw new Error('Store não inicializado.');
    if (typeof executable !== 'string') return store.getBlacklist();
    const key = executable.trim().toLowerCase();
    const updated = store.setBlacklist(store.getBlacklist().filter((x) => x.toLowerCase() !== key));
    watcher?.refresh(); // pardons any running punishment for the removed executable
    return updated;
  });

  // ---------------- Infractions (Black Mirror) ----------------
  ipcMain.handle('infractions:get', () => store?.getInfractions() ?? []);
  ipcMain.handle('infractions:clear', () => store?.clearInfractions());

  // ---------------- Punishment engine ----------------
  ipcMain.handle(
    'punishment:get-status',
    (): PunishmentStatus =>
      watcher?.getStatus() ?? { watcherRunning: false, lastScanAt: null, punishments: [] }
  );

  ipcMain.handle('watcher:get-config', () => store?.getWatcherConfig());

  ipcMain.handle('watcher:update-config', (_event, patch: Partial<WatcherConfig>) => {
    if (!store) throw new Error('Store não inicializado.');
    const updated = store.updateWatcherConfig(patch && typeof patch === 'object' ? patch : {});
    watcher?.refresh();
    return updated;
  });

  // ---------------- Floating Desktop Widget (legacy compat -> Dynamic Island) ----------------
  ipcMain.handle('widget:show', (_event, _state?: Partial<FloatingWidgetState>) => {
    dynamicIsland?.show();
  });

  ipcMain.handle('widget:hide', () => {
    dynamicIsland?.hide();
  });

  ipcMain.handle('widget:update', (_event, _state: Partial<FloatingWidgetState>) => {
    // Handled via island:update-state
  });

  // ---------------- Desktop Dynamic Island ----------------
  ipcMain.handle('island:show', () => {
    dynamicIsland?.show();
  });

  ipcMain.handle('island:hide', () => {
    dynamicIsland?.hide();
  });

  ipcMain.handle('island:update-state', (_event, state: Partial<DynamicIslandState>) => {
    dynamicIsland?.updateState(state && typeof state === 'object' ? state : {});
  });

  ipcMain.handle('island:get-state', () => {
    return dynamicIsland?.getState();
  });

  ipcMain.handle('island:dispatch-action', (_event, action: DynamicIslandAction) => {
    if (!action || typeof action !== 'object') return;
    if (action.type === 'mark-intro-played') {
      dynamicIsland?.markIntroPlayed(true);
    } else if (action.type === 'update-quick-note') {
      dynamicIsland?.saveQuickNote(action.text);
    } else if (action.type === 'open-main-window') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        if (action.tab) {
          sendToRenderer('app:navigate-tab', action.tab);
        }
      }
    }
    sendToRenderer('island:action', action);
  });

  ipcMain.on('island:set-ignore-mouse', (_event, ignore: boolean) => {
    dynamicIsland?.setIgnoreMouse(Boolean(ignore));
  });

  ipcMain.handle('island:focus', () => {
    dynamicIsland?.focus();
  });

  ipcMain.handle('island:set-always-on-top', (_event, alwaysOnTop: boolean) => {
    dynamicIsland?.setAlwaysOnTop(Boolean(alwaysOnTop));
  });

  ipcMain.handle('island:get-intro-played', () => {
    return store?.getIslandIntroPlayed() ?? false;
  });

  ipcMain.handle('island:set-intro-played', (_event, played: boolean) => {
    dynamicIsland?.markIntroPlayed(Boolean(played));
  });

  ipcMain.handle('island:get-quick-note', () => {
    return store?.getQuickNote() ?? '';
  });

  ipcMain.handle('island:set-quick-note', (_event, note: string) => {
    dynamicIsland?.saveQuickNote(typeof note === 'string' ? note : '');
  });

  // ---------------- TickTick Open API ----------------
  ipcMain.handle('ticktick:get-projects', async (_event, token: string) => {
    try {
      const projects = await TickTickClient.getProjects(token);
      return { success: true, projects };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('ticktick:sync-tasks', async (_event, token: string) => {
    try {
      const { tasks, projects } = await TickTickClient.syncTasks(token);
      return { success: true, tasks, projects };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('ticktick:create-task', async (_event, token: string, payload: TickTickTaskPayload) => {
    try {
      const task = await TickTickClient.createTask(token, payload);
      return { success: true, task };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('ticktick:complete-task', async (_event, token: string, taskId: string, projectId?: string) => {
    try {
      await TickTickClient.completeTask(token, taskId, projectId);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('ticktick:update-task', async (_event, token: string, payload: TickTickUpdateTaskPayload) => {
    try {
      const task = await TickTickClient.updateTask(token, payload);
      return { success: true, task };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  // ---------------- Persisted App Settings, Schedule & Autostart ----------------
  ipcMain.handle('settings:get-persisted', () => {
    const persisted = store?.getAppSettings();
    const loginSettings = app.isPackaged ? app.getLoginItemSettings() : null;
    if (persisted && loginSettings && typeof loginSettings.openAtLogin === 'boolean') {
      return { ...persisted, autoLaunchEnabled: loginSettings.openAtLogin };
    }
    return persisted;
  });

  ipcMain.handle('settings:update-persisted', (_event, patch: Partial<PersistedAppSettings>) => {
    if (!store) throw new Error('Store não inicializado.');
    const updated = store.updateAppSettings(patch && typeof patch === 'object' ? patch : {});
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(updated.theme === 'dark' ? '#141517' : '#F5F6FA');
    }
    evaluateSentinelSchedule();
    return updated;
  });

  ipcMain.handle('sentinel:get-schedule-status', () => {
    return computeSentinelScheduleStatus();
  });

  ipcMain.handle('app:set-auto-launch', (_event, enabled: boolean) => {
    const flag = Boolean(enabled);
    store?.updateAppSettings({ autoLaunchEnabled: flag });
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: flag,
        path: process.execPath,
        args: ['--autostart'],
      });
    }
    return flag;
  });

  ipcMain.handle('app:hydrated', () => {
    if (isAutostartBoot && !hasShownAutostartMain && mainWindow && !mainWindow.isDestroyed()) {
      hasShownAutostartMain = true;
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ---------------- Real System Media (SMTC / Spotify) ----------------
  ipcMain.handle('media:get-now-playing', () => {
    return mediaProbe?.getCurrentMedia();
  });

  ipcMain.handle('media:control', async (_event, action: 'play-pause' | 'next' | 'prev') => {
    if (!mediaProbe) return null;
    return mediaProbe.control(action);
  });

  // ---------------- Continuous Activity Tracking & Metrics (SQLite) ----------------
  ipcMain.handle('metrics:get-day-timeline', (_event, date: string) => {
    if (!activityDb) return [];
    const safeDate = typeof date === 'string' ? date : '';
    return activityDb.getDayTimeline(safeDate, activityTracker?.getLiveSession());
  });

  ipcMain.handle('metrics:get-summary', (_event, date: string) => {
    const safeDate = typeof date === 'string' ? date : '';
    if (!activityDb) {
      return {
        date: safeDate,
        totalActiveSeconds: 0,
        productiveSeconds: 0,
        deepWorkSeconds: 0,
        communicationSeconds: 0,
        neutralSeconds: 0,
        distractionSeconds: 0,
        idleSeconds: 0,
        activeInputSeconds: 0,
        passiveSeconds: 0,
        keystrokesCount: 0,
        mouseClicksCount: 0,
        contextSwitchesCount: 0,
        longestFocusStreakSeconds: 0,
        distractionCount: 0,
        focusPercentage: 0,
        sheldonScore: 0,
        categoryBreakdown: [],
        topProjects: [],
      };
    }
    return activityDb.getDaySummary(safeDate, activityTracker?.getLiveSession());
  });

  ipcMain.handle('metrics:get-top-apps', (_event, date: string, limit?: number) => {
    if (!activityDb) return [];
    const safeDate = typeof date === 'string' ? date : '';
    const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : 10;
    return activityDb.getTopApps(safeDate, safeLimit, activityTracker?.getLiveSession());
  });

  ipcMain.handle('metrics:get-day-events', (_event, date: string, limit?: number) => {
    if (!activityDb) return [];
    const safeDate = typeof date === 'string' ? date : '';
    const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : 150;
    return activityDb.getDayEvents(safeDate, safeLimit);
  });

  ipcMain.handle('metrics:get-app-icon', async (_event, processPath: string) => {
    if (typeof processPath !== 'string' || !processPath.trim()) return null;
    const key = processPath.trim().toLowerCase();
    if (appIconCache.has(key)) return appIconCache.get(key) ?? null;

    try {
      if (!fs.existsSync(processPath)) {
        appIconCache.set(key, null);
        return null;
      }
      const icon = await app.getFileIcon(processPath, { size: 'normal' });
      if (icon.isEmpty()) {
        appIconCache.set(key, null);
        return null;
      }
      const dataUrl = icon.toDataURL();
      appIconCache.set(key, dataUrl);
      return dataUrl;
    } catch {
      appIconCache.set(key, null);
      return null;
    }
  });

  ipcMain.handle(
    'metrics:reclassify-activity',
    (_event, payload: ReclassifyActivityPayload) => {
      if (!activityDb) throw new Error('Banco de atividades não inicializado.');
      if (!payload || typeof payload !== 'object') {
        throw new Error('Payload de reclassificação inválido.');
      }

      let targetId = payload.id;
      if (targetId <= 0 && activityTracker) {
        const isProd =
          typeof payload.isProductive === 'boolean'
            ? payload.isProductive
            : isCategoryProductiveByDefault(payload.category);
        const persisted = activityTracker.reclassifyLiveIfUnpersisted(
          payload.category,
          isProd
        );
        if (persisted && persisted.id > 0) {
          targetId = persisted.id;
        }
      }

      const result = activityDb.reclassifyActivity({ ...payload, id: targetId });
      if (result.updated) {
        activityTracker?.syncReclassifiedRecord(result.updated);
      }
      if (activityTracker) {
        sendToRenderer('metrics:updated', activityTracker.getStatus());
      }
      return result;
    }
  );

  ipcMain.handle('metrics:get-category-rules', () => {
    return activityDb?.getCategoryRules() ?? [];
  });

  ipcMain.handle(
    'metrics:upsert-category-rule',
    (_event, rule: Omit<CategoryRule, 'id' | 'createdAt'> & { id?: number }) => {
      if (!activityDb) throw new Error('Banco de atividades não inicializado.');
      activityDb.upsertCategoryRule(rule);
      return activityDb.getCategoryRules();
    }
  );

  ipcMain.handle('metrics:delete-category-rule', (_event, id: number) => {
    if (!activityDb) throw new Error('Banco de atividades não inicializado.');
    return activityDb.deleteCategoryRule(id);
  });

  ipcMain.handle('metrics:get-tracker-status', () => {
    return (
      activityTracker?.getStatus() ?? {
        running: false,
        isIdle: false,
        idleSeconds: 0,
        currentSession: null,
        config: {
          pollIntervalMs: 1500,
          idleThresholdSeconds: 120,
          debounceMs: 2000,
          flushIntervalMs: 60_000,
          enabled: true,
        },
      }
    );
  });

  ipcMain.handle(
    'metrics:update-tracker-config',
    (_event, patch: Partial<ActivityTrackerConfig>) => {
      if (!activityTracker) throw new Error('ActivityTracker não inicializado.');
      return activityTracker.updateConfig(
        patch && typeof patch === 'object' ? patch : {}
      );
    }
  );

  // ---------------- Supabase Cloud Sync & Auth ----------------
  ipcMain.handle('supabase:get-status', () => {
    return supabaseSync?.getStatus() ?? null;
  });

  ipcMain.handle(
    'supabase:sign-in',
    async (_event, email: string, password: string) => {
      if (!supabaseSync) throw new Error('SupabaseSync não inicializado.');
      return supabaseSync.signIn(email, password);
    }
  );

  ipcMain.handle(
    'supabase:sign-up',
    async (_event, email: string, password: string) => {
      if (!supabaseSync) throw new Error('SupabaseSync não inicializado.');
      return supabaseSync.signUp(email, password);
    }
  );

  ipcMain.handle('supabase:sign-in-anonymous', async () => {
    if (!supabaseSync) throw new Error('SupabaseSync não inicializado.');
    return supabaseSync.signInAnonymously();
  });

  ipcMain.handle(
    'supabase:verify-otp',
    async (_event, email: string, token: string) => {
      if (!supabaseSync) throw new Error('SupabaseSync não inicializado.');
      return supabaseSync.verifyOtp(email, token);
    }
  );

  ipcMain.handle('supabase:sign-out', async () => {
    if (!supabaseSync) throw new Error('SupabaseSync não inicializado.');
    return supabaseSync.signOut();
  });

  ipcMain.handle('supabase:sync-now', async () => {
    if (!supabaseSync) throw new Error('SupabaseSync não inicializado.');
    activityTracker?.flushNow();
    return supabaseSync.syncNow();
  });
}

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const gotTheLock = isDev ? true : app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.sheldonfocus.desktop');
    initWatcherEngine();
    registerIpcHandlers();
    createSystemTray();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        mainWindow?.show();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
  mediaProbe?.stop();
  supabaseSync?.stop();
  activityTracker?.stop();
  activityDb?.close();
  watcher?.stop();
  dynamicIsland?.destroy();
  // Kiosk lockdown windows veto 'close'; destroy them so the quit can proceed.
  overlays?.destroyAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
