export type TabId =
  | 'hoje'
  | 'metricas'
  | 'bloquear'
  | 'sheldon'
  | 'configuracoes'
  | 'daybreak'
  | 'black-mirror'
  | 'sheldon-mood'
  | 'settings-leash';

/**
 * As 5 expressões oficiais do Sheldon (Kawaii App Icon Style):
 * - `neutral`: curioso / atento (olhinhos brilhando)
 * - `cool`: óculos escuros (Modo Sentinela blindado / Boss)
 * - `happy`: sorridente com linguinha (feliz / recompensado)
 * - `crying`: chorando rios de lágrimas (decepcionado com procrastinação)
 * - `angry`: bravo / sobrancelha franzida (prestes a dar Taskkill)
 */
export type SheldonVisualState = 'neutral' | 'cool' | 'happy' | 'crying' | 'angry';

export type TaskPriority = 'high' | 'medium' | 'low';

export interface SubTaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface DailyTask {
  id: string;
  title: string;
  project: string;
  estimatedMinutes: number;
  completed: boolean;
  priority: TaskPriority;
  syncedFromTickTick: boolean;
  description?: string;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  isAllDay?: boolean;
  dueLabel?: string;
  /** Optional HH:MM reminder time used by the Dynamic Island schedule notifier */
  scheduledTime?: string;
  listName?: string;
  listColor?: string;
  tags?: string[];
  subtasks?: SubTaskItem[];
  tickTickId?: string;
  tickTickProjectId?: string;
}

export interface NowPlayingMedia {
  available: boolean;
  title: string;
  artist: string;
  album: string;
  sourceApp: string;
  isSpotify: boolean;
  status: 'playing' | 'paused' | 'stopped';
  positionSeconds: number;
  durationSeconds: number;
  thumbnailBase64?: string | null;
  updatedAt: number;
}

export interface DynamicIslandAgendaItem {
  id: string;
  title: string;
  startHour: string;
  endHour: string;
  durationMinutes: number;
  completed?: boolean;
}

export interface DynamicIslandNotification {
  id: string;
  taskId?: string;
  title: string;
  project?: string;
  timeLabel: string;
  triggeredAt: number;
}

export interface DynamicIslandState {
  tasks: DailyTask[];
  agendaEvents: DynamicIslandAgendaItem[];
  selectedTaskId: string | null;
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  cycleCount: number;
  sheldonState: SheldonVisualState;
  isSentinelActive: boolean;
  warningsCount: number;
  patienceLevel: number;
  focusSecondsElapsed: number;
  quickNote: string;
  introPlayed: boolean;
  replayIntroNonce: number;
  activeNotification: DynamicIslandNotification | null;
  isVisible: boolean;
  alwaysOnTop: boolean;
  nowPlaying?: NowPlayingMedia | null;
}

export type DynamicIslandAction =
  | { type: 'toggle-play' }
  | { type: 'stop-focus' }
  | { type: 'select-task'; taskId: string | null }
  | { type: 'toggle-task-complete'; taskId: string }
  | {
      type: 'add-task';
      title: string;
      project: string;
      estimatedMinutes: number;
      priority: TaskPriority;
      tags: string[];
      scheduledTime?: string;
      startDate?: string;
      dueDate?: string;
    }
  | { type: 'set-preset-minutes'; minutes: number }
  | { type: 'start-event-focus'; eventId: string }
  | { type: 'update-quick-note'; text: string }
  | { type: 'toggle-sentinel' }
  | { type: 'open-main-window'; tab?: TabId }
  | { type: 'notification-focus'; notification: DynamicIslandNotification }
  | { type: 'notification-snooze'; notification: DynamicIslandNotification }
  | { type: 'notification-dismiss'; notificationId: string }
  | { type: 'mark-intro-played' };

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: 'work' | 'meeting' | 'deep-work' | 'break' | 'personal';
  color?: string;
  completed?: boolean;
  linkedTaskId?: string;
  tickTickTaskId?: string;
  tickTickProjectId?: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  time: string; // HH:MM
  completed: boolean;
  createdAt: number;
}

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  expanded?: boolean;
}

