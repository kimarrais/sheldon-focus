import React, { useState } from 'react';
import {
  ShieldAlert,
  KeyRound,
  Clock,
  Terminal,
  Plus,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  Save,
  Sun,
  Moon,
  ExternalLink,
  Laptop,
  Layers,
  RefreshCw,
  Bell,
  Sparkles,
  Palmtree,
  Power,
} from 'lucide-react';
import type { SheldonLeashSettings } from '@shared/types';
import { SHELDON_MOODS } from '@/lib/sheldon-moods';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface SettingsLeashTabProps {
  settings: SheldonLeashSettings;
  onUpdateSettings: (updated: Partial<SheldonLeashSettings>) => void;
  onToggleTheme?: (theme: 'dark' | 'light') => void;
  onTestFloatingWidget?: () => void;
  onCloseFloatingWidget?: () => void;
  onReplayIntro?: () => void;
  onTestIslandNotification?: () => void;
  onReplayIslandIntro?: () => void;
}

const SUGGESTED_EXECUTABLES = [
  'CS2.exe',
  'Cyberpunk2077.exe',
  'GenshinImpact.exe',
  'Discord.exe',
  'EpicGamesLauncher.exe',
];

export const SettingsLeashTab: React.FC<SettingsLeashTabProps> = ({
  settings,
  onUpdateSettings,
  onToggleTheme,
  onTestFloatingWidget,
  onCloseFloatingWidget,
  onReplayIntro,
  onTestIslandNotification,
  onReplayIslandIntro,
}) => {
  const [exeInput, setExeInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [testingTickTick, setTestingTickTick] = useState(false);
  const [tickTickTestMsg, setTickTickTestMsg] = useState<string | null>(null);

  const handleAddExecutable = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = exeInput.trim();
    if (!raw) return;

    const formatted = raw.toLowerCase().endsWith('.exe') ? raw : `${raw}.exe`;
    const exists = settings.blacklistedExecutables.some(
      (item) => item.toLowerCase() === formatted.toLowerCase()
    );

    if (!exists) {
      onUpdateSettings({
        blacklistedExecutables: [...settings.blacklistedExecutables, formatted],
      });
    }
    setExeInput('');
  };

  const handleAddPreset = (preset: string) => {
    const exists = settings.blacklistedExecutables.some(
      (item) => item.toLowerCase() === preset.toLowerCase()
    );
    if (!exists) {
      onUpdateSettings({
        blacklistedExecutables: [...settings.blacklistedExecutables, preset],
      });
    }
  };

  const handleRemoveExecutable = (target: string) => {
    onUpdateSettings({
      blacklistedExecutables: settings.blacklistedExecutables.filter(
        (exe) => exe !== target
      ),
    });
  };

  const handleSaveNotify = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    onUpdateSettings({ theme: newTheme });
    if (onToggleTheme) {
      onToggleTheme(newTheme);
    }
  };

  const handleTestTickTick = async () => {
    setTestingTickTick(true);
    setTickTickTestMsg(null);
    try {
      const api = window.sheldonAPI;
      const cleanToken = settings.tickTickToken.trim();
      if (!cleanToken) {
        setTickTickTestMsg('⚠️ Cole seu Personal Access Token do TickTick primeiro.');
        return;
      }
      if (api) {
        const res = await api.tickTickGetProjects(cleanToken);
        if (res.success && res.projects) {
          onUpdateSettings({ tickTickConnected: true, tickTickToken: cleanToken });
          setTickTickTestMsg(`✅ Conectado com sucesso! ${res.projects.length} listas encontradas.`);
        } else {
          onUpdateSettings({ tickTickConnected: false });
          setTickTickTestMsg(`⚠️ Erro na API: ${res.error || 'Token inválido'}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTickTickTestMsg(`Erro: ${msg}`);
    } finally {
      setTestingTickTick(false);
    }
  };

  const applyVacationPresetDays = (days: number) => {
    const start = new Date();
    const end = new Date(start.getTime() + days * 86400000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    onUpdateSettings({
      vacationModeEnabled: true,
      vacationStartDate: fmt(start),
      vacationEndDate: fmt(end),
    });
  };

  return (
    <div className="space-y-4 pb-6 select-none overflow-y-auto sheldon-scroll h-full pr-1">
      {/* Header Banner */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-card via-card to-primary/10">
        <div className="flex items-center gap-3">
          <img
            src={SHELDON_MOODS.cool.avatar}
            alt="Sheldon Guardião"
            className="w-11 h-11 rounded-xl object-contain shadow-orange-glow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="uppercase tracking-wider text-[10px]">
                Configurações Gerais
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">
                Sheldon Anti-Procrastinação
              </span>
            </div>
            <h1 className="text-base font-extrabold text-foreground mt-0.5">
              Tema, Dynamic Island, TickTick, Férias e Sistema
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onReplayIntro && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReplayIntro}
              className="font-bold text-[11px] gap-1.5 border-slate-300 dark:border-white/15 hover:bg-[#FECCAA]/40 dark:hover:bg-white/10 text-[#242424] dark:text-white"
            >
              <span>Ver Intro do Kim</span>
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleSaveNotify} className="font-bold text-[11px] gap-1.5">
            <Save className="w-3.5 h-3.5" />
            <span>{savedToast ? 'Alterações Salvas!' : 'Salvar'}</span>
          </Button>
        </div>
      </Card>

      {/* Top Grid: Theme & Desktop Dynamic Island + Autostart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Theme Options */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-[#FBBF24]" />
              <h2 className="text-base font-extrabold text-foreground">
                Tema Visual da Interface
              </h2>
            </div>
            <Badge variant="cream" className="font-mono text-xs">
              {settings.theme === 'light' ? 'Timeyfi Claro' : 'Obsidian Escuro'}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Escolha entre o visual limpo e minimalista no estilo Timeyfi (fundo claro com cartões brancos) ou o tema escuro padrão do Sheldon.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Light Theme Option */}
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                settings.theme === 'light'
                  ? 'bg-amber-500/10 border-primary ring-2 ring-primary/40 text-foreground shadow-sm'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Sun className="w-5 h-5 text-amber-500" />
                {settings.theme === 'light' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Timeyfi Clean White</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Fundo claro `#F4F6F9`, cartões brancos, visual arejado
                </div>
              </div>
            </button>

            {/* Dark Theme Option */}
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                settings.theme === 'dark'
                  ? 'bg-primary/10 border-primary ring-2 ring-primary/40 text-foreground shadow-sm'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Moon className="w-5 h-5 text-purple-400" />
                {settings.theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">Dark Obsidian</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Tema escuro de alta concentração com roxo e laranja
                </div>
              </div>
            </button>
          </div>
        </Card>

        {/* Card 2: Desktop Dynamic Island + AutoLaunch Controls */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-extrabold text-foreground">
                Dynamic Island &amp; Inicialização
              </h2>
            </div>
            <Switch
              checked={settings.floatingWidgetEnabled}
              onCheckedChange={(checked) =>
                onUpdateSettings({ floatingWidgetEnabled: checked })
              }
            />
          </div>

          <div className="space-y-2 pt-0.5">
            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Power className="w-3.5 h-3.5 text-[#FB7213] mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-foreground">
                    Iniciar ao ligar o Windows
                  </span>
                  <p className="text-[10.5px] text-muted-foreground leading-snug">
                    No app compilado, abre primeiro a Dynamic Island enquanto carrega o sistema e exibe a intro ao finalizar.
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.autoLaunchEnabled}
                onCheckedChange={(checked) => {
                  onUpdateSettings({ autoLaunchEnabled: checked });
                  void window.sheldonAPI?.setAutoLaunch?.(checked);
                }}
              />
            </div>

            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-foreground">Manter Sempre no Topo</span>
                <p className="text-[10.5px] text-muted-foreground">
                  A Dynamic Island fica visível por cima de outros programas e IDEs.
                </p>
              </div>
              <Switch
                checked={settings.floatingWidgetAlwaysOnTop}
                onCheckedChange={(checked) =>
                  onUpdateSettings({ floatingWidgetAlwaysOnTop: checked })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onTestFloatingWidget}
                className="text-xs gap-1.5 font-bold"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Mostrar Ilha</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onTestIslandNotification}
                className="text-xs gap-1.5 font-bold"
              >
                <Bell className="w-3.5 h-3.5 text-[#FB7213]" />
                <span>Testar Notificação</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onReplayIslandIntro}
                className="text-xs gap-1.5 font-bold"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Rever Intro da Ilha</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCloseFloatingWidget}
                className="text-xs text-muted-foreground hover:text-red-400"
              >
                Ocultar Ilha
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Middle Grid: TickTick API Integration + Vacation Mode + Lunch Lock */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* TickTick API Card */}
        <Card className="md:col-span-6 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h2 className="text-base font-extrabold text-foreground">
                Integração TickTick Open API &amp; MCP
              </h2>
            </div>

            <Badge variant="success" className="font-mono text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {settings.tickTickConnected ? 'Conectado' : 'Aguardando Token'}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Insira seu Personal Access Token do TickTick para puxar suas listas (Errands, Work, etc.), tags e tarefas diárias, e sincronizar tarefas concluídas de volta para o app.
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground">
              TickTick Personal Access Token / Bearer Token
            </label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={settings.tickTickToken}
                onChange={(e) =>
                  onUpdateSettings({
                    tickTickToken: e.target.value,
                    tickTickConnected: e.target.value.trim().length > 5,
                  })
                }
                placeholder="tt_live_your_access_token..."
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={testingTickTick}
              onClick={handleTestTickTick}
              className="text-xs font-bold gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${testingTickTick ? 'animate-spin' : ''}`} />
              <span>{testingTickTick ? 'Testando conexão...' : 'Testar Conexão com API'}</span>
            </Button>

            <a
              href="https://help.ticktick.com/articles/7438129581631995904"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <span>Como obter meu token TickTick?</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {tickTickTestMsg && (
            <div className="p-2.5 rounded-xl bg-secondary text-xs font-semibold text-foreground border border-border animate-in fade-in">
              {tickTickTestMsg}
            </div>
          )}
        </Card>

        {/* Vacation Mode + Lunch Lock Column */}
        <div className="md:col-span-6 flex flex-col gap-4">
          {/* Vacation Mode Card */}
          <Card className="p-4 space-y-3 border-emerald-500/25">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-extrabold text-foreground">
                  Modo Férias (Pausar Regras)
                </h2>
              </div>

              <Switch
                checked={settings.vacationModeEnabled}
                onCheckedChange={(checked) =>
                  onUpdateSettings({ vacationModeEnabled: checked })
                }
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">
              Durante o período de férias, o Sentinela fica liberado (não força bloqueio de horário comercial), enquanto o rastreamento contínuo continua registrando normalmente.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-muted-foreground">
                  Início das Férias
                </label>
                <Input
                  type="date"
                  value={settings.vacationStartDate}
                  onChange={(e) => onUpdateSettings({ vacationStartDate: e.target.value })}
                  className="font-mono text-[11px] h-8"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-muted-foreground">
                  Fim das Férias
                </label>
                <Input
                  type="date"
                  value={settings.vacationEndDate}
                  onChange={(e) => onUpdateSettings({ vacationEndDate: e.target.value })}
                  className="font-mono text-[11px] h-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-muted-foreground font-medium">Atalhos:</span>
              <button
                type="button"
                onClick={() => applyVacationPresetDays(2)}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-emerald-500/15 text-[10px] font-semibold text-foreground"
              >
                +2 dias
              </button>
              <button
                type="button"
                onClick={() => applyVacationPresetDays(7)}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-emerald-500/15 text-[10px] font-semibold text-foreground"
              >
                +7 dias
              </button>
              <button
                type="button"
                onClick={() => applyVacationPresetDays(15)}
                className="px-2 py-0.5 rounded-md bg-secondary hover:bg-emerald-500/15 text-[10px] font-semibold text-foreground"
              >
                +15 dias
              </button>
            </div>
          </Card>

          {/* Lunch Lock Schedule Card */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FBBF24]" />
                <h2 className="text-sm font-extrabold text-foreground">
                  Almoço Sagrado (Bloqueio)
                </h2>
              </div>

              <Switch
                checked={settings.lunchLockEnabled}
                onCheckedChange={(checked) =>
                  onUpdateSettings({ lunchLockEnabled: checked })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-muted-foreground">
                  Início
                </label>
                <Input
                  type="time"
                  value={settings.lunchStartTime}
                  onChange={(e) => onUpdateSettings({ lunchStartTime: e.target.value })}
                  className="font-mono text-[11px] h-8"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-muted-foreground">
                  Fim
                </label>
                <Input
                  type="time"
                  value={settings.lunchEndTime}
                  onChange={(e) => onUpdateSettings({ lunchEndTime: e.target.value })}
                  className="font-mono text-[11px] h-8"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Strictness & Process Blacklist */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Enforcement Toggles */}
        <Card className="md:col-span-5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">
              Nível de Rigor do Sentinela
            </h2>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-secondary/50 border border-border flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-foreground">
                  Modo Guilhotina (Overlay Roxo ⚔️)
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Bloqueio kiosk com cronômetro roxo e equalizador neon.
                </p>
              </div>
              <Switch
                checked={settings.fullscreenBlockEnabled}
                onCheckedChange={(checked) =>
                  onUpdateSettings({ fullscreenBlockEnabled: checked })
                }
              />
            </div>

            <div className="p-3 rounded-2xl bg-secondary/50 border border-border flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-foreground">
                  Taskkill Forçado
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Mata o executável imediatamente se o cronômetro zerar.
                </p>
              </div>
              <Switch
                checked={settings.forcedTaskkillEnabled}
                onCheckedChange={(checked) =>
                  onUpdateSettings({ forcedTaskkillEnabled: checked })
                }
              />
            </div>
          </div>
        </Card>

        {/* Executable Blacklist */}
        <Card className="md:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <h2 className="text-base font-extrabold text-foreground">
                Lista Negra de Executáveis
              </h2>
            </div>
            <Badge variant="cream" className="font-mono text-xs">
              {settings.blacklistedExecutables.length} apps
            </Badge>
          </div>

          <form onSubmit={handleAddExecutable} className="flex gap-2">
            <Input
              type="text"
              value={exeInput}
              onChange={(e) => setExeInput(e.target.value)}
              placeholder="Nome do executável (ex: CS2.exe, Valorant.exe)..."
              className="font-mono text-xs flex-1"
            />
            <Button type="submit" size="sm" className="font-bold text-xs gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </Button>
          </form>

          <div className="p-3 rounded-2xl bg-secondary/40 border border-border min-h-[64px] flex items-center flex-wrap gap-2">
            {settings.blacklistedExecutables.map((exe) => (
              <span
                key={exe}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-card border border-border text-xs font-mono font-bold text-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{exe}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveExecutable(exe)}
                  className="text-muted-foreground hover:text-red-400 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            <span>Sugestões:</span>
            {SUGGESTED_EXECUTABLES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleAddPreset(preset)}
                className="px-2 py-0.5 rounded-lg border border-border bg-card text-[11px] font-mono hover:border-primary"
              >
                + {preset}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
