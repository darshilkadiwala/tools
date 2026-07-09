import type { JSX, ReactNode } from 'react';

import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';

interface LoanFormPageProps {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  error?: string | null;
  children: ReactNode;
}

export function LoanFormPage({
  title,
  description,
  backHref = '/',
  // backLabel = 'Back to loans',
  error,
  children,
}: LoanFormPageProps): JSX.Element {
  return (
    <div className='mx-auto space-y-6'>
      <div className='flex gap-2'>
        <Button variant='ghost' size='icon-sm' className='text-muted-foreground' asChild>
          <Link to={backHref}>
            <ArrowLeft className='size-4' />
            {/* {backLabel} */}
          </Link>
        </Button>

        <div className='space-y-1'>
          <h1 className='text-xl font-semibold md:text-2xl'>{title}</h1>
          <p className='text-muted-foreground text-sm md:text-base'>{description}</p>
        </div>
      </div>

      {error && <InlineError message={error} />}

      {children}
    </div>
  );
}