export interface NoteDocument {
  id: string;
  title: string;
  folderId: string | null;
  icon: string;
  coverImage?: string;
  content: string;
  updatedAt: number;
}

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  closed?: boolean;
}

export interface TickTickTaskPayload {
  title: string;
  projectId?: string;
  content?: string;
  desc?: string;
  priority?: number;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  isAllDay?: boolean;
  tags?: string[];
}

export interface TickTickUpdateTaskPayload {
  id: string;
  projectId: string;
  title?: string;
  content?: string;
  desc?: string;
  priority?: number;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  isAllDay?: boolean;
  tags?: string[];
}

export type WarningSeverity = 'warning' | 'critical' | 'terminated';

export interface WarningLogItem {
  id: string;
  timestamp: string;
  executable: string;
  windowTitle: string;
  severity: WarningSeverity;
  actionTaken: string;
  sheldonComment: string;
  /** ISO 8601 timestamp (set by the native watcher for real infractions) */
  occurredAt?: string;
}

/* ------------------------------------------------------------------ */
/* Native Process Watcher (Main process) — shared contracts            */
/* ------------------------------------------------------------------ */

/**
 * - `warning`    → Estágio 1: popup flutuante, tolerância inicial correndo
 * - `guillotine` → Estágio 2: telas de bloqueio kiosk em todos os monitores
 * - `executing`  → cronômetro zerou, taskkill em andamento
 */
export type PunishmentStage = 'warning' | 'guillotine' | 'executing';

export interface ActivePunishment {
  executable: string;
  stage: PunishmentStage;
  /** epoch ms */
  detectedAt: number;
  /** epoch ms */
  stageStartedAt: number;
  /** epoch ms */
  stageEndsAt: number;
  remainingMs: number;
}

export interface PunishmentStatus {
  watcherRunning: boolean;
  /** epoch ms of the last successful process scan */
  lastScanAt: number | null;
  punishments: ActivePunishment[];
}

export interface WatcherConfig {
  /** Intervalo de varredura (clamp 3000–5000 ms) */
  pollIntervalMs: number;
  /** Tolerância do Estágio 1 antes da guilhotina */
  graceSeconds: number;
  /** Duração do cronômetro da guilhotina (padrão 300 = 05:00) */
  guillotineSeconds: number;
  fullscreenBlockEnabled: boolean;
  forcedTaskkillEnabled: boolean;
}

export type ActivityCategory = 'deep-work' | 'ticktick-sync' | 'procrastination' | 'lunch-lock' | 'idle';

/* ------------------------------------------------------------------ */
/* Native Continuous Activity Tracking & 24h Metrics (SQLite / Win32)  */
/* ------------------------------------------------------------------ */

export type TrackableCategory =
  | 'Deep Work'
  | 'Design'
  | 'Dev'
  | 'Comunicação'
  | 'Distração'
  | 'Neutro'
  | 'Idle';

export type RuleMatchField = 'app_name' | 'domain' | 'url' | 'window_title' | 'any';

export type ActivityEventType =
  | 'window_switch'
  | 'url_change'
  | 'file_change'
  | 'idle_start'
  | 'idle_end';

export interface ActivityRecord {
  id: number;
  appName: string;
  executableName: string;
  processPath: string;
  processId: number;
  windowTitle: string;
  url: string | null;
  domain: string | null;
  projectName: string | null;
  fileName: string | null;
  category: TrackableCategory;
  isProductive: boolean;
  /** Unix timestamp in ms */
  startTime: number;
  /** Unix timestamp in ms */
  endTime: number;
  durationSeconds: number;
  /** Seconds actively typing / clicking / scrolling */
  activeInputSeconds: number;
  /** Seconds reading / watching without input events */
  passiveSeconds: number;
  /** Privacy-safe numeric input cadence counters (never key content) */
  keystrokesCount: number;
  mouseClicksCount: number;
  scrollEventsCount: number;
  syncedAt?: number | null;
  isOngoing?: boolean;
}

