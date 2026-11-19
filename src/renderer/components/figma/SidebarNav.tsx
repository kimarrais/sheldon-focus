import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarLeft01Icon, SidebarRight01Icon } from '@hugeicons/core-free-icons';
import { Lock, Palmtree, Clock } from 'lucide-react';
import type { SentinelScheduleStatus, SheldonVisualState, TabId } from '@shared/types';
import sheldonCatSvg from '../../assets/figma/v2/sheldon-cat.svg';
import checkmarkSquareSvg from '../../assets/figma/v2/checkmark-square-03.svg';
import chartSvg from '../../assets/figma/v2/chart.svg';
import pointerOffSvg from '../../assets/figma/v2/pointer-off.svg';
import pawPrintSvg from '../../assets/figma/v2/paw-print.svg';
import settingsSvg from '../../assets/figma/v2/settings-03.svg';

interface SidebarNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  sheldonState: SheldonVisualState;
  onToggleSheldonMood: () => void;
  isSentinelActive: boolean;
  onToggleSentinel: () => void;
  warningsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  scheduleStatus?: SentinelScheduleStatus | null;
}

const MOOD_TITLES: Record<SheldonVisualState, string> = {
  happy: 'Feliz demais',
  cool: 'Foco blindado',
  neutral: 'De boa',
  crying: 'Triste demais',
  angry: 'Pistola total',
};

interface NavItemDef {
  id: TabId;
  label: string;
  icon: string;
  match: (tab: TabId) => boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'hoje',
    label: 'Hoje',
    icon: checkmarkSquareSvg,
    match: (t) => t === 'hoje' || t === 'daybreak',
  },
  {
    id: 'metricas',
    label: 'Métricas',
    icon: chartSvg,
    match: (t) => t === 'metricas' || t === 'black-mirror',
  },
  {
    id: 'bloquear',
    label: 'Bloquear',
    icon: pointerOffSvg,
    match: (t) => t === 'bloquear',
  },
  {
    id: 'sheldon',
    label: 'Sheldon',
    icon: pawPrintSvg,
    match: (t) => t === 'sheldon' || t === 'sheldon-mood',
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: settingsSvg,
    match: (t) => t === 'configuracoes' || t === 'settings-leash',
  },
];

