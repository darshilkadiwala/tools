import type { Loan, EMIScheduleEntry, LoanModification, EMIStatus } from '@/types'
import { addMonths, isBefore, isAfter, startOfDay, endOfMonth, getDate, setDate, differenceInDays, startOfMonth } from 'date-fns'
import { dateToISO, isoToDate } from '@/lib/utils'

/**
 * Calculate standard EMI using the formula:
 * EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
 * where P = principal, r = monthly interest rate, n = number of months
 */
export function calculateEMI(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number
): number {
  if (tenureMonths === 0) return 0
  
  const monthlyRate = annualInterestRate / 100 / 12
  if (monthlyRate === 0) {
    return principal / tenureMonths
  }
  
  const emi =
    (principal *
      monthlyRate *
      Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  
  return Math.round(emi * 100) / 100
}

/**
 * Determine EMI status based on due date
 */
export function getEMIStatus(dueDate: string | Date, existingStatus?: EMIStatus): EMIStatus {
  // If already marked as paid or modified, keep that status
  if (existingStatus === 'paid' || existingStatus === 'modified') {
    return existingStatus
  }

  const today = startOfDay(new Date())
  const due = startOfDay(typeof dueDate === 'string' ? isoToDate(dueDate) : dueDate)

  if (isBefore(due, today)) {
    // Past due date - mark as paid (assuming it was paid)
    return 'paid'
  } else if (isAfter(due, today)) {
    // Future due date - mark as upcoming
    return 'upcoming'
  } else {
    // Today - mark as pending
    return 'pending'
  }
}

/**
 * Generate complete EMI schedule for a loan
 */
export function generateEMISchedule(
  loan: Loan,
  modifications: LoanModification[] = []
): EMIScheduleEntry[] {
  const schedule: EMIScheduleEntry[] = []
  let outstandingPrincipal = loan.principal
  const monthlyRate = loan.interestRate / 100 / 12
  const emiAmount = loan.emiAmount

  // Get modifications sorted by date
  const sortedModifications = [...modifications].sort(
    (a, b) => isoToDate(a.date).getTime() - isoToDate(b.date).getTime()
  )

  // Use emiStartDate if available, otherwise fall back to startDate for backward compatibility
  const emiStart = isoToDate(loan.emiStartDate || loan.startDate)
  const loanStartDate = isoToDate(loan.startDate)

  // Check if we need an adjustment payment (loan start date and EMI start date are in different months/dates)
  const loanStartMonth = startOfMonth(loanStartDate)
  const emiStartMonth = startOfMonth(emiStart)
  const needsAdjustment = loanStartMonth.getTime() !== emiStartMonth.getTime() || getDate(loanStartDate) !== getDate(emiStart)

  let emiCounter = 1

  // Generate adjustment payment if needed
  if (needsAdjustment && loan.emiStartDate) {
    const adjustmentDueDate = loanStartDate // Due on loan start date
    const monthEnd = endOfMonth(loanStartDate)
    const daysInMonth = differenceInDays(monthEnd, startOfMonth(loanStartDate)) + 1
    const daysFromStart = differenceInDays(monthEnd, loanStartDate) + 1
    const partialDaysRatio = daysFromStart / daysInMonth

    // Calculate interest for partial period
    const partialInterest = Math.round(outstandingPrincipal * monthlyRate * partialDaysRatio * 100) / 100
    
    // For adjustment, we typically pay only interest or a minimal principal
    // Calculate a proportional amount based on the partial period
    const adjustmentAmount = Math.round((emiAmount * partialDaysRatio) * 100) / 100
    const adjustmentPrincipal = Math.max(0, Math.round((adjustmentAmount - partialInterest) * 100) / 100)
    const actualAdjustmentPrincipal = Math.min(adjustmentPrincipal, outstandingPrincipal)
    const adjustmentTotal = actualAdjustmentPrincipal + partialInterest

    outstandingPrincipal = Math.round((outstandingPrincipal - actualAdjustmentPrincipal) * 100) / 100

    const adjustmentStatus = getEMIStatus(adjustmentDueDate)

    schedule.push({
      id: `${loan.id}-emi-adjustment`,
      loanId: loan.id,
      emiNumber: 0, // Special number for adjustment
      dueDate: dateToISO(adjustmentDueDate),
      principal: actualAdjustmentPrincipal,
      interest: partialInterest,
      total: adjustmentTotal,
      outstandingPrincipal: Math.max(0, outstandingPrincipal),
      status: adjustmentStatus,
      isAdjustment: true,
    })

    emiCounter = 1 // Regular EMIs start from 1
  }

  // Generate regular EMIs starting from the EMI start date
  const regularEMIStartMonth = needsAdjustment && loan.emiStartDate 
    ? startOfMonth(addMonths(loanStartMonth, 1)) // Start from next month after loan start
    : emiStartMonth

  // Get the day of month for EMI date
  const emiDay = loan.emiStartDate ? getDate(isoToDate(loan.emiStartDate)) : getDate(emiStart)
  
  // Calculate how many regular EMIs we need
  const totalRegularEMIs = needsAdjustment ? loan.tenureMonths : loan.tenureMonths

  for (let i = 0; i < totalRegularEMIs; i++) {
    // Calculate the due date: start from the EMI start month, add i months, set to EMI day
    const monthForEMI = addMonths(regularEMIStartMonth, i)
    let dueDate = setDate(monthForEMI, emiDay)
    
    // If the day doesn't exist in that month (e.g., Feb 31), use last day of month
    if (getDate(dueDate) !== emiDay) {
      dueDate = endOfMonth(monthForEMI)
    }
    
    // Check if there's a modification affecting this EMI
    const modification = sortedModifications.find(
      (m) => m.affectedEMIs.includes(emiCounter) || (m.date <= dueDate && m.type === 'interest_change')
    )

    // Use modified interest rate if available
    const effectiveRate = modification?.newInterestRate 
      ? modification.newInterestRate / 100 / 12 
      : monthlyRate

    // Calculate interest for this month
    const interest = Math.round(outstandingPrincipal * effectiveRate * 100) / 100
    
    // Calculate principal component
    const principalComponent = Math.round((emiAmount - interest) * 100) / 100
    
    // Ensure principal doesn't exceed outstanding
    const actualPrincipal = Math.min(principalComponent, outstandingPrincipal)
    const actualTotal = actualPrincipal + interest

    outstandingPrincipal = Math.round((outstandingPrincipal - actualPrincipal) * 100) / 100

    // Determine status based on due date
    const status = getEMIStatus(dueDate)

    schedule.push({
      id: `${loan.id}-emi-${emiCounter}`,
      loanId: loan.id,
      emiNumber: emiCounter,
      dueDate: dateToISO(dueDate),
      principal: actualPrincipal,
      interest,
      total: actualTotal,
      outstandingPrincipal: Math.max(0, outstandingPrincipal),
      status,
      modifiedInterestRate: modification?.newInterestRate,
      isAdjustment: false,
    })

    emiCounter++
  }

  return schedule
}

/**
 * Recalculate EMI schedule after prepayment
 */
export function recalculateAfterPrepayment(
  loan: Loan,
  prepaymentAmount: number,
  prepaymentEMINumber: number,
  existingSchedule: EMIScheduleEntry[],
  reduceTenure: boolean = false
): {
  updatedLoan: Loan
  updatedSchedule: EMIScheduleEntry[]
} {
  // Find the EMI where prepayment is made
  const prepaymentEMI = existingSchedule.find(
    (emi) => emi.emiNumber === prepaymentEMINumber
  )

  if (!prepaymentEMI) {
    throw new Error(`EMI number ${prepaymentEMINumber} not found`)
  }

  // Reduce outstanding principal
  let newOutstandingPrincipal = prepaymentEMI.outstandingPrincipal - prepaymentAmount

  if (newOutstandingPrincipal < 0) {
    newOutstandingPrincipal = 0
  }

  // Get remaining EMIs
  const remainingEMIs = existingSchedule.filter(
    (emi) => emi.emiNumber > prepaymentEMINumber && emi.status === 'pending'
  )

  if (remainingEMIs.length === 0) {
    // No remaining EMIs, just update the prepayment EMI
    const updatedSchedule = existingSchedule.map((emi) => {
      if (emi.emiNumber === prepaymentEMINumber) {
        return {
          ...emi,
          outstandingPrincipal: newOutstandingPrincipal,
        }
      }
      return emi
    })

    return {
      updatedLoan: loan,
      updatedSchedule,
    }
  }

  // Recalculate remaining EMIs
  const monthlyRate = loan.interestRate / 100 / 12
  let updatedLoan = { ...loan }

  if (reduceTenure) {
    // Reduce tenure - keep same EMI amount
    const newTenure = Math.ceil(
      -Math.log(1 - (newOutstandingPrincipal * monthlyRate) / loan.emiAmount) /
        Math.log(1 + monthlyRate)
    )
    updatedLoan = {
      ...loan,
      tenureMonths: prepaymentEMINumber + newTenure,
    }
  } else {
    // Reduce EMI amount - keep same tenure
    const remainingMonths = remainingEMIs.length
    if (remainingMonths > 0 && monthlyRate > 0) {
      const newEMI =
        (newOutstandingPrincipal *
          monthlyRate *
          Math.pow(1 + monthlyRate, remainingMonths)) /
        (Math.pow(1 + monthlyRate, remainingMonths) - 1)
      updatedLoan = {
        ...loan,
        emiAmount: Math.round(newEMI * 100) / 100,
      }
    }
  }

  // Regenerate schedule for remaining EMIs
  const updatedSchedule = [...existingSchedule]
  let currentOutstanding = newOutstandingPrincipal

  for (const emi of remainingEMIs) {
    const interest = Math.round(currentOutstanding * monthlyRate * 100) / 100
    const principal = Math.round((updatedLoan.emiAmount - interest) * 100) / 100
    const actualPrincipal = Math.min(principal, currentOutstanding)
    const actualTotal = actualPrincipal + interest

    currentOutstanding = Math.round((currentOutstanding - actualPrincipal) * 100) / 100

    const index = updatedSchedule.findIndex((e) => e.id === emi.id)
    if (index !== -1) {
      updatedSchedule[index] = {
        ...emi,
        principal: actualPrincipal,
        interest,
        total: actualTotal,
        outstandingPrincipal: Math.max(0, currentOutstanding),
      }
    }
  }

  return {
    updatedLoan,
    updatedSchedule,
  }
}

/**
 * Apply step-up to EMI schedule
 */
export function applyStepUp(
  loan: Loan,
  stepUpAmount: number | null,
  stepUpPercentage: number | null,
  fromEMINumber: number,
  existingSchedule: EMIScheduleEntry[]
): {
  updatedLoan: Loan
  updatedSchedule: EMIScheduleEntry[]
} {
  const currentEMI = loan.emiAmount
  let newEMIAmount: number

  if (stepUpAmount !== null) {
    newEMIAmount = currentEMI + stepUpAmount
  } else if (stepUpPercentage !== null) {
    newEMIAmount = currentEMI * (1 + stepUpPercentage / 100)
  } else {
    throw new Error('Either stepUpAmount or stepUpPercentage must be provided')
  }

  newEMIAmount = Math.round(newEMIAmount * 100) / 100

  // Update loan
  const updatedLoan = {
    ...loan,
    emiAmount: newEMIAmount,
  }

  // Update affected EMIs
  const updatedSchedule = existingSchedule.map((emi) => {
    if (emi.emiNumber >= fromEMINumber && emi.status === 'pending') {
      const monthlyRate = loan.interestRate / 100 / 12
      const interest = Math.round(emi.outstandingPrincipal * monthlyRate * 100) / 100
      const principal = Math.round((newEMIAmount - interest) * 100) / 100
      const actualPrincipal = Math.min(principal, emi.outstandingPrincipal)
      const actualTotal = actualPrincipal + interest

      const newOutstanding = Math.round(
        (emi.outstandingPrincipal - actualPrincipal) * 100
      ) / 100

      return {
        ...emi,
        principal: actualPrincipal,
        interest,
        total: actualTotal,
        outstandingPrincipal: Math.max(0, newOutstanding),
      }
    }
    return emi
  })

  // Recalculate outstanding principal for subsequent EMIs
  let currentOutstanding = updatedSchedule.find(
    (e) => e.emiNumber === fromEMINumber
  )?.outstandingPrincipal || 0

  for (let i = fromEMINumber + 1; i <= loan.tenureMonths; i++) {
    const emi = updatedSchedule.find((e) => e.emiNumber === i)
    if (emi && emi.status === 'pending') {
      const monthlyRate = loan.interestRate / 100 / 12
      const interest = Math.round(currentOutstanding * monthlyRate * 100) / 100
      const principal = Math.round((newEMIAmount - interest) * 100) / 100
      const actualPrincipal = Math.min(principal, currentOutstanding)
      const actualTotal = actualPrincipal + interest

      currentOutstanding = Math.round((currentOutstanding - actualPrincipal) * 100) / 100

      const index = updatedSchedule.findIndex((e) => e.id === emi.id)
      if (index !== -1) {
        updatedSchedule[index] = {
          ...emi,
          principal: actualPrincipal,
          interest,
          total: actualTotal,
          outstandingPrincipal: Math.max(0, currentOutstanding),
        }
      }
    }
  }

  return {
    updatedLoan,
    updatedSchedule,
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

