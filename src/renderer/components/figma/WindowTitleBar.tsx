import React, { useState } from 'react';

export const WindowTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    window.sheldonAPI?.minimizeWindow();
  };

  const handleMaximize = async () => {
    const maximized = await window.sheldonAPI?.toggleMaximizeWindow();
    if (typeof maximized === 'boolean') {
      setIsMaximized(maximized);
    } else {
      setIsMaximized((prev) => !prev);
    }
  };

  const handleClose = () => {
    window.sheldonAPI?.closeToTray();
  };

  return (
    <div
      className="h-[36px] w-full shrink-0 flex items-center justify-end pr-2 pt-1 mb-1 select-none app-drag z-40"
      aria-label="Barra de título da janela"
    >
      {/* Borderless Window Caption Control Buttons with standard sizing & comfortable spacing */}
      <div className="flex items-center gap-1 h-[32px] app-no-drag shrink-0">
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimizar janela"
          title="Minimizar"
          className="w-[40px] h-[30px] rounded-[8px] flex items-center justify-center text-[#4B5563] dark:text-white/75 hover:bg-black/[0.06] dark:hover:bg-white/[0.09] active:bg-black/[0.1] transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1.5 5.5H9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => void handleMaximize()}
          aria-label={isMaximized ? 'Restaurar janela' : 'Maximizar janela'}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          className="w-[40px] h-[30px] rounded-[8px] flex items-center justify-center text-[#4B5563] dark:text-white/75 hover:bg-black/[0.06] dark:hover:bg-white/[0.09] active:bg-black/[0.1] transition-colors"
        >
          {isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <rect x="1.8" y="3.3" width="5.8" height="5.8" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M3.8 3.3V2.1C3.8 1.75 4.08 1.5 4.4 1.5H8.8C9.15 1.5 9.4 1.78 9.4 2.1V6.5C9.4 6.85 9.15 7.1 8.8 7.1H7.6"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <rect x="1.8" y="1.8" width="7.4" height="7.4" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Minimizar para bandeja"
          title="Fechar para bandeja"
          className="w-[40px] h-[30px] rounded-[8px] flex items-center justify-center text-[#4B5563] dark:text-white/75 hover:bg-[#C42B1C] hover:text-white active:bg-[#A62316] transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path
              d="M2 2L9 9M9 2L2 9"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
