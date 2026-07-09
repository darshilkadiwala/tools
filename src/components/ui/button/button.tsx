import type { ComponentProps, JSX } from 'react';

import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

import { buttonVariants, type ButtonVariants } from './button-variants';

export interface ButtonProps extends ComponentProps<'button'>, ButtonVariants {
  asChild?: boolean;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: ButtonProps): JSX.Element {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
