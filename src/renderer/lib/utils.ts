import React from 'react';

type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | ClassValue[]
  | Record<string, boolean | undefined | null>;

function toVal(mix: ClassValue): string {
  if (typeof mix === 'string' || typeof mix === 'number') {
    return String(mix);
  }
  let str = '';
  if (Array.isArray(mix)) {
    for (let k = 0; k < mix.length; k++) {
      if (mix[k]) {
        const y = toVal(mix[k]);
        if (y) {
          if (str) str += ' ';
          str += y;
        }
      }
    }
  } else if (mix && typeof mix === 'object') {
    for (const k in mix) {
      if (mix[k]) {
        if (str) str += ' ';
        str += k;
      }
    }
  }
  return str;
}

export function cn(...inputs: ClassValue[]): string {
  let str = '';
  for (let i = 0; i < inputs.length; i++) {
    const tmp = inputs[i];
    if (tmp) {
      const x = toVal(tmp);
      if (x) {
        if (str) str += ' ';
        str += x;
      }
    }
  }
  return str;
}

export type VariantConfig<V extends Record<string, Record<string, string>>> = {
  variants: V;
  defaultVariants?: {
    [K in keyof V]?: keyof V[K];
  };
};

export type VariantProps<T extends (...args: never[]) => string> =
  Parameters<T>[0] extends undefined
    ? Record<string, never>
    : Omit<NonNullable<Parameters<T>[0]>, 'className'>;

export function cva<V extends Record<string, Record<string, string>>>(
  base: string,
  config?: VariantConfig<V>
) {
  return (
    props?: {
      [K in keyof V]?: keyof V[K] | null | undefined;
    } & { className?: string }
  ): string => {
    if (!config || !config.variants) {
      return cn(base, props?.className);
    }
    const { variants, defaultVariants } = config;
    const classes: string[] = [base];

    for (const variantKey of Object.keys(variants) as Array<keyof V>) {
      const propValue = props?.[variantKey] ?? defaultVariants?.[variantKey];
      if (propValue !== undefined && propValue !== null) {
        const variantClass = variants[variantKey]?.[propValue as string];
        if (variantClass) {
          classes.push(variantClass);
        }
      }
    }

    if (props?.className) {
      classes.push(props.className);
    }

    return classes.filter(Boolean).join(' ');
  };
}

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...props }, forwardedRef) => {
    if (React.isValidElement(children)) {
      const childProps = (children as React.ReactElement<Record<string, unknown>>).props;
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        ...props,
        ...childProps,
        ref: forwardedRef,
        className: cn(props.className, childProps.className as string | undefined),
      });
    }
    return null;
  }
);
Slot.displayName = 'Slot';

