import type { JSX, ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  step: number;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormSection({
  step,
  icon: Icon,
  title,
  description,
  children,
  className,
}: FormSectionProps): JSX.Element {
  return (
    <Card className={cn(className)}>
      <CardHeader className='flex items-start gap-3 border-b'>
        <div className='bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg font-semibold'>
          {step}
        </div>
        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex items-center gap-2'>
            <Icon className='text-muted-foreground size-4 shrink-0' aria-hidden />
            <CardTitle className='font-semibold'>{title}</CardTitle>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
