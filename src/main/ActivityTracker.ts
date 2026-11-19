import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { powerMonitor } from 'electron';
import path from 'path';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import { uIOhook } from 'uiohook-napi';
import type {
  ActivityEventType,
  ActivityRecord,
  ActivityTrackerConfig,
  TrackableCategory,
  TrackerStatus,
} from '../shared/types';
import type { ActivityDatabase } from './Database';
import { BrowserUrlProbe } from './UrlProbe';
import type { ActiveWindowSample } from './win32-probe.worker';

const execFileAsync = promisify(execFile);

export const DEFAULT_TRACKER_CONFIG: ActivityTrackerConfig = {
  pollIntervalMs: 1500,
  idleThresholdSeconds: 120,
  debounceMs: 2000,
  flushIntervalMs: 60_000,
  enabled: true,
};

const BROWSER_EXECUTABLES = new Set([
  'chrome.exe',
  'msedge.exe',
  'brave.exe',
  'firefox.exe',
  'opera.exe',
  'opera_gx.exe',
  'vivaldi.exe',
  'arc.exe',
  'zen.exe',
]);

const BROWSER_APP_NAMES =
  /\b(google chrome|chrome|microsoft edge|edge|brave|mozilla firefox|firefox|opera(?:\s*gx)?|vivaldi|arc)\b/i;

const BROWSER_SUFFIX_REGEX =
  /(?:\s+(?:e\s+mais|and)\s+\d+\s+p[aá]ginas?|\s+\d+\s+more\s+pages?)?(?:\s*[-–—]\s*(?:Perfil\s*\d+|Profile\s*\d+|Pessoal|Trabalho|Work|Personal|Guest|Convidado|InPrivate|Inc[oô]gnit[oa]|Navega[cç][aã]o Privativa))?\s*[-–—]\s*(?:Google Chrome|Microsoft\s*Edge|Brave|Mozilla Firefox|Firefox|Opera(?:\s*GX)?|Vivaldi|Arc)(?:\s*\([^)]*\))?$/i;

const EXPLICIT_DOMAIN_REGEX =
  /\b((?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|app|ai|br|edu|gov|co|tv|me|gg|so|cloud|tech)(?:\.[a-z]{2})?|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)\b/i;

