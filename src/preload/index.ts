import { contextBridge, ipcRenderer } from 'electron';
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
  SheldonElectronAPI,
  SupabaseSyncStatus,
  TabId,
  TickTickUpdateTaskPayload,
  TrackerStatus,
  WarningLogItem,
  WatcherConfig,
} from '../shared/types';

/** Subscribes to a Main → Renderer channel and returns an unsubscribe function. */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const sheldonAPI: SheldonElectronAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeToTray: () => ipcRenderer.invoke('window:close-to-tray'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  setSentinelMode: (active: boolean) => ipcRenderer.invoke('sentinel:set-mode', active),
  onSentinelModeChanged: (callback: (active: boolean) => void) =>
    subscribe<boolean>('sentinel:mode-changed', callback),

  // Blacklist
  getBlacklist: () => ipcRenderer.invoke('blacklist:get'),
  addToBlacklist: (executable: string) => ipcRenderer.invoke('blacklist:add', executable),
  removeFromBlacklist: (executable: string) => ipcRenderer.invoke('blacklist:remove', executable),

  // Infractions (Black Mirror)
  getInfractions: () => ipcRenderer.invoke('infractions:get'),
  clearInfractions: () => ipcRenderer.invoke('infractions:clear'),
  onInfraction: (callback: (item: WarningLogItem) => void) =>
    subscribe<WarningLogItem>('infraction:new', callback),

  // Punishment engine
  getPunishmentStatus: () => ipcRenderer.invoke('punishment:get-status'),
  onPunishmentStatus: (callback: (status: PunishmentStatus) => void) =>
    subscribe<PunishmentStatus>('punishment:status', callback),
  getWatcherConfig: () => ipcRenderer.invoke('watcher:get-config'),
  updateWatcherConfig: (patch: Partial<WatcherConfig>) =>
    ipcRenderer.invoke('watcher:update-config', patch),

  // Floating Desktop Widget (legacy compat)
  showFloatingWidget: (task) => ipcRenderer.invoke('widget:show', task),
  hideFloatingWidget: () => ipcRenderer.invoke('widget:hide'),
  updateFloatingWidget: (state) => ipcRenderer.invoke('widget:update', state),
  onFloatingWidgetAction: (callback) =>
    subscribe<'toggle' | 'close' | 'skip'>('floating-widget:action', callback),

  // Desktop Dynamic Island
  showDynamicIsland: () => ipcRenderer.invoke('island:show'),
  hideDynamicIsland: () => ipcRenderer.invoke('island:hide'),
  updateDynamicIslandState: (state: Partial<DynamicIslandState>) =>
    ipcRenderer.invoke('island:update-state', state),
  getDynamicIslandState: () => ipcRenderer.invoke('island:get-state'),
  onDynamicIslandState: (callback: (state: DynamicIslandState) => void) =>
    subscribe<DynamicIslandState>('island:state', callback),
  dispatchDynamicIslandAction: (action: DynamicIslandAction) =>
    ipcRenderer.invoke('island:dispatch-action', action),
  onDynamicIslandAction: (callback: (action: DynamicIslandAction) => void) =>
    subscribe<DynamicIslandAction>('island:action', callback),
  setDynamicIslandIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.send('island:set-ignore-mouse', ignore),
  focusDynamicIsland: () => ipcRenderer.invoke('island:focus'),
  onDynamicIslandBlurred: (callback: () => void) => subscribe<void>('island:blurred', callback),
  setDynamicIslandAlwaysOnTop: (alwaysOnTop: boolean) =>
    ipcRenderer.invoke('island:set-always-on-top', alwaysOnTop),
  getIslandIntroPlayed: () => ipcRenderer.invoke('island:get-intro-played'),
  setIslandIntroPlayed: (played: boolean) =>
    ipcRenderer.invoke('island:set-intro-played', played),
  getQuickNote: () => ipcRenderer.invoke('island:get-quick-note'),
  setQuickNote: (note: string) => ipcRenderer.invoke('island:set-quick-note', note),
  onNavigateTab: (callback: (tab: TabId) => void) => subscribe<TabId>('app:navigate-tab', callback),

  // TickTick API Bridge
  tickTickGetProjects: (token) => ipcRenderer.invoke('ticktick:get-projects', token),
  tickTickSyncTasks: (token) => ipcRenderer.invoke('ticktick:sync-tasks', token),
  tickTickCreateTask: (token, payload) => ipcRenderer.invoke('ticktick:create-task', token, payload),
  tickTickUpdateTask: (token, payload: TickTickUpdateTaskPayload) =>
    ipcRenderer.invoke('ticktick:update-task', token, payload),
  tickTickCompleteTask: (token, taskId, projectId) =>
    ipcRenderer.invoke('ticktick:complete-task', token, taskId, projectId),

  // Persisted App Settings, Schedule & Lifecycle
  getPersistedSettings: () => ipcRenderer.invoke('settings:get-persisted'),
  updatePersistedSettings: (patch: Partial<PersistedAppSettings>) =>
    ipcRenderer.invoke('settings:update-persisted', patch),
  getSentinelScheduleStatus: () => ipcRenderer.invoke('sentinel:get-schedule-status'),
  onSentinelScheduleStatusChanged: (callback: (status: SentinelScheduleStatus) => void) =>
    subscribe<SentinelScheduleStatus>('sentinel:schedule-status', callback),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:set-auto-launch', enabled),
  notifyAppHydrated: () => ipcRenderer.invoke('app:hydrated'),

  // Real System Media (SMTC / Spotify Now Playing)
  getNowPlayingMedia: () => ipcRenderer.invoke('media:get-now-playing'),
  mediaControlAction: (action: 'play-pause' | 'next' | 'prev') =>
    ipcRenderer.invoke('media:control', action),
  onNowPlayingUpdated: (callback: (media: NowPlayingMedia) => void) =>
    subscribe<NowPlayingMedia>('media:updated', callback),

  // Continuous Activity Tracking & 24h Metrics (SQLite + Supabase)
  getDayTimeline: (date: string) => ipcRenderer.invoke('metrics:get-day-timeline', date),
  getMetricsSummary: (date: string) => ipcRenderer.invoke('metrics:get-summary', date),
  getTopApps: (date: string, limit?: number) =>
    ipcRenderer.invoke('metrics:get-top-apps', date, limit),
  getDayEvents: (date: string, limit?: number) =>
    ipcRenderer.invoke('metrics:get-day-events', date, limit),
  getAppIcon: (processPath: string) =>
    ipcRenderer.invoke('metrics:get-app-icon', processPath),
  reclassifyActivity: (payload: ReclassifyActivityPayload) =>
    ipcRenderer.invoke('metrics:reclassify-activity', payload),
  getCategoryRules: () => ipcRenderer.invoke('metrics:get-category-rules'),
  upsertCategoryRule: (rule: Omit<CategoryRule, 'id' | 'createdAt'> & { id?: number }) =>
    ipcRenderer.invoke('metrics:upsert-category-rule', rule),
  deleteCategoryRule: (id: number) => ipcRenderer.invoke('metrics:delete-category-rule', id),
  getTrackerStatus: () => ipcRenderer.invoke('metrics:get-tracker-status'),
  updateTrackerConfig: (patch: Partial<ActivityTrackerConfig>) =>
    ipcRenderer.invoke('metrics:update-tracker-config', patch),
  onMetricsUpdated: (callback: (status: TrackerStatus) => void) =>
    subscribe<TrackerStatus>('metrics:updated', callback),

  // Supabase Cloud Sync & Auth
  getSupabaseSyncStatus: () => ipcRenderer.invoke('supabase:get-status'),
  supabaseSignIn: (email: string, password: string) =>
    ipcRenderer.invoke('supabase:sign-in', email, password),
  supabaseSignUp: (email: string, password: string) =>
    ipcRenderer.invoke('supabase:sign-up', email, password),
  supabaseSignInAnonymously: () => ipcRenderer.invoke('supabase:sign-in-anonymous'),
  supabaseVerifyOtp: (email: string, token: string) =>
    ipcRenderer.invoke('supabase:verify-otp', email, token),
  supabaseSignOut: () => ipcRenderer.invoke('supabase:sign-out'),
  supabaseSyncNow: () => ipcRenderer.invoke('supabase:sync-now'),
  onSupabaseStatusChanged: (callback: (status: SupabaseSyncStatus) => void) =>
    subscribe<SupabaseSyncStatus>('supabase:status-changed', callback),
};

contextBridge.exposeInMainWorld('sheldonAPI', sheldonAPI);
