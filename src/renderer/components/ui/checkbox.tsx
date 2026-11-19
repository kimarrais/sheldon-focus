import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClick?.(e);
      if (!e.defaultPrevented && !props.disabled) {
        onCheckedChange?.(!checked);
      }
    };

    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        onClick={handleClick}
        ref={ref}
        className={cn(
          'peer h-5 w-5 shrink-0 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center',
          checked
            ? 'bg-gradient-to-b from-[#FF8429] to-[#F97316] border-[#FDBA74] text-[#2A1506] shadow-orange-glow-sm'
            : 'bg-background border-border hover:border-[#F97316]',
          className
        )}
        {...props}
      >
        {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
      </button>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };

