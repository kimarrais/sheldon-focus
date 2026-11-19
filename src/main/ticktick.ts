import type {
  DailyTask,
  SubTaskItem,
  TaskPriority,
  TickTickProject,
  TickTickTaskPayload,
  TickTickUpdateTaskPayload,
} from '../shared/types';

interface RawTickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  isAllDay?: boolean;
  priority?: number;
  status?: number;
  completedTime?: string;
  tags?: string[];
  items?: { id: string; title: string; status: number }[];
}

interface RawTickTickProject {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  closed?: boolean;
}

const TICKTICK_BASE_URL = 'https://api.ticktick.com/open/v1';

function mapTickTickPriority(val?: number): TaskPriority {
  // TickTick API: 0 = none, 1 = low, 3 = medium, 5 = high
  if (val === 5) return 'high';
  if (val === 3) return 'medium';
  return 'low';
}

export function parseTickTickDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTickTickDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? parseTickTickDate(dateInput) || new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
  }
  return date.toISOString().replace(/\.\d{3}Z$/, '+0000');
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isTaskInTodayView(raw: RawTickTickTask): boolean {
  // TickTick "Hoje" shows open (non-completed) tasks due today or overdue,
  // or whose scheduled span starts on/before today and isn't in the past-completed bin.
  if (raw.status === 2 || raw.status === 1) return false;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();

  const due = parseTickTickDate(raw.dueDate);
  const start = parseTickTickDate(raw.startDate);

  if (due && due.getTime() <= endOfTodayMs) return true;
  if (start && start.getTime() <= endOfTodayMs) return true;
  return false;
}

function mapRawTaskToDailyTask(
  rawTask: RawTickTickTask,
  projectName: string,
  projectColor?: string
): DailyTask {
  const subtasks: SubTaskItem[] = (rawTask.items || []).map((item, idx) => ({
    id: item.id || `sub-${rawTask.id}-${idx}`,
    title: item.title,
    completed: item.status === 1 || item.status === 2,
  }));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = parseTickTickDate(rawTask.startDate);
  const due = parseTickTickDate(rawTask.dueDate);
  const effectiveDate = due || start;

  let dueLabel = 'Hoje';
  if (effectiveDate) {
    const targetDayStart = new Date(
      effectiveDate.getFullYear(),
      effectiveDate.getMonth(),
      effectiveDate.getDate()
    ).getTime();
    const diffDays = Math.round((todayStart - targetDayStart) / 86400000);
    if (diffDays > 0) {
      dueLabel = diffDays === 1 ? '1 dia em atraso' : `${diffDays} dias em atraso`;
    } else if (diffDays < 0) {
      dueLabel = toLocalDateKey(effectiveDate);
    } else {
      dueLabel = 'Hoje';
    }
  }

  let scheduledTime: string | undefined;
  let estimatedMinutes = 30;
  const timedSource = start || due;
  if (timedSource && rawTask.isAllDay === false) {
    const hhmm = toLocalHHMM(timedSource);
    if (hhmm !== '00:00') {
      scheduledTime = hhmm;
    }
  }
  if (start && due && rawTask.isAllDay === false) {
    const diffMins = Math.round((due.getTime() - start.getTime()) / 60000);
    if (diffMins >= 10 && diffMins <= 720) {
      estimatedMinutes = diffMins;
    }
  }

  const normalizedTags = Array.isArray(rawTask.tags)
    ? rawTask.tags.map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    id: `tt-${rawTask.id}`,
    title: rawTask.title,
    project: projectName || 'TickTick',
    listName: projectName || 'Inbox',
    listColor: projectColor,
    estimatedMinutes,
    completed: rawTask.status === 2,
    priority: mapTickTickPriority(rawTask.priority),
    syncedFromTickTick: true,
    description: rawTask.content || rawTask.desc || '',
    startDate: rawTask.startDate,
    dueDate: rawTask.dueDate,
    timeZone: rawTask.timeZone,
    isAllDay: rawTask.isAllDay,
    dueLabel,
    scheduledTime,
    tags: normalizedTags,
    subtasks,
    tickTickId: rawTask.id,
    tickTickProjectId: rawTask.projectId,
  };
}

