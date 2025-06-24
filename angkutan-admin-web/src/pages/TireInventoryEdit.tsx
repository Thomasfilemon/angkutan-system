// src/pages/TireInventoryEdit.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireInventoryData {
  tire_brand: string;
  tire_size: string;
  tire_type: string;
  current_stock: number;
  min_stock: number;
  unit_price: number;
}

interface AddInstanceData {
  quantity: number;
  purchase_price: number;
  purchase_date: string;
}

const TireInventoryEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<TireInventoryData>({
    tire_brand: '',
    tire_size: '',
    tire_type: '',
    current_stock: 0,
    min_stock: 0,
    unit_price: 0
  });
  const [addInstanceData, setAddInstanceData] = useState<AddInstanceData>({
    quantity: 0,
    purchase_price: 0,
    purchase_date: new Date().toISOString().split('T')[0]
  });
  const [showAddInstances, setShowAddInstances] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTireData();
  }, [id]);

  const fetchTireData = async () => {
    try {
      setIsPageLoading(true);
      const response = await apiClient.get(`/tires/tire-inventory/${id}`);
      const data = response.data?.data || response.data;
      setFormData({
        tire_brand: data.tire_brand || '',
        tire_size: data.tire_size || '',
        tire_type: data.tire_type || '',
        current_stock: data.current_stock || 0,
        min_stock: data.min_stock || 0,
        unit_price: data.unit_price || 0
      });
      setAddInstanceData(prev => ({
        ...prev,
        purchase_price: data.unit_price || 0
      }));
    } catch (err) {
      setError('Failed to load tire data');
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('stock') || name === 'unit_price' ? Number(value) : value
    }));
  };

  const handleInstanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddInstanceData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'purchase_price' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.put(`/tires/tire-inventory/${id}`, formData);
      navigate('/tire-inventory');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update tire inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddInstances = async () => {
    if (addInstanceData.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.post('/tires/tire-instances', {
        tire_inventory_id: parseInt(id!),
        quantity: addInstanceData.quantity,
        purchase_price: addInstanceData.purchase_price || formData.unit_price,
        purchase_date: addInstanceData.purchase_date
      });

      // Refresh data
      await fetchTireData();
      setShowAddInstances(false);
      setAddInstanceData({
        quantity: 0,
        purchase_price: formData.unit_price,
        purchase_date: new Date().toISOString().split('T')[0]
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add tire instances');
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) return <div className="text-center p-8">Loading...</div>;
  if (error && isPageLoading) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Edit Ban</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Basic Information Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Informasi Dasar</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Ban *
            </label>
            <input
              type="text"
              name="tire_brand"
              value={formData.tire_brand}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ukuran Ban *
            </label>
            <input
              type="text"
              name="tire_size"
              value={formData.tire_size}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipe Ban
            </label>
            <select
              name="tire_type"
              value={formData.tire_type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih Tipe</option>
              <option value="Radial">Radial</option>
              <option value="Bias">Bias</option>
              <option value="Tubeless">Tubeless</option>
              <option value="Tube Type">Tube Type</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stok Saat Ini
            </label>
            <input
              type="number"
              name="current_stock"
              value={formData.current_stock}
              onChange={handleChange}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Stok otomatis dihitung dari instance ban yang dibuat
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Stok *
            </label>
            <input
              type="number"
              name="min_stock"
              value={formData.min_stock}
              onChange={handleChange}
              required
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Harga Satuan (Rp) *
            </label>
            <input
              type="number"
              name="unit_price"
              value={formData.unit_price}
              onChange={handleChange}
              required
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/tire-inventory')}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? 'Menyimpan...' : 'Update'}
          </button>
        </div>
      </form>

      {/* Add New Instances Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Tambah Stok Ban</h3>
          <button
            type="button"
            onClick={() => setShowAddInstances(!showAddInstances)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            {showAddInstances ? 'Batal' : '+ Tambah Ban Baru'}
          </button>
        </div>

        {showAddInstances && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah Ban *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={addInstanceData.quantity}
                  onChange={handleInstanceChange}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Harga Beli per Ban (Rp)
                </label>
                <input
                  type="number"
                  name="purchase_price"
                  value={addInstanceData.purchase_price}
                  onChange={handleInstanceChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Pembelian *
                </label>
                <input
                  type="date"
                  name="purchase_date"
                  value={addInstanceData.purchase_date}
                  onChange={handleInstanceChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {addInstanceData.quantity > 0 && (
              <div className="bg-green-50 p-3 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>Total investasi:</strong> Rp {(addInstanceData.purchase_price * addInstanceData.quantity).toLocaleString('id-ID')}
                </p>
                <p className="text-sm text-green-700">
                  {addInstanceData.quantity} ban akan dibuat dengan serial number unik
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddInstances}
                disabled={isLoading || addInstanceData.quantity <= 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
              >
                {isLoading ? 'Menambahkan...' : 'Tambah Ban'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TireInventoryEditPage;
