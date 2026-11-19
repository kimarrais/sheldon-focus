import React, { useState } from 'react';
import { Clock, Lock, Palmtree } from 'lucide-react';
import type { SentinelScheduleStatus, SheldonLeashSettings } from '@shared/types';
import pointerOffSvg from '../../assets/figma/pointer-off.svg';
import powerSvg from '../../assets/figma/power.svg';

interface BlockerTabProps {
  settings: SheldonLeashSettings;
  onUpdateSettings: (updated: Partial<SheldonLeashSettings>) => void;
  isSentinelActive: boolean;
  onToggleSentinel: () => void;
  onSimulateViolation?: () => void;
  scheduleStatus?: SentinelScheduleStatus | null;
}

const COMMON_GAMES = [
  'Valorant.exe',
  'LeagueClient.exe',
  'Steam.exe',
  'Discord.exe',
  'SleepingDogs.exe',
  'EldenRing.exe',
  'CS2.exe',
  'Cyberpunk2077.exe',
  'GenshinImpact.exe',
  'EpicGamesLauncher.exe',
];

const WORK_PRESETS = [
  { label: '08:00 – 17:00', start: '08:00', end: '17:00' },
  { label: '09:00 – 18:00', start: '09:00', end: '18:00' },
  { label: '10:00 – 19:00', start: '10:00', end: '19:00' },
];

