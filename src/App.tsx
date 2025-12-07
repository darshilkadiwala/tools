import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { LoanProvider } from './contexts/LoanContext';
import { CreateLoanPage } from './pages/CreateLoanPage';
import { EditLoanPage } from './pages/EditLoanPage';
import { LoanDetailsPage } from './pages/LoanDetailsPage';
import { LoansPage } from './pages/LoansPage';

function App() {
  return (
    <BrowserRouter>
      <LoanProvider>
        <Routes>
          <Route path='/' element={<Layout />}>
            <Route index element={<LoansPage />} />
            <Route path='loans/create' element={<CreateLoanPage />} />
            <Route path='loans/:id' element={<LoanDetailsPage />} />
            <Route path='loans/:id/edit' element={<EditLoanPage />} />
          </Route>
        </Routes>
      </LoanProvider>
    </BrowserRouter>
  );
}

export default App;
