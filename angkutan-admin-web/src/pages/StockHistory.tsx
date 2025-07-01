import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import { debounce } from 'lodash';

interface Transaction {
  id: number;
  transaction_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  notes: string;
  transaction_date: string;
}

const StockHistoryPage = () => {
  const { id } = useParams<{ id: string }>();
  
  // State data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [itemName, setItemName] = useState('');
  
  // State UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State untuk Filter dan Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // --- EFEK 1: Ambil nama barang (hanya sekali) ---
  useEffect(() => {
    if (!id) return;
    apiClient.get(`/stock/${id}`)
      .then(response => {
        setItemName(response.data.item_name);
      })
      .catch(err => {
        console.error("Gagal mengambil nama item:", err);
        setError("Gagal memuat detail barang.");
      });
  }, [id]);

  // --- EFEK 2: Ambil data riwayat setiap kali filter atau halaman berubah ---
  const fetchHistory = useCallback(async (page = 1, search = '', startDate = '', endDate = '') => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15', search });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await apiClient.get(`/stock/${id}/history?${params.toString()}`);
      
      setTransactions(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
      setCurrentPage(response.data.pagination.currentPage);

    } catch (err) {
      setError('Gagal memuat riwayat stok');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Debounce untuk efisiensi
  const debouncedFetch = useCallback(debounce((...args) => fetchHistory(...args), 500), [fetchHistory]);

  useEffect(() => {
    debouncedFetch(1, searchTerm, dateRange.startDate, dateRange.endDate);
    return () => debouncedFetch.cancel();
  }, [searchTerm, dateRange, debouncedFetch]);

  // Handler untuk paginasi
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
        fetchHistory(newPage, searchTerm, dateRange.startDate, dateRange.endDate);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDateRange({ startDate: '', endDate: '' });
  };
  
  const getTransactionTypeBadge = (type: string, quantity: number) => {
      const types = {
          in: { label: 'Masuk', class: 'bg-green-100 text-green-800' },
          out: { label: 'Keluar', class: 'bg-red-100 text-red-800' },
          adjustment: { label: 'Adjustment', class: 'bg-yellow-100 text-yellow-800' }
      };
      if (type === 'adjustment') {
          const label = quantity > 0 ? 'Adj. (Tambah)' : 'Adj. (Kurang)';
          return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${types.adjustment.class}`}>{label}</span>;
      }
      return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${types[type as keyof typeof types].class}`}>{types[type as keyof typeof types].label}</span>;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Riwayat Stok</h1>
      <h2 className="text-xl font-semibold text-gray-600 mb-6">{itemName}</h2>

      <div className="mb-4">
        <Link to="/stock" className="text-blue-500 hover:underline">&larr; Kembali ke Manajemen Stok</Link>
      </div>

      {/* --- Filter Bar --- */}
      <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <input type="text" placeholder="Cari di catatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md col-span-2" />
          <input type="date" name="startDate" value={dateRange.startDate} onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} className="p-2 border rounded-md" />
          <input type="date" name="endDate" value={dateRange.endDate} onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} className="p-2 border rounded-md" />
          <button onClick={resetFilters} className="p-2 bg-gray-300 hover:bg-gray-400 rounded-md">Reset</button>
        </div>
      </div>

      {/* --- Tabel Riwayat --- */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">Tanggal</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">Tipe Transaksi</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-right text-xs font-semibold text-gray-600 uppercase">Jumlah</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
                <tr><td colSpan={4} className="text-center p-10 text-gray-500">Memuat...</td></tr>
            ) : error ? (
                <tr><td colSpan={4} className="text-center p-10 text-red-500">{error}</td></tr>
            ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-5 py-4 text-sm"><p className="text-gray-900 whitespace-no-wrap">{new Date(tx.transaction_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p></td>
                        <td className="px-5 py-4 text-sm">{getTransactionTypeBadge(tx.transaction_type, tx.quantity)}</td>
                        <td className="px-5 py-4 text-sm text-right"><p className={`font-semibold whitespace-no-wrap ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{tx.quantity}</p></td>
                        <td className="px-5 py-4 text-sm"><p className="text-gray-900 whitespace-no-wrap">{tx.notes || '-'}</p></td>
                    </tr>
                ))
            ) : (
                <tr><td colSpan={4} className="text-center p-10 text-gray-500">Tidak ada riwayat transaksi yang cocok dengan filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Pagination --- */}
      <div className="py-4 flex justify-between items-center">
        <span className="text-sm text-gray-700">
            Halaman <span className="font-semibold">{currentPage}</span> dari <span className="font-semibold">{totalPages}</span>
        </span>
        <div className="flex items-center space-x-2">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || loading} className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white">&larr; Sebelumnya</button>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || loading} className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white">Berikutnya &rarr;</button>
        </div>
      </div>
    </div>
  );
};

export default StockHistoryPage;