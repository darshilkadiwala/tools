import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLoanContext } from '@/contexts/LoanContext'
import { LoanForm } from '@/components/loan/LoanForm'
import type { Loan } from '@/types'

export function EditLoanPage() {
  const { id } = useParams<{ id: string }>()
  const { loans } = useLoanContext()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  
  const loan = loans.loans.find((l) => l.id === id)

  useEffect(() => {
    if (!loans.loading && !loan) {
      navigate('/')
    }
  }, [loans.loading, loan, navigate])

  if (loans.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!loan) return null

  const handleUpdateLoan = async (
    data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>
  ) => {
    try {
      setError(null)
      await loans.updateLoan(loan.id, data)
      navigate('/')
    } catch (error) {
      console.error('Failed to update loan:', error)
      setError(error instanceof Error ? error.message : 'Failed to update loan')
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Edit Loan</h1>
        <p className="text-muted-foreground text-base">
          Update the loan details below
        </p>
      </div>

      <LoanForm
        loan={loan}
        onSubmit={handleUpdateLoan}
        onCancel={() => navigate('/')}
      />
    </div>
  )
}
