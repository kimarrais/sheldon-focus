import { EventEmitter } from 'events';
import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { SupabaseSyncStatus } from '../shared/types';
import type { ActivityDatabase } from './Database';
import { loadEnv } from './env';

loadEnv();

export const SUPABASE_PROJECT_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

class FileAuthStorage {
  private readonly filePath: string;
  private cache: Record<string, string> = {};

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          this.cache = parsed as Record<string, string>;
        }
      }
    } catch {
      this.cache = {};
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf-8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[SupabaseSync] Falha ao salvar sessão auth:', err);
    }
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.cache, key)
      ? this.cache[key]
      : null;
  }

  setItem(key: string, value: string): void {
    this.cache[key] = value;
    this.save();
  }

  removeItem(key: string): void {
    delete this.cache[key];
    this.save();
  }
}

export interface SupabaseSyncEvents {
  status: (status: SupabaseSyncStatus) => void;
}

export declare interface SupabaseSyncService {
  on<E extends keyof SupabaseSyncEvents>(
    event: E,
    listener: SupabaseSyncEvents[E]
  ): this;
  emit<E extends keyof SupabaseSyncEvents>(
    event: E,
    ...args: Parameters<SupabaseSyncEvents[E]>
  ): boolean;
}

/**
 * Background cloud sync engine bridging local SQLite (`ActivityDatabase`)
 * with the Sheldon Focus Supabase PostgreSQL backend.
 */
export class SupabaseSyncService extends EventEmitter {
  private readonly client: SupabaseClient | null = null;
  private authSubscription: { unsubscribe: () => void } | null = null;
  private currentUser: User | null = null;
  private deviceRegistered = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private syncing = false;
  private stopped = false;
  private lastSyncAt: number | null = null;
  private lastError: string | null = null;

  constructor(private readonly db: ActivityDatabase) {
    super();

    if (!SUPABASE_PROJECT_URL || !SUPABASE_PUBLISHABLE_KEY) {
      this.client = null;
      this.lastError = 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.';
      return;
    }

    try {
      const sessionFile = path.join(
        app.getPath('userData'),
        'sheldon-supabase-session.json'
      );
      const storage = new FileAuthStorage(sessionFile);

      this.client = createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });

