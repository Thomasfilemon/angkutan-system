import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../../api/axiosConfig";
import Select from "react-select";
import { paymentsApi } from "../../modules/payments/api";
import EditablePphCell from "../../modules/payments/components/EditablePphCell";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
);

interface POData {
  purchase_order: {
    id: number;
    po_number: string;
    customer_name: string;
    item_name: string;
    total_quantity: string;
    unit: string;
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
  metadata: {
    filters_available: {
      vehicles: {
        license_plate: string;
        type: string;
        display_name?: string;
      }[];
    };
  };
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: string;
  actual_load_quantity?: string;
  unit: string; // This is guaranteed by backend fallback
  unit_price: string; // Also seems guaranteed
  total_amount: string; // Also seems guaranteed
  payment_status: string;
  status: string;
  completed_at?: string;
  vehicle: {
    id: number;
    license_plate: string;
    type: string;
    capacity: string;
  };
  driver: {
    id: number;
    username: string;
    driverProfile: {
      full_name: string;
      phone: string;
    };
  };
  payments: Payment[];
  invoices: Invoice[];
  adjustments: any[]; // Add if needed
  calculated: {
    actualQuantity: number;
    grossIncome: number;
    operationalCosts: number;
    netProfit: number;
    profitMargin: number;
  };
  unit_info: {
    unit: string;
    po_unit: string;
    unit_mismatch: boolean;
    unit_display: string;
  };
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
  notes?: string;
}

interface GroupedInvoice extends Invoice {
  do_numbers: string[];
}

const POSpecificRitaseTable: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const [data, setData] = useState<POData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDOs, setSelectedDOs] = useState<number[]>([]);
  const navigate = useNavigate();
  const [allPOs, setAllPOs] = useState<
    { id: number; po_number: string; customer_name: string }[]
  >([]);
  const [bulkInvoiceLoading, setBulkInvoiceLoading] = useState(false);
  const [bulkInvoiceError, setBulkInvoiceError] = useState<string | null>(null);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showBulkInvoiceModal, setShowBulkInvoiceModal] = useState(false);
  const [viewingInvoiceDOs, setViewingInvoiceDOs] =
    useState<GroupedInvoice | null>(null);
  const [bulkInvoiceNumber, setBulkInvoiceNumber] = useState<string>("");
  const [bulkPphPercentage, setBulkPphPercentage] = useState<
    number | undefined
  >(undefined);
  const [bulkDueDate, setBulkDueDate] = useState<string>(""); // ISO date string, YYYY-MM-DD
  const [bulkNotes, setBulkNotes] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "deliveries" | "invoices" | "analytics"
  >("deliveries");
  const [vehicleOptions, setVehicleOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (poId) {
      fetchPOData();
    }
  }, [poId]);

  const fetchPOData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get("/ritase/purchase-orders/list");

      const response = await apiClient.get(
        `/ritase/purchase-orders/${poId}/comprehensive`
      );
      setAllPOs(res.data.data || []);
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch PO data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data?.metadata?.filters_available?.vehicles) {
      setVehicleOptions(
        data.metadata.filters_available.vehicles.map((v) => ({
          value: v.license_plate,
          label: v.display_name || `${v.license_plate} (${v.type})`,
        }))
      );
    }
  }, [data?.metadata]);

  const processedDOs = useMemo(() => {
    if (!data?.delivery_orders) return [];
    let filtered = data.delivery_orders;

    if (selectedVehicle) {
      filtered = filtered.filter(
        (do_) =>
          do_.vehicle.license_plate.toLowerCase() ===
          selectedVehicle.value.toLowerCase()
      );
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (do_) =>
          do_.do_number.toLowerCase().includes(lowerSearch) ||
          do_.customer_name.toLowerCase().includes(lowerSearch) ||
          do_.item_name.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [data, selectedVehicle, searchTerm]);

  const groupedInvoices = useMemo(() => {
    if (!data?.delivery_orders) return [];

    const invoiceMap = new Map<number, GroupedInvoice>();

    data.delivery_orders.forEach((do_) => {
      do_.invoices.forEach((invoice) => {
        if (invoiceMap.has(invoice.id)) {
          // Invoice already in map, just add the new DO number
          const existing = invoiceMap.get(invoice.id)!;
          if (!existing.do_numbers.includes(do_.do_number)) {
            existing.do_numbers.push(do_.do_number);
          }
        } else {
          // New invoice, add it to the map with its first DO number
          invoiceMap.set(invoice.id, {
            ...invoice,
            do_numbers: [do_.do_number],
          });
        }
      });
    });

    // Convert map to array and sort by date
    return Array.from(invoiceMap.values()).sort(
      (a, b) =>
        new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
    );
  }, [data]);

  const deliveryOrdersSummary = useMemo(() => {
    const totalAmount = processedDOs.reduce(
      (sum, do_) => sum + (parseFloat(do_.total_amount) || 0),
      0
    );
    return { totalAmount };
  }, [processedDOs]);

  const invoicesSummary = useMemo(() => {
    if (!groupedInvoices)
      return { totalInvoiced: 0, totalNetInvoiced: 0, count: 0 };

    const totalInvoiced = groupedInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.invoice_amount) || 0),
      0
    );

    const totalNetInvoiced = groupedInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.net_amount) || 0),
      0
    );

    return {
      totalInvoiced,
      totalNetInvoiced,
      count: groupedInvoices.length,
    };
  }, [groupedInvoices]);

  const paginatedDOs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedDOs.slice(start, start + itemsPerPage);
  }, [processedDOs, currentPage]);

  const totalPages = Math.ceil(processedDOs.length / itemsPerPage);

  const calculateVariance = () => {
    if (!data) return { quantity: 0, amount: 0, percentage: 0 };

    const targetQty = parseFloat(data.purchase_order.total_quantity);
    const actualQty = data.summary.total_quantity_delivered;
    const targetAmount = parseFloat(data.purchase_order.total_amount);
    const actualAmount = data.summary.total_revenue;

    return {
      quantity: actualQty - targetQty,
      amount: actualAmount - targetAmount,
      percentage:
        targetQty > 0 ? ((actualQty - targetQty) / targetQty) * 100 : 0,
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

  const handleCreateBulkInvoice = useCallback(async () => {
    if (selectedDOs.length < 2) {
      alert("Select at least 2 delivery orders to create a bulk invoice.");
      return;
    }
    setBulkInvoiceLoading(true);
    setBulkInvoiceError(null);

    try {
      const payload: {
        do_ids: number[];
        invoice_number?: string;
        pph_percentage?: number;
        due_date?: string;
        notes?: string;
      } = {
        do_ids: selectedDOs,
      };
      if (bulkInvoiceNumber.trim() !== "") {
        payload.invoice_number = bulkInvoiceNumber.trim();
      }
      if (bulkPphPercentage !== undefined && !isNaN(bulkPphPercentage)) {
        payload.pph_percentage = bulkPphPercentage;
      }
      if (bulkDueDate) {
        payload.due_date = bulkDueDate; // Should be ISO string (YYYY-MM-DD)
      }
      if (bulkNotes.trim() !== "") {
        payload.notes = bulkNotes.trim();
      }

      const response = await paymentsApi.createBulkInvoice(payload);

      if (response.data?.success) {
        alert(
          `Bulk invoice created: ${response.data.data.bulk_invoice_number}`
        );
        setShowBulkInvoiceModal(false);
        setSelectedDOs([]);
        // Clear bulk inputs
        setBulkInvoiceNumber("");
        setBulkPphPercentage(undefined);
        setBulkDueDate("");
        setBulkNotes("");
        // Refetch PO data for fresh invoices display
        fetchPOData();
      } else {
        setBulkInvoiceError(
          response.data.message || "Failed to create bulk invoice"
        );
      }
    } catch (err: any) {
      setBulkInvoiceError(
        err.response?.data?.message || "Bulk invoice creation failed."
      );
    } finally {
      setBulkInvoiceLoading(false);
    }
  }, [
    selectedDOs,
    bulkInvoiceNumber,
    bulkPphPercentage,
    bulkDueDate,
    bulkNotes,
    fetchPOData,
  ]);

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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const eligibleDOs = processedDOs
        .filter(
          (do_) => do_.invoices.length === 0 && do_.status === "completed"
        )
        .map((do_) => do_.id);
      setSelectedDOs(eligibleDOs);
    } else {
      setSelectedDOs([]);
    }
  };

  // Helper: Convert quantity to KG (adjust if kubik needs special handling)
  const convertToKg = (quantity: string, unit: string) => {
    const qty = parseFloat(quantity) || 0;
    switch (unit) {
      case "ton":
        return qty * 1000;
      case "kilogram":
        return qty;
      case "kubik":
        return qty;
      default:
        return qty;
    }
  };

  const handleExportExcel = () => {
    if (!data || !data.purchase_order || !processedDOs.length) {
      alert("No data to export!");
      return;
    }

    const po = data.purchase_order;
    const summary = data.summary;

    // --- SETUP ---
    const safeSheetName = (po.po_number || "Ritase")
      .replace(/[:\\/?*[\]]/g, "-")
      .substring(0, 31);

    const wb = XLSX.utils.book_new();
    let sheetData: any[][] = [];

    // --- SECTION 1: HEADER ---
    sheetData.push(["Laporan Ritase"]); // Title
    sheetData.push([]); // Spacer
    sheetData.push(["PO Number:", po.po_number]);
    sheetData.push(["Customer:", po.customer_name]);
    sheetData.push(["Item:", po.item_name]);
    sheetData.push([]); // Spacer

    // --- SECTION 2: DELIVERY ORDERS TABLE ---
    sheetData.push(["Rincian Delivery Order"]);
    const doHeaders = [
      "No",
      "Plat Mobil",
      "Tanggal Muat",
      "Muatan",
      "Quantity (KG)",
      "Harga/KG",
      "Total Pembayaran",
    ];
    sheetData.push(doHeaders);

    const dataRows = processedDOs.map((do_, index) => {
      const quantityKg = convertToKg(
        do_.actual_load_quantity || do_.minimal_load_quantity || "0",
        do_.unit || "ton"
      );
      const unitPrice = parseFloat(do_.unit_price || "0") || 0;
      const pricePerKg = do_.unit === "ton" ? unitPrice / 1000 : unitPrice;

      return [
        index + 1,
        do_.vehicle?.license_plate || "N/A",
        do_.completed_at
          ? new Date(do_.completed_at).toLocaleDateString("id-ID")
          : "N/A",
        do_.item_name || "N/A",
        quantityKg,
        pricePerKg,
        parseFloat(do_.total_amount || "0") || 0,
      ];
    });
    sheetData.push(...dataRows);

    // Calculate totals for the DO table
    const totalAngkutQtyKg = dataRows.reduce(
      (sum, row) => sum + (row[4] as number),
      0
    );
    const totalAngkutAmount = dataRows.reduce(
      (sum, row) => sum + (row[6] as number),
      0
    );

    sheetData.push([
      "",
      "",
      "",
      "TOTAL",
      totalAngkutQtyKg,
      "",
      totalAngkutAmount,
    ]);
    sheetData.push([]); // Spacer

    // --- SECTION 3: FINANCIAL SUMMARY ---
    sheetData.push(["Ringkasan Finansial"]);
    const allInvoices = processedDOs.flatMap((do_) => do_.invoices || []);
    const totalPph = allInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.pph_amount) || 0),
      0
    );
    const grandTotal = totalAngkutAmount - totalPph;
    const totalPaid = allInvoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.net_amount) || 0),
      0
    ); // Assuming net_amount is what's paid
    const sisaPembayaran = grandTotal - totalPaid;

    const summaryData = [
      ["Total Pendapatan (DO)", totalAngkutAmount],
      ["Total Potongan PPH", totalPph],
      ["Pendapatan Bersih (Setelah PPH)", grandTotal],
      ["Total Sudah Dibayar", totalPaid],
      ["Sisa Pembayaran", sisaPembayaran],
    ];
    sheetData.push(...summaryData);
    sheetData.push([]); // Spacer

    // --- SECTION 4: INVOICE DETAILS ---
    if (allInvoices.length > 0) {
      sheetData.push(["Rincian Invoice"]);
      const invoiceHeaders = [
        "Invoice Number",
        "Due Date",
        "PPH (%)",
        "PPH Amount",
        "Net Amount",
        "Notes",
      ];
      sheetData.push(invoiceHeaders);

      const invoiceRows = allInvoices.map((inv) => [
        inv.invoice_number || "N/A",
        inv.due_date
          ? new Date(inv.due_date).toLocaleDateString("id-ID")
          : "N/A",
        parseFloat(inv.pph_percentage || "0") || 0,
        parseFloat(inv.pph_amount || "0") || 0,
        parseFloat(inv.net_amount || "0") || 0,
        inv.notes || "",
      ]);
      sheetData.push(...invoiceRows);
    }

    // --- CREATE WORKSHEET AND APPLY STYLING ---
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Merging cells for titles
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Main Title
      { s: { r: 6, c: 0 }, e: { r: 6, c: 6 } }, // DO Title
      {
        s: { r: 10 + dataRows.length, c: 0 },
        e: { r: 10 + dataRows.length, c: 1 },
      }, // Financial Summary Title
      {
        s: { r: 17 + dataRows.length, c: 0 },
        e: { r: 17 + dataRows.length, c: 5 },
      }, // Invoice Title
    ];

    // Set column widths
    ws["!cols"] = [
      { wch: 5 }, // No
      { wch: 15 }, // Plat Mobil
      { wch: 15 }, // Tanggal Muat
      { wch: 20 }, // Muatan
      { wch: 15 }, // Quantity
      { wch: 15 }, // Harga
      { wch: 20 }, // Total
    ];

    // Apply cell styles (bolding, number formats)
    const currencyFormat = '"Rp" #,##0;\\-"Rp" #,##0';
    const kgFormat = '#,##0 "KG"';
    const percentFormat = "0.00%";

    for (let R = 0; R < sheetData.length; ++R) {
      for (let C = 0; C < sheetData[R].length; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellAddress]) continue;

        // Bold styles
        if (
          R === 0 ||
          R === 6 ||
          R === 7 ||
          R === 9 + dataRows.length ||
          R === 10 + dataRows.length ||
          R === 17 + dataRows.length ||
          R === 18 + dataRows.length
        ) {
          ws[cellAddress].s = { font: { bold: true } };
        }

        // Number formats
        if (C === 4 && R > 7 && R <= 8 + dataRows.length)
          ws[cellAddress].s = { ...ws[cellAddress].s, numFmt: kgFormat }; // Quantity
        if (C === 5 && R > 7 && R <= 8 + dataRows.length)
          ws[cellAddress].s = { ...ws[cellAddress].s, numFmt: currencyFormat }; // Harga/KG
        if (C === 6 && R > 7 && R <= 8 + dataRows.length)
          ws[cellAddress].s = { ...ws[cellAddress].s, numFmt: currencyFormat }; // Total Pembayaran
        if (C === 1 && R >= 11 + dataRows.length && R <= 15 + dataRows.length)
          ws[cellAddress].s = { ...ws[cellAddress].s, numFmt: currencyFormat }; // Financial Summary Amounts
        if (C === 2 && R >= 19 + dataRows.length)
          ws[cellAddress].s = { ...ws[cellAddress].s, numFmt: percentFormat }; // PPH %
        if ((C === 3 || C === 4) && R >= 19 + dataRows.length)
          ws[cellAddress].s = { ...ws[cellAddress].s, numFmt: currencyFormat }; // Invoice Amounts
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    XLSX.writeFile(wb, `Laporan Ritase - ${safeSheetName}.xlsx`);
  };

  // Analytics Charts Data
  const pieData = {
    labels: ["Completed", "Pending", "Outstanding"],
    datasets: [
      {
        data: [
          data?.summary.completed_dos ?? 0,
          data?.summary.pending_dos ?? 0,
          data?.summary.outstanding_payments ?? 0,
        ],
        backgroundColor: ["#10B981", "#3B82F6", "#EF4444"],
      },
    ],
  };

  const barData = {
    labels: ["Revenue", "Costs", "Profit"],
    datasets: [
      {
        label: "Financials",
        data: [
          data?.summary.total_revenue ?? 0,
          data?.summary.total_operational_costs ?? 0,
          data?.summary.total_net_profit ?? 0,
        ],
        backgroundColor: ["#10B981", "#F59E0B", "#3B82F6"],
      },
    ],
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={() => navigate("/ritase/comprehensive")}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-sm"
          >
            ← Back
          </button>
          {allPOs.length > 0 && (
            <select
              value={poId}
              onChange={(e) => navigate(`/ritase/po/${e.target.value}/table`)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-auto"
            >
              {allPOs.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_number} - {po.customer_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {/* 🎯 SECTION 1: PO Summary Header (Improved layout) */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PO Info */}
          <div className="md:col-span-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2 sm:mb-0">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block">Customer:</span>
                <p className="font-medium">{po.customer_name}</p>
              </div>
              <div>
                <span className="text-gray-500 block">Item:</span>
                <p className="font-medium">{po.item_name}</p>
              </div>
              <div>
                <span className="text-gray-500 block">Load Location:</span>
                <p className="font-medium">{po.load_location}</p>
              </div>
              <div>
                <span className="text-gray-500 block">Unload Location:</span>
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
                  {po.unit}
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
      {/* 🎯 SECTION 2: Navigation Tabs (Improved styling) */}
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
                count: invoicesSummary.count,
              },
              { key: "analytics", label: "Analytics", count: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
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
      {/* Deliveries Tab (Improved with search and pagination) */}
      {activeTab === "deliveries" && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Action Bar with search */}
          <div className="bg-gray-50 px-6 py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <div>
                <h3 className="text-lg font-medium">
                  Delivery Orders ({processedDOs.length})
                </h3>
                <p className="text-sm text-green-600 font-semibold">
                  Total: Rp{" "}
                  {deliveryOrdersSummary.totalAmount.toLocaleString("id-ID")}
                </p>
              </div>
              {selectedDOs.length > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedDOs.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 items-start sm:items-center w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search DO, customer, item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
              />
              <Select
                options={vehicleOptions}
                value={selectedVehicle}
                onChange={setSelectedVehicle}
                placeholder="Filter by Vehicle"
                isClearable
                className="w-full sm:w-48"
                classNamePrefix="select"
              />
              {selectedDOs.length > 1 && (
                <button
                  onClick={() => setShowBulkInvoiceModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm w-full sm:w-auto"
                >
                  Create Bulk Invoice
                </button>
              )}
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm w-full sm:w-auto"
              >
                Export to Excel
              </button>
            </div>
          </div>

          {/* DO Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      onChange={handleSelectAll}
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
                {paginatedDOs.map((do_) => (
                  <tr
                    key={do_.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        checked={selectedDOs.includes(do_.id)}
                        onChange={() => handleDOSelection(do_.id)}
                        disabled={
                          do_.invoices.length > 0 || do_.status !== "completed"
                        }
                        title={
                          do_.invoices.length > 0
                            ? "Sudah ada invoice, tidak bisa di-select untuk bulk"
                            : ""
                        }
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
                          {new Date(do_.completed_at).toLocaleDateString(
                            "id-ID"
                          )}
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
                            {parseFloat(
                              do_.actual_load_quantity
                            ).toLocaleString("id-ID")}{" "}
                            {do_.unit}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        Rp{" "}
                        {parseFloat(do_.total_amount).toLocaleString("id-ID")}
                      </div>
                      <div className="text-xs text-gray-500">
                        @ Rp{" "}
                        {parseFloat(do_.unit_price).toLocaleString("id-ID")}/
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
                        <span className="text-xs text-gray-400">
                          No invoice
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <Link
                        to={`/ritase/delivery-orders/${do_.id}/payment`}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-semibold transition-colors"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t flex justify-between items-center text-sm">
            <p>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, processedDOs.length)} of{" "}
              {processedDOs.length} entries
            </p>
            <div className="space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Invoices Tab (Improved with sorting) */}
      {activeTab === "invoices" && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium">
              All Invoices ({invoicesSummary.count})
            </h3>
            {/* --- NEW: Display total amounts for invoices --- */}
            <div className="flex space-x-6 text-sm mt-2">
              <div className="text-gray-600">
                Total Invoiced:
                <span className="font-semibold text-gray-800 ml-2">
                  Rp {invoicesSummary.totalInvoiced.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-green-600">
                Total Net (after PPH):
                <span className="font-semibold text-green-700 ml-2">
                  Rp {invoicesSummary.totalNetInvoiced.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                {groupedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    {/* --- MODIFIED: DO Number column with click logic --- */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {invoice.do_numbers.length > 1 ? (
                        <button
                          onClick={() => setViewingInvoiceDOs(invoice)}
                          className="text-blue-600 hover:underline text-left"
                          title="Click to see all DO numbers"
                        >
                          {invoice.do_numbers[0]}
                          <span className="text-xs font-normal ml-1 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            +{invoice.do_numbers.length - 1} more
                          </span>
                        </button>
                      ) : (
                        <span>{invoice.do_numbers[0] || "N/A"}</span>
                      )}
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Analytics Tab (Improved with charts) */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Completion Progress */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Progress Overview</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Quantity Progress</span>
                  <span>{summary.completion_percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
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
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full"
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
            <div className="mt-6">
              <Pie
                data={pieData}
                options={{
                  responsive: true,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-white shadow-md rounded-lg p-6">
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
            <div className="mt-6">
              <Bar
                data={barData}
                options={{
                  responsive: true,
                  indexAxis: "y" as const,
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
          </div>
        </div>
      )}
      {viewingInvoiceDOs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Delivery Orders for Invoice:
              <br />
              <span className="font-bold text-blue-600">
                {viewingInvoiceDOs.invoice_number}
              </span>
            </h3>
            <ul className="list-disc list-inside max-h-60 overflow-y-auto bg-gray-50 p-4 rounded-md border">
              {viewingInvoiceDOs.do_numbers.map((doNumber, index) => (
                <li key={index} className="text-gray-800 py-1">
                  {doNumber}
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewingInvoiceDOs(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">Create Bulk Invoice</h3>

            <p className="mb-4">
              Creating invoices for <strong>{selectedDOs.length}</strong>{" "}
              delivery order
              {selectedDOs.length > 1 ? "s" : ""}.
            </p>

            <label className="block mb-2 text-sm font-medium text-gray-700">
              Invoice Number (optional)
            </label>
            <input
              type="text"
              value={bulkInvoiceNumber}
              onChange={(e) => setBulkInvoiceNumber(e.target.value)}
              placeholder="Auto-generated if empty"
              className="mb-4 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <label className="block mb-2 text-sm font-medium text-gray-700">
              PPH (%) (optional)
            </label>
            <input
              type="number"
              value={bulkPphPercentage !== undefined ? bulkPphPercentage : ""}
              onChange={(e) => {
                const val = e.target.value;
                setBulkPphPercentage(val ? Number(val) : undefined);
              }}
              placeholder="Leave empty for default"
              min={0}
              step={0.01}
              className="mb-4 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <label className="block mb-2 text-sm font-medium text-gray-700">
              Due Date (optional)
            </label>
            <input
              type="date"
              value={bulkDueDate}
              onChange={(e) => setBulkDueDate(e.target.value)}
              className="mb-4 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <label className="block mb-2 text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="Add any notes for the bulk invoice"
              rows={3}
              className="mb-4 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {bulkInvoiceError && (
              <div className="mb-4 text-sm text-red-600 font-medium">
                {bulkInvoiceError}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkInvoiceModal(false)}
                disabled={bulkInvoiceLoading}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBulkInvoice}
                disabled={bulkInvoiceLoading}
                className={`px-4 py-2 rounded text-white ${
                  bulkInvoiceLoading
                    ? "bg-purple-300"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {bulkInvoiceLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSpecificRitaseTable;
