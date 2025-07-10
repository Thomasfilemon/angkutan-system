import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

// Import the payments API we built earlier
import { paymentsApi } from "../../modules/payments/api";
import EditablePphCell from "../../modules/payments/components/EditablePphCell";

interface POData {
  purchase_order: {
    id: number;
    po_number: string;
    customer_name: string;
    item_name: string;
    total_quantity: string;
    unit: string;
    unit_price: string;
    total_amount: string;
    load_location: string;
    unload_location: string;
    order_date: string;
    status: string;
    notes?: string;
    poDeliveryOrders: DeliveryOrder[];
  };
  delivery_orders: DeliveryOrder[];
  summary: {
    total_dos: number;
    completed_dos: number;
    pending_dos: number;
    total_quantity_delivered: number;
    total_revenue: number;
    total_operational_costs: number;
    total_net_profit: number;
    outstanding_payments: number;
    completion_percentage: number;
    profit_margin: number;
  };
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: string;
  actual_load_quantity?: string;
  unit: string;
  unit_price: string;
  total_amount: string;
  payment_status: string;
  status: string;
  completed_at?: string;
  vehicle: {
    license_plate: string;
    type: string;
    capacity: string;
  };
  driver: {
    driverProfile: {
      full_name: string;
    };
  };
  payments: Payment[];
  invoices: Invoice[];
}

interface Payment {
  id: number;
  payment_amount: string;
  payment_date: string;
  payment_type: string;
  payment_reference?: string;
  notes?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: string;
  pph_percentage: string;
  pph_amount: string;
  net_amount: string;
  status: string;
  due_date?: string;
}

