import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";
import { createRecap, listRecaps, addItemToRecap } from "../api/recapApi";
import { createStockUsage, CreateStockUsagePayload } from "../api/stockUsageApi";

interface CashCategory {
  id: number;
  category_name: string;
  category_type: "income" | "expense";
  description?: string;
}

interface CashTransaction {
  id: number;
  transaction_type: "debit" | "kredit" | "debit_tempo" | "kredit_tempo";
  category_id?: number;
  amount: number;
  description: string;
  reference_number?: string;
  transaction_date: string;
  created_at: string;
  running_balance?: number;
  category?: CashCategory;
  account: string;
  attachment_urls?: Array<string>;
  no_nota?: string[];
  date_nota?: string[];
  supplier?: string | null;
  tanggal_jatuh_tempo?: string;
  last_edited_by?: string;
  last_edited_at?: string;
  // Synthetic summary row fields
  is_summary?: boolean;
  total_debit?: number;
  total_kredit?: number;
  saldo?: number;
}

interface RekapanTransaction extends CashTransaction {
  parsedDetails?: {
    mainDescription: string;
    transactions: Array<{
      id: number;
      type: string;
      description: string;
      amount: number;
      supplier?: string;
    }>;
  };
}

interface CashSummary {
  total_debit: number;
  total_kredit: number;
  total_debit_tempo?: number;
  total_kredit_tempo?: number;
  saldo: number;
}

