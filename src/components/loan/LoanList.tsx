import { useState } from 'react'
import { LoanCard } from './LoanCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'
import type { Loan } from '@/types'

interface LoanListProps {
  loans: Loan[]
  onView: (loanId: string) => void
  onEdit: (loanId: string) => void
  onDelete: (loanId: string) => void
  onCreateNew: () => void
}

export function LoanList({ loans, onView, onEdit, onDelete, onCreateNew }: LoanListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLoans = loans.filter((loan) =>
    loan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Loans</h1>
          <p className="text-muted-foreground text-base">
            Manage and track all your loan accounts in one place
          </p>
        </div>
        <Button onClick={onCreateNew} className="w-full sm:w-auto h-11 px-6">
          <Plus className="h-4 w-4 mr-2" />
          New Loan
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search loans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 text-base"
        />
      </div>

      {filteredLoans.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4 text-lg">
            {searchQuery ? 'No loans found matching your search.' : 'No loans yet. Create your first loan to get started.'}
          </p>
          {!searchQuery && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Loan
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