const KNOWN_SITE_SIGNATURES: Array<{ pattern: RegExp; domain: string }> = [
  { pattern: /\byoutube(?:\s+music|\s+studio)?\b/i, domain: 'youtube.com' },
  { pattern: /\bgithub\b/i, domain: 'github.com' },
  { pattern: /\bgitlab\b/i, domain: 'gitlab.com' },
  { pattern: /\bbitbucket\b/i, domain: 'bitbucket.org' },
  { pattern: /(?:^|\s|[-–—|/])x(?:\s|$)|\btwitter\b|\bon x:/i, domain: 'x.com' },
  { pattern: /\bnotion\b/i, domain: 'notion.so' },
  { pattern: /\bfigma\b/i, domain: 'figma.com' },
  { pattern: /\blinear\b/i, domain: 'linear.app' },
  { pattern: /\bslack\b/i, domain: 'slack.com' },
  { pattern: /\bdiscord\b/i, domain: 'discord.com' },
  { pattern: /\bwhatsapp(?:\s+web)?\b/i, domain: 'web.whatsapp.com' },
  { pattern: /\btelegram(?:\s+web)?\b/i, domain: 'web.telegram.org' },
  {
    pattern: /\bgmail\b|\bgoogle mail\b|\bcaixa de entrada\b/i,
    domain: 'mail.google.com',
  },
  {
    pattern: /\bgoogle docs\b|\bdocumentos google\b/i,
    domain: 'docs.google.com',
  },
  {
    pattern: /\bgoogle sheets\b|\bplanilhas google\b/i,
    domain: 'sheets.google.com',
  },
  {
    pattern: /\bgoogle slides\b|\bapresenta[cç][oõ]es google\b/i,
    domain: 'slides.google.com',
  },
  { pattern: /\bgoogle meet\b|\bmeet\s*[-–—]/i, domain: 'meet.google.com' },
  {
    pattern: /\bgoogle calendar\b|\bgoogle agenda\b/i,
    domain: 'calendar.google.com',
  },
  { pattern: /\bgoogle drive\b/i, domain: 'drive.google.com' },
  { pattern: /\bchatgpt\b|\bopenai\b/i, domain: 'chatgpt.com' },
  { pattern: /\bclaude\b/i, domain: 'claude.ai' },
  {
    pattern: /\bgoogle ai studio\b|\bgemini\b/i,
    domain: 'gemini.google.com',
  },
  { pattern: /\bstack\s*overflow\b/i, domain: 'stackoverflow.com' },
  {
    pattern: /\bmdn web docs\b|\bmozilla developer\b/i,
    domain: 'developer.mozilla.org',
  },
  { pattern: /\breddit\b/i, domain: 'reddit.com' },
  { pattern: /\btwitch\b/i, domain: 'twitch.tv' },
  { pattern: /\binstagram\b/i, domain: 'instagram.com' },
  { pattern: /\bfacebook\b/i, domain: 'facebook.com' },
  { pattern: /\blinkedin\b/i, domain: 'linkedin.com' },
  { pattern: /\bnetflix\b/i, domain: 'netflix.com' },
  { pattern: /\bprime video\b/i, domain: 'primevideo.com' },
  { pattern: /\btiktok\b/i, domain: 'tiktok.com' },
  { pattern: /\bspotify\b/i, domain: 'open.spotify.com' },
  { pattern: /\bsupabase\b/i, domain: 'supabase.com' },
  { pattern: /\bvercel\b/i, domain: 'vercel.com' },
  { pattern: /\bfirebase\b/i, domain: 'firebase.google.com' },
  { pattern: /\bticktick\b/i, domain: 'ticktick.com' },
  { pattern: /\btrello\b/i, domain: 'trello.com' },
  { pattern: /\bjira\b|\bconfluence\b/i, domain: 'atlassian.net' },
  { pattern: /\bcoursera\b/i, domain: 'coursera.org' },
  { pattern: /\budemy\b/i, domain: 'udemy.com' },
  {
    pattern: /\bgoogle\s*(?:pesquisa|search)?\b/i,
    domain: 'google.com',
  },
];

const LOCK_SCREEN_EXECUTABLES = new Set(['lockapp.exe', 'logonui.exe']);

export function isBrowserWindow(appName: string, processPath: string): boolean {
  const exe = path.basename(processPath || '').toLowerCase();
  if (exe && BROWSER_EXECUTABLES.has(exe)) return true;
  return BROWSER_APP_NAMES.test(appName);
}

/**
 * Extracts active site/domain from Chrome, Edge, Brave, Firefox, and Opera window titles
 * as a reliable fallback when UIAutomation does not return an address bar URL.
 */
export function extractBrowserDomain(
  appName: string,
  processPath: string,
  windowTitle: string
): string | null {
  if (!windowTitle || !isBrowserWindow(appName, processPath)) return null;

  const stripped = windowTitle
    .replace(/^\(\d+\)\s*/, '')
    .replace(BROWSER_SUFFIX_REGEX, '')
    .trim();

  if (!stripped) return null;

  const domainMatch = EXPLICIT_DOMAIN_REGEX.exec(stripped);
  if (domainMatch) {
    return domainMatch[1].toLowerCase().replace(/^www\./, '');
  }

  for (const sig of KNOWN_SITE_SIGNATURES) {
    if (sig.pattern.test(stripped)) {
      return sig.domain;
    }
  }

  return null;
}

/**
 * Surgical extraction of active Project / Repository / Workspace and File / Page
 * from IDE, design tool, terminal, and browser URLs/titles.
 */
export function extractProjectAndFile(
  appName: string,
  windowTitle: string,
  url: string | null,
  domain: string | null
): { projectName: string | null; fileName: string | null } {
  const appLower = appName.toLowerCase();
  const title = (windowTitle || '').trim();

  // 1) VS Code / Cursor / Windsurf / Antigravity
  if (
    /^(code|code insiders|cursor|windsurf|antigravity)$/i.test(appLower) ||
    /visual studio code|cursor|windsurf|antigravity/i.test(title)
  ) {
    const cleaned = title
      .replace(/^●\s*/, '')
      .replace(
        /\s*[-–—]\s*(?:Visual Studio Code|Code|Cursor|Windsurf|Antigravity)(?:\s*\[[^\]]+\])?$/i,
        ''
      )
      .trim();

    const parts = cleaned
      .split(/\s+[-–—]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return {
        fileName: parts[0],
        projectName: parts[parts.length - 1].replace(/\s*\(Workspace\)$/i, ''),
      };
    }
    if (parts.length === 1) {
      return { projectName: parts[0], fileName: null };
    }
  }

  // 2) Figma
  if (appLower === 'figma' || domain === 'figma.com') {
    const cleaned = title
      .replace(/\s*[-–—]\s*Figma$/i, '')
      .replace(BROWSER_SUFFIX_REGEX, '')
      .trim();
    const parts = cleaned
      .split(/\s+[-–—]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return { projectName: parts[0], fileName: parts.slice(1).join(' — ') };
    }
    if (cleaned) {
      return { projectName: cleaned, fileName: null };
    }
  }

  // 3) JetBrains IDEs
  if (/(webstorm|pycharm|intellij|rider|goland|clion|datagrip)/i.test(appLower)) {
    const parts = title
      .split(/\s+[–—-]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return { projectName: parts[0], fileName: parts[1] };
    }
  }

  // 4) GitHub URL parsing (github.com/owner/repo/...)
  if (url && domain === 'github.com') {
    try {
      const parsed = new URL(url);
      const segs = parsed.pathname.split('/').filter(Boolean);
      if (segs.length >= 2) {
        const repo = `${segs[0]}/${segs[1]}`;
        const sub = segs.length > 2 ? segs.slice(2).join('/') : null;
        return { projectName: repo, fileName: sub };
      }
    } catch {
      // ignore
    }
  }

  // 5) Supabase URL parsing
  if (url && domain === 'supabase.com') {
    try {
      const parsed = new URL(url);
      const match = /\/project\/([a-z0-9]+)/i.exec(parsed.pathname);
      if (match) {
        return {
          projectName: `Supabase (${match[1]})`,
          fileName: parsed.pathname.split('/').pop() || null,
        };
      }
    } catch {
      // ignore
    }
  }

  // 6) Generic browser tab title cleanup -> fileName = cleaned page title
  if (domain) {
    const cleanTab = title
      .replace(/^\(\d+\)\s*/, '')
      .replace(BROWSER_SUFFIX_REGEX, '')
      .trim();
    return {
      projectName: domain,
      fileName: cleanTab || null,
    };
  }

  return { projectName: null, fileName: null };
}

interface EnrichedWindowSample extends ActiveWindowSample {
  url: string | null;
  domain: string | null;
  projectName: string | null;
  fileName: string | null;
}

interface InMemorySession {
  dbId: number | null;
  clientSyncId: string | null;
  key: string;
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
  startTime: number;
  endTime: number;
  activeInputSeconds: number;
  passiveSeconds: number;
  keystrokesCount: number;
  mouseClicksCount: number;
  scrollEventsCount: number;
}

interface PendingCandidate {
  key: string;
  sample: EnrichedWindowSample;
  firstSeenAt: number;
}

export interface ActivityTrackerEvents {
  updated: (status: TrackerStatus) => void;
  flushed: () => void;
}

export declare interface ActivityTracker {
  on<E extends keyof ActivityTrackerEvents>(
    event: E,
    listener: ActivityTrackerEvents[E]
  ): this;
  emit<E extends keyof ActivityTrackerEvents>(
    event: E,
    ...args: Parameters<ActivityTrackerEvents[E]>
  ): boolean;
}