const POSpecificRitaseTable: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const [data, setData] = useState<POData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDOs, setSelectedDOs] = useState<number[]>([]);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showBulkInvoiceModal, setShowBulkInvoiceModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "deliveries" | "invoices" | "analytics"
  >("deliveries");

  useEffect(() => {
    if (poId) {
      fetchPOData();
    }
  }, [poId]);

  const fetchPOData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(
        `/ritase/purchase-orders/${poId}/comprehensive`
      );
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch PO data");
    } finally {
      setLoading(false);
    }
  };

  const calculateVariance = () => {
    if (!data) return { quantity: 0, amount: 0, percentage: 0 };

    const targetQty = parseFloat(data.purchase_order.total_quantity);
    const actualQty = data.summary.total_quantity_delivered;
    const targetAmount = parseFloat(data.purchase_order.total_amount);
    const actualAmount = data.summary.total_revenue;

    return {
      quantity: actualQty - targetQty,
      amount: actualAmount - targetAmount,
      percentage: ((actualQty - targetQty) / targetQty) * 100,
    };
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      lunas: "bg-green-100 text-green-800",
      deposit: "bg-blue-100 text-blue-800",
      proses_tagihan: "bg-yellow-100 text-yellow-800",
      awaiting_confirmation: "bg-orange-100 text-orange-800",
    };

    const statusText: { [key: string]: string } = {
      lunas: "Paid",
      deposit: "Partial",
      proses_tagihan: "Billing",
      awaiting_confirmation: "Awaiting",
    };

    return (
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          statusMap[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {statusText[status] || status}
      </span>
    );
  };

  const handleDOSelection = (doId: number) => {
    setSelectedDOs((prev) =>
      prev.includes(doId) ? prev.filter((id) => id !== doId) : [...prev, doId]
    );
  };

  const handleDownloadInvoice = async (invoiceId: number) => {
    try {
      // Option 1: PDF generation (future)
      // const response = await apiClient.get(`/payments/invoices/${invoiceId}/pdf`, { responseType: 'blob' });

      // Option 2: Simple invoice data export (immediate)
      const response = await apiClient.get(`/payments/invoices/${invoiceId}`);
      const invoice = response.data.data;

      // Create downloadable JSON/text for now
      const dataStr = JSON.stringify(invoice, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.invoice_number}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download invoice");
    }
  };

  const handleCreateInvoice = async (doId: number, invoiceData: any) => {
    try {
      await paymentsApi.createInvoice(doId, invoiceData);
      fetchPOData(); // Refresh data
      setShowCreateInvoiceModal(false);
    } catch (err: any) {
      console.error("Failed to create invoice:", err);
      alert(err.response?.data?.message || "Failed to create invoice");
    }
  };

  const handleRecordPayment = async (doId: number, paymentData: any) => {
    try {
      await paymentsApi.recordPayment(doId, paymentData);
      fetchPOData(); // Refresh data
    } catch (err: any) {
      console.error("Failed to record payment:", err);
      alert(err.response?.data?.message || "Failed to record payment");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
          <Link
            to="/ritase"
            className="mt-2 inline-block bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Back to Ritase
          </Link>
        </div>
      </div>
    );
  }

  const variance = calculateVariance();
  const po = data.purchase_order;
  const summary = data.summary;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 🎯 SECTION 1: PO Summary Header (Excel-style) */}
      <div className="bg-white shadow-xl rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PO Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {po.po_number}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  po.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : po.status === "partial"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {po.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Customer:</span>
                <p className="font-medium">{po.customer_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Item:</span>
                <p className="font-medium">{po.item_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Load Location:</span>
                <p className="font-medium">{po.load_location}</p>
              </div>
              <div>
                <span className="text-gray-500">Unload Location:</span>
                <p className="font-medium">{po.unload_location}</p>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Financial Summary</h3>

            {/* Target vs Actual */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Target:</span>
                <span className="font-medium">
                  {parseFloat(po.total_quantity).toLocaleString("id-ID")}{" "}
                  {po.unit} @ Rp{" "}
                  {parseFloat(po.unit_price).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Actual:</span>
                <span className="font-medium">
                  {summary.total_quantity_delivered.toLocaleString("id-ID")}{" "}
                  {po.unit}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Variance:</span>
                <span
                  className={`font-medium ${
                    variance.quantity >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {variance.quantity >= 0 ? "+" : ""}
                  {variance.quantity.toLocaleString("id-ID")} {po.unit}(
                  {variance.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="border-t mt-3 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue:</span>
                <span className="font-medium">
                  Rp {summary.total_revenue.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Profit:</span>
                <span className="font-medium text-green-600">
                  Rp {summary.total_net_profit.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Profit Margin:</span>
                <span className="font-medium">
                  {summary.profit_margin.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completion:</span>
                <span className="font-medium">
                  {summary.completion_percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 SECTION 2: Navigation Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              {
                key: "deliveries",
                label: "Delivery Orders",
                count: summary.total_dos,
              },
              {
                key: "invoices",
                label: "Invoices",
                count: data.delivery_orders.reduce(
                  (acc, do_) => acc + do_.invoices.length,
                  0
                ),
              },
              { key: "analytics", label: "Analytics", count: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 🎯 SECTION 3: Content Based on Active Tab */}

      {/* Deliveries Tab */}
      {activeTab === "deliveries" && (
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Action Bar */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-medium">
                  Delivery Orders ({data.delivery_orders.length})
                </h3>
                {selectedDOs.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedDOs.length} selected
                  </span>
                )}
              </div>
              <div className="flex space-x-3">
                {selectedDOs.length > 1 && (
                  <button
                    onClick={() => setShowBulkInvoiceModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    Create Bulk Invoice
                  </button>
                )}
                <button
                  onClick={() =>
                    window.open(
                      `/api/web/ritase/purchase-orders/${poId}/export`,
                      "_blank"
                    )
                  }
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          {/* DO Table */}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDOs(
                          data.delivery_orders.map((do_) => do_.id)
                        );
                      } else {
                        setSelectedDOs([]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle & Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DO Number & Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Info
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.delivery_orders.map((do_) => (
                <tr key={do_.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      checked={selectedDOs.includes(do_.id)}
                      onChange={() => handleDOSelection(do_.id)}
                    />
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {do_.vehicle.license_plate}
                    </div>
                    <div className="text-sm text-gray-500">
                      {do_.driver.driverProfile.full_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {do_.vehicle.type}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {do_.do_number}
                    </div>
                    {do_.completed_at && (
                      <div className="text-sm text-gray-500">
                        {new Date(do_.completed_at).toLocaleDateString("id-ID")}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="text-gray-500">
                        Target:{" "}
                        {parseFloat(do_.minimal_load_quantity).toLocaleString(
                          "id-ID"
                        )}{" "}
                        {do_.unit}
                      </div>
                      {do_.actual_load_quantity && (
                        <div className="font-medium text-gray-900">
                          Actual:{" "}
                          {parseFloat(do_.actual_load_quantity).toLocaleString(
                            "id-ID"
                          )}{" "}
                          {do_.unit}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      Rp {parseFloat(do_.total_amount).toLocaleString("id-ID")}
                    </div>
                    <div className="text-xs text-gray-500">
                      @ Rp {parseFloat(do_.unit_price).toLocaleString("id-ID")}/
                      {do_.unit}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {getPaymentStatusBadge(do_.payment_status)}
                    {do_.payments.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {do_.payments.length} payment(s)
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {do_.invoices.length > 0 ? (
                      <div className="space-y-1">
                        {do_.invoices.map((invoice) => (
                          <div key={invoice.id} className="text-xs">
                            <div className="font-medium">
                              {invoice.invoice_number}
                            </div>
                            <div className="text-gray-500">
                              Rp{" "}
                              {parseFloat(invoice.net_amount).toLocaleString(
                                "id-ID"
                              )}
                              (PPH {invoice.pph_percentage}%)
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No invoice</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        to={`/delivery-orders/${do_.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-xs"
                      >
                        Details
                      </Link>

                      {do_.invoices.length === 0 &&
                        do_.payment_status === "proses_tagihan" && (
                          <button
                            onClick={() => setShowCreateInvoiceModal(true)}
                            className="text-green-600 hover:text-green-900 text-xs"
                          >
                            Invoice
                          </button>
                        )}

                      {do_.invoices.length > 0 &&
                        do_.payment_status !== "lunas" && (
                          <button
                            onClick={() => {
                              /* Show payment modal */
                            }}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Payment
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium">All Invoices</h3>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PPH
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.delivery_orders.flatMap((do_) =>
                do_.invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {do_.do_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>
                        {new Date(invoice.invoice_date).toLocaleDateString(
                          "id-ID"
                        )}
                      </div>
                      {invoice.due_date && (
                        <div className="text-xs">
                          Due:{" "}
                          {new Date(invoice.due_date).toLocaleDateString(
                            "id-ID"
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Rp{" "}
                      {parseFloat(invoice.invoice_amount).toLocaleString(
                        "id-ID"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>{invoice.pph_percentage}%</div>
                      <div className="text-xs text-gray-500">
                        Rp{" "}
                        {parseFloat(invoice.pph_amount).toLocaleString("id-ID")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      Rp{" "}
                      {parseFloat(invoice.net_amount).toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "sent"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <EditablePphCell
                          invoice={{
                            id: invoice.id,
                            pph_percentage: parseFloat(invoice.pph_percentage),
                            pph_amount: parseFloat(invoice.pph_amount),
                            net_amount: parseFloat(invoice.net_amount),
                            invoice_amount: parseFloat(invoice.invoice_amount),
                            status: invoice.status,
                          }}
                          onUpdate={(invoiceId, updatedData) => {
                            // Refresh PO data setelah PPH update
                            fetchPOData();
                          }}
                        />
                        <button
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          className="text-green-600 hover:text-green-900 text-xs"
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Completion Progress */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Progress Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Quantity Progress</span>
                  <span>{summary.completion_percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(summary.completion_percentage, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Payment Progress</span>
                  <span>
                    {(
                      ((summary.total_revenue - summary.outstanding_payments) /
                        summary.total_revenue) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${
                        ((summary.total_revenue -
                          summary.outstanding_payments) /
                          summary.total_revenue) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Financial Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Gross Revenue:</span>
                <span className="font-medium">
                  Rp {summary.total_revenue.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Operational Costs:</span>
                <span className="font-medium text-red-600">
                  Rp {summary.total_operational_costs.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-600">Net Profit:</span>
                <span className="font-medium text-green-600">
                  Rp {summary.total_net_profit.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Profit Margin:</span>
                <span className="font-medium">
                  {summary.profit_margin.toFixed(2)}%
                </span>
              </div>
              {summary.outstanding_payments > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Outstanding:</span>
                  <span className="font-medium">
                    Rp {summary.outstanding_payments.toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSpecificRitaseTable;
