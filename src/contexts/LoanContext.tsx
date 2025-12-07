import { createContext, ReactNode, useContext } from 'react';

import { useLoans } from '@/hooks/useLoans';

interface LoanContextType {
  loans: ReturnType<typeof useLoans>;
}

const LoanContext = createContext<LoanContextType | undefined>(undefined);

export function LoanProvider({ children }: { children: ReactNode }) {
  const loans = useLoans();

  return <LoanContext.Provider value={{ loans }}>{children}</LoanContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoanContext() {
  const context = useContext(LoanContext);
  if (context === undefined) {
    throw new Error('useLoanContext must be used within a LoanProvider');
  }
  return context;
}