export interface ActivityEventRecord {
  id: number;
  clientEventId: string;
  eventType: ActivityEventType;
  appName: string;
  executableName: string;
  windowTitle: string;
  url: string | null;
  domain: string | null;
  projectName: string | null;
  fileName: string | null;
  category: TrackableCategory;
  occurredAt: number;
  durationMs: number;
  keystrokesCount: number;
  mouseClicksCount: number;
  scrollEventsCount: number;
}

export interface ProjectStat {
  projectName: string;
  category: TrackableCategory;
  totalSeconds: number;
  activeInputSeconds: number;
  sessionCount: number;
}

export interface CategoryRule {
  id: number;
  pattern: string;
  matchField: RuleMatchField;
  category: TrackableCategory;
  isProductive: boolean;
  priority: number;
  enabled: boolean;
  createdAt: number;
}

export interface CategoryBreakdownItem {
  category: TrackableCategory;
  seconds: number;
  percentage: number;
}

export interface MetricsSummary {
  /** YYYY-MM-DD */
  date: string;
  /** Active screen time excluding Idle (seconds) */
  totalActiveSeconds: number;
  /** Time marked as productive (Deep Work / Design / Dev / custom productive rules) */
  productiveSeconds: number;
  /** Deep Work + Design + Dev */
  deepWorkSeconds: number;
  communicationSeconds: number;
  neutralSeconds: number;
  distractionSeconds: number;
  idleSeconds: number;
  /** Surgical input cadence metrics */
  activeInputSeconds: number;
  passiveSeconds: number;
  keystrokesCount: number;
  mouseClicksCount: number;
  contextSwitchesCount: number;
  longestFocusStreakSeconds: number;
  /** Number of distraction blocks / context switches into distraction */
  distractionCount: number;
  /** Productive share of total active time (0-100) */
  focusPercentage: number;
  /** Sheldon Focus Score (0-100) balancing deep focus vs distractions */
  sheldonScore: number;
  categoryBreakdown: CategoryBreakdownItem[];
  topProjects: ProjectStat[];
}

export interface TopAppStat {
  key: string;
  appName: string;
  executableName: string;
  processPath: string;
  domain: string | null;
  category: TrackableCategory;
  isProductive: boolean;
  totalSeconds: number;
  activeInputSeconds: number;
  keystrokesCount: number;
  mouseClicksCount: number;
  percentageOfActive: number;
  percentageOfDay: number;
  sessionCount: number;
}

export interface SupabaseSyncStatus {
  configured: boolean;
  authenticated: boolean;
  email: string | null;
  isAnonymous: boolean;
  userId: string | null;
  deviceId: string;
  pendingActivitiesCount: number;
  pendingEventsCount: number;
  syncedActivitiesCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
  projectUrl: string;
}

export interface ActivityTrackerConfig {
  /** Polling interval in ms (1000-2000 ms) */
  pollIntervalMs: number;
  /** System idle threshold in seconds (default 120) */
  idleThresholdSeconds: number;
  /** Flicker debounce in ms (default 2000) */
  debounceMs: number;
  /** Safety DB flush interval in ms (default 60000) */
  flushIntervalMs: number;
  enabled: boolean;
}

export interface TrackerStatus {
  running: boolean;
  isIdle: boolean;
  idleSeconds: number;
  currentSession: ActivityRecord | null;
  config: ActivityTrackerConfig;
}

export interface ReclassifyActivityPayload {
  id: number;
  category: TrackableCategory;
  isProductive?: boolean;
  createRule?: boolean;
  matchField?: RuleMatchField;
  pattern?: string;
  applyToSameTargetToday?: boolean;
}

export interface TimelineBlock {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  label: string;
  category: ActivityCategory;
  details: string;
}