export const BlockerTab: React.FC<BlockerTabProps> = ({
  settings,
  onUpdateSettings,
  isSentinelActive,
  onToggleSentinel,
  onSimulateViolation,
  scheduleStatus,
}) => {
  const [newExe, setNewExe] = useState<string>('');
  const isLocked = Boolean(scheduleStatus?.lockedByWorkHours);

  const handleAddExe = (exe: string) => {
    const clean = exe.trim();
    if (!clean) return;
    const formatted = clean.endsWith('.exe') ? clean : `${clean}.exe`;
    if (settings.blacklistedExecutables.some((e) => e.toLowerCase() === formatted.toLowerCase())) {
      return;
    }
    onUpdateSettings({
      blacklistedExecutables: [...settings.blacklistedExecutables, formatted],
    });
    setNewExe('');
  };

  const handleRemoveExe = (exe: string) => {
    onUpdateSettings({
      blacklistedExecutables: settings.blacklistedExecutables.filter(
        (e) => e.toLowerCase() !== exe.toLowerCase()
      ),
    });
  };

  return (
    <div className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[18px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] p-4 xl:p-5 flex flex-col gap-4 flex-1 min-h-0 h-full select-none overflow-y-auto sheldon-scroll">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08] gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-[11px] bg-[#FECCAA]/45 dark:bg-[#FB7213]/15 flex items-center justify-center shrink-0">
            <img src={pointerOffSvg} alt="Bloquear" className="size-5 dark:invert" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-[#242424] dark:text-white truncate">
              Sentinela &amp; Bloqueio de Distrações
            </h2>
            <p className="text-[11px] text-[#6D6D6D] dark:text-[#9CA3AF] truncate">
              O Sentinela apenas bloqueia distrações. Seu rastreamento automático de uso continua 24/7 mesmo desligado.
            </p>
          </div>
        </div>

        {/* Sentinel Active Quick Toggle */}
        <button
          type="button"
          onClick={onToggleSentinel}
          title={isLocked ? 'Travado pelo horário de trabalho ativo' : undefined}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-[11px] font-semibold text-xs transition-all duration-200 active:scale-95 shrink-0 ${
            isSentinelActive
              ? 'bg-[#FECCAA] dark:bg-[#FB7213]/25 text-[#FB7213] hover:bg-[#fedbc4]'
              : 'bg-slate-100 dark:bg-[#2A2C32] text-slate-500 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-[#32353E]'
          }`}
        >
          {isLocked ? (
            <Lock className="size-3.5" />
          ) : (
            <img
              src={powerSvg}
              alt=""
              className={`size-4 dark:invert ${isSentinelActive ? 'opacity-100' : 'opacity-40 grayscale'}`}
            />
          )}
          <span>{isSentinelActive ? 'Sentinela Ativo' : 'Sentinela Desativado'}</span>
        </button>
      </div>

      {/* Work Hours Rule Card */}
      <div className="bg-[#FFF7F0] dark:bg-[#26221F] border border-[#FDE2CC] dark:border-[#FB7213]/25 rounded-[14px] p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="size-8 rounded-[9px] bg-[#FB7213]/15 text-[#FB7213] flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[12.5px] font-bold text-[#242424] dark:text-white">
                  Regra de Horário de Trabalho
                </p>
                {settings.workHoursEnabled && scheduleStatus?.inVacation && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <Palmtree className="size-3" /> Pausado pelo Modo Férias
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6D6D6D] dark:text-[#9CA3AF]">
                Mantém o Modo Sentinela ativado automaticamente no horário comercial e exibe a regra no painel lateral.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUpdateSettings({ workHoursEnabled: !settings.workHoursEnabled })}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
              settings.workHoursEnabled ? 'bg-[#FB7213]' : 'bg-slate-300 dark:bg-white/20'
            }`}
          >
            <span
              className={`size-5 rounded-full bg-white shadow transition-transform ${
                settings.workHoursEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {settings.workHoursEnabled && (
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-[#FDE2CC] dark:border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 bg-white dark:bg-[#1B1C20] border border-[#FDE2CC] dark:border-white/10 rounded-[9px] px-2.5 py-1.5">
                <span className="text-[10.5px] text-[#6D6D6D] dark:text-white/60 font-medium">Das</span>
                <input
                  type="time"
                  value={settings.workHoursStart}
                  onChange={(e) => onUpdateSettings({ workHoursStart: e.target.value })}
                  className="bg-transparent text-[11.5px] font-semibold text-[#242424] dark:text-white outline-none tabular-nums"
                />
              </label>

              <label className="flex items-center gap-1.5 bg-white dark:bg-[#1B1C20] border border-[#FDE2CC] dark:border-white/10 rounded-[9px] px-2.5 py-1.5">
                <span className="text-[10.5px] text-[#6D6D6D] dark:text-white/60 font-medium">às</span>
                <input
                  type="time"
                  value={settings.workHoursEnd}
                  onChange={(e) => onUpdateSettings({ workHoursEnd: e.target.value })}
                  className="bg-transparent text-[11.5px] font-semibold text-[#242424] dark:text-white outline-none tabular-nums"
                />
              </label>
            </div>

            <div className="flex items-center gap-1.5">
              {WORK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      workHoursStart: preset.start,
                      workHoursEnd: preset.end,
                    })
                  }
                  className={`px-2 py-1 rounded-[8px] text-[10px] font-semibold transition-colors ${
                    settings.workHoursStart === preset.start && settings.workHoursEnd === preset.end
                      ? 'bg-[#FB7213] text-white'
                      : 'bg-white dark:bg-[#1B1C20] text-[#6D6D6D] dark:text-white/70 hover:text-[#FB7213]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rules / Switches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Rule 1 */}
        <div className="bg-[#F5F6FA] dark:bg-[#26282E] rounded-[14px] p-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-bold text-[#242424] dark:text-white">
              Taskkill Forçado Imediato
            </p>
            <p className="text-[11px] text-[#6D6D6D] dark:text-[#9CA3AF]">
              Encerra jogos e distrações em até 2 avisos sem chance de salvar.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ forcedTaskkillEnabled: !settings.forcedTaskkillEnabled })
            }
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
              settings.forcedTaskkillEnabled ? 'bg-[#FB7213]' : 'bg-slate-300 dark:bg-white/20'
            }`}
          >
            <span
              className={`size-5 rounded-full bg-white shadow transition-transform ${
                settings.forcedTaskkillEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Rule 2 */}
        <div className="bg-[#F5F6FA] dark:bg-[#26282E] rounded-[14px] p-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-bold text-[#242424] dark:text-white">
              Overlay Kiosk em Tela Cheia
            </p>
            <p className="text-[11px] text-[#6D6D6D] dark:text-[#9CA3AF]">
              Bloqueia a tela de todos os monitores ao detectar infração grave.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ fullscreenBlockEnabled: !settings.fullscreenBlockEnabled })
            }
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
              settings.fullscreenBlockEnabled ? 'bg-[#FB7213]' : 'bg-slate-300 dark:bg-white/20'
            }`}
          >
            <span
              className={`size-5 rounded-full bg-white shadow transition-transform ${
                settings.fullscreenBlockEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Executable Blacklist Manager */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-[#242424] dark:text-white">
              Lista Negra de Executáveis ({settings.blacklistedExecutables.length})
            </h3>
            <p className="text-[11px] text-[#6D6D6D] dark:text-[#9CA3AF]">
              Só dispara avisos quando o Modo Sentinela está ativado.
            </p>
          </div>

          {onSimulateViolation && (
            <button
              type="button"
              onClick={onSimulateViolation}
              className="px-2.5 py-1 rounded-[8px] bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px] font-semibold transition-all"
            >
              Simular Infração
            </button>
          )}
        </div>

        {/* Add input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddExe(newExe);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newExe}
            onChange={(e) => setNewExe(e.target.value)}
            placeholder="Exemplo: Valorant.exe ou Game.exe"
            className="flex-1 bg-[#F5F6FA] dark:bg-[#26282E] border border-slate-200 dark:border-white/10 rounded-[10px] px-3 py-1.5 text-xs text-[#242424] dark:text-white outline-none focus:ring-2 focus:ring-[#FB7213]/40"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-[10px] bg-[#FB7213] hover:bg-[#e06209] text-white text-xs font-semibold transition-all active:scale-95"
          >
            Adicionar
          </button>
        </form>

        {/* Tag pills of blacklisted apps */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {settings.blacklistedExecutables.map((exe) => (
            <div
              key={exe}
              className="bg-[#F5F6FA] dark:bg-[#26282E] border border-slate-200/80 dark:border-white/10 rounded-[9px] pl-2.5 pr-1.5 py-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#242424] dark:text-white"
            >
              <span>{exe}</span>
              <button
                type="button"
                onClick={() => handleRemoveExe(exe)}
                className="size-3.5 rounded-full bg-slate-200 dark:bg-white/15 hover:bg-rose-500 hover:text-white flex items-center justify-center text-[9px] text-slate-600 dark:text-white/75 transition-colors"
                title="Remover"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Suggested Distractions */}
        <div className="pt-2">
          <p className="text-[11px] font-semibold text-[#6D6D6D] dark:text-[#9CA3AF] mb-1.5">
            Sugestões frequentes:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_GAMES.filter(
              (g) => !settings.blacklistedExecutables.some((e) => e.toLowerCase() === g.toLowerCase())
            ).map((game) => (
              <button
                key={game}
                type="button"
                onClick={() => handleAddExe(game)}
                className="text-[11px] bg-slate-100 dark:bg-[#26282E] hover:bg-[#FECCAA]/40 dark:hover:bg-[#FB7213]/20 text-[#6D6D6D] dark:text-white/70 hover:text-[#FB7213] px-2 py-0.5 rounded-[7px] transition-colors"
              >
                + {game}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
