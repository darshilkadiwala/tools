import { lazy, type JSX } from 'react';

import { Route } from 'react-router-dom';

import { PageLoader } from '@/components/ui/page-loader';

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

export function RouteFallback(): JSX.Element {
  return <PageLoader />;
}

export function AppRoutes(): JSX.Element {
  return (
    <>
      <Route index element={<LoansPage />} />
      <Route path='loans/create' element={<CreateLoanPage />} />
      <Route path='loans/:id' element={<LoanDetailsPage />} />
      <Route path='loans/:id/edit' element={<EditLoanPage />} />
    </>
  );
}
