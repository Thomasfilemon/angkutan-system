// src/pages/Ritase/InvoiceDetail.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../api/axiosConfig";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
    minimal_load_quantity: number;
    actual_load_quantity: number;
    unit: string;
    unit_price: number;
    load_location: string;
    unload_location: string;
    vehicle: {
      license_plate: string;
      type: string;
    } | null;
    driver: {
      username: string;
      driverProfile: {
        full_name: string;
      };
    } | null;
  };
  payments: Array<{
    id: number;
    payment_amount: number;
    payment_date: string;
    payment_type: string;
    payment_reference?: string;
    notes?: string;
  }>;
  summary: {
    total_paid: number;
    remaining_amount: number;
    is_fully_paid: boolean;
    is_overdue: boolean;
  };
}

// Simple config - replace with your company info
const COMPANY_INFO = {
  name: "PT ANGKUTAN SEJAHTERA",
  address1: "Jl. Raya Tangerang No. 123",
  address2: "Tangerang, Banten 15117",
  phone: "+62 21 1234 5678",
};

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
    if (!invoiceData || invoiceData.invoice.id !== invoiceId) {
      toast.error("Invoice data not loaded yet");
      return;
    }
    setDownloadingInvoiceId(invoiceId);
    try {
      generateInvoicePDF(invoiceData);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate invoice PDF");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  useEffect(() => {
    const fetchInvoiceDetail = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get(
          `/payments/delivery-orders/${doId}/invoices/${invoiceId}`
        );
        if (!response.data?.data) {
          throw new Error("Invalid invoice data from server");
        }
        setInvoiceData(response.data.data);
      } catch (error: any) {
        console.error("Error fetching invoice detail:", error);
        toast.error(
          error.response?.data?.message || "Failed to load invoice details"
        );
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

  const formatQuantity = (quantity: number, unit: string) => {
    return quantity ? `${quantity.toLocaleString("id-ID")} ${unit}` : "N/A";
  };

  // ✅ PROPERLY TYPED COLOR INTERFACE
  interface PDFColors {
    primary: [number, number, number];
    secondary: [number, number, number];
    success: [number, number, number];
    warning: [number, number, number];
    danger: [number, number, number];
    gray: [number, number, number];
    lightGray: [number, number, number];
  }

  // Enhanced PDF generation with professional styling
  const generateInvoicePDF = (data: InvoiceDetailData) => {
    const { invoice, delivery_order, payments, summary } = data;
    const doc = new jsPDF();

    // ✅ PROPERLY TYPED COLOR OBJECT
    const colors: PDFColors = {
      primary: [0, 102, 204],
      secondary: [71, 85, 105],
      success: [16, 185, 129],
      warning: [245, 158, 11],
      danger: [239, 68, 68],
      gray: [107, 114, 128],
      lightGray: [249, 250, 251],
    };

    addEnhancedHeader(doc, colors);
    addCompanyBranding(doc, colors);
    addInvoiceMetadata(doc, invoice, delivery_order, colors);
    addCustomerSection(doc, delivery_order, colors);
    addItemizedTable(doc, delivery_order, colors);
    addFinancialSummary(doc, invoice, summary, colors);
    addProfessionalFooter(doc, colors);

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  // ✅ FIXED: Proper type signature
  const addEnhancedHeader = (doc: jsPDF, colors: PDFColors) => {
    // Header background
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, 210, 30, "F");

    // Main title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 105, 20, { align: "center" });

    // Subtitle line
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Professional Delivery Services", 105, 26, { align: "center" });
  };

  // ✅ FIXED: Proper type signature
  const addCompanyBranding = (doc: jsPDF, colors: PDFColors) => {
    // Company section background
    doc.setFillColor(...colors.lightGray);
    doc.rect(15, 35, 85, 35, "F");
    doc.setDrawColor(...colors.gray);
    doc.rect(15, 35, 85, 35, "S");

    // Company details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_INFO.name, 20, 45);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray);
    doc.text(COMPANY_INFO.address1, 20, 52);
    doc.text(COMPANY_INFO.address2, 20, 57);
    doc.text(`Phone: ${COMPANY_INFO.phone}`, 20, 62);
    doc.text("Email: info@angkutansejahtera.com", 20, 67);
  };

  // ✅ FIXED: Proper type signature
  const addInvoiceMetadata = (
    doc: jsPDF,
    invoice: any,
    delivery_order: any,
    colors: PDFColors
  ) => {
    // Invoice details box
    doc.setFillColor(255, 255, 255);
    doc.rect(110, 35, 85, 35, "F");
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.rect(110, 35, 85, 35, "S");

    // Invoice details
    const details = [
      ["Invoice Number:", invoice.invoice_number],
      [
        "Invoice Date:",
        new Date(invoice.invoice_date).toLocaleDateString("id-ID"),
      ],
      [
        "Due Date:",
        invoice.due_date
          ? new Date(invoice.due_date).toLocaleDateString("id-ID")
          : "N/A",
      ],
      ["DO Number:", delivery_order.do_number],
    ];

    let yPos = 42;
    details.forEach(([label, value]) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colors.gray);
      doc.text(label, 115, yPos);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(value, 155, yPos);
      yPos += 6;
    });
  };

  // ✅ FIXED: Proper type signature
  const addCustomerSection = (
    doc: jsPDF,
    delivery_order: any,
    colors: PDFColors
  ) => {
    let yPos = 80;

    // Bill To section
    doc.setFillColor(...colors.primary);
    doc.rect(15, yPos, 180, 8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", 20, yPos + 5);

    // Customer details
    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(delivery_order.customer_name, 20, yPos);

    yPos += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray);
    doc.text(`Load: ${delivery_order.load_location}`, 20, yPos);
    yPos += 5;
    doc.text(`Unload: ${delivery_order.unload_location}`, 20, yPos);
  };

  // ✅ FIXED: Proper type signature
  const addItemizedTable = (
    doc: jsPDF,
    delivery_order: any,
    colors: PDFColors
  ) => {
    const startY = 120;

    // Table data with enhanced formatting
    const tableData = [
      ["ITEM DESCRIPTION", "QUANTITY", "UNIT PRICE", "AMOUNT"],
      [
        delivery_order.item_name,
        `${
          delivery_order.actual_load_quantity?.toLocaleString("id-ID") || "N/A"
        } ${delivery_order.unit}`,
        formatCurrency(delivery_order.unit_price),
        formatCurrency(
          delivery_order.actual_load_quantity * delivery_order.unit_price
        ),
      ],
    ];

    // Add vehicle and driver info
    if (delivery_order.vehicle || delivery_order.driver) {
      tableData.push([
        "VEHICLE & DRIVER",
        delivery_order.vehicle
          ? `${delivery_order.vehicle.license_plate} (${delivery_order.vehicle.type})`
          : "N/A",
        delivery_order.driver
          ? delivery_order.driver.driverProfile?.full_name ||
            delivery_order.driver.username
          : "N/A",
        "-",
      ]);
    }

    autoTable(doc, {
      startY: startY,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: "grid",
      headStyles: {
        fillColor: colors.primary,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: 8,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 6,
        textColor: 50,
      },
      alternateRowStyles: {
        fillColor: colors.lightGray,
      },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: "bold" },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 35, halign: "right" },
        3: { cellWidth: 35, halign: "right", fontStyle: "bold" },
      },
      margin: { left: 15, right: 15 },
      tableLineColor: colors.gray,
      tableLineWidth: 0.3,
    });
  };

  // ✅ FIXED: Proper type signature
  const addFinancialSummary = (
    doc: jsPDF,
    invoice: any,
    summary: any,
    colors: PDFColors
  ) => {
    const startY = (doc as any).lastAutoTable.finalY + 15;

    // Financial summary box
    doc.setFillColor(...colors.lightGray);
    doc.rect(120, startY, 75, 40, "F");
    doc.setDrawColor(...colors.primary);
    doc.rect(120, startY, 75, 40, "S");

    // Title
    doc.setFillColor(...colors.primary);
    doc.rect(120, startY, 75, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("FINANCIAL SUMMARY", 157.5, startY + 5, { align: "center" });

    // Summary items
    const summaryItems = [
      ["Gross Amount:", formatCurrency(invoice.invoice_amount)],
      [
        `PPH Tax (${invoice.pph_percentage}%):`,
        `-${formatCurrency(invoice.pph_amount)}`,
      ],
      ["Net Amount:", formatCurrency(invoice.net_amount)],
      ["Total Paid:", formatCurrency(summary.total_paid)],
    ];

    let yPos = startY + 15;
    summaryItems.forEach(([label, value], index) => {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont(
        "helvetica",
        index === summaryItems.length - 1 ? "bold" : "normal"
      );
      doc.text(label, 125, yPos);

      // Color code the amounts
      if (value.includes("-")) {
        doc.setTextColor(...colors.danger);
      } else if (label.includes("Paid")) {
        doc.setTextColor(...colors.success);
      } else {
        doc.setTextColor(0, 0, 0);
      }

      doc.text(value, 190, yPos, { align: "right" });
      yPos += 6;
    });

    // Outstanding balance highlight
    const outstanding = summary.remaining_amount;
    if (outstanding !== 0) {
      yPos += 3;

      // ✅ FIXED: Extract the color selection first
      const backgroundColor = outstanding < 0 ? colors.warning : colors.danger;
      doc.setFillColor(...backgroundColor);
      doc.rect(125, yPos - 3, 65, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(outstanding < 0 ? "OVERPAID:" : "OUTSTANDING:", 127, yPos + 2);
      doc.text(formatCurrency(Math.abs(outstanding)), 188, yPos + 2, {
        align: "right",
      });
    }
  };

  // ✅ FIXED: Proper type signature
  const addProfessionalFooter = (doc: jsPDF, colors: PDFColors) => {
    const pageHeight = doc.internal.pageSize.height;

    // Footer line
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(1);
    doc.line(15, pageHeight - 25, 195, pageHeight - 25);

    // Footer content
    doc.setTextColor(...colors.gray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Thank you for choosing PT Angkutan Sejahtera",
      105,
      pageHeight - 18,
      { align: "center" }
    );
    doc.text(
      "For inquiries, contact us at info@angkutansejahtera.com",
      105,
      pageHeight - 13,
      { align: "center" }
    );
    doc.text(
      `Generated on ${new Date().toLocaleDateString(
        "id-ID"
      )} | Document ID: ${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`,
      105,
      pageHeight - 8,
      { align: "center" }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      case "issued":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getInvoiceContext = (
    invoice: InvoiceDetailData["invoice"],
    summary: InvoiceDetailData["summary"]
  ) => {
    if (invoice.invoice_amount === 0 && summary.total_paid > 0) {
      return {
        type: "adjusted_after_payment",
        title: "⚠️ Invoice Adjusted After Payment",
        message: `This invoice was adjusted to zero after payments were made. Customer overpaid by ${formatCurrency(
          summary.total_paid
        )}.`,
        action: "May require refund or credit processing",
        color: "bg-gradient-to-r from-orange-50 to-red-50 border-orange-200",
        textColor: "text-orange-900",
        iconColor: "text-orange-500",
      };
    }
    return { type: "normal" };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading invoice details...
          </p>
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Invoice Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            The requested invoice could not be found or you don't have
            permission to view it.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { invoice, delivery_order, payments, summary } = invoiceData;
  const invoiceContext = getInvoiceContext(invoice, summary);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Payment
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => handleDownloadInvoice(invoice.id)}
                disabled={downloadingInvoiceId === invoice.id}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingInvoiceId === invoice.id ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                    Generating...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center px-6 py-3 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-200"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print Invoice
              </button>
            </div>
          </div>

          {/* Invoice Header Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {invoice.invoice_number}
                    </h1>
                    <p className="text-gray-600 font-medium">
                      Invoice for DO #{delivery_order.do_number}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold border ${getStatusColor(
                    invoice.status
                  )}`}
                >
                  <div className="w-2 h-2 rounded-full bg-current mr-2"></div>
                  {invoice.status.toUpperCase()}
                </span>
                <div className="mt-2 text-right">
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      summary.total_paid > 0
                        ? summary.total_paid
                        : invoice.net_amount
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overpayment Warning - Enhanced */}
        {invoiceContext.type === "adjusted_after_payment" && (
          <div
            className={`${invoiceContext.color} border-2 rounded-2xl p-6 mb-8 shadow-lg`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <svg
                    className={`w-6 h-6 ${invoiceContext.iconColor}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <h3
                  className={`text-xl font-bold ${invoiceContext.textColor} mb-2`}
                >
                  {invoiceContext.title}
                </h3>
                <p
                  className={`${invoiceContext.textColor} mb-4 leading-relaxed`}
                >
                  {invoiceContext.message}
                </p>
                <div className="bg-orange-100 border border-orange-200 rounded-xl px-4 py-3">
                  <p
                    className={`text-sm font-semibold ${invoiceContext.textColor}`}
                  >
                    <span className="font-bold">⚡ Action Required:</span>{" "}
                    {invoiceContext.action}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Invoice Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Invoice Information - Enhanced */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Invoice Information
                </h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Invoice Date
                </span>
                <span className="font-semibold text-gray-900">
                  {new Date(invoice.invoice_date).toLocaleDateString("id-ID")}
                </span>
              </div>
              {invoice.due_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Due Date
                  </span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">
                      {new Date(invoice.due_date).toLocaleDateString("id-ID")}
                    </span>
                    {new Date(invoice.due_date) < new Date() &&
                      invoice.status !== "paid" && (
                        <span className="block text-xs font-bold text-red-600 mt-1">
                          ⚠️ OVERDUE
                        </span>
                      )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Created
                </span>
                <span className="font-semibold text-gray-900">
                  {new Date(invoice.created_at).toLocaleDateString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Order Info - Enhanced */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Delivery Details
                </h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-500">
                  DO Number
                </span>
                <p className="font-semibold text-gray-900">
                  {delivery_order.do_number}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Customer
                </span>
                <p className="font-semibold text-gray-900">
                  {delivery_order.customer_name}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Item</span>
                <p className="font-semibold text-gray-900">
                  {delivery_order.item_name}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Quantity
                </span>
                <p className="font-semibold text-gray-900">
                  {formatQuantity(
                    delivery_order.minimal_load_quantity,
                    delivery_order.unit
                  )}{" "}
                  /
                  {formatQuantity(
                    delivery_order.actual_load_quantity,
                    delivery_order.unit
                  )}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Unit Price
                </span>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(delivery_order.unit_price)}
                </p>
              </div>
              {delivery_order.vehicle && (
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Vehicle
                  </span>
                  <p className="font-semibold text-gray-900">
                    🚛 {delivery_order.vehicle.license_plate} (
                    {delivery_order.vehicle.type})
                  </p>
                </div>
              )}
              {delivery_order.driver && (
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Driver
                  </span>
                  <p className="font-semibold text-gray-900">
                    👤{" "}
                    {delivery_order.driver.driverProfile?.full_name ||
                      delivery_order.driver.username}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Amount Breakdown - Enhanced */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Financial Summary
                </h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Invoice Amount
                </span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(invoice.invoice_amount)}
                  </span>
                  {invoice.invoice_amount === 0 && (
                    <span className="block text-xs text-orange-600 mt-1">
                      ⚠️ Adjusted to zero
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Total Paid
                </span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(summary.total_paid)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    {summary.remaining_amount < 0
                      ? "💰 Overpaid"
                      : "📋 Remaining"}
                  </span>
                  <span
                    className={`text-xl font-bold ${
                      summary.remaining_amount < 0
                        ? "text-orange-600"
                        : summary.remaining_amount === 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {summary.remaining_amount < 0
                      ? `+${formatCurrency(Math.abs(summary.remaining_amount))}`
                      : formatCurrency(summary.remaining_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section - Enhanced */}
        {invoice.notes && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mr-4">
                <svg
                  className="w-5 h-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-amber-900 mb-2">
                  📝 Notes
                </h3>
                <p className="text-amber-800 leading-relaxed">
                  {invoice.notes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment History - Enhanced */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Payment History
                </h3>
              </div>
              <span className="text-white bg-white bg-opacity-20 px-3 py-1 rounded-lg text-sm font-semibold">
                {payments.length} Payment{payments.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="p-6">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">
                  No payments recorded yet
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Payment history will appear here once payments are made
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-4 px-2 font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="text-left py-4 px-2 font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="text-left py-4 px-2 font-semibold text-gray-700">
                        Method
                      </th>
                      <th className="text-left py-4 px-2 font-semibold text-gray-700">
                        Reference
                      </th>
                      <th className="text-left py-4 px-2 font-semibold text-gray-700">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        className={`${
                          index % 2 === 0 ? "bg-gray-50" : "bg-white"
                        } hover:bg-blue-50 transition-colors duration-150`}
                      >
                        <td className="py-4 px-2">
                          <span className="font-medium text-gray-900">
                            {new Date(payment.payment_date).toLocaleDateString(
                              "id-ID"
                            )}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <span className="font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg">
                            {formatCurrency(payment.payment_amount)}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-800">
                            {payment.payment_type === "transfer" && "🏦"}
                            {payment.payment_type === "cash" && "💵"}
                            {payment.payment_type === "deposit" && "📁"}
                            <span className="ml-1 capitalize">
                              {payment.payment_type}
                            </span>
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {payment.payment_reference || "-"}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <span className="text-gray-700">
                            {payment.notes || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
