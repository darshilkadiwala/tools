import { lazy, Suspense, type JSX } from 'react';

import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { PageLoader } from '@/components/ui/page-loader';
import { LoanProvider } from '@/contexts/LoanContext';

const LoansPage = lazy(async () => {
  const module = await import('@/pages/LoansPage');
  return { default: module.LoansPage };
});

const CreateLoanPage = lazy(async () => {
  const module = await import('@/pages/CreateLoanPage');
  return { default: module.CreateLoanPage };
});

const LoanDetailsPage = lazy(async () => {
  const module = await import('@/pages/LoanDetailsPage');
  return { default: module.LoanDetailsPage };
});

const EditLoanPage = lazy(async () => {
  const module = await import('@/pages/EditLoanPage');
  return { default: module.EditLoanPage };
});

function RouteFallback(): JSX.Element {
  return <PageLoader />;
}

export function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LoanProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path='/' element={<Layout />}>
                <Route index element={<LoansPage />} />
                <Route path='loans/create' element={<CreateLoanPage />} />
                <Route path='loans/:id' element={<LoanDetailsPage />} />
                <Route path='loans/:id/edit' element={<EditLoanPage />} />
              </Route>
            </Routes>
          </Suspense>
        </LoanProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