function formatShortBrDate(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  sheldonState,
  onToggleSheldonMood,
  isSentinelActive,
  onToggleSentinel,
  warningsCount = 0,
  isCollapsed = false,
  onToggleCollapsed,
  scheduleStatus,
}) => {
  const currentMoodTitle = MOOD_TITLES[sheldonState] || 'Feliz demais';
  const showVacationBanner = Boolean(scheduleStatus?.vacationModeEnabled);
  const showWorkHoursBanner = Boolean(scheduleStatus?.workHoursEnabled);
  const isLockedByWorkHours = Boolean(scheduleStatus?.lockedByWorkHours);

  return (
    <aside
      aria-label="Menu lateral principal"
      className={`bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] h-full shrink-0 rounded-[20px] flex flex-col justify-between overflow-hidden no-scrollbar select-none shadow-[0_2px_12px_rgba(16,24,40,0.03)] dark:shadow-none transition-[width,padding] duration-200 ease-out ${
        isCollapsed ? 'w-[68px] p-2.5' : 'w-[214px] xl:w-[228px] p-3 xl:p-3.5'
      }`}
    >
      {/* Top Section: Collapse Control + Sheldon Mood Card + Navigation Menu */}
      <div className="flex flex-col gap-3 min-h-0">
        {/* Collapse/Expand Button + Sheldon Mood Card */}
        <div className={`flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>
          {onToggleCollapsed && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-end'}`}>
              <button
                type="button"
                onClick={onToggleCollapsed}
                title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                className="size-[26px] rounded-[8px] bg-[#F5F6FA] dark:bg-[#2A2C32] hover:bg-[#ECEEF5] dark:hover:bg-[#343740] text-[#6D6D6D] dark:text-white/70 hover:text-[#242424] dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <HugeiconsIcon
                  icon={isCollapsed ? SidebarRight01Icon : SidebarLeft01Icon}
                  size={15}
                  strokeWidth={2}
                />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleSheldonMood}
            title={isCollapsed ? `Sheldon: ${currentMoodTitle}` : 'Clique para alternar o humor do Sheldon'}
            className={`bg-[#FB7213] hover:shadow-orange-glow transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] group shrink-0 overflow-hidden text-left cursor-pointer flex items-center ${
              isCollapsed
                ? 'size-[46px] rounded-[13px] justify-center p-0'
                : 'h-[58px] xl:h-[62px] w-full rounded-[15px] gap-1.5 pr-2.5'
            }`}
          >
            <div className="shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <img
                src={sheldonCatSvg}
                width={isCollapsed ? 46 : 58}
                height={isCollapsed ? 46 : 58}
                alt="Sheldon"
                className="block shrink-0"
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 leading-tight text-white">
                <span className="text-[9.5px] font-normal text-white/95 whitespace-nowrap">
                  Sheldon está se sentindo:
                </span>
                <span className="text-[15px] xl:text-[16.5px] font-bold tracking-tight text-white truncate">
                  {currentMoodTitle}
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Vertical Navigation */}
        <nav className="flex flex-col gap-1 w-full" aria-label="Navegação Principal">
          {NAV_ITEMS.map((item) => {
            const active = item.match(activeTab);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-[12px] transition-all duration-200 relative text-left ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'
                } ${
                  active
                    ? 'bg-[#F5F6FA] dark:bg-[#2B2D33] text-[#242424] dark:text-white font-semibold'
                    : 'text-[#6D6D6D] dark:text-[#9CA3AF] hover:text-[#242424] dark:hover:text-white hover:bg-[#F5F6FA]/70 dark:hover:bg-[#2B2D33]/60 font-medium'
                }`}
              >
                <img
                  src={item.icon}
                  width={19}
                  height={19}
                  alt=""
                  className={`shrink-0 transition-transform duration-200 dark:invert ${
                    active ? 'scale-105 opacity-100' : 'opacity-70 dark:opacity-65'
                  }`}
                />
                {!isCollapsed && (
                  <span className="text-[12.5px] xl:text-[13.5px] truncate">{item.label}</span>
                )}
                {item.id === 'metricas' && warningsCount > 0 && (
                  <span
                    className={`size-1.5 rounded-full bg-[#E05555] shrink-0 ${
                      isCollapsed ? 'absolute top-2 right-2' : 'ml-auto'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Modo Sentinela Switch + Optional Work Hours / Vacation Rule Top Section */}
      {isCollapsed ? (
        <button
          type="button"
          onClick={onToggleSentinel}
          title={
            isLockedByWorkHours
              ? `Sentinela travado pelo horário (${scheduleStatus?.workHoursStart}–${scheduleStatus?.workHoursEnd})`
              : isSentinelActive
                ? 'Modo Sentinela ATIVADO (clique para desligar)'
                : 'Modo Sentinela DESATIVADO (clique para ativar)'
          }
          className={`w-full h-[46px] rounded-[13px] flex flex-col items-center justify-center transition-all ${
            showVacationBanner && scheduleStatus?.inVacation
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : isSentinelActive
                ? 'bg-[#FECCAA] dark:bg-[#FB7213]/25 text-[#55321E] dark:text-[#FB7213]'
                : 'bg-[#F5F6FA] dark:bg-[#2A2C32] text-[#6D6D6D] dark:text-white/55'
          }`}
        >
          <span
            className={`size-3 rounded-full transition-colors ${
              isSentinelActive ? 'bg-[#FB7213]' : 'bg-[#9CA3AF]'
            }`}
          />
          <span className="text-[8px] font-bold uppercase mt-1">
            {showVacationBanner && scheduleStatus?.inVacation
              ? 'Férias'
              : isSentinelActive
                ? 'ON'
                : 'OFF'}
          </span>
        </button>
      ) : (
        <div className="bg-[#F5F6FA] dark:bg-[#26282E] border border-transparent dark:border-white/[0.06] rounded-[16px] overflow-hidden shrink-0 flex flex-col">
          {/* Top Rule Section (Work Hours OR Vacation Mode) */}
          {(showVacationBanner || showWorkHoursBanner) && (
            <div
              className={`px-2.5 py-2 border-b text-left flex flex-col gap-0.5 ${
                showVacationBanner && scheduleStatus?.inVacation
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-[#FFF3E9] dark:bg-[#FB7213]/12 border-[#FDE2CC] dark:border-[#FB7213]/25 text-[#9A4205] dark:text-[#FCA76B]'
              }`}
            >
              {showVacationBanner && scheduleStatus?.inVacation ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                      <Palmtree className="size-3 shrink-0" />
                      Modo Férias ativo
                    </span>
                    {(scheduleStatus.vacationStartDate || scheduleStatus.vacationEndDate) && (
                      <span className="text-[9.5px] font-semibold tabular-nums opacity-85">
                        {formatShortBrDate(scheduleStatus.vacationStartDate)}
                        {scheduleStatus.vacationEndDate
                          ? ` – ${formatShortBrDate(scheduleStatus.vacationEndDate)}`
                          : '+'}
                      </span>
                    )}
                  </div>
                  <p className="text-[9.5px] leading-tight opacity-85">
                    {showWorkHoursBanner
                      ? `Regra (${scheduleStatus.workHoursStart}–${scheduleStatus.workHoursEnd}) pausada.`
                      : 'Bloqueios liberados nas férias.'}
                  </p>
                </>
              ) : showWorkHoursBanner ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                      <Clock className="size-3 shrink-0" />
                      Regra ativada
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isLockedByWorkHours
                          ? 'bg-[#FB7213] text-white'
                          : 'bg-black/5 dark:bg-white/10 opacity-80'
                      }`}
                    >
                      {isLockedByWorkHours ? 'Em vigor' : 'Agendado'}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium leading-tight">
                    Horário: {scheduleStatus?.workHoursStart} às {scheduleStatus?.workHoursEnd}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
                    <Palmtree className="size-3 shrink-0" />
                    Férias programadas
                  </span>
                  <span className="text-[9.5px] tabular-nums opacity-80">
                    {formatShortBrDate(scheduleStatus?.vacationStartDate || '')}–
                    {formatShortBrDate(scheduleStatus?.vacationEndDate || '')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Switch Card Body */}
          <button
            type="button"
            onClick={onToggleSentinel}
            title={
              isLockedByWorkHours
                ? `Bloqueado pelo Horário de Trabalho (${scheduleStatus?.workHoursStart}–${scheduleStatus?.workHoursEnd}). Ative o Modo Férias em Configurações para pausar.`
                : isSentinelActive
                  ? 'Clique para desativar bloqueio de distrações'
                  : 'Clique para ativar bloqueio de distrações'
            }
            className={`p-2.5 w-full flex flex-col gap-2 transition-colors group ${
              isLockedByWorkHours
                ? 'cursor-not-allowed'
                : 'hover:bg-[#ECEEF5]/70 dark:hover:bg-[#2C2E35] cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between w-full leading-tight">
              <span className="text-[10.5px] font-medium text-[#6D6D6D] dark:text-[#9CA3AF]">
                Modo Sentinela
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[12px] font-bold tracking-tight transition-colors ${
                  isSentinelActive
                    ? 'text-[#FB7213]'
                    : 'text-[#6D6D6D] dark:text-[#9CA3AF]'
                }`}
              >
                {isLockedByWorkHours && <Lock className="size-2.5 shrink-0" />}
                {isSentinelActive ? 'Ativado' : 'Desativado'}
              </span>
            </div>

            {/* Horizontal Sliding Switch Track: Left = Desativado, Right = Ativado */}
            <div
              className={`relative h-[34px] w-full rounded-[11px] p-[3px] flex items-center transition-colors duration-300 ${
                isSentinelActive
                  ? 'bg-[#FECCAA] dark:bg-[#FB7213]/30'
                  : 'bg-[#E3E5EC] dark:bg-[#191A1E]'
              }`}
            >
              {/* Sliding Thumb */}
              <div
                className={`h-full w-1/2 rounded-[8.5px] shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center ${
                  isSentinelActive
                    ? 'translate-x-full bg-[#FB7213] text-white'
                    : 'translate-x-0 bg-white dark:bg-[#32353E] text-[#6D6D6D] dark:text-white/75'
                }`}
              >
                <span className="text-[9.5px] font-bold uppercase tracking-wider">
                  {isSentinelActive ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Background subtle labels */}
              <div className="pointer-events-none absolute inset-0 flex items-center text-[9px] font-semibold">
                <span
                  className={`flex-1 text-center transition-opacity duration-200 ${
                    isSentinelActive ? 'opacity-50 text-[#55321E] dark:text-white/55' : 'opacity-0'
                  }`}
                >
                  OFF
                </span>
                <span
                  className={`flex-1 text-center transition-opacity duration-200 ${
                    isSentinelActive ? 'opacity-0' : 'opacity-55 text-[#6D6D6D] dark:text-white/45'
                  }`}
                >
                  ON
                </span>
              </div>
            </div>
          </button>
        </div>
      )}
    </aside>
  );
};
