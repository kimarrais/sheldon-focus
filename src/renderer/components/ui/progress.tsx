import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(
          'relative h-3 w-full overflow-hidden rounded-full bg-background border border-border p-0.5',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#FBBF24] transition-all duration-500',
            indicatorClassName
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };

