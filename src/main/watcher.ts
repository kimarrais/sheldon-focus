import { exec, execFile } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { promisify } from 'util';
import type {
  ActivePunishment,
  PunishmentStage,
  PunishmentStatus,
  WarningLogItem,
  WarningSeverity,
} from '../shared/types';
import type { OverlayManager } from './overlays';
import type { SheldonStore } from './store';

const execFileAsync = promisify(execFile);

/* ------------------------------------------------------------------ */
/* Process helpers                                                     */
/* ------------------------------------------------------------------ */

const EXECUTABLE_PATTERN = /^[A-Za-z0-9 _.()+\-]{1,120}\.exe$/i;

/** Critical Windows / app processes that must never be blacklisted (taskkill on them = BSOD / lockout). */
const PROTECTED_EXECUTABLES = new Set(
  [
    'system',
    'smss.exe',
    'csrss.exe',
    'wininit.exe',
    'winlogon.exe',
    'services.exe',
    'lsass.exe',
    'lsaiso.exe',
    'svchost.exe',
    'dwm.exe',
    'explorer.exe',
    'fontdrvhost.exe',
    'sihost.exe',
    'ctfmon.exe',
    'conhost.exe',
    'taskmgr.exe',
    'taskhostw.exe',
    'runtimebroker.exe',
    'spoolsv.exe',
    'audiodg.exe',
    'logonui.exe',
    'userinit.exe',
    'startmenuexperiencehost.exe',
    'shellexperiencehost.exe',
    'searchhost.exe',
    'msmpeng.exe',
    'electron.exe',
    'sheldon focus.exe',
    path.basename(process.execPath).toLowerCase(),
  ].map((x) => x.toLowerCase())
);

export type NormalizeResult = { ok: true; value: string } | { ok: false; error: string };

/** Normalizes user input (`C:\Games\Steam.exe`, `steam`) into a safe image name (`steam.exe`). */
export function normalizeExecutableName(input: unknown): NormalizeResult {
  if (typeof input !== 'string') return { ok: false, error: 'Nome de executável inválido.' };
  let name = input.trim().replace(/^"+|"+$/g, '');
  name = name.split(/[\\/]/).pop() ?? '';
  if (!name) return { ok: false, error: 'Nome de executável vazio.' };
  if (!/\.exe$/i.test(name)) name = `${name}.exe`;

  if (!EXECUTABLE_PATTERN.test(name)) {
    return { ok: false, error: `"${name}" contém caracteres inválidos para um executável.` };
  }
  if (PROTECTED_EXECUTABLES.has(name.toLowerCase())) {
    return { ok: false, error: `"${name}" é um processo protegido do sistema e não pode ser bloqueado.` };
  }
  return { ok: true, value: name };
}

/** Returns the image names of every running process. */
export async function listRunningProcesses(): Promise<string[]> {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 10_000,
    });
    const names: string[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const match = /^"([^"]+)"/.exec(line);
      if (match) names.push(match[1]);
    }
    return names;
  }

  // Non-Windows fallback (dev only)
  const { stdout } = await execFileAsync('ps', ['-A', '-o', 'comm='], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 10_000,
  });
  return stdout
    .split('\n')
    .map((l) => path.basename(l.trim()))
    .filter(Boolean);
}

async function isProcessRunning(executable: string): Promise<boolean> {
  const key = executable.toLowerCase();
  const running = await listRunningProcesses();
  return running.some((name) => name.toLowerCase() === key);
}

