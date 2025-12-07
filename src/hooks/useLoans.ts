import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db'
import type { Loan } from '@/types'
import { calculateEMI } from '@/lib/calculations'
import { dateToISO, generateUUID } from '@/lib/utils'

export function useLoans() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true)
      const allLoans = await db.loans.toArray()
      setLoans(allLoans)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load loans'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLoans()
  }, [loadLoans])

  const createLoan = useCallback(async (loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'emiAmount'>) => {
    try {
      const emiAmount = calculateEMI(
        loanData.principal,
        loanData.interestRate,
        loanData.tenureMonths
      )

      const newLoan: Loan = {
        ...loanData,
        id: generateUUID(),
        emiAmount,
        createdAt: dateToISO(new Date()),
        updatedAt: dateToISO(new Date()),
      }

      await db.loans.add(newLoan)
      await loadLoans()
      return newLoan
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create loan')
    }
  }, [loadLoans])

  const updateLoan = useCallback(async (id: string, updates: Partial<Loan>) => {
    try {
      const existingLoan = await db.loans.get(id)
      if (!existingLoan) {
        throw new Error('Loan not found')
      }

      const updatedLoan = {
        ...existingLoan,
        ...updates,
        updatedAt: dateToISO(new Date()),
      }

      // Recalculate EMI if principal, rate, or tenure changed
      if (
        updates.principal !== undefined ||
        updates.interestRate !== undefined ||
        updates.tenureMonths !== undefined
      ) {
        updatedLoan.emiAmount = calculateEMI(
          updatedLoan.principal,
          updatedLoan.interestRate,
          updatedLoan.tenureMonths
        )
      }

      await db.loans.update(id, updatedLoan)
      await loadLoans()
      return updatedLoan
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update loan')
    }
  }, [loadLoans])

  const deleteLoan = useCallback(async (id: string) => {
    try {
      // Delete associated EMI schedules and modifications
      await db.emiSchedules.where('loanId').equals(id).delete()
      await db.modifications.where('loanId').equals(id).delete()
      await db.loans.delete(id)
      await loadLoans()
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete loan')
    }
  }, [loadLoans])

  const getLoan = useCallback(async (id: string) => {
    try {
      return await db.loans.get(id)
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to get loan')
    }
  }, [])

  return {
    loans,
    loading,
    error,
    createLoan,
    updateLoan,
    deleteLoan,
    getLoan,
    refreshLoans: loadLoans,
  }
}

