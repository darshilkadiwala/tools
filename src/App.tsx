import { Suspense, type JSX } from 'react';

import { BrowserRouter } from 'react-router-dom';

import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { LoanProvider } from '@/contexts/LoanContext';
import { AppRoutes, RouteFallback } from '@/routes';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <LoanProvider>
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
      </LoanProvider>
    </BrowserRouter>
  );
}