/** Executes `taskkill /F /IM <executable>`. */
export function killProcess(executable: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const check = normalizeExecutableName(executable);
    if (!check.ok) {
      resolve({ success: false, output: check.error });
      return;
    }
    if (process.platform !== 'win32') {
      resolve({ success: false, output: 'taskkill só está disponível no Windows.' });
      return;
    }
    exec(`taskkill /F /IM "${check.value}"`, { windowsHide: true, timeout: 15_000 }, (error, stdout, stderr) => {
      const output = `${stdout ?? ''}${stderr ?? ''}`.trim();
      resolve({ success: !error, output: output || (error ? error.message : '') });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Sheldon commentary                                                  */
/* ------------------------------------------------------------------ */

const SHELDON_COMMENTS: Record<WarningSeverity, ((exe: string) => string)[]> = {
  warning: [
    (exe) => `Fechou ${exe} no Estágio 1. Pelo menos seu córtex pré-frontal ainda funciona.`,
    (exe) => `Sábia decisão fechar ${exe}. Não foi uma vitória, foi apenas a ausência de derrota.`,
    (exe) => `${exe} encerrado a tempo. Vou anotar como "quase procrastinação". Ainda conta.`,
  ],
  critical: [
    (exe) => `Precisou da guilhotina para largar ${exe}? Isso é condicionamento operante, não força de vontade.`,
    (exe) => `${exe} sobreviveu ao aviso e enfrentou a guilhotina. Seu histórico está ficando constrangedor.`,
    (exe) => `Bazinga! Você só fechou ${exe} com uma tela preta gritando na sua cara.`,
  ],
  terminated: [
    (exe) => `${exe} foi executado via taskkill. Progresso não salvo? Problema seu, não meu.`,
    (exe) => `Eu avisei. Duas vezes. ${exe} agora é apenas uma lembrança.`,
    (exe) => `Taskkill aplicado em ${exe}. Considere isso um experimento de condicionamento clássico.`,
  ],
};

function pickComment(severity: WarningSeverity, exe: string): string {
  const pool = SHELDON_COMMENTS[severity];
  return pool[Math.floor(Math.random() * pool.length)](exe);
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

/* ------------------------------------------------------------------ */
/* Process Watcher + escalation state machine                          */
/* ------------------------------------------------------------------ */

interface PunishmentState {
  key: string;
  executable: string;
  stage: PunishmentStage;
  detectedAt: number;
  stageStartedAt: number;
  stageEndsAt: number;
  busy: boolean;
}

export interface ProcessWatcherEvents {
  status: (status: PunishmentStatus) => void;
  infraction: (item: WarningLogItem) => void;
}

export declare interface ProcessWatcher {
  on<E extends keyof ProcessWatcherEvents>(event: E, listener: ProcessWatcherEvents[E]): this;
  emit<E extends keyof ProcessWatcherEvents>(event: E, ...args: Parameters<ProcessWatcherEvents[E]>): boolean;
}

/**
 * Background loop that scans running processes (every 3–5s) and escalates:
 *   Estágio 1 (warning popup) → Estágio 2 (kiosk guillotine on all displays) → taskkill /F
 */
export class ProcessWatcher extends EventEmitter {
  private pollTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private running = false;
  private scanning = false;
  private lastScanAt: number | null = null;
  private readonly punishments = new Map<string, PunishmentState>();
  /** Processes that survived a punishment (taskkill disabled / failed): ignored until they exit. */
  private readonly tolerated = new Set<string>();

  constructor(
    private readonly store: SheldonStore,
    private readonly overlays: OverlayManager
  ) {
    super();
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('🛡️ [Sheldon Watcher] Varredura de processos iniciada.');
    this.schedulePolling();
    void this.scan();
    this.emitStatus();
  }

  /** Stops scanning and pardons every active punishment (no taskkill, no log). */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    for (const p of [...this.punishments.values()]) this.finish(p);
    this.tolerated.clear();
    this.stopTicker();
    console.log('💤 [Sheldon Watcher] Varredura de processos pausada.');
    this.emitStatus();
  }

  /** Re-applies poll interval and re-evaluates punishments after config/blacklist changes. */
  refresh(): void {
    if (!this.running) return;
    this.schedulePolling();
    void this.scan();
  }

  getStatus(): PunishmentStatus {
    const now = Date.now();
    const punishments: ActivePunishment[] = [...this.punishments.values()].map((p) => ({
      executable: p.executable,
      stage: p.stage,
      detectedAt: p.detectedAt,
      stageStartedAt: p.stageStartedAt,
      stageEndsAt: p.stageEndsAt,
      remainingMs: Math.max(0, p.stageEndsAt - now),
    }));
    return { watcherRunning: this.running, lastScanAt: this.lastScanAt, punishments };
  }

  /* ----------------------------- loop ----------------------------- */

  private schedulePolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    const interval = this.store.getWatcherConfig().pollIntervalMs;
    this.pollTimer = setInterval(() => void this.scan(), interval);
  }

  private async scan(): Promise<void> {
    if (!this.running || this.scanning) return;
    this.scanning = true;
    try {
      const runningNames = await listRunningProcesses();
      if (!this.running) return;
      this.lastScanAt = Date.now();

      const runningMap = new Map<string, string>();
      for (const name of runningNames) runningMap.set(name.toLowerCase(), name);
      const blacklist = new Set(this.store.getBlacklist().map((x) => x.toLowerCase()));

      // 1) Resolve / pardon existing punishments
      for (const p of [...this.punishments.values()]) {
        if (p.busy) continue;
        if (!blacklist.has(p.key)) {
          this.finish(p); // removed from blacklist → pardoned
        } else if (!runningMap.has(p.key)) {
          this.resolveClosedByUser(p);
        }
      }

      // 2) Forget tolerated processes once they exit
      for (const key of [...this.tolerated]) {
        if (!runningMap.has(key) || !blacklist.has(key)) this.tolerated.delete(key);
      }

      // 3) New detections
      for (const [key, name] of runningMap) {
        if (blacklist.has(key) && !this.punishments.has(key) && !this.tolerated.has(key)) {
          this.beginWarning(key, name);
        }
      }
    } catch (err) {
      console.error('[Sheldon Watcher] Falha na varredura de processos:', err);
    } finally {
      this.scanning = false;
      this.emitStatus();
    }
  }

  private ensureTicker(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  private stopTicker(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private tick(): void {
    if (this.punishments.size === 0) {
      this.stopTicker();
      this.emitStatus();
      return;
    }
    const now = Date.now();
    for (const p of this.punishments.values()) {
      if (p.busy || now < p.stageEndsAt) continue;
      if (p.stage === 'warning') void this.escalateToGuillotine(p);
      else if (p.stage === 'guillotine') void this.executeGuillotine(p);
    }
    this.emitStatus();
  }

  /* -------------------------- stages ------------------------------ */

  /** Estágio 1 — popup always-on-top. */
  private beginWarning(key: string, executable: string): void {
    const now = Date.now();
    const { graceSeconds } = this.store.getWatcherConfig();
    const p: PunishmentState = {
      key,
      executable,
      stage: 'warning',
      detectedAt: now,
      stageStartedAt: now,
      stageEndsAt: now + graceSeconds * 1000,
      busy: false,
    };
    this.punishments.set(key, p);
    console.warn(`⚠️ [Sheldon Watcher] ${executable} detectado — Estágio 1 (${graceSeconds}s de tolerância).`);
    this.overlays.showWarning(key, executable, p.stageEndsAt);
    this.ensureTicker();
  }

  /** Estágio 2 — kiosk lockdown on every display + 05:00 countdown. */
  private async escalateToGuillotine(p: PunishmentState): Promise<void> {
    p.busy = true;
    try {
      const alive = await isProcessRunning(p.executable).catch(() => true);
      if (this.punishments.get(p.key) !== p) return;
      if (!alive) {
        this.resolveClosedByUser(p);
        return;
      }

      const now = Date.now();
      const config = this.store.getWatcherConfig();
      p.stage = 'guillotine';
      p.stageStartedAt = now;
      p.stageEndsAt = now + config.guillotineSeconds * 1000;
      console.warn(`🔪 [Sheldon Watcher] ${p.executable} ignorou o aviso — GUILHOTINA ativada.`);

      this.overlays.closeWarning(p.key);
      this.syncLockdown();
    } finally {
      p.busy = false;
      this.emitStatus();
    }
  }

  /** Countdown reached zero — taskkill /F /IM. */
  private async executeGuillotine(p: PunishmentState): Promise<void> {
    p.busy = true;
    p.stage = 'executing';
    this.emitStatus();
    try {
      const alive = await isProcessRunning(p.executable).catch(() => true);
      if (this.punishments.get(p.key) !== p) return;
      if (!alive) {
        this.resolveClosedByUser(p);
        return;
      }

      const config = this.store.getWatcherConfig();
      const exposure = formatDuration(Date.now() - p.detectedAt);

      if (!config.forcedTaskkillEnabled) {
        this.tolerated.add(p.key);
        this.record(p, 'critical', `Guilhotina expirou • Taskkill desativado (exposição ${exposure})`);
        this.finish(p);
        return;
      }

      const result = await killProcess(p.executable);
      if (result.success) {
        console.warn(`☠️ [Sheldon Watcher] taskkill /F /IM ${p.executable} executado.`);
        this.record(p, 'terminated', `Taskkill /F /IM forçado após guilhotina (exposição ${exposure})`);
      } else {
        console.error(`[Sheldon Watcher] taskkill falhou para ${p.executable}: ${result.output}`);
        this.tolerated.add(p.key);
        this.record(p, 'critical', `Taskkill falhou: ${result.output.slice(0, 160) || 'erro desconhecido'}`);
      }
      this.finish(p);
    } finally {
      p.busy = false;
      this.emitStatus();
    }
  }

  /** User closed the process before the guillotine fell. */
  private resolveClosedByUser(p: PunishmentState): void {
    const exposure = formatDuration(Date.now() - p.detectedAt);
    if (p.stage === 'warning') {
      this.record(p, 'warning', `Aviso #1 • Fechado voluntariamente em ${exposure}`);
    } else {
      this.record(p, 'critical', `Guilhotina acionada • Fechado antes do taskkill (exposição ${exposure})`);
    }
    this.finish(p);
  }

  /** Removes the punishment and its overlays. */
  private finish(p: PunishmentState): void {
    this.punishments.delete(p.key);
    this.overlays.closeWarning(p.key);
    this.syncLockdown();
    if (this.punishments.size === 0) this.stopTicker();
  }

  /** Opens / updates / closes the kiosk lockdown based on active guillotine punishments. */
  private syncLockdown(): void {
    const config = this.store.getWatcherConfig();
    const items = [...this.punishments.values()]
      .filter((p) => p.stage === 'guillotine' || p.stage === 'executing')
      .map((p) => ({ executable: p.executable, startedAt: p.stageStartedAt, endsAt: p.stageEndsAt }));

    if (items.length === 0 || !config.fullscreenBlockEnabled) {
      if (this.overlays.isLockdownActive) this.overlays.closeLockdown();
      return;
    }

    const payload = { items, taskkillEnabled: config.forcedTaskkillEnabled };
    if (this.overlays.isLockdownActive) this.overlays.updateLockdown(payload);
    else this.overlays.showLockdown(payload);
  }

  private record(p: PunishmentState, severity: WarningSeverity, actionTaken: string): void {
    const now = new Date();
    const detected = new Date(p.detectedAt);
    const item: WarningLogItem = {
      id: `inf-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.toTimeString().slice(0, 8),
      occurredAt: now.toISOString(),
      executable: p.executable,
      windowTitle: `Processo detectado às ${detected.toTimeString().slice(0, 8)} pelo Sheldon Watcher`,
      severity,
      actionTaken,
      sheldonComment: pickComment(severity, p.executable),
    };
    this.store.addInfraction(item);
    this.emit('infraction', item);
  }

  private emitStatus(): void {
    this.emit('status', this.getStatus());
  }
}