export interface SheldonLeashSettings {
  fullscreenBlockEnabled: boolean;
  forcedTaskkillEnabled: boolean;
  shutdownPcOnLimitEnabled: boolean;
  maxWarningsBeforeKill: number;
  tickTickToken: string;
  tickTickConnected: boolean;
  lunchLockEnabled: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
  workHoursEnabled: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  vacationModeEnabled: boolean;
  vacationStartDate: string;
  vacationEndDate: string;
  autoLaunchEnabled: boolean;
  blacklistedExecutables: string[];
  theme: 'dark' | 'light';
  floatingWidgetEnabled: boolean;
  floatingWidgetAlwaysOnTop: boolean;
}

export interface PersistedAppSettings {
  tickTickToken: string;
  theme: 'dark' | 'light';
  workHoursEnabled: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  vacationModeEnabled: boolean;
  vacationStartDate: string;
  vacationEndDate: string;
  lunchLockEnabled: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
  autoLaunchEnabled: boolean;
}

export interface SentinelScheduleStatus {
  sentinelActive: boolean;
  workHoursEnabled: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  inWorkHours: boolean;
  vacationModeEnabled: boolean;
  vacationStartDate: string;
  vacationEndDate: string;
  inVacation: boolean;
  lockedByWorkHours: boolean;
}

export interface SheldonElectronAPI {
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeToTray: () => Promise<void>;
  quitApp: () => Promise<void>;
  setSentinelMode: (active: boolean) => Promise<void>;
  onSentinelModeChanged: (callback: (active: boolean) => void) => () => void;

  // Blacklist (persisted in Main)
  getBlacklist: () => Promise<string[]>;
  /** Resolves with the updated blacklist. Rejects on invalid/protected executables. */
  addToBlacklist: (executable: string) => Promise<string[]>;
  /** Resolves with the updated blacklist. */
  removeFromBlacklist: (executable: string) => Promise<string[]>;

  // Infraction history (Black Mirror)
  getInfractions: () => Promise<WarningLogItem[]>;
  clearInfractions: () => Promise<void>;
  onInfraction: (callback: (item: WarningLogItem) => void) => () => void;

  // Punishment engine
  getPunishmentStatus: () => Promise<PunishmentStatus>;
  onPunishmentStatus: (callback: (status: PunishmentStatus) => void) => () => void;
  getWatcherConfig: () => Promise<WatcherConfig>;
  updateWatcherConfig: (patch: Partial<WatcherConfig>) => Promise<WatcherConfig>;

  // Floating Desktop Widget (legacy compat)
  showFloatingWidget: (task?: { title: string; remainingSeconds: number; isRunning: boolean }) => Promise<void>;
  hideFloatingWidget: () => Promise<void>;
  updateFloatingWidget: (state: { title: string; remainingSeconds: number; isRunning: boolean }) => Promise<void>;
  onFloatingWidgetAction?: (callback: (action: 'toggle' | 'close' | 'skip') => void) => () => void;

  // Desktop Dynamic Island
  showDynamicIsland: () => Promise<void>;
  hideDynamicIsland: () => Promise<void>;
  updateDynamicIslandState: (state: Partial<DynamicIslandState>) => Promise<void>;
  getDynamicIslandState: () => Promise<DynamicIslandState>;
  onDynamicIslandState: (callback: (state: DynamicIslandState) => void) => () => void;
  dispatchDynamicIslandAction: (action: DynamicIslandAction) => Promise<void>;
  onDynamicIslandAction: (callback: (action: DynamicIslandAction) => void) => () => void;
  setDynamicIslandIgnoreMouse: (ignore: boolean) => void;
  focusDynamicIsland: () => Promise<void>;
  onDynamicIslandBlurred: (callback: () => void) => () => void;
  setDynamicIslandAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
  getIslandIntroPlayed: () => Promise<boolean>;
  setIslandIntroPlayed: (played: boolean) => Promise<void>;
  getQuickNote: () => Promise<string>;
  setQuickNote: (note: string) => Promise<void>;
  onNavigateTab?: (callback: (tab: TabId) => void) => () => void;

