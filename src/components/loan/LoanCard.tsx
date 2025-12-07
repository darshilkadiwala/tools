import { format } from 'date-fns';
import { Car, FileText, GraduationCap, Home, Trash2Icon, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/calculations';
import { isoToDate } from '@/lib/utils';

import type { Loan } from '@/types';

const loanTypeIcons = {
  home: Home,
  car: Car,
  education: GraduationCap,
  personal: Wallet,
  other: FileText,
};

const loanTypeLabels = {
  home: 'Home Loan',
  car: 'Car Loan',
  education: 'Education Loan',
  personal: 'Personal Loan',
  other: 'Other',
};

interface LoanCardProps {
  loan: Loan;
  onView: (loanId: string) => void;
  onEdit: (loanId: string) => void;
  onDelete: (loanId: string) => void;
}

export function LoanCard({ loan, onView, onEdit, onDelete }: LoanCardProps) {
  const Icon = loanTypeIcons[loan.type];

  return (
    <Card>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-2'>
            <Icon className='text-muted-foreground h-5 w-5' />
            <CardTitle className='text-lg'>{loan.name}</CardTitle>
          </div>
        </div>
        <CardDescription>{loanTypeLabels[loan.type]}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='mb-4 space-y-2'>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Principal:</span>
            <span className='font-medium'>{formatCurrency(loan.principal)}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Interest Rate:</span>
            <span className='font-medium'>{loan.interestRate}% p.a.</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>EMI Amount:</span>
            <span className='font-medium'>{formatCurrency(loan.emiAmount)}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Tenure:</span>
            <span className='font-medium'>{loan.tenureMonths} months</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Start Date:</span>
            <span className='font-medium'>{format(isoToDate(loan.startDate), 'MMM dd, yyyy')}</span>
          </div>
        </div>
        {/* for md container show the view button in full width and edit/delete below that with auto flex so they ocupy the width automatically */}
        <div className='flex flex-wrap gap-2 @md:flex-col'>
          <Button variant='default' size='sm' onClick={() => onView(loan.id)} className='flex-1 @md:w-full'>
            View Schedule
          </Button>
          <Button variant='outline' size='sm' onClick={() => onEdit(loan.id)} className='flex-1 @md:w-full'>
            Edit
          </Button>
          <Button variant='ghost' size='icon' onClick={() => onDelete(loan.id)}>
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