export class TickTickClient {
  private static async request<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
    const url = `${TICKTICK_BASE_URL}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`TickTick API [${response.status}]: ${text || response.statusText}`);
    }

    if (!text || text.trim().length === 0) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  public static async getProjects(token: string): Promise<TickTickProject[]> {
    if (!token || token.trim().length === 0) {
      throw new Error('Token do TickTick não configurado.');
    }
    const projects = await this.request<RawTickTickProject[]>('/project', token);
    return (Array.isArray(projects) ? projects : []).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      sortOrder: p.sortOrder,
      closed: p.closed,
    }));
  }

  public static async syncTasks(token: string): Promise<{ tasks: DailyTask[]; projects: TickTickProject[] }> {
    if (!token || token.trim().length === 0) {
      throw new Error('Token do TickTick não configurado.');
    }

    const rawProjects = await this.request<RawTickTickProject[]>('/project', token);
    const projectList = Array.isArray(rawProjects) ? rawProjects : [];

    const projects: TickTickProject[] = projectList.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      sortOrder: p.sortOrder,
      closed: p.closed,
    }));

    const projectInfoMap = new Map<string, { name: string; color?: string }>();
    projectInfoMap.set('inbox', { name: 'Inbox', color: '#3981BF' });
    for (const p of projectList) {
      projectInfoMap.set(p.id, { name: p.name, color: p.color });
    }

    const activeProjectIds = Array.from(
      new Set(['inbox', ...projectList.filter((p) => !p.closed).map((p) => p.id)])
    );

    const seenTaskIds = new Set<string>();
    const todayTasks: DailyTask[] = [];

    // Fetch Inbox + active projects in parallel batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < activeProjectIds.length; i += BATCH_SIZE) {
      const batch = activeProjectIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((projectId) =>
          this.request<{ project?: RawTickTickProject; tasks?: RawTickTickTask[] }>(
            `/project/${encodeURIComponent(projectId)}/data`,
            token
          )
        )
      );

      results.forEach((res, idx) => {
        if (res.status !== 'fulfilled') {
          console.warn(`[TickTick] Falha ao carregar projeto ${batch[idx]}:`, res.reason);
          return;
        }
        const data = res.value;
        const projMeta = data?.project;
        if (projMeta && projMeta.id && !projectInfoMap.has(projMeta.id)) {
          projectInfoMap.set(projMeta.id, { name: projMeta.name || 'Inbox', color: projMeta.color });
        }
        const rawList = Array.isArray(data?.tasks) ? data.tasks : [];
        for (const rawTask of rawList) {
          if (!rawTask || !rawTask.id || seenTaskIds.has(rawTask.id)) continue;
          if (!isTaskInTodayView(rawTask)) continue;

          seenTaskIds.add(rawTask.id);
          const pInfo =
            projectInfoMap.get(rawTask.projectId) ||
            projectInfoMap.get(batch[idx]) || { name: 'Inbox', color: undefined };
          todayTasks.push(mapRawTaskToDailyTask(rawTask, pInfo.name, pInfo.color));
        }
      });
    }

    // Sort Today tasks: overdue first, then priority (high -> medium -> low), then title
    const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
    todayTasks.sort((a, b) => {
      const aOverdue = a.dueLabel?.includes('atraso') ? 0 : 1;
      const bOverdue = b.dueLabel?.includes('atraso') ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const pa = priorityRank[a.priority] ?? 2;
      const pb = priorityRank[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

    return { tasks: todayTasks, projects };
  }

  public static async createTask(token: string, payload: TickTickTaskPayload): Promise<DailyTask> {
    if (!token || token.trim().length === 0) {
      throw new Error('Token do TickTick não configurado.');
    }

    const body: Record<string, unknown> = {
      title: payload.title,
      content: payload.content || payload.desc || '',
      desc: payload.desc || payload.content || '',
      priority: payload.priority !== undefined ? payload.priority : 3,
      tags: payload.tags || [],
    };

    if (payload.projectId) {
      body.projectId = payload.projectId;
    }
    if (payload.startDate) {
      body.startDate = formatTickTickDate(payload.startDate);
    }
    if (payload.dueDate) {
      body.dueDate = formatTickTickDate(payload.dueDate);
    } else if (!payload.startDate) {
      // Default to today so newly created tasks appear in TickTick's "Hoje" view
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 0, 0);
      body.dueDate = formatTickTickDate(todayEnd);
      body.isAllDay = true;
    }
    if (payload.isAllDay !== undefined) {
      body.isAllDay = payload.isAllDay;
    }
    if (payload.timeZone) {
      body.timeZone = payload.timeZone;
    } else {
      body.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    }

    const created = await this.request<RawTickTickTask>('/task', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return mapRawTaskToDailyTask(created, 'Inbox');
  }

  public static async updateTask(token: string, payload: TickTickUpdateTaskPayload): Promise<DailyTask> {
    if (!token || token.trim().length === 0) {
      throw new Error('Token do TickTick não configurado.');
    }
    const cleanId = payload.id.replace(/^tt-/, '');
    if (!cleanId) {
      throw new Error('ID da tarefa TickTick inválido.');
    }

    const body: Record<string, unknown> = {
      id: cleanId,
      projectId: payload.projectId || 'inbox',
    };

    if (payload.title !== undefined) body.title = payload.title;
    if (payload.content !== undefined) body.content = payload.content;
    if (payload.desc !== undefined) body.desc = payload.desc;
    if (payload.priority !== undefined) body.priority = payload.priority;
    if (payload.startDate !== undefined) body.startDate = formatTickTickDate(payload.startDate);
    if (payload.dueDate !== undefined) body.dueDate = formatTickTickDate(payload.dueDate);
    if (payload.isAllDay !== undefined) body.isAllDay = payload.isAllDay;
    if (payload.tags !== undefined) body.tags = payload.tags;
    body.timeZone = payload.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

    const updated = await this.request<RawTickTickTask>(`/task/${encodeURIComponent(cleanId)}`, token, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return mapRawTaskToDailyTask(updated, 'TickTick');
  }

  public static async completeTask(token: string, taskId: string, projectId?: string): Promise<boolean> {
    if (!token || token.trim().length === 0) {
      throw new Error('Token do TickTick não configurado.');
    }

    const cleanId = taskId.replace(/^tt-/, '');
    const targetProject = projectId && projectId.trim().length > 0 ? projectId.trim() : 'inbox';

    await this.request<void>(
      `/project/${encodeURIComponent(targetProject)}/task/${encodeURIComponent(cleanId)}/complete`,
      token,
      {
        method: 'POST',
      }
    );
    return true;
  }
}
