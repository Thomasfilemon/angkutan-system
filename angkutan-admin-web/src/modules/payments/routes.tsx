import React from "react";
import { Routes, Route } from "react-router-dom";
import PaymentsOverview from "../pages/Overview";
import DeliveryList from "../pages/DeliveryList";
import InvoiceList from "../pages/InvoiceList";
import BulkInvoiceWizard from "../pages/BulkInvoiceWizard";
import CreateInvoice from "../pages/CreateInvoice"; // <-- Tambahkan ini
import DepositGroupInvoiceList from "../pages/DepositGroupInvoiceList";
import DepositGroupInvoiceDetail from "../pages/DepositGroupInvoiceDetail";

const PaymentsRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="" element={<PaymentsOverview />} />
      <Route path="deliveries" element={<DeliveryList />} />
      <Route path="invoices" element={<InvoiceList />} />
      <Route path="deposit-group-invoices" element={<DepositGroupInvoiceList />} />
      <Route path="deposit-groups/invoices/:invoiceId" element={<DepositGroupInvoiceDetail />} />
      <Route path="bulk" element={<BulkInvoiceWizard />} />
      <Route
        path="delivery-orders/:doId/invoices/create"
        element={<CreateInvoice />}
      />
    </Routes>
  );
};

export default PaymentsRoutes;
