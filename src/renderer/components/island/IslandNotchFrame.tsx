import React from 'react';

interface IslandNotchFrameProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
}

/**
 * Concave corner ear ("notch fillet") connecting the Dynamic Island smoothly to y = 0
 * using pure black (#000000). Sized proportionally to the scaled-down (~80%) island.
 */
const IslandEar: React.FC<{ side: 'left' | 'right' }> = ({ side }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`shrink-0 pointer-events-none select-none ${
      side === 'left' ? '-mr-[0.5px]' : '-ml-[0.5px]'
    }`}
  >
    {side === 'left' ? (
      <path d="M20 0 H0.38 A19.62 19.62 0 0 1 20 19.62 Z" fill="#000000" />
    ) : (
      <path d="M0 0 H19.62 A19.62 19.62 0 0 0 0 19.62 Z" fill="#000000" />
    )}
  </svg>
);

export const IslandNotchFrame: React.FC<IslandNotchFrameProps> = ({
  children,
  className = '',
  style,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  ariaLabel = 'Sheldon Dynamic Island',
}) => {
  return (
    <div className="flex items-start justify-center select-none pointer-events-none pb-6 px-6">
      <IslandEar side="left" />
      <div
        data-island-interactive="true"
        role="region"
        aria-label={ariaLabel}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          boxShadow: '0 10px 26px -4px rgba(0, 0, 0, 0.55), 0 4px 10px -2px rgba(0, 0, 0, 0.35)',
          ...style,
        }}
        className={`pointer-events-auto bg-[#000000] text-white rounded-bl-[16px] rounded-br-[16px] overflow-hidden transition-[width,height,padding,border-radius,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
      >
        {children}
      </div>
      <IslandEar side="right" />
    </div>
  );
};
