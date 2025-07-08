// src/pages/StockCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface StockCategory {
  id: number;
  category_name: string;
}

interface StockItem {
  id: number;
  category_id: number | null;
  item_code: string;
  item_name: string;
  supplier: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_price: number;
  notes: string;
}

interface FormItem {
  id: number | null;
  category_id: string;
  item_code: string;
  item_name: string;
  supplier: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  unit_price: string;
  notes: string;
  isNew: boolean;
  adjustmentType: 'add' | 'deduct'; // New field for toggle
  adjustmentAmount: string; // New field for adjustment amount
  originalStock?: number; // Track original stock for existing items
}

const StockCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  
  const [formItems, setFormItems] = useState<FormItem[]>([
    {
      id: null,
      category_id: '',
      item_code: '',
      item_name: '',
      supplier: '',
      unit: 'Pcs',
      current_stock: '',
      min_stock: '',
      unit_price: '',
      notes: '',
      isNew: true,
      adjustmentType: 'add', // Default to addition
      adjustmentAmount: '0', // Start with 0
      originalStock: 0
    }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Add these to the state in StockCreatePage
  const [saveToCash, setSaveToCash] = useState(true);
  const [isTempo, setIsTempo] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("General");
  const [notaFile, setNotaFile] = useState<File | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchStockItems();
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

  const fetchStockItems = async () => {
    try {
      const response = await apiClient.get('/stock');
      setStockItems(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch stock items:', err);
    }
  };

  const fetchStockItem = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/stock/${id}`);
      const item = response.data;
      setFormItems([{
        id: item.id,
        category_id: item.category_id?.toString() || '',
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        supplier: item.supplier || '',
        unit: item.unit || 'Pcs',
        current_stock: item.current_stock?.toString() || '',
        min_stock: item.min_stock?.toString() || '',
        unit_price: item.unit_price?.toString() || '',
        notes: item.notes || '',
        isNew: false,
        adjustmentType: 'add',
        adjustmentAmount: '0',
        originalStock: item.current_stock // Store original stock
      }]);
    } catch (err) {
      console.error('Failed to fetch stock item:', err);
      alert('Failed to load stock item data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setFormItems([
      ...formItems,
      {
        id: null,
        category_id: '',
        item_code: '',
        item_name: '',
        supplier: '',
        unit: 'Pcs',
        current_stock: '',
        min_stock: '',
        unit_price: '',
        notes: '',
        isNew: true,
        adjustmentType: 'add',
        adjustmentAmount: '0',
        originalStock: 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length <= 1) return;
    const newItems = [...formItems];
    newItems.splice(index, 1);
    setFormItems(newItems);
  };

  const handleInputChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [name]: value };
    setFormItems(newItems);
    
    // Clear error when user starts typing
    const errorKey = `${name}-${index}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleAdjustmentTypeChange = (index: number, type: 'add' | 'deduct') => {
    const newItems = [...formItems];
    newItems[index].adjustmentType = type;
    setFormItems(newItems);
  };

  const handleAdjustmentAmountChange = (index: number, value: string) => {
    const newItems = [...formItems];
    newItems[index].adjustmentAmount = value;
    setFormItems(newItems);
    
    // Clear error
    const errorKey = `adjustmentAmount-${index}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleItemSelect = async (index: number, itemId: number | null) => {
    const newItems = [...formItems];
    
    if (itemId === null) {
      // "Add New Item" selected
      newItems[index] = {
        id: null,
        category_id: '',
        item_code: '',
        item_name: '',
        supplier: '',
        unit: 'Pcs',
        current_stock: '',
        min_stock: '',
        unit_price: '',
        notes: '',
        isNew: true,
        adjustmentType: 'add',
        adjustmentAmount: '0',
        originalStock: 0
      };
    } else {
      // Existing item selected - fetch full details
      try {
        setLoading(true);
        const response = await apiClient.get(`/stock/${itemId}`);
        const selectedItem = response.data;
        
        newItems[index] = {
          id: selectedItem.id,
          category_id: selectedItem.category_id?.toString() || '',
          item_code: selectedItem.item_code || '',
          item_name: selectedItem.item_name || '',
          supplier: selectedItem.supplier || '',
          unit: selectedItem.unit || 'Pcs',
          current_stock: selectedItem.current_stock?.toString() || '',
          min_stock: selectedItem.min_stock?.toString() || '',
          unit_price: selectedItem.unit_price?.toString() || '',
          notes: selectedItem.notes || '',
          isNew: false,
          adjustmentType: 'add',
          adjustmentAmount: '0',
          originalStock: selectedItem.current_stock
        };
      } catch (err) {
        console.error('Failed to fetch item details:', err);
        alert('Gagal memuat detail barang');
      } finally {
        setLoading(false);
      }
    }
    
    setFormItems(newItems);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    formItems.forEach((item, index) => {
      if (!item.item_name.trim()) {
        newErrors[`item_name-${index}`] = 'Nama barang harus diisi';
        isValid = false;
      }

      if (!item.unit.trim()) {
        newErrors[`unit-${index}`] = 'Satuan harus diisi';
        isValid = false;
      }

      // Validate adjustment amount
      const adjustmentAmount = parseFloat(item.adjustmentAmount) || 0;
      if (adjustmentAmount <= 0) {
        newErrors[`adjustmentAmount-${index}`] = 'Jumlah penyesuaian harus lebih dari 0';
        isValid = false;
      }

      // For deduction, ensure we don't deduct more than available stock
      if (item.adjustmentType === 'deduct') {
        const currentStock = item.originalStock || 0;
        if (adjustmentAmount > currentStock) {
          newErrors[`adjustmentAmount-${index}`] = 'Jumlah pengurangan tidak boleh melebihi stok saat ini';
          isValid = false;
        }
      }

      if (item.min_stock && parseFloat(item.min_stock) < 0) {
        newErrors[`min_stock-${index}`] = 'Minimum stok tidak boleh negatif';
        isValid = false;
      }

      if (item.unit_price && parseFloat(item.unit_price) < 0) {
        newErrors[`unit_price-${index}`] = 'Harga tidak boleh negatif';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNotaFile(e.target.files[0]);
    } else {
      setNotaFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }

  setLoading(true);

  try {
    let totalRestockCost = 0;
    let restockDescription = 'Pembelian Stok:\n';
    
    // Process each item
    for (const formItem of formItems) {
      const adjustmentAmount = parseFloat(formItem.adjustmentAmount) || 0;
      const originalStock = parseFloat(formItem.originalStock?.toString() || '0');
      let newStock = 0;
      
      if (formItem.isNew) {
        newStock = formItem.adjustmentType === 'add' 
          ? adjustmentAmount 
          : 0;
      } else {
        newStock = formItem.adjustmentType === 'add' 
          ? originalStock + adjustmentAmount 
          : Math.max(0, originalStock - adjustmentAmount);
      }

      // Prepare data for API
      const submitData = {
        ...formItem,
        category_id: formItem.category_id ? parseInt(formItem.category_id) : null,
        current_stock: newStock,
        min_stock: parseFloat(formItem.min_stock) || 0,
        unit_price: parseFloat(formItem.unit_price) || 0
      };

      // Save the item
      if (formItem.isNew || !formItem.id) {
        await apiClient.post('/stock', submitData);
      } else {
        await apiClient.put(`/stock/${formItem.id}`, submitData);
      }

      // Calculate cost for cash transaction (only for additions)
      if (formItem.adjustmentType === 'add' && adjustmentAmount > 0) {
        const unitPrice = parseFloat(formItem.unit_price) || 0;
        const itemCost = adjustmentAmount * unitPrice;
        totalRestockCost += itemCost;
        restockDescription += `• ${formItem.item_name} +${adjustmentAmount} @${unitPrice.toLocaleString()} = ${itemCost.toLocaleString()}\n`;
      }
    }

    // Create cash transaction using FormData approach (second method)
    if (totalRestockCost > 0 && saveToCash) {
      const transactionType = isTempo ? "kredit_tempo" : "kredit";
      restockDescription += `\nTotal: ${totalRestockCost.toLocaleString()}`;

      const cashFormData = new FormData();
      cashFormData.append('transaction_type', transactionType);
      cashFormData.append('amount', String(totalRestockCost));
      cashFormData.append('description', restockDescription);
      cashFormData.append('transaction_date', new Date().toISOString());
      cashFormData.append('account', selectedAccount);
      
      // Add file attachment if exists
      if (notaFile) {
        cashFormData.append('attachment', notaFile);
      }

      await apiClient.post("/cash/transactions", cashFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
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

  const calculateNewStock = (item: FormItem) => {
    const adjustmentAmount = parseFloat(item.adjustmentAmount) || 0;
    const originalStock = parseFloat(item.originalStock?.toString() || '0'); // Parse to float
    
    if (item.isNew) {
      return item.adjustmentType === 'add' 
        ? adjustmentAmount 
        : 0;
    }
    
    return item.adjustmentType === 'add' 
      ? originalStock + adjustmentAmount 
      : Math.max(0, originalStock - adjustmentAmount);
  };

  if (loading && isEdit) {
    return <div className="text-center p-8">Loading stock item data...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {isEdit ? 'Edit Barang Stok' : formItems.length > 1 ? 'Kelola Barang Stok' : 'Tambah Barang Stok'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEdit 
            ? 'Ubah informasi barang stok' 
            : formItems.length > 1 
              ? 'Kelola beberapa barang sekaligus' 
              : 'Tambah barang baru ke dalam stok'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        {formItems.map((item, index) => {
          const newStock = calculateNewStock(item);
          
          return (
            <div key={index} className="border-b border-gray-200 pb-6 mb-6 relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-700">Barang #{index + 1}</h2>
                {formItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {/* Item Selection (only when not in edit mode) */}
              {!isEdit && (
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Pilih Barang
                  </label>
                  <select
                    value={item.id || ''}
                    onChange={(e) => handleItemSelect(index, e.target.value ? parseInt(e.target.value) : null)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    disabled={loading}
                  >
                    <option value="">+ Tambah Barang Baru</option>
                    <optgroup label="Barang yang Ada">
                      {stockItems.map(stockItem => (
                        <option key={stockItem.id} value={stockItem.id}>
                          {stockItem.item_name} (Stok: {stockItem.current_stock} {stockItem.unit})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category */}
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Kategori
                  </label>
                  <select
                    name="category_id"
                    value={item.category_id}
                    onChange={(e) => handleInputChange(index, e)}
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
                    value={item.item_code}
                    onChange={(e) => handleInputChange(index, e)}
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
                    value={item.item_name}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Masukkan nama barang"
                    className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                      errors[`item_name-${index}`] ? 'border-red-500' : ''
                    }`}
                    required
                  />
                  {errors[`item_name-${index}`] && (
                    <p className="text-red-500 text-xs italic mt-1">{errors[`item_name-${index}`]}</p>
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
                    value={item.supplier}
                    onChange={(e) => handleInputChange(index, e)}
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
                    value={item.unit}
                    onChange={(e) => handleInputChange(index, e)}
                    className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                      errors[`unit-${index}`] ? 'border-red-500' : ''
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
                  {errors[`unit-${index}`] && (
                    <p className="text-red-500 text-xs italic mt-1">{errors[`unit-${index}`]}</p>
                  )}
                </div>

                {/* Stock Adjustment */}
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Penyesuaian Stok
                  </label>
                  <div className="flex items-center mb-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustmentTypeChange(index, 'add')}
                      className={`px-3 py-1 rounded-l ${
                        item.adjustmentType === 'add' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Tambah
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustmentTypeChange(index, 'deduct')}
                      className={`px-3 py-1 rounded-r ${
                        item.adjustmentType === 'deduct' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Kurangi
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.adjustmentAmount}
                    onChange={(e) => handleAdjustmentAmountChange(index, e.target.value)}
                    placeholder="Jumlah"
                    className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                      errors[`adjustmentAmount-${index}`] ? 'border-red-500' : ''
                    }`}
                  />
                  {errors[`adjustmentAmount-${index}`] && (
                    <p className="text-red-500 text-xs italic mt-1">{errors[`adjustmentAmount-${index}`]}</p>
                  )}
                </div>

                {/* New Stock Display */}
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Stok Baru
                  </label>
                  <div className="p-2 bg-gray-100 rounded">
                    <span className="font-semibold">{newStock}</span> {item.unit}
                    {!item.isNew && (
                      <span className="text-sm text-gray-600 ml-2">
                        (Sebelumnya: {item.originalStock})
                      </span>
                    )}
                  </div>
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
                    value={item.min_stock}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="0"
                    className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                      errors[`min_stock-${index}`] ? 'border-red-500' : ''
                    }`}
                  />
                  {errors[`min_stock-${index}`] && (
                    <p className="text-red-500 text-xs italic mt-1">{errors[`min_stock-${index}`]}</p>
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
                    value={item.unit_price}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="0"
                    className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                      errors[`unit_price-${index}`] ? 'border-red-500' : ''
                    }`}
                  />
                  {errors[`unit_price-${index}`] && (
                    <p className="text-red-500 text-xs italic mt-1">{errors[`unit_price-${index}`]}</p>
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
                  value={item.notes}
                  onChange={(e) => handleInputChange(index, e)}
                  rows={4}
                  placeholder="Catatan tambahan tentang barang ini..."
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
            </div>
          );
        })}

        {/* Add Item Button */}
        {!isEdit && (
          <div className="flex justify-center mb-6">
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center text-blue-500 hover:text-blue-700"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Tambah Barang Lain
            </button>
          </div>
        )}

        {/* Settings for Cash Transaction */}
        <div className="mt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={saveToCash}
              onChange={(e) => setSaveToCash(e.target.checked)}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="ml-2 text-gray-700">Simpan ke Buku Kas</span>
          </label>
          {saveToCash && (
            <div className="mt-4 p-4 border-l-4 border-blue-500 bg-blue-50 rounded">
              <div className="flex items-center mb-3">
                <label className="flex items-center mr-4">
                  <input
                    type="checkbox"
                    checked={isTempo}
                    onChange={(e) => setIsTempo(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">Transaksi Tempo</span>
                </label>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Akun
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="Ewaldo">Ewaldo</option>
                  <option value="Malvin">Malvin</option>
                  <option value="Company">Company</option>
                  <option value="General">General</option>
                </select>
              </div>
              
              {/* ADD THIS FILE UPLOAD SECTION */}
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Foto Nota (Opsional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {notaFile && (
                  <p className="text-sm text-green-600 mt-1">
                    File dipilih: {notaFile.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={() => navigate('/stock')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading 
              ? 'Menyimpan...' 
              : isEdit 
                ? 'Update Barang' 
                : formItems.length > 1 
                  ? 'Simpan Semua Barang' 
                  : 'Simpan Barang'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockCreatePage;