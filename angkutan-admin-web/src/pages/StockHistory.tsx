// src/pages/StockHistory.tsx
import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";

interface StockTransaction {
  id: number;
  transaction_type: string;
  quantity: string | number;
  unit_price: string | number;
  total_amount: string | number;
  notes: string;
  transaction_date: string;
  created_at: string;
  batch_id?: number;
  batch?: {
    batch_number: string;
    supplier: string;
    purchase_date: string;
    unit_price: string;
    last_edited_by?: string;
    last_edited_at?: string;
  };
  last_edited_by?: string;
  last_edited_at?: string;
}

interface StockBatch {
  id: number;
  batch_number: string;
  supplier: string;
  purchase_date: string;
  quantity: number;
  last_edited_by?: string;
  last_edited_at?: string;
}

interface StockItem {
  id: number;
  item_name: string;
  item_code: string;
  unit: string;
}

// ✅ FIXED: Proper TypeScript interface for pagination
interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
}

const StockHistory = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [stockItem, setStockItem] = useState<StockItem | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [error, setError] = useState<string>("");

  // ✅ FIXED: Properly typed pagination state with all required properties
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalItems: 0,
  });

  const [filters, setFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (id) {
      fetchStockItem();
      fetchBatches();

      // Check URL params for batch filter
      const urlParams = new URLSearchParams(location.search);
      const batchParam = urlParams.get("batch");
      if (batchParam) {
        setSelectedBatch(batchParam);
      }
    }
  }, [id, location.search]);

  useEffect(() => {
    if (id) {
      fetchTransactions();
    }
  }, [id, selectedBatch, pagination.page, filters]);

  const fetchStockItem = async () => {
    try {
      const response = await apiClient.get(`/stock/${id}`);
      const itemData = response.data.success
        ? response.data.data
        : response.data;
      setStockItem(itemData);
    } catch (err) {
      console.error("Failed to fetch stock item:", err);
      setError("Failed to load stock item details");
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await apiClient.get(
        `/stock/${id}/batches?includeEmpty=true`
      );
      const batchData = response.data.success
        ? response.data.data
        : response.data;
      setBatches(Array.isArray(batchData) ? batchData : []);
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    }
  };

  const fetchTransactions = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError("");

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters,
      });

      if (selectedBatch) {
        queryParams.append("batchId", selectedBatch);
      }

      const response = await apiClient.get(
        `/stock/${id}/history?${queryParams}`
      );

      // Handle different response structures
      let transactionData: StockTransaction[] = [];
      let paginationData: Partial<Pagination> = {};

      if (response.data.success) {
        transactionData = response.data.data || [];
        paginationData = response.data.pagination || {};
      } else if (Array.isArray(response.data.data)) {
        transactionData = response.data.data;
        paginationData = response.data.pagination || {};
      } else if (Array.isArray(response.data)) {
        transactionData = response.data;
      }

      setTransactions(transactionData);

      // ✅ FIXED: Proper pagination update with type safety
      if (paginationData && Object.keys(paginationData).length > 0) {
        setPagination((prev) => ({
          ...prev,
          totalPages: paginationData.totalPages || prev.totalPages,
          totalItems: paginationData.totalItems || prev.totalItems,
        }));
      }
    } catch (err: any) {
      console.error("Failed to fetch transactions:", err);
      setError(`Failed to load transaction history: ${err.message}`);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getTransactionTypeBadge = (type: string, quantity: string | number) => {
    const qty = parseFloat(quantity.toString());
    const isIncoming = type === "in" || (type === "adjustment" && qty > 0);
    const bgColor = isIncoming
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";
    const text = isIncoming ? "Masuk" : "Keluar";

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
        {text}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = parseFloat(amount.toString()) || 0;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  // ✅ FIXED: Better loading and error states
  if (loading && !transactions.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading transaction history...</div>
        </div>
      </div>
    );
  }

  if (error && !stockItem) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Riwayat Stok</h1>
            <p className="text-gray-600">
              {stockItem
                ? `${stockItem.item_name} (${stockItem.item_code})`
                : `Item ID: ${id}`}
            </p>
          </div>
          <Link
            to="/stock"
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Kembali ke Stok
          </Link>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Batch Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Batch:
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">Semua Batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_number} - {batch.supplier}(
                  {batch.quantity > 0 ? `Sisa: ${batch.quantity}` : "Habis"})
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Catatan:
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              placeholder="Cari dalam catatan..."
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Mulai:
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Akhir:
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
        </div>

        {/* Selected Batch Info */}
        {selectedBatch && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              Filter Aktif - Batch Terpilih:
            </h3>
            {(() => {
              const batch = batches.find(
                (b) => b.id.toString() === selectedBatch
              );
              return batch ? (
                <div className="text-blue-800">
                  <p>
                    <strong>Batch:</strong> {batch.batch_number}
                  </p>
                  <p>
                    <strong>Supplier:</strong> {batch.supplier}
                  </p>
                  <p>
                    <strong>Tanggal Beli:</strong>{" "}
                    {formatDate(batch.purchase_date)}
                  </p>
                  <p>
                    <strong>Sisa Stok:</strong> {batch.quantity}{" "}
                    {stockItem?.unit || "unit"}
                  </p>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">{error}</p>
          </div>
        )}

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Harga Satuan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Nilai
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Tidak ada riwayat transaksi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTransactionTypeBadge(
                        tx.transaction_type,
                        tx.quantity
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tx.batch ? (
                        <div>
                          <div className="font-medium">
                            {tx.batch.batch_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tx.batch.supplier}
                          </div>
                          {tx.batch.last_edited_by && (
                            <div className="mt-1 text-xs text-gray-600">
                              Diubah oleh {tx.batch.last_edited_by} •{" "}
                              {new Date(
                                tx.batch.last_edited_at || ""
                              ).toLocaleString("id-ID")}
                            </div>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        parseFloat(tx.quantity.toString()) > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {parseFloat(tx.quantity.toString()) > 0 ? "+" : ""}
                      {tx.quantity} {stockItem?.unit || "unit"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tx.unit_price ? formatCurrency(tx.unit_price) : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tx.total_amount ? formatCurrency(tx.total_amount) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{tx.notes || "-"}</div>
                      {tx.last_edited_by && (
                        <div className="mt-1 text-xs text-gray-600">
                          Diubah oleh {tx.last_edited_by} •{" "}
                          {new Date(tx.last_edited_at || "").toLocaleString(
                            "id-ID"
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-700">
              Menampilkan {(pagination.page - 1) * pagination.limit + 1} sampai{" "}
              {Math.min(
                pagination.page * pagination.limit,
                pagination.totalItems
              )}{" "}
              dari {pagination.totalItems} transaksi
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
                className="px-3 py-2 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-2 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Debug Info (remove in production) */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs">
          <h4 className="font-semibold text-gray-700 mb-2">Debug Info:</h4>
          <p>Loading: {loading.toString()}</p>
          <p>Transactions count: {transactions.length}</p>
          <p>Error: {error || "None"}</p>
          <p>Selected batch: {selectedBatch || "None"}</p>
        </div>
      </div>
    </div>
  );
};

export default StockHistory;
