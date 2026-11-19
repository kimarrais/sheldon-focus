import { app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import DatabaseConstructor, {
  type Database as BetterSqliteDatabase,
  type Statement,
} from 'better-sqlite3';
import type {
  ActivityEventRecord,
  ActivityEventType,
  ActivityRecord,
  CategoryBreakdownItem,
  CategoryRule,
  MetricsSummary,
  ProjectStat,
  ReclassifyActivityPayload,
  RuleMatchField,
  TopAppStat,
  TrackableCategory,
} from '../shared/types';

export const TRACKABLE_CATEGORIES: readonly TrackableCategory[] = [
  'Deep Work',
  'Design',
  'Dev',
  'Comunicação',
  'Distração',
  'Neutro',
  'Idle',
] as const;

export const PRODUCTIVE_CATEGORIES = new Set<TrackableCategory>([
  'Deep Work',
  'Design',
  'Dev',
]);

interface ActivityRow {
  id: number;
  client_sync_id: string | null;
  app_name: string;
  executable_name: string;
  process_path: string;
  process_id: number;
  window_title: string;
  url: string | null;
  domain: string | null;
  project_name: string | null;
  file_name: string | null;
  category: TrackableCategory;
  is_productive: number;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  active_input_seconds: number;
  passive_seconds: number;
  keystrokes_count: number;
  mouse_clicks_count: number;
  scroll_events_count: number;
  updated_at: number;
  synced_at: number | null;
}

interface ActivityEventRow {
  id: number;
  client_event_id: string;
  activity_sync_id: string | null;
  event_type: ActivityEventType;
  app_name: string;
  executable_name: string;
  window_title: string;
  url: string | null;
  domain: string | null;
  project_name: string | null;
  file_name: string | null;
  category: TrackableCategory;
  occurred_at: number;
  duration_ms: number;
  keystrokes_count: number;
  mouse_clicks_count: number;
  scroll_events_count: number;
  synced_at: number | null;
}

interface CategoryRuleRow {
  id: number;
  pattern: string;
  match_field: RuleMatchField;
  category: TrackableCategory;
  is_productive: number;
  priority: number;
  enabled: number;
  created_at: number;
}

interface CompiledRule {
  rule: CategoryRule;
  regex: RegExp;
}

interface SeedRuleDef {
  pattern: string;
  matchField: RuleMatchField;
  category: TrackableCategory;
  isProductive: boolean;
  priority: number;
}

const DEFAULT_CATEGORY_RULES: SeedRuleDef[] = [
  // Design
  {
    pattern:
      '(figma|adobe\\s*xd|photoshop|illustrator|afterfx|premiere|blender|canva|sketch|framer|penpot)',
    matchField: 'app_name',
    category: 'Design',
    isProductive: true,
    priority: 220,
  },
  {
    pattern: '(figma\\.com|dribbble\\.com|behance\\.net|canva\\.com|framer\\.com)',
    matchField: 'domain',
    category: 'Design',
    isProductive: true,
    priority: 220,
  },

  // Dev
  {
    pattern:
      '^(code|code insiders|cursor|windsurf|antigravity|webstorm|pycharm|intellij idea|rider|goland|clion|visual studio|sublime_text|neovim|nvim|zed|windows terminal|powershell|command prompt|postman|insomnia|docker desktop|datagrip|dbeaver)$',
    matchField: 'app_name',
    category: 'Dev',
    isProductive: true,
    priority: 210,
  },
  {
    pattern:
      '(github\\.com|gitlab\\.com|bitbucket\\.org|stackoverflow\\.com|developer\\.mozilla\\.org|npmjs\\.com|vercel\\.com|supabase\\.com|firebase\\.google\\.com|claude\\.ai|chatgpt\\.com|aistudio\\.google\\.com|localhost|127\\.0\\.0\\.1)',
    matchField: 'domain',
    category: 'Dev',
    isProductive: true,
    priority: 210,
  },
  {
    pattern: '(visual studio code|vs\\s*code|pull request|commit|localhost:\\d+)',
    matchField: 'window_title',
    category: 'Dev',
    isProductive: true,
    priority: 180,
  },

  // Deep Work
  {
    pattern:
      '^(notion|obsidian|linear|ticktick|anki|logseq|roam|microsoft word|microsoft excel|microsoft powerpoint|onenote|acrobat|sumatrapdf|zotero)$',
    matchField: 'app_name',
    category: 'Deep Work',
    isProductive: true,
    priority: 200,
  },
  {
    pattern:
      '(notion\\.so|linear\\.app|docs\\.google\\.com|sheets\\.google\\.com|slides\\.google\\.com|ticktick\\.com|scholar\\.google\\.com|arxiv\\.org|coursera\\.org|udemy\\.com)',
    matchField: 'domain',
    category: 'Deep Work',
    isProductive: true,
    priority: 200,
  },

  // Comunicação
  {
    pattern:
      '^(slack|microsoft teams|teams|zoom|outlook|thunderbird|telegram|whatsapp)$',
    matchField: 'app_name',
    category: 'Comunicação',
    isProductive: false,
    priority: 190,
  },
  {
    pattern:
      '(slack\\.com|mail\\.google\\.com|outlook\\.live\\.com|outlook\\.office\\.com|meet\\.google\\.com|teams\\.microsoft\\.com|web\\.whatsapp\\.com|web\\.telegram\\.org)',
    matchField: 'domain',
    category: 'Comunicação',
    isProductive: false,
    priority: 190,
  },

  // Distração
  {
    pattern:
      '(youtube\\.com|youtu\\.be|tiktok\\.com|instagram\\.com|facebook\\.com|x\\.com|twitter\\.com|reddit\\.com|twitch\\.tv|netflix\\.com|primevideo\\.com|disneyplus\\.com|9gag\\.com|globo\\.com)',
    matchField: 'domain',
    category: 'Distração',
    isProductive: false,
    priority: 230,
  },
  {
    pattern:
      '^(steam|valorant|league of legends|riot client|epic games|battle\\.net|sleepingdogs|eldenring|cs2|cyberpunk2077|discord|spotify|netflix|vlc)$',
    matchField: 'app_name',
    category: 'Distração',
    isProductive: false,
    priority: 200,
  },

  // Neutro
  {
    pattern:
      '^(explorer|sheldon focus|electron|searchhost|systemsettings|taskmgr|applicationframehost)$',
    matchField: 'app_name',
    category: 'Neutro',
    isProductive: false,
    priority: 120,
  },
  {
    pattern: '(google\\.com|bing\\.com|duckduckgo\\.com)',
    matchField: 'domain',
    category: 'Neutro',
    isProductive: false,
    priority: 110,
  },
];

export function isCategoryProductiveByDefault(
  category: TrackableCategory
): boolean {
  return PRODUCTIVE_CATEGORIES.has(category);
}

export function getDayBounds(dateStr?: string): {
  date: string;
  startMs: number;
  endMs: number;
} {
  let year: number;
  let month: number;
  let day: number;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (match) {
    year = Number.parseInt(match[1], 10);
    month = Number.parseInt(match[2], 10);
    day = Number.parseInt(match[3], 10);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  const normalized = `${start.getFullYear()}-${String(
    start.getMonth() + 1
  ).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  return {
    date: normalized,
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return new RegExp(escapeRegexLiteral(pattern), 'i');
  }
}

function rowToActivity(row: ActivityRow): ActivityRecord {
  return {
    id: row.id,
    appName: row.app_name,
    executableName: row.executable_name || '',
    processPath: row.process_path,
    processId: row.process_id,
    windowTitle: row.window_title,
    url: row.url ?? null,
    domain: row.domain ?? null,
    projectName: row.project_name ?? null,
    fileName: row.file_name ?? null,
    category: row.category,
    isProductive: Boolean(row.is_productive),
    startTime: row.start_time,
    endTime: row.end_time,
    durationSeconds: row.duration_seconds,
    activeInputSeconds: row.active_input_seconds || 0,
    passiveSeconds: row.passive_seconds || 0,
    keystrokesCount: row.keystrokes_count || 0,
    mouseClicksCount: row.mouse_clicks_count || 0,
    scrollEventsCount: row.scroll_events_count || 0,
    syncedAt: row.synced_at ?? null,
  };
}

function rowToEvent(row: ActivityEventRow): ActivityEventRecord {
  return {
    id: row.id,
    clientEventId: row.client_event_id,
    eventType: row.event_type,
    appName: row.app_name,
    executableName: row.executable_name || '',
    windowTitle: row.window_title,
    url: row.url ?? null,
    domain: row.domain ?? null,
    projectName: row.project_name ?? null,
    fileName: row.file_name ?? null,
    category: row.category,
    occurredAt: row.occurred_at,
    durationMs: row.duration_ms || 0,
    keystrokesCount: row.keystrokes_count || 0,
    mouseClicksCount: row.mouse_clicks_count || 0,
    scrollEventsCount: row.scroll_events_count || 0,
  };
}

function rowToRule(row: CategoryRuleRow): CategoryRule {
  return {
    id: row.id,
    pattern: row.pattern,
    matchField: row.match_field,
    category: row.category,
    isProductive: Boolean(row.is_productive),
    priority: row.priority,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  };
}

export function computeSheldonScore(params: {
  totalActiveSeconds: number;
  productiveSeconds: number;
  communicationSeconds: number;
  neutralSeconds: number;
  distractionSeconds: number;
  distractionCount: number;
}): number {
  const {
    totalActiveSeconds,
    productiveSeconds,
    communicationSeconds,
    neutralSeconds,
    distractionSeconds,
    distractionCount,
  } = params;

  if (totalActiveSeconds <= 0) return 0;

  const weightedDenominator =
    productiveSeconds +
    distractionSeconds * 1.4 +
    neutralSeconds * 0.25 +
    communicationSeconds * 0.15;

  if (weightedDenominator <= 0) return 50;

  const baseRatio = (productiveSeconds / weightedDenominator) * 100;
  const switchPenalty = Math.min(15, distractionCount * 1.5);
  return Math.max(0, Math.min(100, Math.round(baseRatio - switchPenalty)));
}

export interface PendingActivitySyncRow {
  localId: number;
  clientSyncId: string;
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
  durationSeconds: number;
  activeInputSeconds: number;
  passiveSeconds: number;
  keystrokesCount: number;
  mouseClicksCount: number;
  scrollEventsCount: number;
}

export interface PendingEventSyncRow extends ActivityEventRecord {
  activitySyncId: string | null;
}

/**
 * Local SQLite persistence, schema migration, analytics & cloud-sync queue engine.
 */
export class ActivityDatabase {
  private readonly db: BetterSqliteDatabase;
  private compiledRules: CompiledRule[] = [];
  readonly deviceId: string;

  private readonly stmtInsertActivity: Statement;
  private readonly stmtUpdateActivityMetrics: Statement;
  private readonly stmtGetActivityById: Statement;
  private readonly stmtGetTimelineRange: Statement;
  private readonly stmtUpdateActivityCategory: Statement;
  private readonly stmtUpdateMatchingDomainToday: Statement;
  private readonly stmtUpdateMatchingAppToday: Statement;
  private readonly stmtInsertEvent: Statement;
  private readonly stmtGetEventsRange: Statement;

  constructor(customDbPath?: string) {
    const dbPath =
      customDbPath || path.join(app.getPath('userData'), 'sheldon-activity.db');

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseConstructor(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('temp_store = MEMORY');

    this.initSchema();
    this.deviceId = this.ensureDeviceId();
    this.seedDefaultRulesIfEmpty();
    this.reloadCompiledRules();

    this.stmtInsertActivity = this.db.prepare(`
      INSERT INTO activities (
        client_sync_id, app_name, executable_name, process_path, process_id,
        window_title, url, domain, project_name, file_name,
        category, is_productive, start_time, end_time, duration_seconds,
        active_input_seconds, passive_seconds, keystrokes_count, mouse_clicks_count, scroll_events_count,
        updated_at, synced_at
      ) VALUES (
        @clientSyncId, @appName, @executableName, @processPath, @processId,
        @windowTitle, @url, @domain, @projectName, @fileName,
        @category, @isProductive, @startTime, @endTime, @durationSeconds,
        @activeInputSeconds, @passiveSeconds, @keystrokesCount, @mouseClicksCount, @scrollEventsCount,
        @updatedAt, NULL
      )
    `);

    this.stmtUpdateActivityMetrics = this.db.prepare(`
      UPDATE activities
      SET end_time = @endTime,
          duration_seconds = @durationSeconds,
          active_input_seconds = @activeInputSeconds,
          passive_seconds = @passiveSeconds,
          keystrokes_count = @keystrokesCount,
          mouse_clicks_count = @mouseClicksCount,
          scroll_events_count = @scrollEventsCount,
          url = COALESCE(@url, url),
          domain = COALESCE(@domain, domain),
          project_name = COALESCE(@projectName, project_name),
          file_name = COALESCE(@fileName, file_name),
          updated_at = @updatedAt
      WHERE id = @id
    `);

    this.stmtGetActivityById = this.db.prepare(`
      SELECT * FROM activities WHERE id = ?
    `);

    this.stmtGetTimelineRange = this.db.prepare(`
      SELECT *
      FROM activities
      WHERE end_time > @dayStart AND start_time < @dayEnd
      ORDER BY start_time ASC
    `);

    this.stmtUpdateActivityCategory = this.db.prepare(`
      UPDATE activities
      SET category = @category,
          is_productive = @isProductive,
          updated_at = @updatedAt
      WHERE id = @id
    `);

    this.stmtUpdateMatchingDomainToday = this.db.prepare(`
      UPDATE activities
      SET category = @category,
          is_productive = @isProductive,
          updated_at = @updatedAt
      WHERE LOWER(domain) = LOWER(@domain)
        AND end_time > @dayStart
        AND start_time < @dayEnd
    `);

    this.stmtUpdateMatchingAppToday = this.db.prepare(`
      UPDATE activities
      SET category = @category,
          is_productive = @isProductive,
          updated_at = @updatedAt
      WHERE LOWER(app_name) = LOWER(@appName)
        AND (domain IS NULL OR domain = '')
        AND end_time > @dayStart
        AND start_time < @dayEnd
    `);

    this.stmtInsertEvent = this.db.prepare(`
      INSERT INTO activity_events (
        client_event_id, activity_sync_id, event_type, app_name, executable_name,
        window_title, url, domain, project_name, file_name, category,
        occurred_at, duration_ms, keystrokes_count, mouse_clicks_count, scroll_events_count,
        synced_at
      ) VALUES (
        @clientEventId, @activitySyncId, @eventType, @appName, @executableName,
        @windowTitle, @url, @domain, @projectName, @fileName, @category,
        @occurredAt, @durationMs, @keystrokesCount, @mouseClicksCount, @scrollEventsCount,
        NULL
      )
    `);

    this.stmtGetEventsRange = this.db.prepare(`
      SELECT *
      FROM activity_events
      WHERE occurred_at >= @dayStart AND occurred_at < @dayEnd
      ORDER BY occurred_at DESC
      LIMIT @limit
    `);
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_sync_id TEXT,
        app_name TEXT NOT NULL,
        executable_name TEXT NOT NULL DEFAULT '',
        process_path TEXT NOT NULL DEFAULT '',
        process_id INTEGER NOT NULL DEFAULT 0,
        window_title TEXT NOT NULL DEFAULT '',
        url TEXT,
        domain TEXT,
        project_name TEXT,
        file_name TEXT,
        category TEXT NOT NULL CHECK (
          category IN ('Deep Work', 'Design', 'Dev', 'Comunicação', 'Distração', 'Neutro', 'Idle')
        ),
        is_productive INTEGER NOT NULL DEFAULT 0,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        active_input_seconds INTEGER NOT NULL DEFAULT 0,
        passive_seconds INTEGER NOT NULL DEFAULT 0,
        keystrokes_count INTEGER NOT NULL DEFAULT 0,
        mouse_clicks_count INTEGER NOT NULL DEFAULT 0,
        scroll_events_count INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        synced_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_event_id TEXT NOT NULL UNIQUE,
        activity_sync_id TEXT,
        event_type TEXT NOT NULL CHECK (
          event_type IN ('window_switch', 'url_change', 'file_change', 'idle_start', 'idle_end')
        ),
        app_name TEXT NOT NULL,
        executable_name TEXT NOT NULL DEFAULT '',
        window_title TEXT NOT NULL DEFAULT '',
        url TEXT,
        domain TEXT,
        project_name TEXT,
        file_name TEXT,
        category TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        keystrokes_count INTEGER NOT NULL DEFAULT 0,
        mouse_clicks_count INTEGER NOT NULL DEFAULT 0,
        scroll_events_count INTEGER NOT NULL DEFAULT 0,
        synced_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS category_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        match_field TEXT NOT NULL DEFAULT 'any' CHECK (
          match_field IN ('app_name', 'domain', 'url', 'window_title', 'any')
        ),
        category TEXT NOT NULL CHECK (
          category IN ('Deep Work', 'Design', 'Dev', 'Comunicação', 'Distração', 'Neutro', 'Idle')
        ),
        is_productive INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 100,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        UNIQUE(pattern, match_field)
      );
    `);

    // Migrate existing `activities` table cleanly if missing new surgical columns
    const cols = new Set(
      (
        this.db.prepare('PRAGMA table_info(activities)').all() as Array<{
          name: string;
        }>
      ).map((c) => c.name)
    );

    const migrations: Array<[string, string]> = [
      ['client_sync_id', 'TEXT'],
      ['executable_name', "TEXT NOT NULL DEFAULT ''"],
      ['process_path', "TEXT NOT NULL DEFAULT ''"],
      ['process_id', 'INTEGER NOT NULL DEFAULT 0'],
      ['url', 'TEXT'],
      ['project_name', 'TEXT'],
      ['file_name', 'TEXT'],
      ['active_input_seconds', 'INTEGER NOT NULL DEFAULT 0'],
      ['passive_seconds', 'INTEGER NOT NULL DEFAULT 0'],
      ['keystrokes_count', 'INTEGER NOT NULL DEFAULT 0'],
      ['mouse_clicks_count', 'INTEGER NOT NULL DEFAULT 0'],
      ['scroll_events_count', 'INTEGER NOT NULL DEFAULT 0'],
      ['updated_at', 'INTEGER NOT NULL DEFAULT 0'],
      ['synced_at', 'INTEGER'],
    ];

    for (const [col, def] of migrations) {
      if (!cols.has(col)) {
        this.db.exec(`ALTER TABLE activities ADD COLUMN ${col} ${def};`);
      }
    }

    // Backfill client_sync_id for any legacy rows
    this.db.exec(`
      UPDATE activities
      SET client_sync_id = 'legacy-' || id || '-' || start_time,
          updated_at = CASE WHEN updated_at = 0 THEN end_time ELSE updated_at END
      WHERE client_sync_id IS NULL;
    `);

    // Upgrade `category_rules` if created without 'url' in CHECK constraint
    const ruleSqlRow = this.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='category_rules'"
      )
      .get() as { sql?: string } | undefined;

    if (ruleSqlRow?.sql && !ruleSqlRow.sql.includes("'url'")) {
      this.db.exec(`
        ALTER TABLE category_rules RENAME TO category_rules_old;
        CREATE TABLE category_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern TEXT NOT NULL,
          match_field TEXT NOT NULL DEFAULT 'any' CHECK (
            match_field IN ('app_name', 'domain', 'url', 'window_title', 'any')
          ),
          category TEXT NOT NULL CHECK (
            category IN ('Deep Work', 'Design', 'Dev', 'Comunicação', 'Distração', 'Neutro', 'Idle')
          ),
          is_productive INTEGER NOT NULL DEFAULT 0,
          priority INTEGER NOT NULL DEFAULT 100,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          UNIQUE(pattern, match_field)
        );
        INSERT INTO category_rules (id, pattern, match_field, category, is_productive, priority, enabled, created_at)
        SELECT id, pattern, match_field, category, is_productive, priority, enabled, created_at
        FROM category_rules_old;
        DROP TABLE category_rules_old;
      `);
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_start_time
        ON activities (start_time);
      CREATE INDEX IF NOT EXISTS idx_activities_end_time
        ON activities (end_time);
      CREATE INDEX IF NOT EXISTS idx_activities_start_end
        ON activities (start_time, end_time);
      CREATE INDEX IF NOT EXISTS idx_activities_category_time
        ON activities (category, start_time);
      CREATE INDEX IF NOT EXISTS idx_activities_sync
        ON activities (synced_at, updated_at);
      CREATE INDEX IF NOT EXISTS idx_activity_events_occurred
        ON activity_events (occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_events_sync
        ON activity_events (synced_at);
      CREATE INDEX IF NOT EXISTS idx_category_rules_priority
        ON category_rules (enabled, priority DESC, id ASC);
    `);
  }

  private ensureDeviceId(): string {
    const existing = this.db
      .prepare("SELECT value FROM meta WHERE key = 'device_id'")
      .get() as { value: string } | undefined;
    if (existing?.value) return existing.value;

    const id = `${os.hostname().toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`;
    this.db
      .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('device_id', ?)")
      .run(id);
    return id;
  }

  private seedDefaultRulesIfEmpty(): void {
    const countRow = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM category_rules')
      .get() as { cnt: number };
    if (countRow.cnt > 0) return;

    const now = Date.now();
    const insertRule = this.db.prepare(`
      INSERT OR IGNORE INTO category_rules (
        pattern, match_field, category, is_productive, priority, enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `);

    const tx = this.db.transaction((rules: SeedRuleDef[]) => {
      for (const r of rules) {
        insertRule.run(
          r.pattern,
          r.matchField,
          r.category,
          r.isProductive ? 1 : 0,
          r.priority,
          now
        );
      }
    });
    tx(DEFAULT_CATEGORY_RULES);
  }

  private reloadCompiledRules(): void {
    const rows = this.db
      .prepare(
        `SELECT id, pattern, match_field, category, is_productive, priority, enabled, created_at
         FROM category_rules
         WHERE enabled = 1
         ORDER BY priority DESC, id ASC`
      )
      .all() as CategoryRuleRow[];

    this.compiledRules = rows.map((row) => {
      const rule = rowToRule(row);
      return {
        rule,
        regex: compilePattern(rule.pattern),
      };
    });
  }

  /* ---------------------------------------------------------------- */
  /* Classification & Rules                                           */
  /* ---------------------------------------------------------------- */

  classifyActivity(
    appName: string,
    windowTitle: string,
    domain: string | null,
    url: string | null = null
  ): { category: TrackableCategory; isProductive: boolean } {
    for (const { rule, regex } of this.compiledRules) {
      let matched = false;
      if (rule.matchField === 'domain') {
        if (domain && regex.test(domain)) matched = true;
      } else if (rule.matchField === 'url') {
        if (url && regex.test(url)) matched = true;
      } else if (rule.matchField === 'app_name') {
        if (regex.test(appName)) matched = true;
      } else if (rule.matchField === 'window_title') {
        if (regex.test(windowTitle)) matched = true;
      } else {
        if (
          (url && regex.test(url)) ||
          (domain && regex.test(domain)) ||
          regex.test(appName) ||
          regex.test(windowTitle)
        ) {
          matched = true;
        }
      }

      if (matched) {
        return {
          category: rule.category,
          isProductive: rule.isProductive,
        };
      }
    }

    return { category: 'Neutro', isProductive: false };
  }

  getCategoryRules(): CategoryRule[] {
    const rows = this.db
      .prepare(
        `SELECT id, pattern, match_field, category, is_productive, priority, enabled, created_at
         FROM category_rules
         ORDER BY priority DESC, id DESC`
      )
      .all() as CategoryRuleRow[];
    return rows.map(rowToRule);
  }

  upsertCategoryRule(
    input: Omit<CategoryRule, 'id' | 'createdAt'> & { id?: number }
  ): CategoryRule {
    const cleanPattern = input.pattern.trim();
    if (!cleanPattern) {
      throw new Error('O padrão da regra não pode estar vazio.');
    }

    const now = Date.now();
    if (input.id && input.id > 0) {
      this.db
        .prepare(
          `UPDATE category_rules
           SET pattern = ?, match_field = ?, category = ?, is_productive = ?, priority = ?, enabled = ?
           WHERE id = ?`
        )
        .run(
          cleanPattern,
          input.matchField,
          input.category,
          input.isProductive ? 1 : 0,
          input.priority,
          input.enabled ? 1 : 0,
          input.id
        );
      this.reloadCompiledRules();
      const row = this.db
        .prepare('SELECT * FROM category_rules WHERE id = ?')
        .get(input.id) as CategoryRuleRow;
      return rowToRule(row);
    }

    this.db
      .prepare(
        `INSERT INTO category_rules (
          pattern, match_field, category, is_productive, priority, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pattern, match_field) DO UPDATE SET
          category = excluded.category,
          is_productive = excluded.is_productive,
          priority = excluded.priority,
          enabled = excluded.enabled`
      )
      .run(
        cleanPattern,
        input.matchField,
        input.category,
        input.isProductive ? 1 : 0,
        input.priority,
        input.enabled ? 1 : 0,
        now
      );

    this.reloadCompiledRules();
    const row = this.db
      .prepare('SELECT * FROM category_rules WHERE pattern = ? AND match_field = ?')
      .get(cleanPattern, input.matchField) as CategoryRuleRow;
    return rowToRule(row);
  }

  deleteCategoryRule(id: number): CategoryRule[] {
    this.db.prepare('DELETE FROM category_rules WHERE id = ?').run(id);
    this.reloadCompiledRules();
    return this.getCategoryRules();
  }

  /* ---------------------------------------------------------------- */
  /* Activity & Surgical Event Persistence                            */
  /* ---------------------------------------------------------------- */

  insertActivity(record: Omit<ActivityRecord, 'id'>): {
    id: number;
    clientSyncId: string;
  } {
    const startTime = Math.round(record.startTime);
    const endTime = Math.max(startTime, Math.round(record.endTime));
    const durationSeconds = Math.max(
      0,
      Math.round((endTime - startTime) / 1000)
    );
    const clientSyncId = `${this.deviceId}-${startTime}-${crypto.randomUUID().slice(0, 6)}`;
    const now = Date.now();

    const info = this.stmtInsertActivity.run({
      clientSyncId,
      appName: record.appName,
      executableName: record.executableName || '',
      processPath: record.processPath || '',
      processId: record.processId || 0,
      windowTitle: record.windowTitle || '',
      url: record.url ?? null,
      domain: record.domain ?? null,
      projectName: record.projectName ?? null,
      fileName: record.fileName ?? null,
      category: record.category,
      isProductive: record.isProductive ? 1 : 0,
      startTime,
      endTime,
      durationSeconds,
      activeInputSeconds: Math.max(0, Math.round(record.activeInputSeconds || 0)),
      passiveSeconds: Math.max(0, Math.round(record.passiveSeconds || 0)),
      keystrokesCount: Math.max(0, Math.round(record.keystrokesCount || 0)),
      mouseClicksCount: Math.max(0, Math.round(record.mouseClicksCount || 0)),
      scrollEventsCount: Math.max(0, Math.round(record.scrollEventsCount || 0)),
      updatedAt: now,
    });

    return { id: Number(info.lastInsertRowid), clientSyncId };
  }

  updateActivityMetrics(
    id: number,
    payload: {
      startTime: number;
      endTime: number;
      activeInputSeconds: number;
      passiveSeconds: number;
      keystrokesCount: number;
      mouseClicksCount: number;
      scrollEventsCount: number;
      url?: string | null;
      domain?: string | null;
      projectName?: string | null;
      fileName?: string | null;
    }
  ): void {
    const safeEnd = Math.max(
      Math.round(payload.startTime),
      Math.round(payload.endTime)
    );
    const durationSeconds = Math.max(
      0,
      Math.round((safeEnd - Math.round(payload.startTime)) / 1000)
    );

    this.stmtUpdateActivityMetrics.run({
      id,
      endTime: safeEnd,
      durationSeconds,
      activeInputSeconds: Math.max(0, Math.round(payload.activeInputSeconds)),
      passiveSeconds: Math.max(0, Math.round(payload.passiveSeconds)),
      keystrokesCount: Math.max(0, Math.round(payload.keystrokesCount)),
      mouseClicksCount: Math.max(0, Math.round(payload.mouseClicksCount)),
      scrollEventsCount: Math.max(0, Math.round(payload.scrollEventsCount)),
      url: payload.url ?? null,
      domain: payload.domain ?? null,
      projectName: payload.projectName ?? null,
      fileName: payload.fileName ?? null,
      updatedAt: Date.now(),
    });
  }

  /** Legacy helper compatibility */
  updateActivityTimes(id: number, startTime: number, endTime: number): void {
    const row = this.stmtGetActivityById.get(id) as ActivityRow | undefined;
    this.updateActivityMetrics(id, {
      startTime,
      endTime,
      activeInputSeconds: row?.active_input_seconds || 0,
      passiveSeconds: row?.passive_seconds || 0,
      keystrokesCount: row?.keystrokes_count || 0,
      mouseClicksCount: row?.mouse_clicks_count || 0,
      scrollEventsCount: row?.scroll_events_count || 0,
    });
  }

  insertActivityEvent(
    ev: Omit<ActivityEventRecord, 'id' | 'clientEventId'> & {
      activitySyncId?: string | null;
    }
  ): void {
    const clientEventId = `${this.deviceId}-ev-${ev.occurredAt}-${crypto
      .randomUUID()
      .slice(0, 6)}`;
    this.stmtInsertEvent.run({
      clientEventId,
      activitySyncId: ev.activitySyncId ?? null,
      eventType: ev.eventType,
      appName: ev.appName,
      executableName: ev.executableName || '',
      windowTitle: ev.windowTitle || '',
      url: ev.url ?? null,
      domain: ev.domain ?? null,
      projectName: ev.projectName ?? null,
      fileName: ev.fileName ?? null,
      category: ev.category,
      occurredAt: Math.round(ev.occurredAt),
      durationMs: Math.max(0, Math.round(ev.durationMs || 0)),
      keystrokesCount: Math.max(0, Math.round(ev.keystrokesCount || 0)),
      mouseClicksCount: Math.max(0, Math.round(ev.mouseClicksCount || 0)),
      scrollEventsCount: Math.max(0, Math.round(ev.scrollEventsCount || 0)),
    });
  }

  reclassifyActivity(
    payload: ReclassifyActivityPayload
  ): { updated: ActivityRecord | null; ruleCreated?: CategoryRule } {
    const existingRow = this.stmtGetActivityById.get(payload.id) as
      | ActivityRow
      | undefined;
    if (!existingRow) {
      return { updated: null };
    }

    const isProductive =
      typeof payload.isProductive === 'boolean'
        ? payload.isProductive
        : isCategoryProductiveByDefault(payload.category);
    const now = Date.now();

    const tx = this.db.transaction(() => {
      this.stmtUpdateActivityCategory.run({
        id: payload.id,
        category: payload.category,
        isProductive: isProductive ? 1 : 0,
        updatedAt: now,
      });

      if (payload.applyToSameTargetToday) {
        const d = new Date(existingRow.start_time);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(d.getDate()).padStart(2, '0')}`;
        const { startMs, endMs } = getDayBounds(dayKey);

        if (existingRow.domain) {
          this.stmtUpdateMatchingDomainToday.run({
            category: payload.category,
            isProductive: isProductive ? 1 : 0,
            domain: existingRow.domain,
            dayStart: startMs,
            dayEnd: endMs,
            updatedAt: now,
          });
        } else {
          this.stmtUpdateMatchingAppToday.run({
            category: payload.category,
            isProductive: isProductive ? 1 : 0,
            appName: existingRow.app_name,
            dayStart: startMs,
            dayEnd: endMs,
            updatedAt: now,
          });
        }
      }
    });

    tx();

    let ruleCreated: CategoryRule | undefined;
    if (payload.createRule) {
      const targetField: RuleMatchField =
        payload.matchField || (existingRow.domain ? 'domain' : 'app_name');
      const rawTarget =
        payload.pattern?.trim() ||
        (targetField === 'domain' && existingRow.domain
          ? existingRow.domain
          : targetField === 'url' && existingRow.url
          ? existingRow.url
          : existingRow.app_name);

      if (rawTarget) {
        const pattern = payload.pattern?.trim()
          ? payload.pattern.trim()
          : `^${escapeRegexLiteral(rawTarget)}$`;

        ruleCreated = this.upsertCategoryRule({
          pattern,
          matchField: targetField,
          category: payload.category,
          isProductive,
          priority: 500,
          enabled: true,
        });
      }
    }

    const updatedRow = this.stmtGetActivityById.get(payload.id) as
      | ActivityRow
      | undefined;
    return {
      updated: updatedRow ? rowToActivity(updatedRow) : null,
      ruleCreated,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Analytical Queries (Timeline, Summary, Top Apps, Surgical Events)*/
  /* ---------------------------------------------------------------- */

  getDayTimeline(
    dateStr: string,
    liveSession?: ActivityRecord | null
  ): ActivityRecord[] {
    const { startMs, endMs } = getDayBounds(dateStr);
    const rows = this.stmtGetTimelineRange.all({
      dayStart: startMs,
      dayEnd: endMs,
    }) as ActivityRow[];

    const records: ActivityRecord[] = [];
    let mergedLive = false;

    for (const row of rows) {
      const base = rowToActivity(row);
      const isLiveRow =
        liveSession && liveSession.id > 0 && liveSession.id === base.id;
      const source = isLiveRow
        ? { ...base, ...liveSession, isOngoing: true }
        : base;
      if (isLiveRow) mergedLive = true;

      const clampedStart = Math.max(startMs, source.startTime);
      const clampedEnd = Math.min(endMs, source.endTime);
      if (clampedEnd <= clampedStart) continue;

      const fullDuration = Math.max(
        1,
        Math.round((source.endTime - source.startTime) / 1000)
      );
      const clampedDuration = Math.max(
        1,
        Math.round((clampedEnd - clampedStart) / 1000)
      );
      const ratio = Math.min(1, clampedDuration / fullDuration);

      records.push({
        ...source,
        startTime: clampedStart,
        endTime: clampedEnd,
        durationSeconds: clampedDuration,
        activeInputSeconds: Math.round((source.activeInputSeconds || 0) * ratio),
        passiveSeconds: Math.round((source.passiveSeconds || 0) * ratio),
      });
    }

    if (
      liveSession &&
      !mergedLive &&
      liveSession.endTime > startMs &&
      liveSession.startTime < endMs
    ) {
      const clampedStart = Math.max(startMs, liveSession.startTime);
      const clampedEnd = Math.min(endMs, liveSession.endTime);
      if (clampedEnd > clampedStart) {
        records.push({
          ...liveSession,
          startTime: clampedStart,
          endTime: clampedEnd,
          durationSeconds: Math.max(
            1,
            Math.round((clampedEnd - clampedStart) / 1000)
          ),
          isOngoing: true,
        });
      }
    }

    records.sort((a, b) => a.startTime - b.startTime);
    return records;
  }

  getDayEvents(dateStr: string, limit = 150): ActivityEventRecord[] {
    const { startMs, endMs } = getDayBounds(dateStr);
    const safeLimit = Math.max(1, Math.min(500, Math.round(limit)));
    const rows = this.stmtGetEventsRange.all({
      dayStart: startMs,
      dayEnd: endMs,
      limit: safeLimit,
    }) as ActivityEventRow[];
    return rows.map(rowToEvent);
  }

  getDaySummary(
    dateStr: string,
    liveSession?: ActivityRecord | null
  ): MetricsSummary {
    const { date, startMs, endMs } = getDayBounds(dateStr);
    const timeline = this.getDayTimeline(date, liveSession);

    const categoryTotals = new Map<TrackableCategory, number>();
    for (const cat of TRACKABLE_CATEGORIES) categoryTotals.set(cat, 0);

    let productiveSeconds = 0;
    let distractionCount = 0;
    let activeInputSeconds = 0;
    let passiveSeconds = 0;
    let keystrokesCount = 0;
    let mouseClicksCount = 0;
    let longestFocusStreakSeconds = 0;
    let currentFocusStreak = 0;
    const projectMap = new Map<string, ProjectStat>();

    for (const block of timeline) {
      const sec = block.durationSeconds;
      categoryTotals.set(
        block.category,
        (categoryTotals.get(block.category) || 0) + sec
      );

      if (block.isProductive) {
        productiveSeconds += sec;
        currentFocusStreak += sec;
        if (currentFocusStreak > longestFocusStreakSeconds) {
          longestFocusStreakSeconds = currentFocusStreak;
        }
      } else if (block.category === 'Distração' || block.category === 'Idle') {
        currentFocusStreak = 0;
      }

      if (block.category === 'Distração') {
        distractionCount += 1;
      }

      if (block.category !== 'Idle') {
        activeInputSeconds += block.activeInputSeconds || 0;
        const explicitPassive = block.passiveSeconds || 0;
        const remainder = Math.max(
          0,
          sec - (block.activeInputSeconds || 0) - explicitPassive
        );
        passiveSeconds += explicitPassive + remainder;
        keystrokesCount += block.keystrokesCount || 0;
        mouseClicksCount += block.mouseClicksCount || 0;
      }

      if (block.projectName && block.category !== 'Idle') {
        const pKey = block.projectName.toLowerCase();
        const prev = projectMap.get(pKey);
        if (prev) {
          prev.totalSeconds += sec;
          prev.activeInputSeconds += block.activeInputSeconds || 0;
          prev.sessionCount += 1;
        } else {
          projectMap.set(pKey, {
            projectName: block.projectName,
            category: block.category,
            totalSeconds: sec,
            activeInputSeconds: block.activeInputSeconds || 0,
            sessionCount: 1,
          });
        }
      }
    }

    const deepWorkSeconds =
      (categoryTotals.get('Deep Work') || 0) +
      (categoryTotals.get('Design') || 0) +
      (categoryTotals.get('Dev') || 0);
    const communicationSeconds = categoryTotals.get('Comunicação') || 0;
    const neutralSeconds = categoryTotals.get('Neutro') || 0;
    const distractionSeconds = categoryTotals.get('Distração') || 0;
    const idleSeconds = categoryTotals.get('Idle') || 0;

    const totalActiveSeconds =
      deepWorkSeconds +
      communicationSeconds +
      neutralSeconds +
      distractionSeconds;

    const focusPercentage =
      totalActiveSeconds > 0
        ? Math.min(100, Math.round((productiveSeconds / totalActiveSeconds) * 100))
        : 0;

    const sheldonScore = computeSheldonScore({
      totalActiveSeconds,
      productiveSeconds,
      communicationSeconds,
      neutralSeconds,
      distractionSeconds,
      distractionCount,
    });

    const grandTotalForBreakdown = Math.max(1, totalActiveSeconds + idleSeconds);
    const categoryBreakdown: CategoryBreakdownItem[] = TRACKABLE_CATEGORIES.map(
      (category) => {
        const seconds = categoryTotals.get(category) || 0;
        return {
          category,
          seconds,
          percentage:
            Math.round((seconds / grandTotalForBreakdown) * 1000) / 10,
        };
      }
    ).filter((item) => item.seconds > 0);

    const eventsCountRow = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM activity_events WHERE occurred_at >= ? AND occurred_at < ?`
      )
      .get(startMs, endMs) as { cnt: number };

    const topProjects = [...projectMap.values()]
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 8);

    return {
      date,
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
      contextSwitchesCount:
        eventsCountRow?.cnt || Math.max(0, timeline.length - 1),
      longestFocusStreakSeconds,
      distractionCount,
      focusPercentage,
      sheldonScore,
      categoryBreakdown,
      topProjects,
    };
  }

  getTopApps(
    dateStr: string,
    limit = 10,
    liveSession?: ActivityRecord | null
  ): TopAppStat[] {
    const timeline = this.getDayTimeline(dateStr, liveSession);
    const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));

    let totalActiveSeconds = 0;
    const map = new Map<string, TopAppStat>();

    for (const block of timeline) {
      if (block.category === 'Idle') continue;
      totalActiveSeconds += block.durationSeconds;

      const displayKey = block.domain || block.appName;
      const mapKey = displayKey.toLowerCase();
      const existing = map.get(mapKey);

      if (existing) {
        existing.totalSeconds += block.durationSeconds;
        existing.activeInputSeconds += block.activeInputSeconds || 0;
        existing.keystrokesCount += block.keystrokesCount || 0;
        existing.mouseClicksCount += block.mouseClicksCount || 0;
        existing.sessionCount += 1;
        if (!existing.processPath && block.processPath) {
          existing.processPath = block.processPath;
        }
      } else {
        map.set(mapKey, {
          key: displayKey,
          appName: block.appName,
          executableName: block.executableName,
          processPath: block.processPath,
          domain: block.domain,
          category: block.category,
          isProductive: block.isProductive,
          totalSeconds: block.durationSeconds,
          activeInputSeconds: block.activeInputSeconds || 0,
          keystrokesCount: block.keystrokesCount || 0,
          mouseClicksCount: block.mouseClicksCount || 0,
          percentageOfActive: 0,
          percentageOfDay: 0,
          sessionCount: 1,
        });
      }
    }

    const activeDenom = Math.max(1, totalActiveSeconds);
    return [...map.values()]
      .filter((item) => item.totalSeconds > 0)
      .map((item) => ({
        ...item,
        percentageOfActive:
          Math.round((item.totalSeconds / activeDenom) * 1000) / 10,
        percentageOfDay: Math.round((item.totalSeconds / 86400) * 1000) / 10,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, safeLimit);
  }

  /* ---------------------------------------------------------------- */
  /* Supabase Sync Queue Helpers                                      */
  /* ---------------------------------------------------------------- */

  getPendingActivitiesForSync(limit = 50): PendingActivitySyncRow[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM activities
         WHERE synced_at IS NULL OR updated_at > synced_at
         ORDER BY start_time ASC
         LIMIT ?`
      )
      .all(limit) as ActivityRow[];

    return rows.map((row) => ({
      localId: row.id,
      clientSyncId: row.client_sync_id || `${this.deviceId}-${row.id}-${row.start_time}`,
      appName: row.app_name,
      executableName: row.executable_name || '',
      processPath: row.process_path || '',
      processId: row.process_id || 0,
      windowTitle: row.window_title || '',
      url: row.url ?? null,
      domain: row.domain ?? null,
      projectName: row.project_name ?? null,
      fileName: row.file_name ?? null,
      category: row.category,
      isProductive: Boolean(row.is_productive),
      startTime: row.start_time,
      endTime: row.end_time,
      durationSeconds: row.duration_seconds,
      activeInputSeconds: row.active_input_seconds || 0,
      passiveSeconds: row.passive_seconds || 0,
      keystrokesCount: row.keystrokes_count || 0,
      mouseClicksCount: row.mouse_clicks_count || 0,
      scrollEventsCount: row.scroll_events_count || 0,
    }));
  }

  markActivitiesSynced(localIds: number[], syncedAtMs: number): void {
    if (localIds.length === 0) return;
    const stmt = this.db.prepare(
      'UPDATE activities SET synced_at = ? WHERE id = ?'
    );
    const tx = this.db.transaction((ids: number[]) => {
      for (const id of ids) stmt.run(syncedAtMs, id);
    });
    tx(localIds);
  }

  getPendingEventsForSync(limit = 100): PendingEventSyncRow[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM activity_events
         WHERE synced_at IS NULL
         ORDER BY occurred_at ASC
         LIMIT ?`
      )
      .all(limit) as ActivityEventRow[];

    return rows.map((row) => ({
      ...rowToEvent(row),
      activitySyncId: row.activity_sync_id ?? null,
    }));
  }

  markEventsSynced(localIds: number[], syncedAtMs: number): void {
    if (localIds.length === 0) return;
    const stmt = this.db.prepare(
      'UPDATE activity_events SET synced_at = ? WHERE id = ?'
    );
    const tx = this.db.transaction((ids: number[]) => {
      for (const id of ids) stmt.run(syncedAtMs, id);
    });
    tx(localIds);
  }

  getSyncCounters(): {
    pendingActivitiesCount: number;
    pendingEventsCount: number;
    syncedActivitiesCount: number;
  } {
    if (!this.db.open) {
      return {
        pendingActivitiesCount: 0,
        pendingEventsCount: 0,
        syncedActivitiesCount: 0,
      };
    }

    const aRow = this.db
      .prepare(
        `SELECT
           SUM(CASE WHEN synced_at IS NULL OR updated_at > synced_at THEN 1 ELSE 0 END) AS pending_cnt,
           SUM(CASE WHEN synced_at IS NOT NULL THEN 1 ELSE 0 END) AS synced_cnt
         FROM activities`
      )
      .get() as { pending_cnt: number | null; synced_cnt: number | null };

    const eRow = this.db
      .prepare(
        'SELECT COUNT(*) AS cnt FROM activity_events WHERE synced_at IS NULL'
      )
      .get() as { cnt: number };

    return {
      pendingActivitiesCount: aRow?.pending_cnt || 0,
      pendingEventsCount: eRow?.cnt || 0,
      syncedActivitiesCount: aRow?.synced_cnt || 0,
    };
  }

  close(): void {
    try {
      this.db.pragma('optimize');
      this.db.close();
    } catch (err) {
      console.error('[Sheldon Database] Erro ao fechar banco SQLite:', err);
    }
  }
}
