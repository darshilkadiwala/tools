import type { JSX, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { useEMIScheduleState, type EMIScheduleState } from '@/hooks/useEMISchedule';

const EMIScheduleContext = createContext<EMIScheduleState | undefined>(undefined);

export function EMIScheduleProvider({ loanId, children }: { loanId: string; children: ReactNode }): JSX.Element {
  const value = useEMIScheduleState(loanId);

  return <EMIScheduleContext.Provider value={value}>{children}</EMIScheduleContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEMISchedule(): EMIScheduleState {
  const context = useContext(EMIScheduleContext);
  if (context === undefined) {
    throw new Error('useEMISchedule must be used within an EMIScheduleProvider');
  }
  return context;
}
