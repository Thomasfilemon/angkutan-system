import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig'; // Menggunakan nama apiClient sesuai kode Anda
import StockAdjustmentModal from '../components/StockAdjustmentModal'; // <-- PASTIKAN PATH INI BENAR

// Interface untuk tipe data item stok
interface StockItem {
  id: number;
  item_code: string;
  item_name: string;
  supplier: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_price: number;
  total_value: number;
  is_low_stock: boolean;
  stock_status: 'adequate' | 'low_stock' | 'out_of_stock';
  category?: {
    category_name: string;
  };
}

const StockManagementPage = () => {
  // State yang sudah ada
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [restockData, setRestockData] = useState({
    quantity: '',
    unit_price: '',
    supplier: '',
    notes: ''
  });

  // === STATE BARU UNTUK ADJUSTMENT MODAL ===
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  // ==========================================

  const fetchStockItems = async () => {
    try {
      setLoading(true);
      // Anda menggunakan '/stock', pastikan ini endpoint yang benar
      const response = await apiClient.get('/stock'); 
      setStockItems(response.data);
    } catch (err) {
      setError('Failed to fetch stock items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockItems();
  }, []);

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await apiClient.post(`/web/stock/${selectedItem.id}/add-stock`, restockData);
      setShowRestockModal(false);
      setRestockData({ quantity: '', unit_price: '', supplier: '', notes: '' });
      fetchStockItems();
    } catch (err) {
      alert('Failed to add stock');
    }
  };

  const handleDelete = async (item: StockItem) => {
    if (window.confirm(`Are you sure you want to delete "${item.item_name}"? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/web/stock/${item.id}`);
        fetchStockItems();
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Failed to delete stock item';
        alert(errorMessage);
      }
    }
  };

  // === FUNGSI BARU UNTUK ADJUSTMENT MODAL ===
  const handleAdjustmentClick = (item: StockItem) => {
      setSelectedStockItem(item);
      setIsAdjustmentModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsAdjustmentModalOpen(false);
      setSelectedStockItem(null);
      // Refresh data tabel setelah modal ditutup untuk melihat perubahan
      fetchStockItems(); 
  };
  // ==========================================

  const getStatusBadge = (status: string) => {
    const classes = {
      adequate: 'bg-green-100 text-green-800',
      low_stock: 'bg-yellow-100 text-yellow-800',
      out_of_stock: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      adequate: 'Cukup',
      low_stock: 'Stok Rendah',
      out_of_stock: 'Habis'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes[status as keyof typeof classes]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) return <div className="text-center p-8">Loading stock items...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Stok</h1>
        <div className="space-x-2">
          <Link to="/stock/create">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              + Tambah Barang
            </button>
          </Link>
          <button 
            onClick={() => fetchStockItems()}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kode</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Nama Barang</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Stok</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Harga</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Total Nilai</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{item.item_code || '-'}</p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <div>
                    <p className="text-gray-900 whitespace-no-wrap font-medium">{item.item_name}</p>
                    {item.category && (
                      <p className="text-gray-600 text-xs">{item.category.category_name}</p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{item.supplier || '-'}</p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <div>
                    <p className="text-gray-900 whitespace-no-wrap">
                      {item.current_stock} {item.unit}
                    </p>
                    <p className="text-gray-600 text-xs">Min: {item.min_stock}</p>
                  </div>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">
                    Rp {item.unit_price.toLocaleString('id-ID')}
                  </p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">
                    Rp {item.total_value.toLocaleString('id-ID')}
                  </p>
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                  {getStatusBadge(item.stock_status)}
                </td>
                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                  <div className="flex justify-end items-center space-x-3">
                    <button 
                      onClick={() => {
                        setSelectedItem(item);
                        setRestockData(prev => ({ ...prev, unit_price: item.unit_price.toString(), supplier: item.supplier || '' }));
                        setShowRestockModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      Restock
                    </button>
                    {/* === TOMBOL ADJUSTMENT DENGAN FUNGSI YANG BENAR === */}
                    <button
                      onClick={() => handleAdjustmentClick(item)}
                      className="text-yellow-600 hover:text-yellow-900 text-sm"
                    >
                      Adjustment
                    </button>
                    {/* ============================================ */}
                    <Link to={`/stock/edit/${item.id}`} className="text-indigo-600 hover:text-indigo-900 text-sm">
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === RENDER MODAL ADJUSTMENT DI SINI === */}
      {isAdjustmentModalOpen && selectedStockItem && (
        <StockAdjustmentModal
          isOpen={isAdjustmentModalOpen}
          onClose={handleCloseModal}
          item={selectedStockItem}
        />
      )}
      {/* ====================================== */}

      {/* Modal Restock yang sudah ada */}
      {showRestockModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Restock: {selectedItem.item_name}
            </h3>
            <form onSubmit={handleRestock}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Unit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={restockData.unit_price}
                  onChange={(e) => setRestockData(prev => ({ ...prev, unit_price: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Supplier</label>
                <input
                  type="text"
                  value={restockData.supplier}
                  onChange={(e) => setRestockData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">Notes</label>
                <textarea
                  value={restockData.notes}
                  onChange={(e) => setRestockData(prev => ({ ...prev, notes: e.target.value }))}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagementPage;