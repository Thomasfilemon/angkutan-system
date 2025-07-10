import apiClient from "../../api/axiosConfig";

// Payment API endpoints
export const paymentsApi = {
  // Get delivery orders pending payment
  fetchPendingDOs: (params?: {
    status?: string;
    customer?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get("/payments/delivery-orders", { params }),

  // Get payment overview stats
  getOverviewStats: () => apiClient.get("/payments/overview"),

  // Get delivery orders pending payment
  fetchDeliveryOrders: (params?: {
    status?: string;
    customer?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get("/payments/delivery-orders", { params }),

  // Get invoices with filtering and pagination
  fetchInvoices: (params?: {
    status?: string;
    customer?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
  }) => apiClient.get("/payments/invoices", { params }),

  // Create invoice for DO
  createInvoice: (
    doId: number,
    payload: {
      invoice_number: string;
      invoice_amount: number;
      due_date?: string;
      pph_percentage?: number;
      notes?: string;
    }
  ) => apiClient.post(`/payments/delivery-orders/${doId}/invoices`, payload),

  // Update invoice status
  updateInvoiceStatus: (
    invoiceId: number,
    payload: {
      status: string;
      notes?: string;
    }
  ) => apiClient.patch(`/payments/invoices/${invoiceId}/status`, payload),

  // Update invoice (edit PPH %, etc.)
  updateInvoice: (
    invoiceId: number,
    payload: {
      invoice_amount?: number;
      due_date?: string;
      pph_percentage?: number;
      notes?: string;
      status?: string;
    }
  ) => apiClient.put(`/payments/invoices/${invoiceId}`, payload),

  // Get delivery orders eligible for bulk invoicing
  getBulkEligibleDOs: (params?: {
    customer?: string;
    po_id?: number;
    limit?: number;
  }) => apiClient.get("/payments/delivery-orders/bulk-eligible", { params }),

  // Create bulk invoice
  createBulkInvoice: (payload: {
    do_ids: number[];
    invoice_number?: string;
    pph_percentage?: number;
    due_date?: string;
    notes?: string;
  }) => apiClient.post("/payments/bulk-invoices", payload),

  // Export invoices
  exportInvoices: (params?: {
    format?: "excel" | "csv";
    status?: string;
    customer?: string;
  }) => apiClient.get("/payments/invoices/export", { params }),

  // Record payment
  recordPayment: (
    doId: number,
    payload: {
      invoice_id?: number;
      payment_reference?: string;
      payment_type: "cash" | "transfer" | "check" | "giro";
      payment_amount: number;
      payment_date?: string;
      bank_account?: string;
      notes?: string;
      attachment_url?: string;
    }
  ) => apiClient.post(`/payments/delivery-orders/${doId}`, payload),

  // Confirm DO for payment
  confirmDO: (
    doId: number,
    payload: {
      final_amount?: number;
      notes?: string;
    }
  ) => apiClient.patch(`/payments/delivery-orders/${doId}/confirm`, payload),

  // Update payment status
  updatePaymentStatus: (payload: {
    delivery_order_id: number;
    payment_status: string;
    notes?: string;
  }) => apiClient.patch("/payments/status", payload),
};
