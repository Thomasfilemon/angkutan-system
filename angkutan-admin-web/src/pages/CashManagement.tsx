import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";

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
    account: "All",
  });

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
  const [selectedAccount, setSelectedAccount] = useState<string>(
    formData.account
  );

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

  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const [showDescModal, setShowDescModal] = useState(false);
  const [currentDesc, setCurrentDesc] = useState("");

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== "")
        ),
      });

      const response = await apiClient.get(`/cash/transactions?${params}`);

      setTransactions(response.data.data || []);
      setSummary(
        response.data.summary || { total_debit: 0, total_kredit: 0, saldo: 0 }
      );
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0,
      }));
    } catch (err) {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Buku Kas</h1>
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

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

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
              value={filters.transaction_type}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  transaction_type: e.target.value,
                }))
              }
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
              value={filters.category_id}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category_id: e.target.value }))
              }
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
              value={filters.date_from}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, date_from: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, date_to: e.target.value }))
              }
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
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Akun
            </label>
            <CreatableSelect
              value={
                filters.account === "All"
                  ? { label: "All", value: "All" }
                  : { label: filters.account, value: filters.account }
              }
              options={[
                { label: "All", value: "All" },
                ...accounts.map((account) => ({
                  label: account,
                  value: account,
                })),
              ]}
              onChange={(selected) => {
                const newAccount = selected?.value || "All";
                setFilters((prev) => ({ ...prev, account: newAccount }));
              }}
              onCreateOption={(inputValue) => {
                setFilters((prev) => ({ ...prev, account: inputValue }));
              }}
              className="w-full"
            />
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
                account: "All",
              });
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
                  Nota
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
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">
                          <span
                            onClick={() =>
                              isLong &&
                              (setCurrentDesc(fullDesc), setShowDescModal(true))
                            }
                            className={
                              isLong
                                ? "cursor-pointer text-blue-600 hover:underline"
                                : ""
                            }
                          >
                            {truncated}
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
                      {(transaction.no_nota &&
                        transaction.no_nota.length > 0) ||
                      (transaction.date_nota &&
                        transaction.date_nota.length > 0) ||
                      (transaction.attachment_urls &&
                        transaction.attachment_urls.length > 0) ? (
                        <button
                          onClick={() => handleShowNotaDetails(transaction)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Details
                        </button>
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
                    value={{ label: selectedAccount, value: selectedAccount }}
                    options={accounts.map((account) => ({
                      label: account,
                      value: account,
                    }))}
                    onChange={(selected) => {
                      const newAccount = selected?.value || "General";
                      setSelectedAccount(newAccount);
                      setFormData((prev) => ({ ...prev, account: newAccount }));
                    }}
                    onCreateOption={(inputValue) => {
                      setSelectedAccount(inputValue);
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
                  <p className="text-sm text-gray-500">
                    Tidak ada file terlampir.
                  </p>
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
    </div>
  );
};

export default CashManagementPage;
