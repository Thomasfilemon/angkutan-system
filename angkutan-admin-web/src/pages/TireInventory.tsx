// src/pages/TireInventory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireInventory {
  id: number;
  tire_brand: string;
  tire_size: string;
  tire_type: string;
  current_stock: number;
  min_stock: number;
  unit_price: number;
  created_at: string;
}

const TireInventoryPage = () => {
  const [inventory, setInventory] = useState<TireInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      // Updated to use the correct endpoint
      const response = await apiClient.get('/tires/tire-inventory/all');
      setInventory(response.data?.data || response.data || []);
    } catch (err) {
      setError('Failed to fetch tire inventory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this tire from inventory?')) {
      try {
        await apiClient.delete(`/tires/tire-inventory/${id}`);
        setInventory(prev => prev.filter(tire => tire.id !== id));
      } catch (err) {
        alert('Failed to delete tire');
      }
    }
  };

  // Filter and search logic
  const filteredInventory = inventory.filter(tire => {
    const matchesSearch = tire.tire_brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tire.tire_size.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tire.tire_type && tire.tire_type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBrand = filterBrand === '' || tire.tire_brand === filterBrand;
    return matchesSearch && matchesBrand;
  });

  // Get unique brands for filter
  const uniqueBrands = Array.from(new Set(inventory.map(tire => tire.tire_brand)));

  // Calculate totals
  const totalValue = inventory.reduce((sum, tire) => sum + (tire.current_stock * tire.unit_price), 0);
  const lowStockCount = inventory.filter(tire => tire.current_stock <= tire.min_stock).length;

  if (loading) return <div className="text-center p-8">Loading inventory...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Inventaris Ban</h1>
        <Link to="/tire-inventory/create">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Tambah Ban Baru
          </button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Jenis Ban</h3>
          <p className="text-2xl font-bold text-blue-600">{inventory.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Stok</h3>
          <p className="text-2xl font-bold text-green-600">
            {inventory.reduce((sum, tire) => sum + tire.current_stock, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Nilai Inventaris</h3>
          <p className="text-2xl font-bold text-purple-600">
            Rp {totalValue.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Stok Rendah</h3>
          <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Ban:
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan brand, ukuran, atau tipe..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Brand:
            </label>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Brand</option>
              {uniqueBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Brand</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Ukuran</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tipe</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Stok</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Min Stok</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Harga Satuan</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Nilai Total</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length > 0 ? (
              filteredInventory.map((tire) => (
                <tr key={tire.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">{tire.tire_brand}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.tire_size}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.tire_type || '-'}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-bold">{tire.current_stock}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.min_stock}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      Rp {tire.unit_price.toLocaleString('id-ID')}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">
                      Rp {(tire.current_stock * tire.unit_price).toLocaleString('id-ID')}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tire.current_stock <= tire.min_stock 
                        ? 'bg-red-100 text-red-800' 
                        : tire.current_stock <= tire.min_stock * 2
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {tire.current_stock <= tire.min_stock 
                        ? 'Stok Rendah' 
                        : tire.current_stock <= tire.min_stock * 2
                        ? 'Perhatian'
                        : 'Normal'
                      }
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                    <div className="flex justify-end space-x-2">
                      <Link to={`/tire-inventory/edit/${tire.id}`} className="text-indigo-600 hover:text-indigo-900">
                        Edit
                      </Link>
                      <button 
                        onClick={() => handleDelete(tire.id)} 
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-500">
                  {searchTerm || filterBrand ? 'Tidak ada ban yang sesuai dengan filter' : 'Belum ada data inventaris ban'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TireInventoryPage;