const CashManagementPage = () => {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [categories, setCategories] = useState<CashCategory[]>([]);
  const [summary, setSummary] = useState<CashSummary>({
    total_debit: 0,
    total_kredit: 0,
    saldo: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpecialCategory, setIsSpecialCategory] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    transaction_type: "",
    category_id: "",
    date_from: "",
    date_to: "",
    search: "",
    account: "", // Changed: account is now required, starts empty
    supplier: "",
    item_name: "",
    payment_type: "all", // New: filter for cash/tempo/all
  });
  const [selectedAccount, setSelectedAccount] = useState<string>(""); // New: track selected account for display

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [showModal, setShowModal] = useState(false);
  const [showTransactionTypeModal, setShowTransactionTypeModal] =
    useState(false);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [selectedNotaDetails, setSelectedNotaDetails] =
    useState<CashTransaction | null>(null);
  const [showRekapanModal, setShowRekapanModal] = useState(false);
  const [selectedRekapan, setSelectedRekapan] = useState<RekapanTransaction | null>(null);
  const [selectedTransactionType, setSelectedTransactionType] = useState("");
  const [editingTransaction, setEditingTransaction] =
    useState<CashTransaction | null>(null);
  const [formData, setFormData] = useState({
    transaction_type: "debit" as "debit" | "kredit" | "debit_tempo" | "kredit_tempo",
    category_id: "",
    amount: "",
    description: "",
    reference_number: "",
    account: "General",
    transaction_date: new Date().toISOString().split("T")[0],
    no_nota: [""] as string[],
    date_nota: [""] as string[],
    supplier: "",
    tanggal_jatuh_tempo: "",
  });
  
  // Additional fields for kas biasa item details (form fields)
  const [formItemName, setFormItemName] = useState("");
  const [formItemUnit, setFormItemUnit] = useState("Pcs");
  const [formItemMerk, setFormItemMerk] = useState("");
  const [formItemQty, setFormItemQty] = useState("");
  const [formItemUnitPrice, setFormItemUnitPrice] = useState("");

  const [accounts, setAccounts] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // Debounced search input to avoid immediate refresh/fetch
  const [searchInput, setSearchInput] = useState<string>("");
  const [supplierInput, setSupplierInput] = useState<string>("");
  const [typeInput, setTypeInput] = useState<string>("");
  const [categoryInput, setCategoryInput] = useState<string>("");
  const [dateFromInput, setDateFromInput] = useState<string>("");
  const [dateToInput, setDateToInput] = useState<string>("");
  const [accountInput, setAccountInput] = useState<string>("");
  const [itemNameInput, setItemNameInput] = useState<string>("");
  const [matchNotice, setMatchNotice] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [itemEditorTransaction, setItemEditorTransaction] = useState<CashTransaction | null>(null);
  const [itemRows, setItemRows] = useState<Array<{ id: number; type: string; description: string; supplier?: string; amount: number }>>([]);

  // Meta-only editor (no change to description/items)
  const [showMetaEditor, setShowMetaEditor] = useState(false);
  const [metaEditorTransaction, setMetaEditorTransaction] = useState<CashTransaction | null>(null);
  const [metaForm, setMetaForm] = useState({
    supplier: "",
    reference_number: "",
    account: "General",
    transaction_date: new Date().toISOString().split("T")[0],
    date_nota: "",
    tanggal_jatuh_tempo: "",
  });
  useEffect(() => {
    setSearchInput(filters.search || "");
    setSupplierInput(filters.supplier || "");
    setTypeInput(filters.transaction_type || "");
    setCategoryInput(filters.category_id || "");
    setDateFromInput(filters.date_from || "");
    setDateToInput(filters.date_to || "");
    setAccountInput(filters.account || "");
    setItemNameInput((filters as any).item_name || "");
  }, []);
  // Manual search trigger via button (no debounce)

  // Read account from URL params and set it
  useEffect(() => {
    const accountFromUrl = searchParams.get("account");
    if (accountFromUrl) {
      setFilters((prev) => ({ ...prev, account: accountFromUrl }));
      setSelectedAccount(accountFromUrl);
      setAccountInput(accountFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await apiClient.get("/cash/accounts");
        setAccounts(response.data.data || []);
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      alert("Nama akun tidak boleh kosong!");
      return;
    }

    // Validate account name (max 20 chars, no special characters)
    if (newAccountName.length > 20) {
      alert("Nama akun maksimal 20 karakter!");
      return;
    }

    // Check if account already exists
    if (accounts.includes(newAccountName.trim())) {
      alert("Akun dengan nama tersebut sudah ada!");
      return;
    }

    try {
      const transactionDate = new Date().toISOString().split("T")[0];
      const accountName = newAccountName.trim();

      // Create two transactions: debit 0.01 and kredit 0.01 to register the account
      // This ensures the account stays in the list even if one transaction is deleted
      // Net balance = 0, so it won't affect financial calculations

      // Create debit transaction
      const debitPayload = {
        transaction_type: "debit",
        category_id: "",
        amount: "0.01",
        description: "Inisialisasi Akun",
        reference_number: "",
        transaction_date: transactionDate,
        account: accountName,
        no_nota: [""],
        date_nota: [""],
      };

      const debitFormData = new FormData();
      Object.entries(debitPayload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v)) {
            debitFormData.append(k, JSON.stringify(v));
          } else {
            debitFormData.append(k, v.toString());
          }
        }
      });

      // Create kredit transaction
      const kreditPayload = {
        transaction_type: "kredit",
        category_id: "",
        amount: "0.01",
        description: "Inisialisasi Akun",
        reference_number: "",
        transaction_date: transactionDate,
        account: accountName,
        no_nota: [""],
        date_nota: [""],
      };

      const kreditFormData = new FormData();
      Object.entries(kreditPayload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v)) {
            kreditFormData.append(k, JSON.stringify(v));
          } else {
            kreditFormData.append(k, v.toString());
          }
        }
      });

      // Create both transactions
      await apiClient.post("/cash/transactions", debitFormData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await apiClient.post("/cash/transactions", kreditFormData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Refresh accounts list
      const accountsResponse = await apiClient.get("/cash/accounts");
      const accountsList = accountsResponse.data?.data || accountsResponse.data || [];
      setAccounts(accountsList);
      
      setNewAccountName("");
      setShowCreateAccountModal(false);
      alert("Akun berhasil dibuat!");
    } catch (err: any) {
      console.error("Failed to create account:", err);
      console.error("Error details:", err.response?.data);
      alert("Gagal membuat akun: " + (err?.response?.data?.message || err.message));
    }
  };

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const [showDescModal, setShowDescModal] = useState(false);
  const [currentDesc, setCurrentDesc] = useState("");
  const [currentDescTotal, setCurrentDescTotal] = useState<number | null>(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  // INLINE Kas Composer state (no popup)
  const [recapNumber, setRecapNumber] = useState("");
  const [composerType, setComposerType] = useState("stock_usage"); // stock_usage | stock_add | tire_purchase | service | cash_normal
  const [isTempo, setIsTempo] = useState(false);
  const [composerAccount, setComposerAccount] = useState("General");
  const [composerSupplier, setComposerSupplier] = useState("");
  const [composerDueDate, setComposerDueDate] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("Pcs");
  const [itemQty, setItemQty] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashDesc, setCashDesc] = useState<string>("");

  const ensureRecapNumber = useCallback(async () => {
    const manual = recapNumber.trim();
    if (manual !== "") {
      // Try to ensure it exists by creating with specified number if needed
      try {
        const res = await listRecaps({ page: 1, limit: 1, search: manual });
        const found = (res?.data || []).find((r: any) => r.recap_number === manual);
        if (found) return manual;
      } catch {}
      try {
        const created = await createRecap({ payment_mode: isTempo ? "tempo" : "cash", recap_number: manual });
        setRecapNumber(created.recap_number);
        return created.recap_number;
      } catch (e) {
        // If server rejects manual number, fall back to auto
      }
    }
    // Auto-create recap (default mode based on isTempo)
    try {
      const res = await createRecap({ payment_mode: isTempo ? "tempo" : "cash" });
      setRecapNumber(res.recap_number);
      toast.success(`Recap dibuat: ${res.recap_number}`);
      return res.recap_number;
    } catch (e) {
      toast.error("Gagal membuat recap");
      throw e;
    }
  }, [recapNumber, isTempo]);

  const submitStockUsageRow = useCallback(async () => {
    if (!vehicleId) {
      toast.error("Vehicle ID wajib diisi");
      return;
    }
    const qty = parseFloat(itemQty || "0");
    if (!(qty > 0)) {
      toast.error("Qty harus > 0");
      return;
    }
    const recapNo = await ensureRecapNumber();
    const payload: CreateStockUsagePayload = {
      vehicle_id: parseInt(vehicleId, 10),
      usage_date: new Date().toISOString().split("T")[0],
      notes: `Composer entry: ${itemName || "Item"}`,
      items: [
        {
          item_name: itemName || "Item",
          unit: itemUnit,
          quantity: qty,
        },
      ],
      recap_number: recapNo,
      cash_options: {
        create_cash: true,
        is_tempo: isTempo,
        account: composerAccount,
        supplier: composerSupplier || undefined,
        due_date: isTempo ? composerDueDate || undefined : undefined,
      },
    };
    await createStockUsage(payload);
    toast.success("Stok langsung digunakan berhasil disimpan");
    // Clear item fields for next row
    setItemName("");
    setItemQty("");
  }, [vehicleId, itemName, itemUnit, itemQty, ensureRecapNumber, isTempo, composerAccount, composerSupplier, composerDueDate]);

  const fetchTransactions = useCallback(async () => {
    // Don't fetch if no account is selected
    if (!filters.account) {
      setLoading(false);
      setTransactions([]);
      setSummary({ total_debit: 0, total_kredit: 0, saldo: 0 });
      setPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    try {
      setLoading(true);
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      
      // Fetch both cash and tempo transactions based on payment_type filter
      const { payment_type, ...otherFilters } = filters;
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(otherFilters).filter(([_, v]) => v !== "" && v !== "all")
        ),
      });

      let allTransactions: CashTransaction[] = [];
      let combinedSummary: CashSummary = { total_debit: 0, total_kredit: 0, saldo: 0 };
      let totalCount = 0;

      // Fetch cash transactions if payment_type is "all" or "cash"
      if (payment_type === "all" || payment_type === "cash") {
        const cashResponse = await apiClient.get(`/cash/transactions?${params}`, { signal: controller.signal });
        const cashData = cashResponse.data.data || [];
        allTransactions = [...allTransactions, ...cashData];
        if (cashResponse.data.summary) {
          combinedSummary.total_debit += cashResponse.data.summary.total_debit || 0;
          combinedSummary.total_kredit += cashResponse.data.summary.total_kredit || 0;
        }
        totalCount += cashResponse.data.pagination?.total || 0;
      }

      // Fetch tempo transactions if payment_type is "all" or "tempo"
      if (payment_type === "all" || payment_type === "tempo") {
        const tempoResponse = await apiClient.get(`/cash/tempo-transactions?${params}`, { signal: controller.signal });
        const tempoData = tempoResponse.data.data || [];
        allTransactions = [...allTransactions, ...tempoData];
        if (tempoResponse.data.summary) {
          combinedSummary.total_debit_tempo = (combinedSummary.total_debit_tempo || 0) + (tempoResponse.data.summary.total_debit_tempo || 0);
          combinedSummary.total_kredit_tempo = (combinedSummary.total_kredit_tempo || 0) + (tempoResponse.data.summary.total_kredit_tempo || 0);
        }
        totalCount += tempoResponse.data.pagination?.total || 0;
      }

      // Sort by created_at descending
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate combined saldo
      combinedSummary.saldo = combinedSummary.total_debit + (combinedSummary.total_debit_tempo || 0) - combinedSummary.total_kredit - (combinedSummary.total_kredit_tempo || 0);

      setTransactions(allTransactions);
      setSummary(combinedSummary);
      setPagination((prev) => ({
        ...prev,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pagination.limit),
      }));
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setError("Failed to fetch transactions.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get("/cash/categories");
      setCategories(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, [fetchTransactions, fetchCategories]);

  // Build a small notice showing how many matches exist for current search terms
  useEffect(() => {
    const term = (searchInput || "").trim();
    const itemTerm = (itemNameInput || "").trim();
    if ((!term && !itemTerm) || transactions.length === 0) {
      setMatchNotice("");
      return;
    }
    const toLower = (s: string) => (s || "").toLowerCase();
    const t = toLower(term);
    const it = toLower(itemTerm);
    const count = transactions.filter((tr) => {
      const desc = toLower(tr.description || "");
      const ref = toLower(tr.reference_number || "");
      let ok = false;
      if (t) ok = ok || desc.includes(t) || ref.includes(t);
      if (it) ok = ok || desc.includes(it) || ref.includes(it);
      return ok;
    }).length;
    if (count > 0) {
      const parts: string[] = [];
      if (term) parts.push(`"${term}"`);
      if (itemTerm) parts.push(`"${itemTerm}"`);
      setMatchNotice(`Ditemukan ${count} transaksi yang memuat ${parts.join(" & ")}. Klik No. Nota/Deskripsi untuk melihat detail.`);
    } else {
      setMatchNotice("");
    }
  }, [transactions, searchInput, itemNameInput]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file) => handleAddFile(file));
    }
  };

  const handleAddFile = (file: File) => {
    setAttachmentFiles((prev) => [...prev, file]);
    setFormData((prev) => ({
      ...prev,
      no_nota: [...prev.no_nota, ""],
      date_nota: [...prev.date_nota, ""],
    }));
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...attachmentFiles];
    newFiles.splice(index, 1);
    setAttachmentFiles(newFiles);

    const newNotas = [...formData.no_nota];
    newNotas.splice(index, 1);
    const newDateNotas = [...formData.date_nota];
    newDateNotas.splice(index, 1);
    setFormData((prev) => ({
      ...prev,
      no_nota: newNotas,
      date_nota: newDateNotas,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSpecialCategory) {
      setShowModal(false);
      if (formData.category_id === "inventory_redirect") {
        navigate("/inventory/purchase");
      } else {
        navigate("/services");
      }
      return;
    }

    // Calculate amount from qty * unitPrice if both are provided, otherwise use manual amount
    let calculatedAmount = parseFloat(formData.amount || "0");
    if (formItemQty && formItemUnitPrice) {
      const qty = parseFloat(formItemQty);
      const unitPrice = parseFloat(formItemUnitPrice);
      if (qty > 0 && unitPrice >= 0) {
        calculatedAmount = qty * unitPrice;
      }
    }
    
    if (!(calculatedAmount > 0)) {
      toast.error("Jumlah kas wajib (isi Qty × Harga Satuan atau Jumlah manual)");
      return;
    }

    const submissionData = new FormData();

    // Build description with item details as JSON if item details exist
    let finalDescription = formData.description;
    if (formItemName || formItemUnit || formItemMerk || formItemQty || formItemUnitPrice) {
      const itemDetails: any = {};
      if (formItemName) itemDetails.itemName = formItemName;
      if (formItemUnit) itemDetails.unit = formItemUnit;
      if (formItemMerk) itemDetails.merk = formItemMerk;
      if (formItemQty) itemDetails.qty = formItemQty;
      if (formItemUnitPrice) itemDetails.unitPrice = formItemUnitPrice;
      
      // Store as JSON in description, with human-readable description as fallback
      finalDescription = JSON.stringify({
        type: "kas_biasa_item",
        description: formData.description || `${formItemName || 'Item'} - ${formItemQty || 0} ${formItemUnit || 'Pcs'}`,
        itemDetails: itemDetails
      });
    }

    submissionData.append("transaction_type", formData.transaction_type);
    if (formData.category_id) submissionData.append("category_id", formData.category_id);
    submissionData.append("amount", calculatedAmount.toString());
    submissionData.append("description", finalDescription);
    
    // Use formItemName as reference_number if provided
    if (formItemName) {
      submissionData.append("reference_number", formItemName);
    } else if (formData.reference_number) {
      submissionData.append("reference_number", formData.reference_number);
    }
    
    submissionData.append("transaction_date", formData.transaction_date);
    submissionData.append("account", formData.account);
    submissionData.append("no_nota", JSON.stringify(formData.no_nota));
    submissionData.append("date_nota", JSON.stringify(formData.date_nota));
    if (formData.supplier) {
      submissionData.append("supplier", formData.supplier);
    }
    if (formData.tanggal_jatuh_tempo) {
      submissionData.append("tanggal_jatuh_tempo", formData.tanggal_jatuh_tempo);
    }

    attachmentFiles.forEach((file) => {
      submissionData.append("attachments", file);
    });

    try {
      const config = {
        headers: { "Content-Type": "multipart/form-data" },
      };

      let res;
      if (editingTransaction) {
        res = await apiClient.put(
          `/cash/transactions/${editingTransaction.id}`,
          submissionData,
          config
        );
      } else {
        res = await apiClient.post(
          "/cash/transactions",
          submissionData,
          config
        );
      }

      setShowModal(false);
      const returned = res?.data?.data || res?.data;
      if (returned?.last_edited_by) {
        toast.success("Transaksi berhasil disimpan");
        toast(`Diubah oleh ${returned.last_edited_by}`);
      } else {
        toast.success("Transaksi berhasil disimpan");
      }
      
      // Reset form fields
      resetForm();
      fetchTransactions();
    } catch (err) {
      console.error("Error saving transaction:", err);
      setError("Failed to save transaction.");
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, category_id: value }));
    setIsSpecialCategory(
      value === "inventory_redirect" || value === "service_redirect"
    );
  };

  const handleEdit = (transaction: CashTransaction) => {
    setEditingTransaction(transaction);
    
    // Parse item details from description if it's a kas_biasa_item
    let parsedDescription = transaction.description;
    let parsedItemDetails: any = {};
    try {
      const parsed = JSON.parse(transaction.description);
      if (parsed.type === "kas_biasa_item" && parsed.itemDetails) {
        parsedItemDetails = parsed.itemDetails;
        parsedDescription = parsed.description || transaction.description;
      }
    } catch (e) {
      // Not JSON, use as is
    }
    
    setFormData({
      transaction_type: transaction.transaction_type,
      category_id: transaction.category_id?.toString() || "",
      amount: transaction.amount.toString(),
      description: parsedDescription,
      reference_number: transaction.reference_number || "",
      transaction_date: transaction.transaction_date,
      account: transaction.account || "General",
      no_nota:
        Array.isArray(transaction.no_nota) && transaction.no_nota.length > 0
          ? transaction.no_nota
          : [""],
      date_nota:
        Array.isArray(transaction.date_nota) && transaction.date_nota.length > 0
          ? transaction.date_nota
          : [""],
      supplier: transaction.supplier || "",
      tanggal_jatuh_tempo: transaction.tanggal_jatuh_tempo || "",
    });
    
    // Set item details fields if they exist
    setFormItemName(parsedItemDetails.itemName || transaction.reference_number || "");
    setFormItemUnit(parsedItemDetails.unit || "Pcs");
    setFormItemMerk(parsedItemDetails.merk || "");
    setFormItemQty(parsedItemDetails.qty || "");
    setFormItemUnitPrice(parsedItemDetails.unitPrice || "");
    
    setAttachmentFiles([]);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
      return;
    }

    try {
      await apiClient.delete(`/cash/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      console.error("Error deleting transaction:", err);
      setError("Failed to delete transaction.");
    }
  };

  const handleShowNotaDetails = (transaction: CashTransaction) => {
    setSelectedNotaDetails(transaction);
    setShowNotaModal(true);
  };

  // Function to parse rekapan details from description field
  const parseRekapanDetails = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      if (parsed.transactionDetails) {
        return {
          mainDescription: "Rekapan Nota",
          transactions: parsed.transactionDetails
        };
      }
    } catch (e) {
      // Fallback to old format if JSON parsing fails
    }

    // Try to parse Pelunasan text block that contains 'Detail Transaksi'
    const detailsIdx = description ? description.indexOf("Detail Transaksi") : -1;
    if (detailsIdx !== -1) {
      const section = description.slice(detailsIdx).split(/\r?\n/);
      const items: Array<{ id: number; type: string; description: string; amount: number; supplier?: string }> = [];
      let lineNo = 0;
      for (const raw of section) {
        const line = (raw || "").trim();
        if (!line.startsWith("-")) continue;
        // Extract amount (Rp 1.000.000,00 or Rp 1.000.000)
        const amountMatch = line.match(/Rp\s*([0-9\.\,]+)/i);
        const supplierMatch = line.match(/Supplier:\s*([^\)]+)/i);
        let amount = 0;
        if (amountMatch) {
          const num = amountMatch[1].replace(/\./g, "").replace(/,/g, ".");
          const parsed = parseFloat(num);
          if (!isNaN(parsed)) amount = parsed;
        }
        // Remove prefix '-' and amount and supplier to get description
        let descText = line.replace(/^-+\s*/, "");
        if (amountMatch) {
          descText = descText.replace(amountMatch[0], "").trim();
        }
        if (supplierMatch) {
          descText = descText.replace(supplierMatch[0], "").trim();
        }
        // Extract a 'type' prefix if present before ':'
        let type = "Item";
        const typeMatch = descText.match(/^([^:]+):\s*(.*)$/);
        if (typeMatch) {
          type = typeMatch[1].trim();
          descText = typeMatch[2].trim();
        }
        items.push({
          id: ++lineNo,
          type,
          description: descText,
          amount,
          supplier: supplierMatch ? supplierMatch[1].trim() : undefined,
        });
      }
      return {
        mainDescription: "Pelunasan",
        transactions: items,
      };
    }

    // Fallback: return empty structure
    return {
      mainDescription: "Rekapan Nota",
      transactions: []
    };
  };

  // Function to show rekapan details
  const handleShowRekapanDetails = (transaction: CashTransaction) => {
    const details = parseRekapanDetails(transaction.description || '');
    const rekapanTransaction: RekapanTransaction = {
      ...transaction,
      parsedDetails: details
    };
    setSelectedRekapan(rekapanTransaction);
    setShowRekapanModal(true);
  };

  const isRekapan = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      return !!parsed.transactionDetails;
    } catch (e) {
      return false;
    }
  }

  const isSettlementText = (description: string) => {
    if (!description) return false;
    return /Pelunasan/i.test(description) && /Detail Transaksi/i.test(description);
  }
  const formatIDR = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
  const openItemEditor = (txn: CashTransaction) => {
    const details = parseRekapanDetails(txn.description || '');
    const rows = (details.transactions || []).map((t: any, idx: number) => ({
      id: idx + 1,
      type: String(t.type || 'Item'),
      description: String(t.description || ''),
      supplier: t.supplier ? String(t.supplier) : undefined,
      amount: Number(t.amount || 0),
    }));
    setItemRows(rows);
    setItemEditorTransaction(txn);
    setShowItemEditor(true);
  };

  const openMetaEditor = (txn: CashTransaction) => {
    setMetaEditorTransaction(txn);
    setMetaForm({
      supplier: txn.supplier || "",
      reference_number: txn.reference_number || "",
      account: txn.account || "General",
      transaction_date: txn.transaction_date,
      date_nota:
        Array.isArray(txn.date_nota) && txn.date_nota.length > 0
          ? txn.date_nota[0]
          : "",
      tanggal_jatuh_tempo: txn.tanggal_jatuh_tempo || "",
    });
    setShowMetaEditor(true);
  };
  const saveItemEditor = async () => {
    if (!itemEditorTransaction) return;
    const total = itemRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const isSettle = isSettlementText(itemEditorTransaction.description || '');
    try {
      if (isSettle) {
        const lines = [
          'Pelunasan:',
          'Detail Transaksi:',
          ...itemRows.map(r => {
            const tail = `${formatIDR(r.amount)}${r.supplier ? ` (Supplier: ${r.supplier})` : ''}`;
            return `- ${r.type}: ${r.description} - ${tail}`;
          }),
          `Total Item: ${formatIDR(total)}`,
        ];
        await apiClient.put(`/cash/transactions/${itemEditorTransaction.id}`, {
          description: lines.join('\n'),
          amount: total,
        });
      } else {
        const payload = {
          transactionDetails: itemRows.map((r, idx) => ({
            id: idx + 1,
            type: r.type,
            description: r.description,
            amount: r.amount,
            supplier: r.supplier || undefined,
          })),
        };
        await apiClient.put(`/cash/transactions/${itemEditorTransaction.id}`, {
          description: JSON.stringify(payload),
          amount: total,
        });
      }
      setShowItemEditor(false);
      setItemEditorTransaction(null);
      setItemRows([]);
      await fetchTransactions();
      toast.success('Item berhasil diperbarui');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || 'Gagal menyimpan perubahan item');
    }
  };

  const saveMetaEditor = async () => {
    if (!metaEditorTransaction) return;
    try {
      const payload: any = {
        supplier: metaForm.supplier || undefined,
        reference_number: metaForm.reference_number || undefined,
        account: metaForm.account || undefined,
        transaction_date: metaForm.transaction_date || undefined,
      };

      // Optional: update single Tanggal Nota (stored as first element of date_nota array)
      if (metaForm.date_nota) {
        payload.date_nota = [metaForm.date_nota];
      }

      // Only send due date for tempo transactions
      if (
        metaEditorTransaction.transaction_type === "debit_tempo" ||
        metaEditorTransaction.transaction_type === "kredit_tempo"
      ) {
        payload.tanggal_jatuh_tempo = metaForm.tanggal_jatuh_tempo || undefined;
      }

      await apiClient.put(`/cash/transactions/${metaEditorTransaction.id}`, payload);
      setShowMetaEditor(false);
      setMetaEditorTransaction(null);
      await fetchTransactions();
      toast.success("Info transaksi berhasil diperbarui");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Gagal menyimpan info transaksi");
    }
  };

  // Helpers for inline composer
  const ensureRecap = useCallback(async () => {
    const manual = (recapNumber || "").trim();
    try {
      if (manual) {
        const res = await listRecaps({ page: 1, limit: 1, search: manual });
        const found = (res?.data || []).find((r: any) => r.recap_number === manual);
        if (found) return found;
      }
    } catch {}
    const created = await createRecap({ payment_mode: isTempo ? "tempo" : "cash", recap_number: manual || undefined });
    setRecapNumber(created.recap_number);
    return created;
  }, [recapNumber, isTempo]);

  const addCashTransaction = useCallback(async (amount: number, description: string) => {
    const transaction_type = isTempo ? "kredit_tempo" : "kredit";
    const payload = {
      transaction_type,
      category_id: "",
      amount: amount.toString(),
      description,
      reference_number: recapNumber || undefined,
      transaction_date: new Date().toISOString().split("T")[0],
      account: composerAccount,
      supplier: composerSupplier || undefined,
      tanggal_jatuh_tempo: isTempo ? composerDueDate || undefined : undefined,
      no_nota: [""],
      date_nota: [""],
    } as any;
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined) fd.append(k, v as string);
    });
    const res = await apiClient.post("/cash/transactions", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return res.data?.data || res.data;
  }, [isTempo, recapNumber, composerAccount, composerSupplier, composerDueDate]);

  const handleComposerSubmit = useCallback(async () => {
    try {
      if (composerType === "stock_usage") {
        if (!vehicleId) return toast.error("Vehicle ID wajib");
        const qty = parseFloat(itemQty || "0");
        if (!(qty > 0)) return toast.error("Qty harus > 0");
        const recap = await ensureRecap();
        const payload: CreateStockUsagePayload = {
          vehicle_id: parseInt(vehicleId, 10),
          usage_date: new Date().toISOString().split("T")[0],
          notes: currentDesc || `Composer: ${itemName || "Item"}`,
          items: [
            { item_id: itemId ? parseInt(itemId, 10) : undefined, item_name: itemName || undefined, unit: itemUnit, quantity: qty },
          ],
          recap_number: recap.recap_number,
          cash_options: {
            create_cash: true,
            is_tempo: isTempo,
            account: composerAccount,
            supplier: composerSupplier || undefined,
            due_date: isTempo ? composerDueDate || undefined : undefined,
          },
        };
        await createStockUsage(payload);
        toast.success("Stok langsung digunakan tersimpan");
      } else if (composerType === "stock_add") {
        const qty = parseFloat(itemQty || "0");
        const price = parseFloat(unitPrice || "0");
        if (!(qty > 0)) return toast.error("Qty harus > 0");
        if (!(price >= 0)) return toast.error("Harga tidak valid");
        const itemIdNum = itemId ? parseInt(itemId, 10) : undefined;
        if (!itemIdNum && !itemName) return toast.error("Isi itemId atau itemName");
        const recap = await ensureRecap();
        let targetItemId = itemIdNum;
        if (!targetItemId) {
          const createRes = await apiClient.post("/stock", { 
            item_name: itemName, 
            unit: itemUnit, 
            min_stock: 0,
            initial_stock: qty,
            unit_price: price,
            supplier: composerSupplier || undefined,
            notes: currentDesc || `Initial stock creation for ${itemName}`
          });
          targetItemId = createRes.data?.data?.id || createRes.data?.id;
        } else {
          await apiClient.post("/stock/adjust", {
            itemId: targetItemId,
            adjustmentType: "add",
            quantity: qty,
            unit_price: price,
            supplier: composerSupplier || undefined,
            create_new_batch: true,
            notes: currentDesc || `Tambah stok ${itemName || targetItemId}`,
          });
        }
        if (price > 0) {
          const cash = await addCashTransaction(qty * price, currentDesc || `Pembelian stok ${itemName || targetItemId}`);
          await addItemToRecap(recap.id, { type: "cash", reference_id: cash.id, description: cash.description, amount: cash.amount } as any);
        }
        await addItemToRecap(recap.id, { type: "stock", reference_id: targetItemId!, description: currentDesc || `Stok masuk`, amount: qty * price } as any);
        toast.success("Stok bertambah");
      } else if (composerType === "tire_purchase") {
        const amount = parseFloat(cashAmount || "0");
        if (!(amount > 0)) return toast.error("Jumlah kas wajib");
        const recap = await ensureRecap();
        const cash = await addCashTransaction(amount, currentDesc || "Beli Ban");
        await addItemToRecap(recap.id, { type: "tire_purchase", reference_id: cash.id, description: cash.description, amount: cash.amount } as any);
        toast.success("Beli ban (kas) tersimpan");
      } else if (composerType === "service") {
        // Service creation should be done through the ServiceCreate page, not here
        toast.error("Gunakan halaman Service untuk membuat servis kendaraan");
        return;
      } else if (composerType === "cash_normal") {
        const amount = parseFloat(cashAmount || "0");
        if (!(amount > 0)) return toast.error("Jumlah kas wajib");
        const recap = await ensureRecap();
        const cash = await addCashTransaction(amount, currentDesc || "Kas Biasa");
        await addItemToRecap(recap.id, { type: "cash", reference_id: cash.id, description: cash.description, amount: cash.amount } as any);
        toast.success("Kas biasa tersimpan");
      }
      await fetchTransactions();
      setItemName(""); setItemId(""); setItemQty(""); setUnitPrice(""); setCashAmount(""); setCashDesc("");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Gagal menyimpan baris");
    }
  }, [composerType, vehicleId, itemId, itemName, itemUnit, itemQty, unitPrice, cashAmount, currentDesc, ensureRecap, addCashTransaction, fetchTransactions, isTempo, composerAccount, composerSupplier, composerDueDate]);

  const resetForm = () => {
    // Use selected account from filters if available, otherwise default to "General"
    const defaultAccount = filters.account || selectedAccount || "General";
    setFormData({
      transaction_type: "debit",
      category_id: "",
      amount: "",
      description: "",
      reference_number: "",
      account: defaultAccount,
      transaction_date: new Date().toISOString().split("T")[0],
      no_nota: [""],
      date_nota: [""],
      supplier: "",
      tanggal_jatuh_tempo: "",
    });
    // Reset item details fields
    setFormItemName("");
    setFormItemUnit("Pcs");
    setFormItemMerk("");
    setFormItemQty("");
    setFormItemUnitPrice("");
    setAttachmentFiles([]);
    setIsSpecialCategory(false);
  };

  const handleTransactionTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTransactionTypeModal(false);
    if (selectedTransactionType === "kas_normal") {
      resetForm();
      setEditingTransaction(null);
      setShowModal(true);
    } else if (selectedTransactionType === "kas_stok_barang") {
      const accountParam = filters.account || selectedAccount || "";
      navigate(`/stock/create${accountParam ? `?account=${encodeURIComponent(accountParam)}` : ""}`);
    } else if (selectedTransactionType === "kas_stok_ban") {
      const accountParam = filters.account || selectedAccount || "";
      navigate(`/tire-inventory/create${accountParam ? `?account=${encodeURIComponent(accountParam)}` : ""}`);
    } else if (selectedTransactionType === "kas_servis") {
      const accountParam = filters.account || selectedAccount || "";
      navigate(`/services/create${accountParam ? `?account=${encodeURIComponent(accountParam)}` : ""}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading)
    return <div className="text-center p-8">Loading cash transactions...</div>;

  const visibleTransactions = (() => {
    const itemTerm = (itemNameInput || "").trim().toLowerCase();
    if (!itemTerm) return transactions;
    return transactions.filter((tr) => {
      const desc = (tr.description || "").toLowerCase();
      const ref = (tr.reference_number || "").toLowerCase();
      return desc.includes(itemTerm) || ref.includes(itemTerm);
    });
  })();

  return (
    <div className="p-6">
      {/* INLINE KAS COMPOSER (moved to its own page) */}
      {false && (
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Kas Composer</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recap Number</label>
            <input type="text" value={recapNumber} onChange={(e) => setRecapNumber(e.target.value)} placeholder="Kosongkan untuk auto" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tempo?</label>
            <select value={isTempo ? "yes" : "no"} onChange={(e) => setIsTempo(e.target.value === "yes")} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="no">Cash</option>
              <option value="yes">Tempo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <CreatableSelect value={{ label: composerAccount, value: composerAccount }} options={accounts.map((a) => ({ label: a, value: a }))} onChange={(sel) => setComposerAccount(sel?.value || "General")} onCreateOption={(val) => setComposerAccount(val)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <input type="text" value={composerSupplier} onChange={(e) => setComposerSupplier(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          {isTempo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo</label>
              <input type="date" value={composerDueDate} onChange={(e) => setComposerDueDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
            <select value={composerType} onChange={(e) => setComposerType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="stock_usage">Stok Langsung Digunakan</option>
              <option value="stock_add">Stok (Tambah)</option>
              <option value="tire_purchase">Beli Ban</option>
              <option value="service">Servis</option>
              <option value="cash_normal">Kas Biasa</option>
            </select>
          </div>
        </div>

        {composerType === "stock_usage" && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle ID</label>
              <input type="number" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Item ID (opsional)</label>
              <input type="number" value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Item</label>
              <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <input type="text" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Qty</label>
              <input type="number" step="0.01" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Keterangan</label>
              <input type="text" value={cashDesc} onChange={(e) => setCashDesc(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          </div>
        )}

        {composerType === "stock_add" && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium mb-1">Item ID (opsional)</label>
              <input type="number" value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Item</label>
              <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit</label>
              <input type="text" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Qty</label>
              <input type="number" step="0.01" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Harga Satuan</label>
              <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Keterangan</label>
              <input type="text" value={cashDesc} onChange={(e) => setCashDesc(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          </div>
        )}

        {(composerType === "tire_purchase" || composerType === "service" || composerType === "cash_normal") && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
            {composerType === "service" && (
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle ID</label>
                <input type="number" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Jumlah</label>
              <input type="number" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Deskripsi</label>
              <input type="text" value={cashDesc} onChange={(e) => setCashDesc(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder={composerType === "tire_purchase" ? "Beli ban" : composerType === "service" ? "Servis" : "Kas biasa"} />
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={handleComposerSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded">Tambah Baris</button>
        </div>
      </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Buku Kas</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateAccountModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            title="Buat Akun Baru"
          >
            + Akun
          </button>
          <button
            onClick={() => navigate(`/cash/composer${filters.account ? `?account=${encodeURIComponent(filters.account)}` : ''}`)}
            className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
          >
            Kas Composer
          </button>
          <button
            onClick={() => navigate(`/tempo/composer${filters.account ? `?account=${encodeURIComponent(filters.account)}` : ''}`)}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Tempo Composer
          </button>
          <button
            onClick={() => {
              setSelectedTransactionType("");
              setShowTransactionTypeModal(true);
            }}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            + Tambah Transaksi
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Account Selection View - Show if no account selected */}
      {!filters.account && (
        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Pilih Buku Kas</h2>
          <p className="text-gray-600 mb-6">Pilih akun untuk melihat transaksi dan mengelola buku kas</p>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {accounts.map((account) => (
              <button
                key={account}
                onClick={() => {
                  setSelectedAccount(account);
                  setFilters((prev) => ({ ...prev, account }));
                  setAccountInput(account);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg p-6 text-center transition-all hover:shadow-md"
              >
                <div className="text-2xl mb-2">📖</div>
                <div className="font-semibold text-gray-800 text-lg">{account}</div>
                <div className="text-sm text-gray-500 mt-1">Buku Kas</div>
              </button>
            ))}
            {accounts.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                Belum ada akun. Klik tombol "+ Akun" untuk membuat akun baru.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Show only when account is selected */}
      {filters.account && (
        <>
          {/* Account Header */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Buku Kas: {selectedAccount || filters.account}</h2>
                <p className="text-sm text-gray-600 mt-1">Transaksi untuk akun ini</p>
              </div>
              <button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, account: "" }));
                  setSelectedAccount("");
                  setAccountInput("");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
              >
                Ganti Akun
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-700">Total Debit</h3>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(summary.total_debit + (summary.total_debit_tempo || 0))}
          </p>
          {summary.total_debit_tempo && summary.total_debit_tempo > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Cash: {formatCurrency(summary.total_debit)} | Tempo: {formatCurrency(summary.total_debit_tempo)}
            </p>
          )}
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-gray-700">Total Kredit</h3>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(summary.total_kredit + (summary.total_kredit_tempo || 0))}
          </p>
          {summary.total_kredit_tempo && summary.total_kredit_tempo > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Cash: {formatCurrency(summary.total_kredit)} | Tempo: {formatCurrency(summary.total_kredit_tempo)}
            </p>
          )}
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-700">Saldo</h3>
          <p
            className={`text-2xl font-bold ${
              summary.saldo >= 0 ? "text-blue-600" : "text-red-600"
            }`}
          >
            {formatCurrency(summary.saldo)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <h3 className="text-lg font-semibold text-gray-700">
            Total Transaksi
          </h3>
          <p className="text-2xl font-bold text-gray-600">{pagination.total}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cash/Tempo
            </label>
            <select
              value={filters.payment_type}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, payment_type: e.target.value }));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Semua</option>
              <option value="cash">Cash</option>
              <option value="tempo">Tempo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipe
            </label>
            <select
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Semua Tipe</option>
              <option value="debit">Debit</option>
              <option value="kredit">Kredit</option>
              <option value="debit_tempo">Debit Tempo</option>
              <option value="kredit_tempo">Kredit Tempo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Pilih Kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cari
            </label>
            <input
              type="text"
              placeholder="Deskripsi atau referensi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
            {/* Unified Search button moved beside Akun */}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Barang
            </label>
            <input
              type="text"
              placeholder="Cari nama barang di transaksi composer/rekapan..."
              value={itemNameInput}
              onChange={(e) => setItemNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier
            </label>
            <input
              type="text"
              placeholder="Nama supplier..."
              value={supplierInput}
              onChange={(e) => setSupplierInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  transaction_type: typeInput,
                  category_id: categoryInput,
                  date_from: dateFromInput,
                  date_to: dateToInput,
                  search: searchInput,
                  supplier: supplierInput,
                  item_name: itemNameInput,
                  account: filters.account, // Keep current account
                }));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
            >
              Search
            </button>
          </div>
        </div>
        {matchNotice && (
          <div className="mt-3 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded px-3 py-2">
            {matchNotice}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setFilters({
                transaction_type: "",
                category_id: "",
                date_from: "",
                date_to: "",
                search: "",
                account: filters.account, // Keep current account
                supplier: "",
                item_name: "",
                payment_type: filters.payment_type, // Keep current payment_type
              });
              // Clear queued local inputs as well
              setTypeInput("");
              setCategoryInput("");
              setDateFromInput("");
              setDateToInput("");
              setSearchInput("");
              setSupplierInput("");
              setItemNameInput("");
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Reset Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cash/Tempo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  No. Nota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tgl Nota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kredit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akun
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleTransactions.map((transaction) => {
                // Render summary row (synthetic) if present
                if (transaction.is_summary) {
                  return (
                    <tr key="summary-row" className="bg-gray-50 font-semibold">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Grand Total</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Grand Total</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-700">
                        {formatCurrency(transaction.total_debit || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                        {formatCurrency(transaction.total_kredit || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={(transaction.saldo || 0) >= 0 ? "text-blue-700" : "text-red-700"}>
                          {formatCurrency(transaction.saldo || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">-</td>
                    </tr>
                  );
                }
                const isTxnRekapan = isRekapan(transaction.description);
                const isTxnSettlement = isSettlementText(transaction.description);
                const fullDesc = transaction.description;
                const isLong = fullDesc.length > 100;

                const truncated = isLong
                  ? fullDesc.substring(0, 100) + "..."
                  : fullDesc;
                const autoExpand =
                  (itemNameInput || "").trim() !== "" &&
                  fullDesc.toLowerCase().includes((itemNameInput || "").toLowerCase());
                const expanded =
                  expandedRows.has(transaction.id) || autoExpand;
                return (
                  <>
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.transaction_type.includes("tempo")
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {transaction.transaction_type.includes("tempo") ? "Tempo" : "Cash"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.transaction_type === "debit" || transaction.transaction_type === "debit_tempo"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {transaction.transaction_type === "debit" || transaction.transaction_type === "debit_tempo"
                          ? "Debit"
                          : "Kredit"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.supplier || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.category?.category_name || "-"}
                    </td>
                    {/* No. Nota (moved beside Kategori) */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const v = isTxnRekapan
                          ? (transaction.reference_number || transaction.no_nota?.[0])
                          : (transaction.no_nota && transaction.no_nota[0]);
                        const hasDetails = isTxnRekapan || (transaction.no_nota?.length || transaction.date_nota?.length || transaction.attachment_urls?.length);
                        return hasDetails ? (
                          <button onClick={() => isTxnRekapan ? handleShowRekapanDetails(transaction) : handleShowNotaDetails(transaction)} className="text-blue-600 hover:underline">
                            {v || "-"}
                          </button>
                        ) : (v || "-");
                      })()}
                    </td>
                    {/* Tgl Nota (moved beside Kategori) */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const d = transaction.date_nota && transaction.date_nota[0]
                          ? formatDate(transaction.date_nota[0])
                          : (isTxnRekapan ? formatDate(transaction.transaction_date) : "-");
                        const hasDetails = isTxnRekapan || (transaction.no_nota?.length || transaction.date_nota?.length || transaction.attachment_urls?.length);
                        return hasDetails ? (
                          <button onClick={() => isTxnRekapan ? handleShowRekapanDetails(transaction) : handleShowNotaDetails(transaction)} className="text-blue-600 hover:underline">
                            {d}
                          </button>
                        ) : d;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">
                          <span
                            onClick={() => {
                              if (isTxnRekapan) {
                                handleShowRekapanDetails(transaction);
                              } else if (isLong) {
                                setCurrentDesc(fullDesc);
                                // Compute total from "Detail Transaksi" section if present
                                const computeDetailTotal = (text: string): number | null => {
                                  const marker = "Detail Transaksi";
                                  const idx = text.indexOf(marker);
                                  if (idx === -1) return null;
                                  const section = text.slice(idx);
                                  const re = /Rp\s*([0-9\.,]+)/g;
                                  let match;
                                  let total = 0;
                                  let found = false;
                                  while ((match = re.exec(section)) !== null) {
                                    const raw = match[1].replace(/\./g, "").replace(/,/g, ".");
                                    const val = parseFloat(raw);
                                    if (!isNaN(val)) {
                                      found = true;
                                      total += val;
                                    }
                                  }
                                  return found ? total : null;
                                };
                                setCurrentDescTotal(computeDetailTotal(fullDesc));
                                setShowDescModal(true);
                              }
                            }}
                            className={
                              isTxnRekapan || (isLong && !isTxnRekapan)
                                ? "cursor-pointer text-blue-600 hover:underline"
                                : ""
                            }
                          >
                            {isTxnRekapan ? `Rekapan Nota ${transaction.reference_number}`: truncated}
                          </span>
                        </div>
                        {(isTxnRekapan || isTxnSettlement) && (
                          <div className="mt-1">
                            <button
                              className="text-xs text-indigo-600 hover:underline"
                              onClick={() => {
                                setExpandedRows(prev => {
                                  const next = new Set(prev);
                                  if (next.has(transaction.id)) next.delete(transaction.id);
                                  else next.add(transaction.id);
                                  return next;
                                });
                              }}
                            >
                              {expanded ? "Sembunyikan Item" : "Tampilkan Item"}
                            </button>
                          </div>
                        )}
                        {(isTxnRekapan || isTxnSettlement) && (
                          <div className="mt-1">
                            <button
                              className="text-xs text-blue-600 hover:underline"
                              onClick={() => openItemEditor(transaction)}
                            >
                              Edit Item
                            </button>
                          </div>
                        )}
                        {transaction.reference_number && (
                          <div className="text-xs text-gray-500">
                            Ref: {transaction.reference_number}
                          </div>
                        )}
                        {transaction.last_edited_by && (
                          <div className="text-xs text-gray-600 mt-2">
                            Diubah oleh {transaction.last_edited_by} •{" "}
                            {new Date(
                              transaction.last_edited_at || ""
                            ).toLocaleString("id-ID")}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {transaction.transaction_type === "debit" ? (
                        <span className="text-green-600 font-medium">
                          {formatCurrency(transaction.amount)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {transaction.transaction_type === "kredit" ? (
                        <span className="text-red-600 font-medium">
                          {formatCurrency(transaction.amount)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      {transaction.running_balance !== undefined ? (
                        <span
                          className={
                            transaction.running_balance >= 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }
                        >
                          {formatCurrency(transaction.running_balance)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.account}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => openMetaEditor(transaction)}
                          className="text-indigo-600 hover:text-indigo-900 text-xs"
                        >
                          Edit Info
                        </button>
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                  {(isTxnRekapan || isTxnSettlement) && expanded && (
                    <tr>
                      <td colSpan={12} className="px-6 pb-4">
                        {(() => {
                          const details = parseRekapanDetails(transaction.description || "");
                          const items = Array.isArray(details.transactions) ? details.transactions : [];
                          const term = (itemNameInput || "").toLowerCase();
                          const filtered = term ? items.filter((it: any) => (it.description || "").toLowerCase().includes(term)) : items;
                          if (filtered.length === 0) {
                            return <div className="text-xs text-gray-500">Tidak ada item yang cocok.</div>;
                          }
                          return (
                            <div className="overflow-x-auto border rounded bg-gray-50">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left">No</th>
                                    <th className="px-3 py-2 text-left">Tipe</th>
                                    <th className="px-3 py-2 text-left">Deskripsi</th>
                                    <th className="px-3 py-2 text-left">Supplier</th>
                                    <th className="px-3 py-2 text-right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filtered.map((it: any, idx: number) => (
                                    <tr key={idx} className="border-t">
                                      <td className="px-3 py-2">{idx + 1}</td>
                                      <td className="px-3 py-2">{it.type}</td>
                                      <td className="px-3 py-2">{it.description}</td>
                                      <td className="px-3 py-2">{it.supplier || "-"}</td>
                                      <td className="px-3 py-2 text-right">Rp {Number(it.amount || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {showTransactionTypeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Pilih Tipe Transaksi
              </h3>
              <form
                onSubmit={handleTransactionTypeSubmit}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe Transaksi *
                  </label>
                  <select
                    value={selectedTransactionType}
                    onChange={(e) => setSelectedTransactionType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Pilih Tipe Transaksi</option>
                    <option value="kas_normal">Kas Normal</option>
                    <option value="kas_stok_barang">Kas Stok Barang</option>
                    <option value="kas_stok_ban">Kas Stok Ban</option>
                    <option value="kas_servis">Kas Servis</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTransactionTypeModal(false)}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Lanjutkan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTransaction
                  ? "Edit Transaksi"
                  : "Tambah Transaksi Baru"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Akun *
                  </label>
                  <CreatableSelect
                    value={{ label: formData.account, value: formData.account }}
                    options={accounts.map((account) => ({
                      label: account,
                      value: account,
                    }))}
                    onChange={(selected) => {
                      const newAccount = selected?.value || "General";
                      setFormData((prev) => ({ ...prev, account: newAccount }));
                    }}
                    onCreateOption={(inputValue) => {
                      setFormData((prev) => ({ ...prev, account: inputValue }));
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cash/Tempo *
                  </label>
                  <select
                    value={formData.transaction_type.includes("tempo") ? "tempo" : "cash"}
                    onChange={(e) => {
                      const paymentType = e.target.value;
                      const currentType = formData.transaction_type;
                      let newType: "debit" | "kredit" | "debit_tempo" | "kredit_tempo";
                      if (paymentType === "tempo") {
                        newType = currentType === "debit" ? "debit_tempo" : "kredit_tempo";
                      } else {
                        newType = currentType === "debit_tempo" ? "debit" : "kredit";
                      }
                      setFormData((prev) => ({
                        ...prev,
                        transaction_type: newType,
                        category_id: "",
                      }));
                      setIsSpecialCategory(false);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mb-2"
                  >
                    <option value="cash">Cash</option>
                    <option value="tempo">Tempo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe Transaksi *
                  </label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        transaction_type: e.target.value as "debit" | "kredit" | "debit_tempo" | "kredit_tempo",
                        category_id: "",
                      }));
                      setIsSpecialCategory(false);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    {formData.transaction_type.includes("tempo") ? (
                      <>
                        <option value="debit_tempo">Debit Tempo (Pemasukan)</option>
                        <option value="kredit_tempo">Kredit Tempo (Pengeluaran)</option>
                      </>
                    ) : (
                      <>
                        <option value="debit">Debit (Pemasukan)</option>
                        <option value="kredit">Kredit (Pengeluaran)</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={handleCategoryChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories
                      .filter(
                        (cat) =>
                          ((formData.transaction_type === "debit" || formData.transaction_type === "debit_tempo") &&
                            cat.category_type === "income") ||
                          ((formData.transaction_type === "kredit" || formData.transaction_type === "kredit_tempo") &&
                            cat.category_type === "expense")
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.category_name}
                        </option>
                      ))}
                    {formData.transaction_type === "kredit" && (
                      <option value="inventory_redirect">
                        Inventory (Pembelian Stok)
                      </option>
                    )}
                    {formData.transaction_type === "kredit" && (
                      <option value="service_redirect">Servis</option>
                    )}
                  </select>
                </div>
                {!isSpecialCategory && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Item *
                      </label>
                      <input
                        type="text"
                        value={formItemName}
                        onChange={(e) => setFormItemName(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Nama item"
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={formItemUnit}
                        onChange={(e) => setFormItemUnit(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Pcs, Liter, dll"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Merk
                      </label>
                      <input
                        type="text"
                        value={formItemMerk}
                        onChange={(e) => setFormItemMerk(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Merk/Brand"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formItemQty}
                        onChange={(e) => {
                          setFormItemQty(e.target.value);
                          // Auto-calculate amount if both qty and unitPrice are filled
                          if (e.target.value && formItemUnitPrice) {
                            const qty = parseFloat(e.target.value);
                            const unitPrice = parseFloat(formItemUnitPrice);
                            if (qty > 0 && unitPrice >= 0) {
                              setFormData((prev) => ({
                                ...prev,
                                amount: (qty * unitPrice).toString(),
                              }));
                            }
                          }
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Harga Satuan
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formItemUnitPrice}
                        onChange={(e) => {
                          setFormItemUnitPrice(e.target.value);
                          // Auto-calculate amount if both qty and unitPrice are filled
                          if (e.target.value && formItemQty) {
                            const qty = parseFloat(formItemQty);
                            const unitPrice = parseFloat(e.target.value);
                            if (qty > 0 && unitPrice >= 0) {
                              setFormData((prev) => ({
                                ...prev,
                                amount: (qty * unitPrice).toString(),
                              }));
                            }
                          }
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Jumlah (auto atau manual) *
                      </label>
                      {/* Currency input for amount with thousand separators */}
                      {(() => {
                        const CurrencyInput = require("../components/CurrencyInput").default;
                        return (
                          <CurrencyInput
                            value={formData.amount}
                            onChange={(numeric: string) =>
                              setFormData((prev) => ({
                                ...prev,
                                amount: numeric,
                              }))
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Rp 0"
                          />
                        );
                      })()}
                      <p className="text-xs text-gray-500 mt-1">Otomatis: Qty × Harga Satuan</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Keterangan
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        rows={3}
                        placeholder="Keterangan tambahan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tanggal Transaksi *
                      </label>
                      <input
                        type="date"
                        value={formData.transaction_date}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            transaction_date: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Supplier
                      </label>
                      <input
                        type="text"
                        value={formData.supplier}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            supplier: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Nama supplier (opsional)"
                      />
                    </div>
                    {formData.transaction_type.includes("tempo") && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tanggal Jatuh Tempo *
                        </label>
                        <input
                          type="date"
                          value={formData.tanggal_jatuh_tempo}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              tanggal_jatuh_tempo: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          required={formData.transaction_type.includes("tempo")}
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Upload Nota
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          id="fileInput"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            document.getElementById("fileInput")?.click()
                          }
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
                        >
                          <span>+</span>{" "}
                          <span className="ml-1">Tambah Nota</span>
                        </button>
                        {attachmentFiles.length > 0 && (
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              New Files
                            </label>
                            <ul className="space-y-1">
                              {attachmentFiles.map((file, index) => (
                                <li
                                  key={index}
                                  className="text-sm text-gray-600 flex justify-between"
                                >
                                  <span>{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingTransaction?.attachment_urls &&
                      editingTransaction.attachment_urls.length > 0 && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Existing Files
                          </label>
                          <ul className="space-y-1">
                            {editingTransaction.attachment_urls.map(
                              (url, index) => (
                                <li key={index}>
                                  <a
                                    href={`${process.env.REACT_APP_BACKEND_URL}/${url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    Nota {index + 1}
                                  </a>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    {attachmentFiles.length > 0 && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Files
                        </label>
                        <ul className="space-y-1">
                          {attachmentFiles.map((file, index) => (
                            <li key={index} className="text-sm text-gray-600">
                              {file.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                {formData.no_nota.map((nota, index) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. Nota {index + 1}
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={nota}
                        onChange={(e) => {
                          const newNotas = [...formData.no_nota];
                          newNotas[index] = e.target.value;
                          setFormData({ ...formData, no_nota: newNotas });
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Masukkan nomor nota"
                      />
                      <input
                        type="date"
                        value={formData.date_nota[index] || ""}
                        onChange={(e) => {
                          const newDateNotas = [...formData.date_nota];
                          newDateNotas[index] = e.target.value;
                          setFormData({ ...formData, date_nota: newDateNotas });
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Tanggal nota"
                      />
                    </div>
                  </div>
                ))}
                {isSpecialCategory && (
                  <div className="bg-blue-50 p-3 rounded-md text-blue-800">
                    {formData.category_id === "inventory_redirect" ? (
                      <p>Anda akan diarahkan ke halaman pembelian stok</p>
                    ) : (
                      <p>Anda akan diarahkan ke halaman penjualan servis</p>
                    )}
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTransaction(null);
                      resetForm();
                    }}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingTransaction ? "Update" : "Lanjutkan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* removed old popup composer */}

      {showDescModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Deskripsi Lengkap
              </h3>
              <div className="whitespace-pre-wrap text-sm text-gray-700 mb-4">
                {currentDesc}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDescModal(false)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMetaEditor && metaEditorTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Info Transaksi
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">No. Nota</label>
                  <input
                    type="text"
                    value={metaForm.reference_number}
                    onChange={(e) =>
                      setMetaForm((prev) => ({ ...prev, reference_number: e.target.value }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Nota</label>
                  <input
                    type="date"
                    value={metaForm.date_nota}
                    onChange={(e) =>
                      setMetaForm((prev) => ({ ...prev, date_nota: e.target.value }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier</label>
                  <input
                    type="text"
                    value={metaForm.supplier}
                    onChange={(e) =>
                      setMetaForm((prev) => ({ ...prev, supplier: e.target.value }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ref / No. Rekapan</label>
                  <input
                    type="text"
                    value={metaForm.reference_number}
                    onChange={(e) =>
                      setMetaForm((prev) => ({
                        ...prev,
                        reference_number: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={metaForm.transaction_date}
                    onChange={(e) =>
                      setMetaForm((prev) => ({
                        ...prev,
                        transaction_date: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Akun</label>
                  <select
                    value={metaForm.account}
                    onChange={(e) =>
                      setMetaForm((prev) => ({ ...prev, account: e.target.value }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  >
                    {[...accounts, "General"]?.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(metaEditorTransaction.transaction_type === "debit_tempo" ||
                metaEditorTransaction.transaction_type === "kredit_tempo") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    type="date"
                    value={metaForm.tanggal_jatuh_tempo}
                    onChange={(e) =>
                      setMetaForm((prev) => ({
                        ...prev,
                        tanggal_jatuh_tempo: e.target.value,
                      }))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => {
                    setShowMetaEditor(false);
                    setMetaEditorTransaction(null);
                  }}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={saveMetaEditor}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotaModal && selectedNotaDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Detail Nota
              </h3>
              <div className="space-y-4">
                {(selectedNotaDetails.no_nota &&
                  selectedNotaDetails.no_nota.length > 0) ||
                (selectedNotaDetails.date_nota &&
                  selectedNotaDetails.date_nota.length > 0) ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Nota Details
                    </h4>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            No. Nota
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tanggal Nota
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedNotaDetails.no_nota &&
                          selectedNotaDetails.no_nota.map((nota, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {nota || "-"}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {selectedNotaDetails.date_nota &&
                                selectedNotaDetails.date_nota[index]
                                  ? formatDate(
                                      selectedNotaDetails.date_nota[index]
                                    )
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Tidak ada nomor nota atau tanggal nota.
                  </p>
                )}
                {selectedNotaDetails.attachment_urls &&
                selectedNotaDetails.attachment_urls.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Attached Files
                    </h4>
                    <ul className="space-y-2">
                      {selectedNotaDetails.attachment_urls.map((url, index) => (
                        <li key={index}>
                          <a
                            href={`${process.env.REACT_APP_BACKEND_URL}/${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center"
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
                                d="M15 12h2m0 0h-2m2 0v-2m0 2v2m-6-6h2m0 0h-2m2 0v-2m0 2v2m-6 6h2m0 0h-2m2 0v-2m0 2v2M12 3C8.134 3 5 6.134 5 10c0 2.506 1.42 4.668 3.5 5.799v4.701h7V15.8c2.08-1.132 3.5-3.294 3.5-5.8 0-3.866-3.134-7-7-7z"
                              />
                            </svg>
                            Nota {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Tidak ada file terlampir.</p>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowNotaModal(false)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showItemEditor && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-3xl shadow-lg rounded-md bg-white">
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Item Transaksi</h3>
              <div className="mb-3 text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                Catatan: Perubahan harga di sini tidak mengubah data harga di Inventaris. Perbarui juga di menu Inventaris agar dashboard menampilkan data yang akurat.
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">Tipe</th>
                      <th className="px-3 py-2 text-left">Deskripsi</th>
                      <th className="px-3 py-2 text-left">Supplier</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows.map((row, idx) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.type}
                            onChange={(e) => {
                              const v = e.target.value;
                              setItemRows(prev => prev.map((r, i) => i === idx ? { ...r, type: v } : r));
                            }}
                            className="w-28 border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => {
                              const v = e.target.value;
                              setItemRows(prev => prev.map((r, i) => i === idx ? { ...r, description: v } : r));
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.supplier || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setItemRows(prev => prev.map((r, i) => i === idx ? { ...r, supplier: v } : r));
                            }}
                            className="w-40 border border-gray-300 rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value || '0');
                              setItemRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: isNaN(v) ? 0 : v } : r));
                            }}
                            className="w-32 border border-gray-300 rounded px-2 py-1 text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            className="text-red-600 hover:underline"
                            onClick={() => setItemRows(prev => prev.filter((_, i) => i !== idx))}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-3">
                <button
                  className="text-sm text-indigo-600 hover:underline"
                  onClick={() => setItemRows(prev => [...prev, { id: prev.length + 1, type: 'Item', description: '', amount: 0 }])}
                >
                  + Tambah Item
                </button>
                <div className="text-sm font-semibold">
                  Total: {formatIDR(itemRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
                  onClick={() => { setShowItemEditor(false); setItemEditorTransaction(null); }}
                >
                  Batal
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  onClick={saveItemEditor}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rekapan Detail Modal */}
      {showRekapanModal && selectedRekapan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Detail Rekapan Nota</h2>
                <button
                  onClick={() => setShowRekapanModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Main Transaction Info */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">No. Nota</label>
                    <p className="text-lg font-semibold">{selectedRekapan.reference_number || selectedRekapan.no_nota?.[0] || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                    <p className="text-lg">{new Date(selectedRekapan.transaction_date).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="text-lg font-bold text-red-600">Rp {selectedRekapan.amount.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                {selectedRekapan.supplier && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700">Supplier</label>
                    <p className="text-lg">{selectedRekapan.supplier}</p>
                  </div>
                )}
              </div>

              {/* Transaction Details */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Detail Transaksi</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedRekapan.parsedDetails?.transactions
                        ?.map((transaction: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'Service' ? 'bg-blue-100 text-blue-800' :
                              transaction.type === 'Stock Purchase' ? 'bg-green-100 text-green-800' :
                              transaction.type === 'Stock Usage' ? 'bg-yellow-100 text-yellow-800' :
                              transaction.type === 'Tire Purchase' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.supplier || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            Rp {typeof transaction.amount === 'number' ? transaction.amount.toLocaleString('id-ID') : parseFloat(transaction.amount || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          Total:
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                          Rp {selectedRekapan.amount.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRekapanModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Buat Akun Baru
                </h3>
                <button
                  onClick={() => {
                    setShowCreateAccountModal(false);
                    setNewAccountName("");
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Akun *
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Masukkan nama akun (max 20 karakter)"
                    maxLength={20}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {newAccountName.length}/20 karakter
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAccountModal(false);
                      setNewAccountName("");
                    }}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
                  >
                    Buat Akun
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashManagementPage;
