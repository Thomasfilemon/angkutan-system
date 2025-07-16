// src/pages/TireInventoryCreate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import { toast } from 'react-hot-toast';

interface TireInventoryData {
  tire_brand: string;
  tire_size: string;
  tire_type: string;
  condition: string; // ✅ Changed from min_stock to condition
  serial_numbers: string[];
  purchase_price: number;
  purchase_date: string;
}

const TireInventoryCreatePage = () => {
  const [formData, setFormData] = useState<TireInventoryData>({
    tire_brand: '',
    tire_size: '',
    tire_type: '',
    condition: 'new', // ✅ Default condition is 'new'
    serial_numbers: [''],
    purchase_price: 0,
    purchase_date: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [saveToCash, setSaveToCash] = useState(true);
  const [isTempo, setIsTempo] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("General");
  const [notaFile, setNotaFile] = useState<File | null>(null);

  // ✅ Condition mapping for display
  const conditionOptions = [
    { value: 'new', label: 'Baru' },
    { value: 'good', label: 'Baik' },
    { value: 'fair', label: 'Cukup' },
    { value: 'poor', label: 'Buruk' },
    { value: 'damaged', label: 'Rusak' },
    { value: 'replace', label: 'Perlu Ganti' },
    { value: 'meledak', label: 'Meledak' },
    { value: 'bocor', label: 'Bocor' },
    { value: 'kampasa', label: 'Kampasa' }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'purchase_price' ? Number(value) : value // ✅ Removed min_stock number conversion
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNotaFile(e.target.files[0]);
    } else {
      setNotaFile(null);
    }
  };

  const handleSerialNumberChange = (index: number, value: string) => {
    const newSerialNumbers = [...formData.serial_numbers];
    newSerialNumbers[index] = value;
    setFormData(prev => ({ ...prev, serial_numbers: newSerialNumbers }));
  };

  const addSerialNumberField = () => {
    setFormData(prev => ({
      ...prev,
      serial_numbers: [...prev.serial_numbers, '']
    }));
  };

  const removeSerialNumberField = (index: number) => {
    if (formData.serial_numbers.length <= 1) return;
    const newSerialNumbers = formData.serial_numbers.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, serial_numbers: newSerialNumbers }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const validSerialNumbers = formData.serial_numbers.filter(sn => sn.trim() !== '');
    if (validSerialNumbers.length === 0) {
        setError('Please provide at least one tire serial number.');
        setIsLoading(false);
        return;
    }

    try {
      // ✅ Updated inventory creation - removed min_stock
      const inventoryResponse = await apiClient.post('/tires/tire-inventory', {
        tire_brand: formData.tire_brand,
        tire_size: formData.tire_size,
        tire_type: formData.tire_type,
        unit_price: formData.purchase_price
        // ✅ Removed min_stock from here
      });
      const inventoryId = inventoryResponse.data?.data?.id || inventoryResponse.data?.id;

      // ✅ Updated tire instances creation - added condition
      await apiClient.post('/tires/tire-instances', {
        tire_inventory_id: inventoryId,
        serial_numbers: validSerialNumbers,
        purchase_price: formData.purchase_price,
        purchase_date: formData.purchase_date,
        condition: formData.condition // ✅ Pass condition to tire instances
      });

      if (saveToCash) {
        const totalCost = formData.purchase_price * validSerialNumbers.length;
        if (totalCost > 0) {
            const transactionType = isTempo ? "kredit_tempo" : "kredit";
            const description = `Pembelian Ban: ${validSerialNumbers.length} x ${formData.tire_brand} ${formData.tire_size}`;

            const cashFormData = new FormData();
            cashFormData.append('transaction_type', transactionType);
            cashFormData.append('amount', String(totalCost));
            cashFormData.append('description', description);
            cashFormData.append('transaction_date', formData.purchase_date);
            cashFormData.append('account', selectedAccount);
            if (notaFile) {
                cashFormData.append('attachment', notaFile);
            }

            await apiClient.post("/cash/transactions", cashFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
      }
      
      toast.success(`${validSerialNumbers.length} tire(s) created successfully!`);
      navigate(-1);

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create tire inventory';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tambah Stok Ban Baru</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand Ban *</label>
            <input type="text" name="tire_brand" value={formData.tire_brand} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Contoh: Bridgestone" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ukuran Ban *</label>
            <input type="text" name="tire_size" value={formData.tire_size} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Contoh: 1000 R20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Ban</label>
            <select name="tire_type" value={formData.tire_type} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
              <option value="">Pilih Tipe</option>
              <option value="Radial">Radial</option>
              <option value="Bias">Bias</option>
              <option value="Tubeless">Tubeless</option>
              <option value="Tube Type">Tube Type</option>
            </select>
          </div>
          {/* ✅ Changed from min_stock to condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kondisi Ban *</label>
            <select 
              name="condition" 
              value={formData.condition} 
              onChange={handleChange} 
              required 
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {conditionOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <hr />

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Detail Pembelian & Serial Number</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Harga Beli per Ban (Rp) *</label>
              <input type="number" name="purchase_price" value={formData.purchase_price} onChange={handleChange} required min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Pembelian *</label>
              <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number Ban *</label>
            {formData.serial_numbers.map((serial, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder={`Serial Number Ban #${index + 1}`}
                  required
                />
                <button type="button" onClick={() => removeSerialNumberField(index)} className="px-3 py-2 bg-red-500 text-white rounded-md" disabled={formData.serial_numbers.length <= 1}>×</button>
              </div>
            ))}
            <button type="button" onClick={addSerialNumberField} className="mt-2 text-sm text-blue-600 hover:text-blue-800">+ Tambah Ban Lain</button>
          </div>
        </div>

        <div className="mt-6">
          <label className="flex items-center">
            <input type="checkbox" checked={saveToCash} onChange={(e) => setSaveToCash(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600" />
            <span className="ml-2 text-gray-700">Simpan ke Buku Kas</span>
          </label>
          {saveToCash && (
            <div className="mt-4 p-4 border-l-4 border-blue-500 bg-blue-50 rounded">
              <div className="flex items-center mb-3">
                <label className="flex items-center mr-4">
                  <input type="checkbox" checked={isTempo} onChange={(e) => setIsTempo(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600" />
                  <span className="ml-2 text-gray-700">Transaksi Tempo</span>
                </label>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">Akun</label>
                <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700">
                  <option value="Ewaldo">Ewaldo</option>
                  <option value="Malvin">Malvin</option>
                  <option value="Company">Company</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Foto Nota (Opsional)
                </label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
          )}
        </div>

        {formData.serial_numbers.filter(sn => sn.trim()).length > 0 && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Ringkasan:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {formData.serial_numbers.filter(sn => sn.trim()).length} ban akan dibuat.</li>
              <li>• Kondisi ban: {conditionOptions.find(opt => opt.value === formData.condition)?.label}</li>
              <li>• Total investasi: Rp {(formData.purchase_price * formData.serial_numbers.filter(sn => sn.trim()).length).toLocaleString('id-ID')}</li>
            </ul>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">Batal</button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">{isLoading ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  );
};

export default TireInventoryCreatePage;