function clampConfig(
  patch: Partial<ActivityTrackerConfig>,
  base: ActivityTrackerConfig
): ActivityTrackerConfig {
  const clamp = (val: unknown, min: number, max: number, fb: number) => {
    const n = typeof val === 'number' && Number.isFinite(val) ? val : fb;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return {
    pollIntervalMs: clamp(patch.pollIntervalMs, 1000, 2000, base.pollIntervalMs),
    idleThresholdSeconds: clamp(
      patch.idleThresholdSeconds,
      15,
      3600,
      base.idleThresholdSeconds
    ),
    debounceMs: clamp(patch.debounceMs, 1000, 10_000, base.debounceMs),
    flushIntervalMs: clamp(
      patch.flushIntervalMs,
      10_000,
      300_000,
      base.flushIntervalMs
    ),
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : base.enabled,
  };
}

/**
 * Surgical Continuous Activity Tracker (Rize / RescueTime level):
 * - Win32 off-thread window probe (`koffi` in worker_threads)
 * - Exact Browser URL extraction (`Windows UIAutomation`)
 * - Project / Repository / File parsing
 * - Privacy-safe real OS input cadence via `uiohook-napi` (counters only, never key content)
 * - Idle detection via `powerMonitor.getSystemIdleTime()`
 * - In-memory buffering + <2s debounce + 60s safety flush + granular `activity_events`
 */
export class ActivityTracker extends EventEmitter {
  private config: ActivityTrackerConfig;
  private worker: Worker | null = null;
  private readonly urlProbe = new BrowserUrlProbe();
  private workerReqSeq = 0;
  private readonly pendingWorkerCalls = new Map<
    number,
    { resolve: (val: ActiveWindowSample | null) => void; timer: NodeJS.Timeout }
  >();

  private pollTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private running = false;
  private pollingInFlight = false;
  private systemLockedOrSuspended = false;
  private lastIdleSeconds = 0;
  private lastPollAtMs = 0;

  // Input cadence counters (privacy-safe numeric counters only)
  private hookActive = false;
  private lastInputAtMs = Date.now();
  private readonly onKeyDown = () => {
    this.lastInputAtMs = Date.now();
    if (this.activeSession && this.activeSession.category !== 'Idle') {
      this.activeSession.keystrokesCount += 1;
    }
  };
  private readonly onMouseDown = () => {
    this.lastInputAtMs = Date.now();
    if (this.activeSession && this.activeSession.category !== 'Idle') {
      this.activeSession.mouseClicksCount += 1;
    }
  };
  private readonly onWheel = () => {
    this.lastInputAtMs = Date.now();
    if (this.activeSession && this.activeSession.category !== 'Idle') {
      this.activeSession.scrollEventsCount += 1;
    }
  };

  private activeSession: InMemorySession | null = null;
  private pendingCandidate: PendingCandidate | null = null;

  constructor(
    private readonly db: ActivityDatabase,
    initialConfig?: Partial<ActivityTrackerConfig>
  ) {
    super();
    this.config = clampConfig(initialConfig ?? {}, DEFAULT_TRACKER_CONFIG);
    this.bindPowerMonitorEvents();
  }

  private bindPowerMonitorEvents(): void {
    powerMonitor.on('suspend', () => {
      this.systemLockedOrSuspended = true;
      this.transitionToIdle(Date.now(), 0);
    });
    powerMonitor.on('lock-screen', () => {
      this.systemLockedOrSuspended = true;
      this.transitionToIdle(Date.now(), 0);
    });
    powerMonitor.on('resume', () => {
      this.systemLockedOrSuspended = false;
      void this.pollOnce();
    });
    powerMonitor.on('unlock-screen', () => {
      this.systemLockedOrSuspended = false;
      void this.pollOnce();
    });
  }

  private startInputHook(): void {
    if (this.hookActive) return;
    try {
      uIOhook.on('keydown', this.onKeyDown);
      uIOhook.on('mousedown', this.onMouseDown);
      uIOhook.on('wheel', this.onWheel);
      uIOhook.start();
      this.hookActive = true;
      console.log('⌨️ [Sheldon ActivityTracker] Cadência nativa de input (uiohook-napi) ativa.');
    } catch (err) {
      console.warn(
        '[Sheldon ActivityTracker] uiohook-napi indisponível, usando fallback getSystemIdleTime:',
        err
      );
      this.hookActive = false;
    }
  }

  private stopInputHook(): void {
    if (!this.hookActive) return;
    try {
      uIOhook.removeListener('keydown', this.onKeyDown);
      uIOhook.removeListener('mousedown', this.onMouseDown);
      uIOhook.removeListener('wheel', this.onWheel);
      uIOhook.stop();
    } catch {
      // ignore cleanup error
    } finally {
      this.hookActive = false;
    }
  }

  private ensureWorker(): Worker | null {
    if (process.platform !== 'win32') return null;
    if (this.worker) return this.worker;

    try {
      const workerPath = path.join(__dirname, 'win32-probe.worker.js');
      const w = new Worker(workerPath);
      w.on('message', (msg: { id: number; window: ActiveWindowSample | null }) => {
        const pending = this.pendingWorkerCalls.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pendingWorkerCalls.delete(msg.id);
        pending.resolve(msg.window);
      });
      w.on('error', (err) => {
        console.error('[Sheldon ActivityTracker] Worker Win32 erro:', err);
        this.rejectAllPendingWorkerCalls();
        this.worker = null;
      });
      w.on('exit', () => {
        this.rejectAllPendingWorkerCalls();
        this.worker = null;
      });
      this.worker = w;
      return w;
    } catch (err) {
      console.error('[Sheldon ActivityTracker] Falha ao iniciar Worker Win32:', err);
      return null;
    }
  }

  private rejectAllPendingWorkerCalls(): void {
    for (const [id, pending] of this.pendingWorkerCalls.entries()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
      this.pendingWorkerCalls.delete(id);
    }
  }

  private async sampleActiveWindow(): Promise<ActiveWindowSample | null> {
    if (process.platform === 'win32') {
      const worker = this.ensureWorker();
      if (!worker) return null;

      const reqId = ++this.workerReqSeq;
      return new Promise<ActiveWindowSample | null>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingWorkerCalls.delete(reqId);
          resolve(null);
        }, 850);

        this.pendingWorkerCalls.set(reqId, { resolve, timer });
        worker.postMessage({ id: reqId });
      });
    }

    if (process.platform === 'darwin') {
      try {
        const { stdout } = await execFileAsync('osascript', [
          '-e',
          'tell application "System Events" to get {name, title of front window} of first application process whose frontmost is true',
        ]);
        const [appName, windowTitle] = stdout.trim().split(', ');
        if (!appName) return null;
        return {
          hwnd: 0,
          appName,
          executableName: appName,
          processPath: appName,
          windowTitle: windowTitle || appName,
          processId: 0,
        };
      } catch {
        return null;
      }
    }

    return null;
  }

  private async enrichSample(
    sample: ActiveWindowSample
  ): Promise<EnrichedWindowSample> {
    let url: string | null = null;
    let domain: string | null = null;

    if (isBrowserWindow(sample.appName, sample.processPath)) {
      if (sample.hwnd) {
        const uia = await this.urlProbe.getBrowserUrl(
          sample.hwnd,
          sample.windowTitle
        );
        url = uia.url;
        domain = uia.domain;
      }
      if (!domain) {
        domain = extractBrowserDomain(
          sample.appName,
          sample.processPath,
          sample.windowTitle
        );
      }
    }

    const { projectName, fileName } = extractProjectAndFile(
      sample.appName,
      sample.windowTitle,
      url,
      domain
    );

    return {
      ...sample,
      url,
      domain,
      projectName,
      fileName,
    };
  }

  start(): void {
    if (this.running || !this.config.enabled) return;
    this.running = true;
    this.lastPollAtMs = Date.now();
    this.ensureWorker();
    this.startInputHook();
    this.scheduleTimers();
    void this.pollOnce();
    console.log(
      `📊 [Sheldon ActivityTracker] Motor cirúrgico iniciado (poll=${this.config.pollIntervalMs}ms, idle=${this.config.idleThresholdSeconds}s).`
    );
    this.emitStatus();
  }

  stop(): void {
    if (!this.running && !this.activeSession) return;
    this.running = false;
    this.clearTimers();
    this.stopInputHook();
    this.flushNow();
    this.activeSession = null;
    this.pendingCandidate = null;
    this.rejectAllPendingWorkerCalls();
    this.urlProbe.stop();
    if (this.worker) {
      void this.worker.terminate();
      this.worker = null;
    }
    console.log('📊 [Sheldon ActivityTracker] Encerrado e sessão consolidada.');
    this.emitStatus();
  }

  getConfig(): ActivityTrackerConfig {
    return { ...this.config };
  }

  updateConfig(patch: Partial<ActivityTrackerConfig>): ActivityTrackerConfig {
    const prevEnabled = this.config.enabled;
    this.config = clampConfig(patch, this.config);

    if (!this.config.enabled && prevEnabled) {
      this.stop();
    } else if (this.config.enabled && !this.running) {
      this.start();
    } else if (this.running) {
      this.scheduleTimers();
    }

    this.emitStatus();
    return this.getConfig();
  }

  getLiveSession(): ActivityRecord | null {
    if (!this.activeSession) return null;
    const now = Math.max(this.activeSession.endTime, Date.now());
    return {
      id: this.activeSession.dbId ?? -1,
      appName: this.activeSession.appName,
      executableName: this.activeSession.executableName,
      processPath: this.activeSession.processPath,
      processId: this.activeSession.processId,
      windowTitle: this.activeSession.windowTitle,
      url: this.activeSession.url,
      domain: this.activeSession.domain,
      projectName: this.activeSession.projectName,
      fileName: this.activeSession.fileName,
      category: this.activeSession.category,
      isProductive: this.activeSession.isProductive,
      startTime: this.activeSession.startTime,
      endTime: now,
      durationSeconds: Math.max(
        1,
        Math.round((now - this.activeSession.startTime) / 1000)
      ),
      activeInputSeconds: Math.round(this.activeSession.activeInputSeconds),
      passiveSeconds: Math.round(this.activeSession.passiveSeconds),
      keystrokesCount: this.activeSession.keystrokesCount,
      mouseClicksCount: this.activeSession.mouseClicksCount,
      scrollEventsCount: this.activeSession.scrollEventsCount,
      isOngoing: true,
    };
  }

  getStatus(): TrackerStatus {
    return {
      running: this.running,
      isIdle: this.activeSession?.category === 'Idle',
      idleSeconds: this.lastIdleSeconds,
      currentSession: this.getLiveSession(),
      config: this.getConfig(),
    };
  }

  syncReclassifiedRecord(record: ActivityRecord | null): void {
    if (!record || !this.activeSession) return;
    if (this.activeSession.dbId === record.id) {
      this.activeSession.category = record.category;
      this.activeSession.isProductive = record.isProductive;
      this.emitStatus();
    }
  }

  reclassifyLiveIfUnpersisted(
    category: TrackableCategory,
    isProductive: boolean
  ): ActivityRecord | null {
    if (!this.activeSession) return null;
    this.activeSession.category = category;
    this.activeSession.isProductive = isProductive;
    this.persistSessionObject(this.activeSession);
    this.emitStatus();
    return this.getLiveSession();
  }

  flushNow(): void {
    if (!this.activeSession) return;
    const now = Math.max(this.activeSession.endTime, Date.now());
    this.activeSession.endTime = now;

    const elapsedMs = now - this.activeSession.startTime;
    if (elapsedMs < this.config.debounceMs && this.activeSession.dbId === null) {
      return;
    }

    this.persistSessionObject(this.activeSession);
    this.emit('flushed');
  }

  private scheduleTimers(): void {
    this.clearTimers();
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, this.config.pollIntervalMs);

    this.flushTimer = setInterval(() => {
      this.flushNow();
      this.emitStatus();
    }, this.config.flushIntervalMs);
  }

  private clearTimers(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.running || this.pollingInFlight) return;
    this.pollingInFlight = true;

    try {
      const now = Date.now();
      const tickDeltaSec =
        this.lastPollAtMs > 0
          ? Math.min(10, Math.max(0.5, (now - this.lastPollAtMs) / 1000))
          : this.config.pollIntervalMs / 1000;
      this.lastPollAtMs = now;

      const idleSeconds = powerMonitor.getSystemIdleTime();
      this.lastIdleSeconds = idleSeconds;

      // 1) Idle / AFK check
      if (
        this.systemLockedOrSuspended ||
        idleSeconds >= this.config.idleThresholdSeconds
      ) {
        this.pendingCandidate = null;
        this.transitionToIdle(now, idleSeconds);
        return;
      }

      // 2) Active window probe + UIAutomation URL capture
      const rawSample = await this.sampleActiveWindow();
      if (!this.running || !rawSample) return;

      const exeName = path.basename(rawSample.processPath || '').toLowerCase();
      if (LOCK_SCREEN_EXECUTABLES.has(exeName)) {
        this.pendingCandidate = null;
        this.transitionToIdle(now, idleSeconds);
        return;
      }

      const sample = await this.enrichSample(rawSample);
      if (!this.running) return;

      const sessionKey = this.buildSessionKey(sample);

      // 3) Returning from Idle
      if (this.activeSession && this.activeSession.category === 'Idle') {
        const idleDurationMs = now - this.activeSession.startTime;
        this.recordGranularEvent(
          'idle_end',
          this.activeSession,
          now,
          idleDurationMs
        );
        this.finalizeActiveSession(now);
        this.startNewSession(sample, sessionKey, now, 'window_switch');
        this.pendingCandidate = null;
        this.emitStatus();
        return;
      }

      // 4) First session on boot
      if (!this.activeSession) {
        this.startNewSession(sample, sessionKey, now, 'window_switch');
        this.pendingCandidate = null;
        this.emitStatus();
        return;
      }

      // 5) Same context -> accumulate active vs passive cadence in memory
      if (this.activeSession.key === sessionKey) {
        this.activeSession.endTime = now;
        const recentlyInteracted = this.hookActive
          ? now - this.lastInputAtMs <= 5000
          : idleSeconds <= 5;

        if (recentlyInteracted) {
          this.activeSession.activeInputSeconds += tickDeltaSec;
        } else {
          this.activeSession.passiveSeconds += tickDeltaSec;
        }
        this.pendingCandidate = null;
        return;
      }

      // 6) Context changed -> <2s flicker debounce
      if (!this.pendingCandidate || this.pendingCandidate.key !== sessionKey) {
        this.pendingCandidate = {
          key: sessionKey,
          sample,
          firstSeenAt: now,
        };
        return;
      }

      if (now - this.pendingCandidate.firstSeenAt >= this.config.debounceMs) {
        const switchAt = this.pendingCandidate.firstSeenAt;
        const prev = this.activeSession;
        const nextSample = this.pendingCandidate.sample;

        const eventType = this.determineTransitionEventType(prev, nextSample);
        this.finalizeActiveSession(switchAt);
        this.startNewSession(nextSample, this.pendingCandidate.key, switchAt, eventType);

        if (this.activeSession) {
          this.activeSession.endTime = now;
        }
        this.pendingCandidate = null;
        this.emitStatus();
      }
    } catch (err) {
      console.error('[Sheldon ActivityTracker] Erro durante ciclo de captura:', err);
    } finally {
      this.pollingInFlight = false;
    }
  }

  private determineTransitionEventType(
    prev: InMemorySession,
    next: EnrichedWindowSample
  ): ActivityEventType {
    if (prev.appName.toLowerCase() === next.appName.toLowerCase()) {
      if ((prev.url || prev.domain) !== (next.url || next.domain)) {
        return 'url_change';
      }
      if (prev.fileName !== next.fileName || prev.windowTitle !== next.windowTitle) {
        return 'file_change';
      }
    }
    return 'window_switch';
  }

  private transitionToIdle(now: number, idleSeconds: number): void {
    const idleBackdatedStart =
      idleSeconds > 0 ? Math.max(0, now - idleSeconds * 1000) : now;

    if (this.activeSession?.category === 'Idle') {
      this.activeSession.endTime = now;
      return;
    }

    let idleStart = idleBackdatedStart;
    if (this.activeSession) {
      const activeEnd = Math.max(
        this.activeSession.startTime,
        Math.min(now, idleBackdatedStart)
      );
      this.finalizeActiveSession(activeEnd);
      idleStart = activeEnd;
    }

    this.activeSession = {
      dbId: null,
      clientSyncId: null,
      key: '__IDLE__',
      appName: 'Ausente/Pausa',
      executableName: '',
      processPath: '',
      processId: 0,
      windowTitle: 'Usuário ausente (inatividade detectada)',
      url: null,
      domain: null,
      projectName: null,
      fileName: null,
      category: 'Idle',
      isProductive: false,
      startTime: idleStart,
      endTime: now,
      activeInputSeconds: 0,
      passiveSeconds: 0,
      keystrokesCount: 0,
      mouseClicksCount: 0,
      scrollEventsCount: 0,
    };

    this.recordGranularEvent('idle_start', this.activeSession, idleStart, 0);
    this.emitStatus();
  }

  private startNewSession(
    sample: EnrichedWindowSample,
    key: string,
    startTime: number,
    eventType: ActivityEventType
  ): void {
    const classified = this.db.classifyActivity(
      sample.appName,
      sample.windowTitle,
      sample.domain,
      sample.url
    );

    this.activeSession = {
      dbId: null,
      clientSyncId: null,
      key,
      appName: sample.appName,
      executableName: sample.executableName,
      processPath: sample.processPath,
      processId: sample.processId,
      windowTitle: sample.windowTitle,
      url: sample.url,
      domain: sample.domain,
      projectName: sample.projectName,
      fileName: sample.fileName,
      category: classified.category,
      isProductive: classified.isProductive,
      startTime,
      endTime: startTime,
      activeInputSeconds: 0,
      passiveSeconds: 0,
      keystrokesCount: 0,
      mouseClicksCount: 0,
      scrollEventsCount: 0,
    };

    this.recordGranularEvent(eventType, this.activeSession, startTime, 0);
  }

  private recordGranularEvent(
    eventType: ActivityEventType,
    session: InMemorySession,
    occurredAt: number,
    durationMs: number
  ): void {
    try {
      this.db.insertActivityEvent({
        eventType,
        activitySyncId: session.clientSyncId,
        appName: session.appName,
        executableName: session.executableName,
        windowTitle: session.windowTitle,
        url: session.url,
        domain: session.domain,
        projectName: session.projectName,
        fileName: session.fileName,
        category: session.category,
        occurredAt,
        durationMs,
        keystrokesCount: session.keystrokesCount,
        mouseClicksCount: session.mouseClicksCount,
        scrollEventsCount: session.scrollEventsCount,
      });
    } catch (err) {
      console.error('[Sheldon ActivityTracker] Falha ao gravar evento cirúrgico:', err);
    }
  }

  private finalizeActiveSession(endTime: number): void {
    if (!this.activeSession) return;
    this.activeSession.endTime = Math.max(this.activeSession.startTime, endTime);
    const elapsedMs = this.activeSession.endTime - this.activeSession.startTime;

    if (elapsedMs >= this.config.debounceMs || this.activeSession.dbId !== null) {
      this.persistSessionObject(this.activeSession);
      this.emit('flushed');
    }

    this.activeSession = null;
  }

  private persistSessionObject(session: InMemorySession): void {
    const durationSeconds = Math.max(
      1,
      Math.round((session.endTime - session.startTime) / 1000)
    );
    const activeSec = Math.min(durationSeconds, Math.round(session.activeInputSeconds));
    const passiveSec = Math.max(0, durationSeconds - activeSec);

    if (session.dbId === null) {
      const inserted = this.db.insertActivity({
        appName: session.appName,
        executableName: session.executableName,
        processPath: session.processPath,
        processId: session.processId,
        windowTitle: session.windowTitle,
        url: session.url,
        domain: session.domain,
        projectName: session.projectName,
        fileName: session.fileName,
        category: session.category,
        isProductive: session.isProductive,
        startTime: session.startTime,
        endTime: session.endTime,
        durationSeconds,
        activeInputSeconds: activeSec,
        passiveSeconds: passiveSec,
        keystrokesCount: session.keystrokesCount,
        mouseClicksCount: session.mouseClicksCount,
        scrollEventsCount: session.scrollEventsCount,
      });
      session.dbId = inserted.id;
      session.clientSyncId = inserted.clientSyncId;
    } else {
      this.db.updateActivityMetrics(session.dbId, {
        startTime: session.startTime,
        endTime: session.endTime,
        activeInputSeconds: activeSec,
        passiveSeconds: passiveSec,
        keystrokesCount: session.keystrokesCount,
        mouseClicksCount: session.mouseClicksCount,
        scrollEventsCount: session.scrollEventsCount,
        url: session.url,
        domain: session.domain,
        projectName: session.projectName,
        fileName: session.fileName,
      });
    }
  }

  private buildSessionKey(sample: EnrichedWindowSample): string {
    return `${sample.appName.toLowerCase()}||${(sample.url || sample.domain || '').toLowerCase()}||${sample.windowTitle}`;
  }

  private emitStatus(): void {
    this.emit('updated', this.getStatus());
  }
}
