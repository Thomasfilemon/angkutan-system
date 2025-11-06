import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  transaction_type: "debit" | "kredit";
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
  last_edited_by?: string;
  last_edited_at?: string;
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

  const [filters, setFilters] = useState({
    transaction_type: "",
    category_id: "",
    date_from: "",
    date_to: "",
    search: "",
    account: "", // Changed: account is now required, starts empty
    supplier: "",
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
    transaction_type: "debit" as "debit" | "kredit",
    category_id: "",
    amount: "",
    description: "",
    reference_number: "",
    account: "General",
    transaction_date: new Date().toISOString().split("T")[0],
    no_nota: [""] as string[],
    date_nota: [""] as string[],
  });

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
  useEffect(() => {
    setSearchInput(filters.search || "");
    setSupplierInput(filters.supplier || "");
    setTypeInput(filters.transaction_type || "");
    setCategoryInput(filters.category_id || "");
    setDateFromInput(filters.date_from || "");
    setDateToInput(filters.date_to || "");
    setAccountInput(filters.account || "");
  }, []);
  // Manual search trigger via button (no debounce)

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
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== "")
        ),
      });

      const response = await apiClient.get(`/cash/transactions?${params}`, { signal: controller.signal });

      setTransactions(response.data.data || []);
      setSummary(
        response.data.summary || { total_debit: 0, total_kredit: 0, saldo: 0 }
      );
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0,
      }));
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setError("Failed to fetch cash transactions.");
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

    const submissionData = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (key === "no_nota" || key === "date_nota") return;
      if (typeof value === "string" || typeof value === "number") {
        submissionData.append(key, value.toString());
      } else if (Array.isArray(value)) {
        submissionData.append(key, JSON.stringify(value));
      }
    });

    submissionData.append("no_nota", JSON.stringify(formData.no_nota));
    submissionData.append("date_nota", JSON.stringify(formData.date_nota));

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
    setFormData({
      transaction_type: transaction.transaction_type,
      category_id: transaction.category_id?.toString() || "",
      amount: transaction.amount.toString(),
      description: transaction.description,
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
    });
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
    setFormData({
      transaction_type: "debit",
      category_id: "",
      amount: "",
      description: "",
      reference_number: "",
      account: "General",
      transaction_date: new Date().toISOString().split("T")[0],
      no_nota: [""],
      date_nota: [""],
    });
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
      navigate("/stock/create");
    } else if (selectedTransactionType === "kas_stok_ban") {
      navigate("/tire-inventory/create");
    } else if (selectedTransactionType === "kas_servis") {
      navigate("/services/create");
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
            onClick={() => navigate("/cash/composer")}
            className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
          >
            Kas Composer
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
            {formatCurrency(summary.total_debit)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-gray-700">Total Kredit</h3>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(summary.total_kredit)}
          </p>
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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              });
              // Clear queued local inputs as well
              setTypeInput("");
              setCategoryInput("");
              setDateFromInput("");
              setDateToInput("");
              setSearchInput("");
              setSupplierInput("");
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
              {transactions.map((transaction) => {
                const isTxnRekapan = isRekapan(transaction.description);
                const fullDesc = transaction.description;
                const isLong = fullDesc.length > 100;

                const truncated = isLong
                  ? fullDesc.substring(0, 100) + "..."
                  : fullDesc;
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.transaction_type === "debit"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {transaction.transaction_type === "debit"
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
                    Tipe Transaksi *
                  </label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        transaction_type: e.target.value as "debit" | "kredit",
                        category_id: "",
                      }));
                      setIsSpecialCategory(false);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="debit">Debit (Pemasukan)</option>
                    <option value="kredit">Kredit (Pengeluaran)</option>
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
                          (formData.transaction_type === "debit" &&
                            cat.category_type === "income") ||
                          (formData.transaction_type === "kredit" &&
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
                        Jumlah *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="0"
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deskripsi *
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
                        placeholder="Deskripsi transaksi..."
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nomor Referensi
                      </label>
                      <input
                        type="text"
                        value={formData.reference_number}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            reference_number: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Nomor referensi (opsional)"
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
                        ?.filter((t: any) => t.type !== 'Stock Usage') // Filter out stock_usage from general stock recap
                        ?.map((transaction: any, index: number) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.id}</td>
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
                            Rp {transaction.amount.toLocaleString('id-ID')}
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
