import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const interestRateSchema = z.object({
  newInterestRate: z.number().min(0, 'Interest rate must be non-negative').max(100, 'Interest rate cannot exceed 100%'),
  applyTo: z.enum(['all', 'selected']),
  selectedEMIs: z.array(z.number()).optional(),
})

type InterestRateFormValues = z.infer<typeof interestRateSchema>

interface InterestRateModifierProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanId: string
  currentRate: number
  selectedEMIs?: number[]
  onSuccess?: () => void
}

export function InterestRateModifier({
  open,
  onOpenChange,
  loanId,
  currentRate,
  selectedEMIs = [],
  onSuccess,
}: InterestRateModifierProps) {
  const { changeInterestRate } = useLoanOperations()
  const { refreshSchedule } = useEMISchedule(loanId)
  const [loading, setLoading] = useState(false)

  const form = useForm<InterestRateFormValues>({
    resolver: zodResolver(interestRateSchema),
    defaultValues: {
      newInterestRate: currentRate,
      applyTo: selectedEMIs.length > 0 ? 'selected' : 'all',
      selectedEMIs: selectedEMIs.length > 0 ? selectedEMIs : undefined,
    },
  })

  const applyTo = form.watch('applyTo')

  const handleSubmit = async (data: InterestRateFormValues) => {
    try {
      setLoading(true)
      const affectedEMIs =
        data.applyTo === 'all'
          ? 'all'
          : data.selectedEMIs || []

      await changeInterestRate(loanId, data.newInterestRate, affectedEMIs)
      await refreshSchedule()
      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Interest rate change failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to change interest rate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Interest Rate</DialogTitle>
          <DialogDescription>
            Update the interest rate for future EMIs. You can apply it to all remaining EMIs or only selected ones.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              Current Interest Rate: {currentRate}% p.a.
            </div>

            <FormField
              control={form.control}
              name="newInterestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Interest Rate (% p.a.)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="8.5"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage>{form.formState.errors.newInterestRate?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applyTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply To</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Remaining EMIs</SelectItem>
                      <SelectItem value="selected" disabled={selectedEMIs.length === 0}>
                        Selected EMIs ({selectedEMIs.length})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage>{form.formState.errors.applyTo?.message}</FormMessage>
                </FormItem>
              )}
            />

            {applyTo === 'selected' && selectedEMIs.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Selected EMIs: {selectedEMIs.sort((a, b) => a - b).join(', ')}
              </div>
            )}

            {applyTo === 'selected' && selectedEMIs.length === 0 && (
              <div className="text-sm text-destructive">
                Please select EMIs from the schedule table first.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || (applyTo === 'selected' && selectedEMIs.length === 0)}
            >
              {loading ? 'Processing...' : 'Update Interest Rate'}
            </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