  // TickTick Open API bridge (bypasses CORS in Electron Main)
  tickTickGetProjects: (token: string) => Promise<{ success: boolean; projects?: TickTickProject[]; error?: string }>;
  tickTickSyncTasks: (token: string) => Promise<{ success: boolean; tasks?: DailyTask[]; projects?: TickTickProject[]; error?: string }>;
  tickTickCreateTask: (token: string, payload: TickTickTaskPayload) => Promise<{ success: boolean; task?: DailyTask; error?: string }>;
  tickTickUpdateTask: (token: string, payload: TickTickUpdateTaskPayload) => Promise<{ success: boolean; task?: DailyTask; error?: string }>;
  tickTickCompleteTask: (token: string, taskId: string, projectId?: string) => Promise<{ success: boolean; error?: string }>;

  // Persisted App Settings, Schedule & Lifecycle
  getPersistedSettings: () => Promise<PersistedAppSettings>;
  updatePersistedSettings: (patch: Partial<PersistedAppSettings>) => Promise<PersistedAppSettings>;
  getSentinelScheduleStatus: () => Promise<SentinelScheduleStatus>;
  onSentinelScheduleStatusChanged: (callback: (status: SentinelScheduleStatus) => void) => () => void;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  notifyAppHydrated: () => Promise<void>;

  // Real System Media (SMTC / Spotify Now Playing)
  getNowPlayingMedia: () => Promise<NowPlayingMedia>;
  mediaControlAction: (action: 'play-pause' | 'next' | 'prev') => Promise<NowPlayingMedia>;
  onNowPlayingUpdated: (callback: (media: NowPlayingMedia) => void) => () => void;

  // Continuous Activity Tracking & 24h Metrics (SQLite + Supabase)
  getDayTimeline: (date: string) => Promise<ActivityRecord[]>;
  getMetricsSummary: (date: string) => Promise<MetricsSummary>;
  getTopApps: (date: string, limit?: number) => Promise<TopAppStat[]>;
  getDayEvents: (date: string, limit?: number) => Promise<ActivityEventRecord[]>;
  getAppIcon: (processPath: string) => Promise<string | null>;
  reclassifyActivity: (
    payload: ReclassifyActivityPayload
  ) => Promise<{ updated: ActivityRecord | null; ruleCreated?: CategoryRule }>;
  getCategoryRules: () => Promise<CategoryRule[]>;
  upsertCategoryRule: (
    rule: Omit<CategoryRule, 'id' | 'createdAt'> & { id?: number }
  ) => Promise<CategoryRule[]>;
  deleteCategoryRule: (id: number) => Promise<CategoryRule[]>;
  getTrackerStatus: () => Promise<TrackerStatus>;
  updateTrackerConfig: (patch: Partial<ActivityTrackerConfig>) => Promise<ActivityTrackerConfig>;
  onMetricsUpdated: (callback: (status: TrackerStatus) => void) => () => void;

  // Supabase Cloud Sync & Auth
  getSupabaseSyncStatus: () => Promise<SupabaseSyncStatus>;
  supabaseSignIn: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; status: SupabaseSyncStatus }>;
  supabaseSignUp: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; needsEmailConfirmation?: boolean; error?: string; status: SupabaseSyncStatus }>;
  supabaseSignInAnonymously: () => Promise<{
    ok: boolean;
    error?: string;
    status: SupabaseSyncStatus;
  }>;
  supabaseVerifyOtp: (
    email: string,
    token: string
  ) => Promise<{ ok: boolean; error?: string; status: SupabaseSyncStatus }>;
  supabaseSignOut: () => Promise<SupabaseSyncStatus>;
  supabaseSyncNow: () => Promise<{
    synced: number;
    error?: string;
    status: SupabaseSyncStatus;
  }>;
  onSupabaseStatusChanged: (callback: (status: SupabaseSyncStatus) => void) => () => void;
}