      const { data } = this.client.auth.onAuthStateChange((_event, session) => {
        if (this.stopped) return;
        this.currentUser = session?.user ?? null;
        if (!this.currentUser) {
          this.deviceRegistered = false;
        }
        this.emitStatus();
      });
      this.authSubscription = data.subscription;
    } catch (err) {
      console.warn('[SupabaseSync] Falha ao inicializar client Supabase:', err);
      this.client = null;
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  async init(): Promise<void> {
    if (!this.client) {
      this.emitStatus();
      return;
    }

    try {
      const { data } = await this.client.auth.getSession();
      this.currentUser = data.session?.user ?? null;
      if (this.currentUser) {
        await this.ensureDeviceRegistered();
        void this.syncNow();
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }

    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        if (this.currentUser) {
          void this.syncNow();
        }
      }, 15_000);
    }

    this.emitStatus();
  }

  stop(): void {
    this.stopped = true;
    this.authSubscription?.unsubscribe();
    this.authSubscription = null;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  getStatus(): SupabaseSyncStatus {
    const counters = this.db.getSyncCounters();
    const isConfigured = Boolean(
      this.client && SUPABASE_PROJECT_URL && SUPABASE_PUBLISHABLE_KEY
    );

    return {
      configured: isConfigured,
      authenticated: Boolean(this.currentUser),
      email: this.currentUser?.email ?? null,
      isAnonymous: Boolean(this.currentUser?.is_anonymous),
      userId: this.currentUser?.id ?? null,
      deviceId: this.db.deviceId,
      pendingActivitiesCount: counters.pendingActivitiesCount,
      pendingEventsCount: counters.pendingEventsCount,
      syncedActivitiesCount: counters.syncedActivitiesCount,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      syncing: this.syncing,
      projectUrl: SUPABASE_PROJECT_URL,
    };
  }

  private emitStatus(): void {
    if (this.stopped) return;
    this.emit('status', this.getStatus());
  }

  private async ensureDeviceRegistered(): Promise<void> {
    if (!this.client || !this.currentUser || this.deviceRegistered) return;
    const { error } = await this.client.from('devices').upsert(
      {
        user_id: this.currentUser.id,
        device_fingerprint: this.db.deviceId,
        hostname: os.hostname(),
        os_platform: process.platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_fingerprint' }
    );
    if (!error) {
      this.deviceRegistered = true;
    }
  }

  async signIn(
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string; status: SupabaseSyncStatus }> {
    if (!this.client) {
      return {
        ok: false,
        error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.',
        status: this.getStatus(),
      };
    }

    this.lastError = null;
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      this.lastError = error.message;
      this.emitStatus();
      return { ok: false, error: error.message, status: this.getStatus() };
    }

    this.currentUser = data.user;
    await this.ensureDeviceRegistered();
    await this.syncNow();
    return { ok: true, status: this.getStatus() };
  }

  async signUp(email: string, password: string): Promise<{
    ok: boolean;
    needsEmailConfirmation?: boolean;
    error?: string;
    status: SupabaseSyncStatus;
  }> {
    if (!this.client) {
      return {
        ok: false,
        error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.',
        status: this.getStatus(),
      };
    }

    this.lastError = null;
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      this.lastError = error.message;
      this.emitStatus();
      return { ok: false, error: error.message, status: this.getStatus() };
    }

    if (data.session?.user) {
      this.currentUser = data.session.user;
      await this.ensureDeviceRegistered();
      await this.syncNow();
      return {
        ok: true,
        needsEmailConfirmation: false,
        status: this.getStatus(),
      };
    }

    this.emitStatus();
    return {
      ok: true,
      needsEmailConfirmation: true,
      status: this.getStatus(),
    };
  }

  async verifyOtp(
    email: string,
    token: string
  ): Promise<{ ok: boolean; error?: string; status: SupabaseSyncStatus }> {
    if (!this.client) {
      return {
        ok: false,
        error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.',
        status: this.getStatus(),
      };
    }

    this.lastError = null;
    const { data, error } = await this.client.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'signup',
    });

    if (error) {
      this.lastError = error.message;
      this.emitStatus();
      return { ok: false, error: error.message, status: this.getStatus() };
    }

    this.currentUser = data.user ?? data.session?.user ?? null;
    if (this.currentUser) {
      await this.ensureDeviceRegistered();
      await this.syncNow();
    }
    return { ok: true, status: this.getStatus() };
  }

  async signInAnonymously(): Promise<{
    ok: boolean;
    error?: string;
    status: SupabaseSyncStatus;
  }> {
    if (!this.client) {
      return {
        ok: false,
        error: 'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.',
        status: this.getStatus(),
      };
    }

    this.lastError = null;
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) {
      this.lastError = error.message;
      this.emitStatus();
      return { ok: false, error: error.message, status: this.getStatus() };
    }
    this.currentUser = data.user ?? data.session?.user ?? null;
    if (this.currentUser) {
      await this.ensureDeviceRegistered();
      await this.syncNow();
    }
    return { ok: true, status: this.getStatus() };
  }

  async signOut(): Promise<SupabaseSyncStatus> {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.currentUser = null;
    this.deviceRegistered = false;
    this.lastError = null;
    this.emitStatus();
    return this.getStatus();
  }

  async syncNow(): Promise<{
    synced: number;
    error?: string;
    status: SupabaseSyncStatus;
  }> {
    if (!this.client) {
      return {
        synced: 0,
        error: 'Supabase não configurado no .env.',
        status: this.getStatus(),
      };
    }
    if (!this.currentUser) {
      return {
        synced: 0,
        error: 'Usuário não autenticado no Supabase.',
        status: this.getStatus(),
      };
    }
    if (this.syncing) {
      return { synced: 0, status: this.getStatus() };
    }

    this.syncing = true;
    this.lastError = null;
    this.emitStatus();

    let totalSynced = 0;

    try {
      await this.ensureDeviceRegistered();

      // 1) Sync pending consolidated activities in batches of 50
      const pendingActivities = this.db.getPendingActivitiesForSync(50);
      if (pendingActivities.length > 0) {
        const rows = pendingActivities.map((a) => ({
          user_id: this.currentUser!.id,
          device_id: this.db.deviceId,
          local_id: a.localId,
          client_sync_id: a.clientSyncId,
          app_name: a.appName,
          executable_name: a.executableName,
          process_path: a.processPath,
          process_id: a.processId,
          window_title: a.windowTitle,
          url: a.url,
          domain: a.domain,
          project_name: a.projectName,
          file_name: a.fileName,
          category: a.category,
          is_productive: a.isProductive,
          start_time: new Date(a.startTime).toISOString(),
          end_time: new Date(a.endTime).toISOString(),
          duration_seconds: a.durationSeconds,
          active_input_seconds: a.activeInputSeconds,
          passive_seconds: a.passiveSeconds,
          keystrokes_count: a.keystrokesCount,
          mouse_clicks_count: a.mouseClicksCount,
          scroll_events_count: a.scrollEventsCount,
        }));

        const { error } = await this.client
          .from('activities')
          .upsert(rows, { onConflict: 'user_id,client_sync_id' });

        if (error) throw error;

        this.db.markActivitiesSynced(
          pendingActivities.map((a) => a.localId),
          Date.now()
        );
        totalSynced += pendingActivities.length;
      }

      // 2) Sync pending surgical events in batches of 100
      const pendingEvents = this.db.getPendingEventsForSync(100);
      if (pendingEvents.length > 0) {
        const eventRows = pendingEvents.map((e) => ({
          user_id: this.currentUser!.id,
          device_id: this.db.deviceId,
          client_event_id: e.clientEventId,
          activity_sync_id: e.activitySyncId,
          event_type: e.eventType,
          app_name: e.appName,
          executable_name: e.executableName,
          window_title: e.windowTitle,
          url: e.url,
          domain: e.domain,
          project_name: e.projectName,
          file_name: e.fileName,
          category: e.category,
          occurred_at: new Date(e.occurredAt).toISOString(),
          duration_ms: e.durationMs,
          keystrokes_count: e.keystrokesCount,
          mouse_clicks_count: e.mouseClicksCount,
          scroll_events_count: e.scrollEventsCount,
        }));

        const { error } = await this.client
          .from('activity_events')
          .upsert(eventRows, { onConflict: 'user_id,client_event_id' });

        if (error) throw error;

        this.db.markEventsSynced(
          pendingEvents.map((e) => e.id),
          Date.now()
        );
        totalSynced += pendingEvents.length;
      }

      this.lastSyncAt = Date.now();
      return { synced: totalSynced, status: this.getStatus() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      return { synced: totalSynced, error: msg, status: this.getStatus() };
    } finally {
      this.syncing = false;
      this.emitStatus();
    }
  }
}
