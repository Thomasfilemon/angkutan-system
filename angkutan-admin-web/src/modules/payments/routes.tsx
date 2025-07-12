import React from "react";
import { Routes, Route } from "react-router-dom";
import PaymentsOverview from "./pages/Overview";
import DeliveryList from "./pages/DeliveryList";
import InvoiceList from "./pages/InvoiceList";
import BulkInvoiceWizard from "./pages/BulkInvoiceWizard";
import CreateInvoice from "./pages/CreateInvoice"; // <-- Tambahkan ini

const PaymentsRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="" element={<PaymentsOverview />} />
      <Route path="deliveries" element={<DeliveryList />} />
      <Route path="invoices" element={<InvoiceList />} />
      <Route path="bulk" element={<BulkInvoiceWizard />} />
      <Route
        path="delivery-orders/:doId/invoices/create"
        element={<CreateInvoice />}
      />
    </Routes>
  );
};

export default PaymentsRoutes;
