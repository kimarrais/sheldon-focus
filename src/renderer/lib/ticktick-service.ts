import type {
  DailyTask,
  TickTickProject,
  TickTickTaskPayload,
  TickTickUpdateTaskPayload,
} from '@shared/types';

export const INITIAL_TICKTICK_PROJECTS: TickTickProject[] = [
  { id: 'Routine', name: 'Rotina', color: '#8B5CF6' },
  { id: 'Trabalho', name: 'Trabalho 💻', color: '#0EA5E9' },
  { id: 'Tarefas', name: 'Tarefas 🔥', color: '#FB7213' },
  { id: 'Hábitos', name: 'Hábitos ✨', color: '#10B981' },
];

export const INITIAL_TICKTICK_TASKS: DailyTask[] = [
  // Rotina
  {
    id: 'tt-r1',
    title: 'Planejamento matinal e prioridades do dia 🟡',
    project: 'Routine',
    listName: 'Rotina Diária',
    listColor: '#8B5CF6',
    estimatedMinutes: 20,
    completed: false,
    priority: 'high',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Rotina', 'Foco'],
    description: 'Revisar metas, organizar bloco de trabalho no Sheldon Focus e listar pendências críticas.',
    subtasks: [
      { id: 's1', title: 'Definir 3 prioridades do dia', completed: true },
      { id: 's2', title: 'Ativar o Sentinela no modo trabalho', completed: false },
    ],
  },
  {
    id: 'tt-r2',
    title: 'Organização do workspace e ambiente de trabalho',
    project: 'Routine',
    listName: 'Rotina Diária',
    listColor: '#8B5CF6',
    estimatedMinutes: 15,
    completed: false,
    priority: 'medium',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Rotina', 'Organização'],
    description: 'Manter a mesa limpa e fechar abas desnecessárias do navegador.',
  },

  // Trabalho
  {
    id: 'tt-w1',
    title: 'Configurar variáveis de ambiente (.env) para Supabase',
    project: 'Trabalho',
    listName: 'Desenvolvimento',
    listColor: '#0EA5E9',
    estimatedMinutes: 30,
    completed: false,
    priority: 'high',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Dev', 'Supabase'],
    description: 'Copiar .env.example para .env e preencher SUPABASE_URL e SUPABASE_ANON_KEY.',
    subtasks: [
      { id: 's3', title: 'Copiar .env.example para .env', completed: true },
      { id: 's4', title: 'Testar conexão de sync na aba Métricas', completed: false },
    ],
  },
  {
    id: 'tt-w2',
    title: 'Sessão de Deep Work (45 minutos de foco)',
    project: 'Trabalho',
    listName: 'Desenvolvimento',
    listColor: '#0EA5E9',
    estimatedMinutes: 45,
    completed: false,
    priority: 'high',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Deep Work', 'Foco'],
    description: 'Programação sem interrupções com auxílio do Sheldon e Dynamic Island.',
  },
  {
    id: 'tt-w3',
    title: 'Revisão de código e testes do backend',
    project: 'Trabalho',
    listName: 'Desenvolvimento',
    listColor: '#0EA5E9',
    estimatedMinutes: 40,
    completed: false,
    priority: 'medium',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Dev', 'Code Review'],
    description: 'Conferir rotas de API, sincronização de atividades e regras do banco de dados.',
  },

  // Tarefas
  {
    id: 'tt-t1',
    title: 'Revisar documentação técnica do projeto (README.md)',
    project: 'Tarefas',
    listName: 'Documentação',
    listColor: '#FB7213',
    estimatedMinutes: 25,
    completed: false,
    priority: 'medium',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Docs', 'Projeto'],
    description: 'Garantir que as instruções de instalação e modo dev estejam claras e completas.',
  },
  {
    id: 'tt-t2',
    title: 'Customizar lista de processos bloqueados no Black Mirror',
    project: 'Tarefas',
    listName: 'Configurações',
    listColor: '#FB7213',
    estimatedMinutes: 15,
    completed: false,
    priority: 'low',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Configurações'],
    description: 'Adicionar jogos e executáveis que costumam causar distração durante o horário de trabalho.',
  },

  // Hábitos
  {
    id: 'tt-h1',
    title: 'Hidratação constante (meta: 2L de água)',
    project: 'Hábitos',
    listName: 'Saúde e Bem-estar',
    listColor: '#10B981',
    estimatedMinutes: 5,
    completed: false,
    priority: 'low',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Hábito', 'Saúde'],
    description: 'Beber um copo de água a cada bloco de foco de 50 minutos.',
  },
  {
    id: 'tt-h2',
    title: 'Pausa ativa e alongamento postural',
    project: 'Hábitos',
    listName: 'Saúde e Bem-estar',
    listColor: '#10B981',
    estimatedMinutes: 10,
    completed: false,
    priority: 'low',
    syncedFromTickTick: true,
    dueLabel: 'Hoje',
    tags: ['Hábito', 'Saúde'],
    description: 'Levantar da cadeira, alongar ombros e relaxar os olhos longe das telas.',
  },
];

