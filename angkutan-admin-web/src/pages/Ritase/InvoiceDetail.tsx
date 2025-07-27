// src/pages/Ritase/InvoiceDetail.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../../api/axiosConfig";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface InvoiceDetailData {
  invoice: {
    id: number;
    invoice_number: string;
    invoice_amount: number;
    net_amount: number;
    pph_amount: number;
    pph_percentage: number;
    invoice_date: string;
    due_date?: string;
    status: string;
    notes?: string;
    created_at: string;
    updated_at: string;
  };
  delivery_order: {
    id: number;
    do_number: string;
    customer_name: string;
    item_name: string;
    load_location: string;
    unload_location: string;
    vehicle?: {
      license_plate: string;
      type: string;
    };
    driver?: {
      username: string;
      driverProfile?: {
        full_name: string;
      };
    };
  };
  payments: Array<{
    id: number;
    payment_amount: number;
    payment_date: string;
    payment_type: string;
    payment_reference?: string;
    notes?: string;
  }>;
}

const InvoiceDetail: React.FC = () => {
  const { doId, invoiceId } = useParams<{ doId: string; invoiceId: string }>();
  const navigate = useNavigate();
  const [invoiceData, setInvoiceData] = useState<InvoiceDetailData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<
    number | null
  >(null);

  const handleDownloadInvoice = async (invoiceId: number) => {
    setDownloadingInvoiceId(invoiceId);
    try {
      const response = await apiClient.get(`/payments/invoices/${invoiceId}`);
      const invoiceData = response.data.data;

      generateInvoicePDF(invoiceData);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  useEffect(() => {
    const fetchInvoiceDetail = async () => {
      try {
        const response = await apiClient.get(
          `/payments/delivery-orders/${doId}/invoices/${invoiceId}`
        );
        setInvoiceData(response.data.data);
      } catch (error) {
        console.error("Error fetching invoice detail:", error);
        toast.error("Failed to load invoice details");
        navigate(`/ritase/delivery-orders/${doId}/payment`);
      } finally {
        setLoading(false);
      }
    };

    if (doId && invoiceId) {
      fetchInvoiceDetail();
    }
  }, [doId, invoiceId, navigate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(amount);
  };

  const generateInvoicePDF = (invoiceData: any) => {
    const { invoice, delivery_order, payments } = invoiceData;
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Your Company Name", 20, 35); // Replace with actual company name
    doc.text("Your Address Line 1", 20, 42);
    doc.text("Your Address Line 2", 20, 49);
    doc.text("Phone: +62 XXX XXXX XXXX", 20, 56);

    // Invoice Details (Right side)
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Number:", 130, 35);
    doc.text("Invoice Date:", 130, 42);
    doc.text("Due Date:", 130, 49);
    doc.text("DO Number:", 130, 56);

    doc.setFont("helvetica", "normal");
    doc.text(invoice.invoice_number, 175, 35);
    doc.text(
      new Date(invoice.invoice_date).toLocaleDateString("id-ID"),
      175,
      42
    );
    doc.text(
      invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString("id-ID")
        : "N/A",
      175,
      49
    );
    doc.text(delivery_order.do_number, 175, 56);

    // Customer Info
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 75);
    doc.setFont("helvetica", "normal");
    doc.text(delivery_order.customer_name, 20, 82);

    // Delivery Details Table
    const deliveryDetails = [
      ["Item", delivery_order.item_name],
      [
        "Vehicle",
        delivery_order.vehicle
          ? `${delivery_order.vehicle.license_plate} (${delivery_order.vehicle.type})`
          : "N/A",
      ],
      [
        "Driver",
        delivery_order.driver?.driverProfile?.full_name ||
          delivery_order.driver?.username ||
          "N/A",
      ],
      ["Load Location", delivery_order.load_location || "N/A"],
      ["Unload Location", delivery_order.unload_location || "N/A"],
    ];

    (doc as any).autoTable({
      startY: 95,
      head: [["Description", "Details"]],
      body: deliveryDetails,
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105] },
      margin: { left: 20, right: 20 },
    });

    // Amount Breakdown
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    const amountData = [
      ["Gross Amount", `Rp ${invoice.invoice_amount.toLocaleString("id-ID")}`],
      [
        `PPH (${invoice.pph_percentage}%)`,
        `Rp ${invoice.pph_amount.toLocaleString("id-ID")}`,
      ],
      ["Net Amount", `Rp ${invoice.net_amount.toLocaleString("id-ID")}`],
    ];

    (doc as any).autoTable({
      startY: finalY,
      body: amountData,
      theme: "plain",
      styles: { halign: "right" },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold" },
        1: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 120, right: 20 },
    });

    // Payment History (if any)
    if (payments && payments.length > 0) {
      const paymentY = (doc as any).lastAutoTable.finalY + 15;

      doc.setFont("helvetica", "bold");
      doc.text("Payment History:", 20, paymentY);

      const paymentData = payments.map((payment: any) => [
        new Date(payment.payment_date).toLocaleDateString("id-ID"),
        `Rp ${payment.payment_amount.toLocaleString("id-ID")}`,
        payment.payment_type,
        payment.payment_reference || "-",
      ]);

      (doc as any).autoTable({
        startY: paymentY + 5,
        head: [["Date", "Amount", "Type", "Reference"]],
        body: paymentData,
        theme: "striped",
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 20, right: 20 },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.text("Thank you for your business!", 105, pageHeight - 20, {
      align: "center",
    });
    doc.text(
      `Generated on ${new Date().toLocaleDateString("id-ID")}`,
      105,
      pageHeight - 15,
      { align: "center" }
    );

    // Save the PDF
    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Invoice Not Found
        </h2>
        <p className="text-gray-600 mb-4">
          The requested invoice could not be found.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg
            className="h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
      </div>
    );
  }

  const { invoice, delivery_order, payments } = invoiceData;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <div className="flex gap-3">
            // In your JSX:
            <button
              onClick={() => handleDownloadInvoice(invoice.id)}
              disabled={downloadingInvoiceId === invoice.id}
              className="text-green-600 hover:text-green-900 text-xs disabled:opacity-50"
            >
              {downloadingInvoiceId === invoice.id ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-1 h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                "Download"
              )}
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Print Invoice
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoice_number}
            </h1>
            <p className="text-gray-600">
              Invoice for DO #{delivery_order.do_number}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              invoice.status
            )}`}
          >
            {invoice.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Invoice Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Invoice Information</h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Invoice Date</span>
              <p className="font-medium">
                {new Date(invoice.invoice_date).toLocaleDateString("id-ID")}
              </p>
            </div>
            {invoice.due_date && (
              <div>
                <span className="text-sm text-gray-600">Due Date</span>
                <p className="font-medium">
                  {new Date(invoice.due_date).toLocaleDateString("id-ID")}
                  {new Date(invoice.due_date) < new Date() &&
                    invoice.status !== "paid" && (
                      <span className="ml-2 text-red-600 text-xs font-bold">
                        OVERDUE
                      </span>
                    )}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600">Created</span>
              <p className="font-medium">
                {new Date(invoice.created_at).toLocaleDateString("id-ID")}
              </p>
            </div>
          </div>
        </div>

        {/* Delivery Order Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Delivery Order</h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">DO Number</span>
              <p className="font-medium">{delivery_order.do_number}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Customer</span>
              <p className="font-medium">{delivery_order.customer_name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Item</span>
              <p className="font-medium">{delivery_order.item_name}</p>
            </div>
            {delivery_order.vehicle && (
              <div>
                <span className="text-sm text-gray-600">Vehicle</span>
                <p className="font-medium">
                  {delivery_order.vehicle.license_plate} (
                  {delivery_order.vehicle.type})
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Amount Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Gross Amount</span>
              <span className="font-medium">
                {formatCurrency(invoice.invoice_amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">
                PPH ({invoice.pph_percentage}%)
              </span>
              <span className="font-medium text-red-600">
                -{formatCurrency(invoice.pph_amount)}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Net Amount</span>
              <span className="font-bold text-lg">
                {formatCurrency(invoice.net_amount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      {invoice.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-2">Notes</h3>
          <p className="text-gray-700">{invoice.notes}</p>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Payment History</h3>
        {payments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Reference</th>
                  <th className="text-left py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100">
                    <td className="py-3">
                      {new Date(payment.payment_date).toLocaleDateString(
                        "id-ID"
                      )}
                    </td>
                    <td className="py-3 font-medium">
                      {formatCurrency(payment.payment_amount)}
                    </td>
                    <td className="py-3">{payment.payment_type}</td>
                    <td className="py-3">{payment.payment_reference || "-"}</td>
                    <td className="py-3">{payment.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceDetail;
