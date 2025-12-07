import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/calculations'
import { format } from 'date-fns'
import type { EMIScheduleEntry } from '@/types'
import { isoToDate } from '@/lib/utils'
import { CheckCircle2, AlertCircle, Edit, Clock } from 'lucide-react'

interface EMITableProps {
  schedule: EMIScheduleEntry[]
  onSelectEMI?: (emiNumbers: number[]) => void
  selectedEMIs?: number[]
  showActions?: boolean
}

export function EMITable({ schedule, onSelectEMI, selectedEMIs = [], showActions = false }: EMITableProps) {
  const handleRowClick = (emiNumber: number) => {
    if (!onSelectEMI) return
    
    if (selectedEMIs.includes(emiNumber)) {
      onSelectEMI(selectedEMIs.filter((n) => n !== emiNumber))
    } else {
      onSelectEMI([...selectedEMIs, emiNumber])
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectEMI) return
    
    if (checked) {
      // Select all EMI numbers (excluding adjustments)
      const allEMINumbers = schedule
        .filter((emi) => !emi.isAdjustment)
        .map((emi) => emi.emiNumber)
      onSelectEMI(allEMINumbers)
    } else {
      // Deselect all
      onSelectEMI([])
    }
  }

  const selectableEMIs = schedule.filter((emi) => !emi.isAdjustment)
  const allSelected = selectableEMIs.length > 0 && 
    selectableEMIs.every((emi) => selectedEMIs.includes(emi.emiNumber))
  
  const someSelected = selectableEMIs.length > 0 &&
    selectableEMIs.some((emi) => selectedEMIs.includes(emi.emiNumber)) &&
    !allSelected

  const getStatusIcon = (status: EMIScheduleEntry['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'modified':
        return <Edit className="h-4 w-4 text-blue-500" />
      case 'upcoming':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showActions && (
              <TableHead className="w-12">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={handleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select all rows"
                />
              </TableHead>
            )}
            <TableHead>EMI #</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            {schedule.some((emi) => emi.modifiedInterestRate) && (
              <TableHead className="text-right">Modified Rate</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 9 : 8} className="text-center py-8 text-muted-foreground">
                No EMI schedule available
              </TableCell>
            </TableRow>
          ) : (
            schedule.map((emi) => (
              <TableRow
                key={emi.id}
                onClick={() => !emi.isAdjustment && handleRowClick(emi.emiNumber)}
                className={`cursor-pointer ${selectedEMIs.includes(emi.emiNumber) ? 'bg-muted' : ''} ${emi.isAdjustment ? 'opacity-75' : ''}`}
              >
                {showActions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {emi.isAdjustment ? (
                      <div className="w-4" />
                    ) : (
                      <Checkbox
                        checked={selectedEMIs.includes(emi.emiNumber)}
                        onCheckedChange={() => handleRowClick(emi.emiNumber)}
                        aria-label={`Select EMI ${emi.emiNumber}`}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {emi.isAdjustment ? 'Adjustment' : emi.emiNumber}
                </TableCell>
                <TableCell>{format(isoToDate(emi.dueDate), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="text-right">{formatCurrency(emi.principal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(emi.interest)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(emi.total)}</TableCell>
                <TableCell className="text-right">{formatCurrency(emi.outstandingPrincipal)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(emi.status)}
                    <span className="capitalize">{emi.status}</span>
                  </div>
                </TableCell>
                {schedule.some((e) => e.modifiedInterestRate) && (
                  <TableCell className="text-right">
                    {emi.modifiedInterestRate ? `${emi.modifiedInterestRate.toFixed(2)}%` : '-'}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

