import { Suspense, type JSX } from 'react';

import { BrowserRouter } from 'react-router-dom';

import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { LoanProvider } from '@/contexts/LoanContext';
import { AppRoutes, RouteFallback } from '@/routes';

export function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LoanProvider>
          <Suspense fallback={<RouteFallback />}>
            <AppRoutes />
          </Suspense>
        </LoanProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
