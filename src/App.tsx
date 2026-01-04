import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { MonteCarloDashboard } from "@/components/MonteCarloDashboard";
import { GKWithdrawalCalculator } from "@/components/GKWithdrawalCalculator";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Main simulation page */}
          <Route path="/" element={<MonteCarloDashboard />} />
          
          {/* G-K Withdrawal Strategy Calculator */}
          <Route path="/gk-withdrawal" element={<GKWithdrawalCalculator />} />
          
          {/* Future pages can be added here:
          <Route path="/swp" element={<SWPSimulation />} />
          <Route path="/sip" element={<SIPCalculator />} />
          */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}