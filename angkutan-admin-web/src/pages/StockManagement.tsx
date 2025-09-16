import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import StockAdjustmentModal from "../components/StockAdjustmentModal";

// --- Simplified Icon Collection ---
const IconHistory = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const IconBatch = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const IconDelete = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

interface StockItem {
  id: number;
  item_code: string;
  item_name: string;
  supplier: string;
  unit: string;
  rack_row?: number | null;
  rack_level?: number | null;
  current_stock: number;
  min_stock: number;
  average_unit_price: number;
  total_value: number;
  stock_status: string;
  category?: { category_name: string };
  weighted_average_price?: number;
  batch_count?: number;
  is_low_stock?: boolean;
  last_edited_by?: string;
  last_edited_at?: string;
}

// ✅ ADD SEARCH FILTERS INTERFACE
interface SearchFilters {
  searchTerm: string;
  categoryFilter: string;
  supplierFilter: string;
  statusFilter: string;
  startDate: string;
  endDate: string;
}

const StockManagementPage = () => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ UPDATED FILTER STATES
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: "",
    categoryFilter: "",
    supplierFilter: "",
    statusFilter: "",
    startDate: "",
    endDate: "",
  });

  // ✅ ADD FILTER OPTIONS
  const [filterOptions, setFilterOptions] = useState({
    categories: [] as string[],
    suppliers: [] as string[],
    statuses: [] as string[],
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Modal state for adjustments
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] =
    useState<StockItem | null>(null);

  // ✅ ENHANCED FETCH FUNCTION
  const fetchStockItems = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      const response = await apiClient.get(`/stock?${params.toString()}`);
      const responseData = response.data?.data || [];
      const paginationData = response.data?.pagination || {};

      setStockItems(responseData);
      setTotalPages(paginationData.totalPages || 0);
      setTotalItems(paginationData.totalItems || 0);
      setCurrentPage(paginationData.currentPage || 1);

      // ✅ EXTRACT FILTER OPTIONS
      extractFilterOptions(responseData);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Gagal memuat data stok");
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ ADD FILTER OPTIONS EXTRACTION
  const extractFilterOptions = (items: StockItem[]) => {
    const categories = Array.from(
      new Set(
        items
          .map((item) => item.category?.category_name)
          .filter((name): name is string => Boolean(name))
      )
    );
    const suppliers = Array.from(
      new Set(
        items
          .map((item) => item.supplier)
          .filter((supplier): supplier is string => Boolean(supplier))
      )
    );
    const statuses = Array.from(
      new Set(
        items
          .map((item) => item.stock_status)
          .filter((status): status is string => Boolean(status))
      )
    );

    setFilterOptions({
      categories: categories.sort(),
      suppliers: suppliers.sort(),
      statuses: statuses.sort(),
    });
  };

  // ✅ ADD FILTER LOGIC
  const applyFilters = useCallback(() => {
    let filtered = [...stockItems];

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.item_name.toLowerCase().includes(searchLower) ||
          item.item_code?.toLowerCase().includes(searchLower) ||
          item.supplier?.toLowerCase().includes(searchLower) ||
          item.category?.category_name?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (filters.categoryFilter) {
      filtered = filtered.filter(
        (item) => item.category?.category_name === filters.categoryFilter
      );
    }

    // Supplier filter
    if (filters.supplierFilter) {
      filtered = filtered.filter(
        (item) => item.supplier === filters.supplierFilter
      );
    }

    // Status filter
    if (filters.statusFilter) {
      filtered = filtered.filter(
        (item) => item.stock_status === filters.statusFilter
      );
    }

    setFilteredItems(filtered);
  }, [stockItems, filters]);

  // ✅ ADD FILTER EFFECT
  useEffect(() => {
    applyFilters();
  }, [stockItems, filters, applyFilters]);

  // ✅ ADD FILTER HANDLERS
  const handleFilterChange = (
    filterType: keyof SearchFilters,
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: "",
      categoryFilter: "",
      supplierFilter: "",
      statusFilter: "",
      startDate: "",
      endDate: "",
    });
  };

  useEffect(() => {
    fetchStockItems(1);
  }, [fetchStockItems]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      fetchStockItems(newPage);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (
      window.confirm(
        "Anda yakin ingin menghapus item ini? Semua batch terkait akan ikut terhapus."
      )
    ) {
      try {
        await apiClient.delete(`/stock/${itemId}`);
        alert("Item berhasil dihapus");
        fetchStockItems(currentPage);
      } catch (err: any) {
        console.error("Delete error:", err);
        alert(
          `Gagal menghapus item: ${err.response?.data?.message || err.message}`
        );
      }
    }
  };

  const openAdjustModal = (item: StockItem) => {
    setSelectedItemForAdjust(item);
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSuccess = (payload: any) => {
    const updated = payload?.updated_item;
    if (!updated) return;

    // Update stockItems and filteredItems
    setStockItems((prev) =>
      prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
    );
    setFilteredItems((prev) =>
      prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
    );
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      adequate: "bg-green-100 text-green-800",
      low_stock: "bg-yellow-100 text-yellow-800",
      out_of_stock: "bg-red-100 text-red-800",
    };
    const labels = {
      adequate: "Cukup",
      low_stock: "Stok Rendah",
      out_of_stock: "Habis",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          classes[status as keyof typeof classes]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Manajemen Stok FIFO
          </h1>
          <p className="text-gray-600 mt-1">
            Sistem First In, First Out untuk pelacakan batch
          </p>
        </div>
        <Link to="/stock/create">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow">
            + Restok Barang
          </button>
        </Link>
      </div>

      {/* ✅ ENHANCED SEARCH AND FILTER SECTION */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Filter & Pencarian
          </h2>
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Hapus Semua Filter
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search Term */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pencarian
            </label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
              placeholder="Nama, kode, supplier..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <select
              value={filters.categoryFilter}
              onChange={(e) =>
                handleFilterChange("categoryFilter", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Kategori</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier
            </label>
            <select
              value={filters.supplierFilter}
              onChange={(e) =>
                handleFilterChange("supplierFilter", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Supplier</option>
              {filterOptions.suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Stok
            </label>
            <select
              value={filters.statusFilter}
              onChange={(e) =>
                handleFilterChange("statusFilter", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Status</option>
              {filterOptions.statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "adequate"
                    ? "Cukup"
                    : status === "low_stock"
                    ? "Stok Rendah"
                    : "Habis"}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* ✅ ADD RESULT COUNT */}
        <div className="mt-4 text-sm text-gray-600">
          Menampilkan {filteredItems.length} dari {totalItems} item
        </div>
      </div>

      {/* ✅ UPDATED TABLE TO USE FILTERED ITEMS */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-200">
            <tr>
              <th scope="col" className="px-6 py-3 border border-gray-300">
                Nama Barang
              </th>
              <th scope="col" className="px-6 py-3 border border-gray-300">
                Supplier
              </th>
              <th scope="col" className="px-6 py-3 border border-gray-300">
                Rak
              </th>
              <th
                scope="col"
                className="px-6 py-3 border border-gray-300 text-center"
              >
                Stok Saat Ini
              </th>
              <th
                scope="col"
                className="px-6 py-3 border border-gray-300 text-center"
              >
                Stok Min.
              </th>
              <th scope="col" className="px-6 py-3 border border-gray-300">
                Harga Rata-rata
              </th>
              <th scope="col" className="px-6 py-3 border border-gray-300">
                Total Nilai
              </th>
              <th
                scope="col"
                className="px-6 py-3 border border-gray-300 text-center"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 border border-gray-300 text-center"
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-red-500">
                  {error}
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-gray-500">
                  {stockItems.length === 0
                    ? "Tidak ada data stok"
                    : "Tidak ada item yang sesuai dengan filter"}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-6 py-4 border border-gray-300 font-medium text-gray-900">
                    <div>
                      <div className="font-semibold">{item.item_name}</div>
                      <div className="text-xs text-gray-500">
                        {item.item_code || "-"}
                        {item.category && (
                          <span className="ml-2 px-1 bg-blue-100 text-blue-800 rounded">
                            {item.category.category_name}
                          </span>
                        )}
                        {item.last_edited_by && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              Diubah oleh {item.last_edited_by} •{" "}
                              {new Date(
                                item.last_edited_at || ""
                              ).toLocaleString("id-ID")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 border border-gray-300">
                    {item.supplier || "-"}
                  </td>
                  <td className="px-6 py-4 border border-gray-300">
                    {(() => {
                      const mapRowToLetter = (row?: number | null) =>
                        row ? String.fromCharCode("A".charCodeAt(0) + (row - 1)) : null;
                      const letter = mapRowToLetter(item.rack_row);
                      const level = item.rack_level ?? null;
                      return letter && level ? `${letter}${level}` : "-";
                    })()}
                  </td>
                  <td className="px-6 py-4 border border-gray-300 text-center">
                    <span
                      className={`font-semibold ${
                        item.current_stock <= 0
                          ? "text-red-600"
                          : item.is_low_stock
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {item.current_stock} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 border border-gray-300 text-center">
                    {item.min_stock} {item.unit}
                  </td>
                  <td className="px-6 py-4 border border-gray-300">
                    Rp{" "}
                    {Number(item.average_unit_price || 0).toLocaleString(
                      "id-ID"
                    )}
                  </td>
                  <td className="px-6 py-4 border border-gray-300">
                    <div>
                      <div className="font-semibold">
                        Rp{" "}
                        {Number(item.total_value || 0).toLocaleString("id-ID")}
                      </div>
                      {item.batch_count && (
                        <div className="text-xs text-gray-500">
                          {item.batch_count} batch
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 border border-gray-300 text-center">
                    {getStatusBadge(item.stock_status)}
                  </td>
                  <td className="px-6 py-4 border border-gray-300">
                    {/* ✅ FIXED: BATCH NAVIGATION - Back to Link instead of modal */}
                    <div className="flex justify-center items-center space-x-1">
                      <Link
                        to={`/stock/${item.id}/batches`}
                        className="p-1 rounded-full hover:bg-purple-100 text-gray-500 hover:text-purple-600"
                        title="Lihat Batches"
                      >
                        <IconBatch />
                      </Link>
                      <Link
                        to={`/stock/history/${item.id}`}
                        className="p-1 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-900"
                        title="Riwayat Transaksi"
                      >
                        <IconHistory />
                      </Link>
                      <button
                        onClick={() => openAdjustModal(item)}
                        className="p-1 rounded-full hover:bg-blue-100 text-gray-500 hover:text-blue-600"
                        title="Penyesuaian Stok"
                      >
                        {/* Simple plus icon */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600"
                        title="Hapus Barang"
                      >
                        <IconDelete />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedItemForAdjust && (
        <StockAdjustmentModal
          isOpen={isAdjustModalOpen}
          onClose={() => {
            setIsAdjustModalOpen(false);
            setSelectedItemForAdjust(null);
          }}
          item={selectedItemForAdjust}
          onSuccess={(payload) => handleAdjustSuccess(payload)}
        />
      )}

      {/* Pagination */}
      <div className="py-4 flex justify-between items-center">
        <span className="text-sm text-gray-700">
          Total <span className="font-semibold">{totalItems}</span> item
          {filteredItems.filter((item) => item.is_low_stock).length > 0 && (
            <span className="ml-4 text-yellow-600">
              • {filteredItems.filter((item) => item.is_low_stock).length} stok
              rendah
            </span>
          )}
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white"
          >
            &larr; Sebelumnya
          </button>
          <span className="text-sm">
            Halaman <span className="font-semibold">{currentPage}</span> dari{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white"
          >
            Berikutnya &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockManagementPage;