export function hasValidTickTickToken(token?: string): boolean {
  return Boolean(
    token &&
      token.trim().length > 10 &&
      !token.startsWith('tt_demo_')
  );
}

export async function syncTickTickTasks(
  token?: string
): Promise<{ tasks: DailyTask[]; projects: TickTickProject[]; syncedLive?: boolean; error?: string }> {
  const api = window.sheldonAPI;
  if (api && hasValidTickTickToken(token)) {
    try {
      const res = await api.tickTickSyncTasks(token!.trim());
      if (res.success && res.tasks) {
        return {
          tasks: res.tasks,
          projects: res.projects && res.projects.length > 0 ? res.projects : INITIAL_TICKTICK_PROJECTS,
          syncedLive: true,
        };
      }
      return {
        tasks: INITIAL_TICKTICK_TASKS,
        projects: INITIAL_TICKTICK_PROJECTS,
        syncedLive: false,
        error: res.error || 'Falha ao sincronizar com TickTick.',
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[TickTick Service] Erro ao sincronizar via API:', msg);
      return {
        tasks: INITIAL_TICKTICK_TASKS,
        projects: INITIAL_TICKTICK_PROJECTS,
        syncedLive: false,
        error: msg,
      };
    }
  }

  // Fallback demo/initial data
  return {
    tasks: INITIAL_TICKTICK_TASKS,
    projects: INITIAL_TICKTICK_PROJECTS,
    syncedLive: false,
  };
}

export async function createTickTickTask(
  token: string | undefined,
  payload: TickTickTaskPayload
): Promise<DailyTask> {
  const api = window.sheldonAPI;
  if (api && hasValidTickTickToken(token)) {
    try {
      const res = await api.tickTickCreateTask(token!.trim(), payload);
      if (res.success && res.task) {
        return res.task;
      }
    } catch (e) {
      console.warn('[TickTick Service] Erro ao criar tarefa via API:', e);
    }
  }

  // Local fallback task
  return {
    id: `local-task-${Date.now()}`,
    title: payload.title,
    project: payload.projectId || 'Hoje',
    listName: payload.projectId || 'Hoje',
    estimatedMinutes: 30,
    completed: false,
    priority: payload.priority === 5 ? 'high' : payload.priority === 3 ? 'medium' : 'low',
    syncedFromTickTick: false,
    description: payload.content || payload.desc || '',
    startDate: payload.startDate,
    dueDate: payload.dueDate,
    dueLabel: 'Hoje',
    tags: payload.tags || [],
    subtasks: [],
  };
}

export async function updateTickTickTask(
  token: string | undefined,
  payload: TickTickUpdateTaskPayload
): Promise<boolean> {
  const api = window.sheldonAPI;
  if (api && hasValidTickTickToken(token)) {
    try {
      const res = await api.tickTickUpdateTask(token!.trim(), payload);
      return res.success;
    } catch (e) {
      console.warn('[TickTick Service] Erro ao atualizar tarefa via API:', e);
      return false;
    }
  }
  return false;
}

export async function markTickTickTaskComplete(
  token: string | undefined,
  taskId: string,
  projectId?: string
): Promise<boolean> {
  const api = window.sheldonAPI;
  if (api && hasValidTickTickToken(token)) {
    try {
      const res = await api.tickTickCompleteTask(token!.trim(), taskId, projectId);
      return res.success;
    } catch (e) {
      console.warn('[TickTick Service] Erro ao completar tarefa via API:', e);
    }
  }
  return true;
}
