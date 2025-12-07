import { useState } from 'react';

import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { Loan } from '@/types';

import { LoanCard } from './LoanCard';

interface LoanListProps {
  loans: Loan[];
  onView: (loanId: string) => void;
  onEdit: (loanId: string) => void;
  onDelete: (loanId: string) => void;
  onCreateNew: () => void;
}

export function LoanList({ loans, onView, onEdit, onDelete, onCreateNew }: LoanListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLoans = loans.filter(
    (loan) =>
      loan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className='space-y-8'>
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold tracking-tight'>My Loans</h1>
          <p className='text-muted-foreground text-base'>Manage and track all your loan accounts in one place</p>
        </div>
        <Button onClick={onCreateNew} className='h-11 w-full px-6 sm:w-auto'>
          <Plus className='mr-2 h-4 w-4' />
          New Loan
        </Button>
      </div>

      <div className='relative max-w-md'>
        <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform' />
        <Input
          placeholder='Search loans...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='h-11 pl-10 text-base'
        />
      </div>

      {filteredLoans.length === 0 ? (
        <div className='py-16 text-center'>
          <div className='bg-muted mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full'>
            <Search className='text-muted-foreground h-6 w-6' />
          </div>
          <p className='text-muted-foreground mb-4 text-lg'>
            {searchQuery
              ? 'No loans found matching your search.'
              : 'No loans yet. Create your first loan to get started.'}
          </p>
          {!searchQuery && (
            <Button onClick={onCreateNew}>
              <Plus className='mr-2 h-4 w-4' />
              Create Loan
            </Button>
          )}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {filteredLoans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} onView={onView} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
