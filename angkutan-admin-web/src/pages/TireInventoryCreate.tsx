// src/pages/TireInventoryCreate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireInventoryData {
  tire_brand: string;
  tire_size: string;
  tire_type: string;
  current_stock: number;
  min_stock: number;
  unit_price: number;
  // NEW: Options for creating tire instances
  create_instances: boolean;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
}

const TireInventoryCreatePage = () => {
  const [formData, setFormData] = useState<TireInventoryData>({
    tire_brand: '',
    tire_size: '',
    tire_type: '',
    current_stock: 0,
    min_stock: 0,
    unit_price: 0,
    create_instances: true, // NEW: Default to creating instances
    quantity: 0,
    purchase_price: 0,
    purchase_date: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              name.includes('stock') || name === 'unit_price' || name === 'quantity' || name === 'purchase_price' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // First create the tire inventory
      const inventoryResponse = await apiClient.post('/tires/tire-inventory', {
        tire_brand: formData.tire_brand,
        tire_size: formData.tire_size,
        tire_type: formData.tire_type,
        current_stock: formData.create_instances ? 0 : formData.current_stock, // Set to 0 if creating instances
        min_stock: formData.min_stock,
        unit_price: formData.unit_price
      });

      // If creating instances, create them
      if (formData.create_instances && formData.quantity > 0) {
        const inventoryId = inventoryResponse.data?.data?.id || inventoryResponse.data?.id;
        
        await apiClient.post('/tires/tire-instances', {
          tire_inventory_id: inventoryId,
          quantity: formData.quantity,
          purchase_price: formData.purchase_price || formData.unit_price,
          purchase_date: formData.purchase_date
        });
      }

      navigate('/tire-inventory');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create tire inventory');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tambah Ban Baru</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
        {/* Basic Tire Information */}
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
              placeholder="Contoh: Bridgestone"
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
              placeholder="Contoh: 1000 R20"
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

          <div className="md:col-span-2">
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

        <hr />

        {/* NEW: Tire Instance Creation Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pembelian Ban</h3>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="create_instances"
                checked={formData.create_instances}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Buat instance ban individual (Direkomendasikan untuk tracking lengkap)
              </span>
            </label>
          </div>

          {formData.create_instances ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah Ban Dibeli *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  required={formData.create_instances}
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
                  value={formData.purchase_price}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Kosongkan untuk menggunakan harga satuan"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Pembelian *
                </label>
                <input
                  type="date"
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleChange}
                  required={formData.create_instances}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stok Awal *
              </label>
              <input
                type="number"
                name="current_stock"
                value={formData.current_stock}
                onChange={handleChange}
                required={!formData.create_instances}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Mode manual: Stok akan ditambahkan tanpa tracking individual
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        {formData.create_instances && formData.quantity > 0 && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Ringkasan:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {formData.quantity} ban akan dibuat dengan serial number unik</li>
              <li>• Total investasi: Rp {((formData.purchase_price || formData.unit_price) * formData.quantity).toLocaleString('id-ID')}</li>
              <li>• Setiap ban dapat dilacak secara individual</li>
              <li>• Stok inventaris akan otomatis bertambah {formData.quantity}</li>
            </ul>
          </div>
        )}

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
            {isLoading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TireInventoryCreatePage;
