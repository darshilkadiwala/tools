import { Suspense, type JSX } from 'react';

import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Layout } from '@/components/layout/Layout';
import { LoanProvider } from '@/contexts/LoanContext';
import { AppRoutes, RouteFallback } from '@/routes';

export function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LoanProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path='/' element={<Layout />}>
                <AppRoutes />
              </Route>
            </Routes>
          </Suspense>
        </LoanProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
