import React from 'react';
import { cn, cva, type VariantProps } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-[#FB7213]/30 bg-[#FB7213]/15 text-[#FB7213]',
        secondary:
          'border-border bg-secondary text-secondary-foreground',
        destructive:
          'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-300',
        outline:
          'border-border bg-background/60 text-muted-foreground',
        success:
          'border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        warning:
          'border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300',
        tear:
          'border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300',
        cream:
          'border-[#FBBF24]/50 bg-[#FDE6C4] text-[#3B2314] font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

