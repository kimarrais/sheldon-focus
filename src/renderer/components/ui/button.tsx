import React from 'react';
import { cn, cva, Slot, type VariantProps } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-[#FF8429] to-[#F97316] text-[#1A0D04] font-bold border border-[#FDBA74]/50 shadow-orange-glow-sm hover:from-[#F97316] hover:to-[#EA580C]',
        destructive:
          'bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 hover:border-red-400',
        outline:
          'border border-border bg-card/80 text-foreground hover:bg-secondary hover:border-[#F97316]/60 hover:text-[#FDE6C4]',
        secondary:
          'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 hover:border-[#F97316]/40',
        ghost:
          'text-muted-foreground hover:bg-secondary hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        cream:
          'bg-[#FDE6C4] text-[#3B2314] font-bold border border-[#FBBF24] hover:bg-[#FCD34D] shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-2xl px-6 text-sm',
        icon: 'h-9 w-9 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as React.Ref<never>}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

