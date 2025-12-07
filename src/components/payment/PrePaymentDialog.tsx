import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useLoanOperations } from '@/hooks/useLoanOperations'
import { useEMISchedule } from '@/hooks/useEMISchedule'

const prepaymentSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'),
  emiNumber: z.number().min(1, 'EMI number must be at least 1'),
  reduceTenure: z.boolean(),
})

type PrepaymentFormValues = z.infer<typeof prepaymentSchema>

interface PrePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string
  maxEMINumber: number
  onSuccess?: () => void
}

export function PrePaymentDialog({
  open,
  onOpenChange,
  loanId,
  maxEMINumber,
  onSuccess,
}: PrePaymentDialogProps) {
  const { applyPrepayment } = useLoanOperations()
  const { refreshSchedule } = useEMISchedule(loanId)
  const [loading, setLoading] = useState(false)

  const form = useForm<PrepaymentFormValues>({
    resolver: zodResolver(prepaymentSchema),
    defaultValues: {
      amount: 0,
      emiNumber: 1,
      reduceTenure: false,
    },
  })

  const handleSubmit = async (data: PrepaymentFormValues) => {
    try {
      setLoading(true)
      await applyPrepayment(loanId, data.amount, data.emiNumber, data.reduceTenure)
      await refreshSchedule()
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Prepayment failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to apply prepayment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pre-payment</DialogTitle>
          <DialogDescription>
            Make a pre-payment to reduce your loan principal. You can choose to reduce the EMI amount or the tenure.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pre-payment Amount (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="50000"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.amount?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emiNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EMI Number (for which prepayment is made)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={maxEMINumber}
                      placeholder="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.emiNumber?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reduceTenure"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="rounded"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    Reduce tenure (instead of reducing EMI amount)
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Apply Pre-payment'}
            </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


