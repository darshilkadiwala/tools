import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoanProvider } from "./contexts/LoanContext";
import { Layout } from "./components/Layout";
import { LoansPage } from "./pages/LoansPage";
import { CreateLoanPage } from "./pages/CreateLoanPage";
import { EditLoanPage } from "./pages/EditLoanPage";
import { LoanDetailsPage } from "./pages/LoanDetailsPage";

function App() {
  return (
    <BrowserRouter>
      <LoanProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LoansPage />} />
            <Route path="loans/create" element={<CreateLoanPage />} />
            <Route path="loans/:id" element={<LoanDetailsPage />} />
            <Route path="loans/:id/edit" element={<EditLoanPage />} />
          </Route>
        </Routes>
      </LoanProvider>
    </BrowserRouter>
  );
}

export default App;
