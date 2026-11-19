import React from 'react';
import { Bell } from 'lucide-react';
import type { SheldonVisualState, TabId } from '@shared/types';
import sheldonCatSvg from '../../assets/figma/sheldon-cat.svg';
import checkmarkSquareSvg from '../../assets/figma/checkmark-square-03.svg';
import chartSvg from '../../assets/figma/chart.svg';
import pointerOffSvg from '../../assets/figma/pointer-off.svg';
import pawPrintSvg from '../../assets/figma/paw-print.svg';
import settingsSvg from '../../assets/figma/settings-03.svg';
import powerSvg from '../../assets/figma/power.svg';

interface TopNavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  sheldonState: SheldonVisualState;
  onToggleSheldonMood: () => void;
  isSentinelActive: boolean;
  onToggleSentinel: () => void;
  warningsCount?: number;
  onTestIslandNotification?: () => void;
}

const MOOD_TITLES: Record<SheldonVisualState, string> = {
  happy: 'Feliz da vida',
  cool: 'Foco blindado',
  neutral: 'De boa na lagoa',
  crying: 'Triste e carente',
  angry: 'Pistola total',
};

export const TopNavigation: React.FC<TopNavigationProps> = ({
  activeTab,
  onSelectTab,
  sheldonState,
  onToggleSheldonMood,
  isSentinelActive,
  onToggleSentinel,
  warningsCount = 0,
  onTestIslandNotification,
}) => {
  const currentMoodTitle = MOOD_TITLES[sheldonState] || 'Feliz da vida';

  const isTabActive = (tab: TabId) => {
    if (tab === 'hoje') return activeTab === 'hoje' || activeTab === 'daybreak';
    if (tab === 'metricas') return activeTab === 'metricas' || activeTab === 'black-mirror';
    if (tab === 'bloquear') return activeTab === 'bloquear';
    if (tab === 'sheldon') return activeTab === 'sheldon' || activeTab === 'sheldon-mood';
    if (tab === 'configuracoes') return activeTab === 'configuracoes' || activeTab === 'settings-leash';
    return activeTab === tab;
  };

  const handleMinimize = () => {
    window.sheldonAPI?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.sheldonAPI?.toggleMaximizeWindow();
  };

  const handleClose = () => {
    window.sheldonAPI?.closeToTray();
  };

  return (
    <header className="relative w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-2 flex flex-col gap-2 z-20">
      {/* Electron Window Drag Bar & Controls */}
      <div className="flex items-center justify-between h-7 w-full app-drag px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FB7213] animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wider text-[#6D6D6D]/80 uppercase">
            Sheldon Focus
          </span>
        </div>
        <div className="flex items-center gap-2.5 app-no-drag">
          {onTestIslandNotification && (
            <button
              type="button"
              onClick={onTestIslandNotification}
              title="Testar notificação de horário de tarefa na Dynamic Island do desktop"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200/90 hover:border-[#FB7213]/60 hover:bg-[#FCE5D9]/50 text-[#242424] text-[11px] font-semibold shadow-xs transition-all active:scale-95"
            >
              <Bell className="size-3.5 text-[#FB7213]" />
              <span>Testar Notificação da Ilha</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleMinimize}
              aria-label="Minimizar"
              className="w-3.5 h-3.5 rounded-full bg-[#E5E7EB] hover:bg-amber-400 transition-colors flex items-center justify-center text-[9px] text-transparent hover:text-black"
            >
              –
            </button>
            <button
              onClick={handleMaximize}
              aria-label="Maximizar"
              className="w-3.5 h-3.5 rounded-full bg-[#E5E7EB] hover:bg-emerald-400 transition-colors flex items-center justify-center text-[8px] text-transparent hover:text-black"
            >
              +
            </button>
            <button
              onClick={handleClose}
              aria-label="Fechar"
              className="w-3.5 h-3.5 rounded-full bg-[#E5E7EB] hover:bg-rose-500 transition-colors flex items-center justify-center text-[9px] text-transparent hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Main Top Navigation Row from Figma */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 w-full">
        {/* Left: Sheldon Mood Card */}
        <div
          onClick={onToggleSheldonMood}
          role="button"
          tabIndex={0}
          title="Clique para interagir com o humor do Sheldon!"
          className="bg-[#FB7213] h-[77px] w-[291px] shrink-0 rounded-[20px] flex items-center gap-[15px] pr-[19px] overflow-hidden cursor-pointer select-none shadow-sm hover:shadow-orange-glow transition-all duration-300 transform hover:-translate-y-0.5 active:scale-[0.98] group"
        >
          <div className="relative shrink-0 size-[77px] overflow-hidden transition-transform duration-300 group-hover:scale-105">
            <img
              src={sheldonCatSvg}
              alt="Sheldon Mascot"
              className="w-full h-full object-cover block"
            />
          </div>
          <div className="flex flex-col items-start text-white leading-normal">
            <p className="text-[12px] text-white/90 font-normal tracking-wide">
              Sheldon está se sentindo:
            </p>
            <p className="text-[22px] sm:text-[24px] font-bold tracking-tight text-white transition-all duration-200">
              {currentMoodTitle}
            </p>
          </div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav
          className="bg-white h-[77px] flex-1 max-w-[772px] rounded-[20px] shadow-sm flex items-center justify-center px-[8px] sm:px-[12px] py-[10px] gap-1 sm:gap-2 overflow-x-auto select-none"
          aria-label="Navegação Principal"
        >
          {/* Tab: Hoje */}
          <button
            onClick={() => onSelectTab('hoje')}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[16px] transition-all duration-200 shrink-0 ${
              isTabActive('hoje')
                ? 'bg-[#F5F6FA] text-[#242424] font-semibold shadow-xs'
                : 'text-[#6D6D6D] hover:text-[#242424] hover:bg-[#F5F6FA]/60 font-medium'
            }`}
          >
            <img
              src={checkmarkSquareSvg}
              alt=""
              className={`size-6 transition-transform duration-200 ${
                isTabActive('hoje') ? 'scale-105' : 'opacity-70 group-hover:opacity-100'
              }`}
            />
            <span className="text-[15px] sm:text-[16px]">Hoje</span>
          </button>

          {/* Tab: Métricas */}
          <button
            onClick={() => onSelectTab('metricas')}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[16px] transition-all duration-200 shrink-0 relative ${
              isTabActive('metricas')
                ? 'bg-[#F5F6FA] text-[#242424] font-semibold shadow-xs'
                : 'text-[#6D6D6D] hover:text-[#242424] hover:bg-[#F5F6FA]/60 font-medium'
            }`}
          >
            <img
              src={chartSvg}
              alt=""
              className={`size-6 transition-transform duration-200 ${
                isTabActive('metricas') ? 'scale-105' : 'opacity-70'
              }`}
            />
            <span className="text-[15px] sm:text-[16px]">Métricas</span>
            {warningsCount > 0 && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          {/* Tab: Bloquear */}
          <button
            onClick={() => onSelectTab('bloquear')}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[16px] transition-all duration-200 shrink-0 ${
              isTabActive('bloquear')
                ? 'bg-[#F5F6FA] text-[#242424] font-semibold shadow-xs'
                : 'text-[#6D6D6D] hover:text-[#242424] hover:bg-[#F5F6FA]/60 font-medium'
            }`}
          >
            <img
              src={pointerOffSvg}
              alt=""
              className={`size-6 transition-transform duration-200 ${
                isTabActive('bloquear') ? 'scale-105' : 'opacity-70'
              }`}
            />
            <span className="text-[15px] sm:text-[16px]">Bloquear</span>
          </button>

          {/* Tab: Sheldon */}
          <button
            onClick={() => onSelectTab('sheldon')}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[16px] transition-all duration-200 shrink-0 ${
              isTabActive('sheldon')
                ? 'bg-[#F5F6FA] text-[#242424] font-semibold shadow-xs'
                : 'text-[#6D6D6D] hover:text-[#242424] hover:bg-[#F5F6FA]/60 font-medium'
            }`}
          >
            <img
              src={pawPrintSvg}
              alt=""
              className={`size-6 transition-transform duration-200 ${
                isTabActive('sheldon') ? 'scale-105' : 'opacity-70'
              }`}
            />
            <span className="text-[15px] sm:text-[16px]">Sheldon</span>
          </button>

          {/* Tab: Configurações */}
          <button
            onClick={() => onSelectTab('configuracoes')}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-[16px] transition-all duration-200 shrink-0 ${
              isTabActive('configuracoes')
                ? 'bg-[#F5F6FA] text-[#242424] font-semibold shadow-xs'
                : 'text-[#6D6D6D] hover:text-[#242424] hover:bg-[#F5F6FA]/60 font-medium'
            }`}
          >
            <img
              src={settingsSvg}
              alt=""
              className={`size-6 transition-transform duration-200 ${
                isTabActive('configuracoes') ? 'scale-105' : 'opacity-70'
              }`}
            />
            <span className="text-[15px] sm:text-[16px]">Configurações</span>
          </button>
        </nav>

        {/* Right: Modo Sentinela Toggle Card */}
        <div
          onClick={onToggleSentinel}
          role="button"
          tabIndex={0}
          title={isSentinelActive ? 'Clique para desativar Modo Sentinela' : 'Clique para ativar Modo Sentinela'}
          className="bg-white h-[77px] w-[249px] shrink-0 rounded-[20px] shadow-sm flex items-center justify-between pl-[10px] pr-[17px] py-[10px] cursor-pointer select-none transition-all duration-300 hover:shadow-md active:scale-[0.98] group"
        >
          <div
            className={`h-[57px] w-[111px] rounded-[16px] flex items-center justify-center shrink-0 transition-all duration-300 ${
              isSentinelActive
                ? 'bg-[#FECCAA] shadow-xs group-hover:bg-[#fdbf94]'
                : 'bg-slate-100 group-hover:bg-slate-200'
            }`}
          >
            <img
              src={powerSvg}
              alt="Power Icon"
              className={`size-8 transition-transform duration-300 group-hover:scale-110 ${
                isSentinelActive ? 'opacity-100' : 'opacity-40 grayscale'
              }`}
            />
          </div>
          <div className="flex flex-col items-start leading-normal text-[#242424] w-[93px]">
            <p className="text-[12px] font-medium text-[#6D6D6D] whitespace-nowrap">
              Modo Sentinela
            </p>
            <p className="text-[22px] sm:text-[24px] font-bold whitespace-nowrap tracking-tight transition-colors">
              {isSentinelActive ? (
                <span className="text-[#242424]">Ativado</span>
              ) : (
                <span className="text-[#6D6D6D]">Desativado</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

