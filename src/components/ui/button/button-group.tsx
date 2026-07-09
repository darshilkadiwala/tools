import type { ComponentProps, JSX } from 'react';

import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

import { Separator } from '../separator';
import { buttonGroupVariants, type ButtonGroupVariants } from './button-group-variants';

interface ButtonGroupProps extends ComponentProps<'div'>, ButtonGroupVariants {}

export function ButtonGroup({ className, orientation, ...props }: ButtonGroupProps): JSX.Element {
  return (
    <div
      role='group'
      data-slot='button-group'
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

interface ButtonGroupTextProps extends ComponentProps<'div'> {
  asChild?: boolean;
}

export function ButtonGroupText({ className, asChild = false, ...props }: ButtonGroupTextProps): JSX.Element {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        `bg-muted flex items-center gap-2 rounded-lg border px-2.5 text-sm font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4`,
        className,
      )}
      {...props}
    />
  );
}

interface ButtonGroupSeparatorProps extends ComponentProps<typeof Separator> {}

export function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: ButtonGroupSeparatorProps): JSX.Element {
  return (
    <Separator
      data-slot='button-group-separator'
      orientation={orientation}
      className={cn(
        `bg-input relative self-stretch data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto`,
        className,
      )}
      {...props}
    />
  );
}
