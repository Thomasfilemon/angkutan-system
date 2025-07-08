import React from "react";
import { Routes, Route } from "react-router-dom";
import PaymentsOverview from "./pages/Overview";
import DeliveryList from "./pages/DeliveryList";

// Placeholder components
const InvoiceList = () => (
  <div className="p-8">
    <h2 className="text-2xl">Invoice List - Coming Soon</h2>
  </div>
);
const BulkWizard = () => (
  <div className="p-8">
    <h2 className="text-2xl">Bulk Invoice Wizard - Coming Soon</h2>
  </div>
);

const PaymentsRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="" element={<PaymentsOverview />} />
      <Route path="deliveries" element={<DeliveryList />} />
      <Route path="invoices" element={<InvoiceList />} />
      <Route path="bulk/*" element={<BulkWizard />} />
    </Routes>
  );
};

export default PaymentsRoutes;
