// src/pages/StockCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface StockCategory {
  id: number;
  category_name: string;
}

const StockCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  
  const [formData, setFormData] = useState({
    category_id: '',
    item_code: '',
    item_name: '',
    supplier: '',
    unit: 'Pcs',
    current_stock: '',
    min_stock: '',
    unit_price: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
    if (isEdit && id) {
      fetchStockItem();
    }
  }, [isEdit, id]);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/stock/categories');
      setCategories(response.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchStockItem = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/stock/${id}`);
      const item = response.data;
      setFormData({
        category_id: item.category_id?.toString() || '',
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        supplier: item.supplier || '',
        unit: item.unit || 'Pcs',
        current_stock: item.current_stock?.toString() || '',
        min_stock: item.min_stock?.toString() || '',
        unit_price: item.unit_price?.toString() || '',
        notes: item.notes || ''
      });
    } catch (err) {
      console.error('Failed to fetch stock item:', err);
      alert('Failed to load stock item data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.item_name.trim()) {
      newErrors.item_name = 'Nama barang harus diisi';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Satuan harus diisi';
    }

    if (formData.current_stock && parseFloat(formData.current_stock) < 0) {
      newErrors.current_stock = 'Stok tidak boleh negatif';
    }

    if (formData.min_stock && parseFloat(formData.min_stock) < 0) {
      newErrors.min_stock = 'Minimum stok tidak boleh negatif';
    }

    if (formData.unit_price && parseFloat(formData.unit_price) < 0) {
      newErrors.unit_price = 'Harga tidak boleh negatif';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        current_stock: parseFloat(formData.current_stock) || 0,
        min_stock: parseFloat(formData.min_stock) || 0,
        unit_price: parseFloat(formData.unit_price) || 0
      };

      if (isEdit) {
        await apiClient.put(`/stock/${id}`, submitData);
      } else {
        await apiClient.post('/stock', submitData);
      }

      navigate('/stock');
    } catch (err: any) {
      console.error('Failed to save stock item:', err);
      if (err.response?.data?.errors) {
        alert(err.response.data.errors.join(', '));
      } else {
        alert('Gagal menyimpan data. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return <div className="text-center p-8">Loading stock item data...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {isEdit ? 'Edit Barang Stok' : 'Tambah Barang Stok'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEdit ? 'Ubah informasi barang stok' : 'Tambah barang baru ke dalam stok'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kategori
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">Pilih Kategori</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Item Code */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kode Barang
            </label>
            <input
              type="text"
              name="item_code"
              value={formData.item_code}
              onChange={handleInputChange}
              placeholder="Contoh: OLI-001"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Nama Barang *
            </label>
            <input
              type="text"
              name="item_name"
              value={formData.item_name}
              onChange={handleInputChange}
              placeholder="Masukkan nama barang"
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.item_name ? 'border-red-500' : ''
              }`}
              required
            />
            {errors.item_name && (
              <p className="text-red-500 text-xs italic mt-1">{errors.item_name}</p>
            )}
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Supplier
            </label>
            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={handleInputChange}
              placeholder="Nama supplier"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Satuan *
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.unit ? 'border-red-500' : ''
              }`}
              required
            >
              <option value="Pcs">Pcs</option>
              <option value="Liter">Liter</option>
              <option value="Kg">Kg</option>
              <option value="Meter">Meter</option>
              <option value="Set">Set</option>
              <option value="Botol">Botol</option>
              <option value="Dus">Dus</option>
              <option value="Batang">Batang</option>
              <option value="Lembar">Lembar</option>
            </select>
            {errors.unit && (
              <p className="text-red-500 text-xs italic mt-1">{errors.unit}</p>
            )}
          </div>

          {/* Current Stock */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Stok Saat Ini
            </label>
            <input
              type="number"
              step="0.01"
              name="current_stock"
              value={formData.current_stock}
              onChange={handleInputChange}
              placeholder="0"
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.current_stock ? 'border-red-500' : ''
              }`}
            />
            {errors.current_stock && (
              <p className="text-red-500 text-xs italic mt-1">{errors.current_stock}</p>
            )}
          </div>

          {/* Min Stock */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Minimum Stok
            </label>
            <input
              type="number"
              step="0.01"
              name="min_stock"
              value={formData.min_stock}
              onChange={handleInputChange}
              placeholder="0"
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.min_stock ? 'border-red-500' : ''
              }`}
            />
            {errors.min_stock && (
              <p className="text-red-500 text-xs italic mt-1">{errors.min_stock}</p>
            )}
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Harga Satuan
            </label>
            <input
              type="number"
              step="0.01"
              name="unit_price"
              value={formData.unit_price}
              onChange={handleInputChange}
              placeholder="0"
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.unit_price ? 'border-red-500' : ''
              }`}
            />
            {errors.unit_price && (
              <p className="text-red-500 text-xs italic mt-1">{errors.unit_price}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Catatan
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={4}
            placeholder="Catatan tambahan tentang barang ini..."
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={() => navigate('/stock')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : isEdit ? 'Update Barang' : 'Simpan Barang'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockCreatePage;
