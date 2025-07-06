// src/pages/ServiceCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
}

interface StockItem {
  id: number;
  item_name: string;
  current_stock: number;
  unit: string;
  unit_price: number;
}

interface ServiceItem {
  stock_item_id?: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  from_stock: boolean;
}

const ServiceCreatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_date: new Date().toISOString().split('T')[0],
    service_type: 'regular',
    description: '',
    workshop_name: '',
    labor_cost: '',
    notes: ''
  });

  const [saveToCash, setSaveToCash] = useState(true); // Default to saving to cash
  const [isTempo, setIsTempo] = useState(false);
  const [cashAccount, setCashAccount] = useState('General');

  useEffect(() => {
    fetchVehicles();
    fetchStockItems();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await apiClient.get('/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  };

  const fetchStockItems = async () => {
    try {
      const response = await apiClient.get('/services/stock-items');
      setStockItems(response.data);
    } catch (err) {
      console.error('Failed to fetch stock items:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addServiceItem = () => {
    setServiceItems(prev => [...prev, {
      item_name: '',
      quantity: 0,
      unit_price: 0,
      from_stock: false
    }]);
  };

  const updateServiceItem = (index: number, field: keyof ServiceItem, value: any) => {
    setServiceItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // If selecting from stock, auto-fill details
        if (field === 'stock_item_id' && value) {
          const stockItem = stockItems.find(s => s.id === parseInt(value));
          if (stockItem) {
            updatedItem.item_name = stockItem.item_name;
            updatedItem.unit_price = stockItem.unit_price;
            updatedItem.from_stock = true;
          }
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const removeServiceItem = (index: number) => {
    setServiceItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        labor_cost: parseFloat(formData.labor_cost) || 0,
        items: serviceItems.filter(item => item.item_name && item.quantity > 0),
        // Add cash management settings
        cash_settings: saveToCash ? {
          save_to_cash: true,
          is_tempo: isTempo,
          account: cashAccount
        } : {
          save_to_cash: false
        }
      };

      await apiClient.post('/services', submitData);
      navigate('/services');
    } catch (err) {
      console.error('Failed to create service:', err);
      alert('Failed to create service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Tambah Servis Kendaraan</h1>
        <p className="text-gray-600 mt-2">Catat servis kendaraan dan penggunaan suku cadang</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Vehicle Selection */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kendaraan *
            </label>
            <select
              name="vehicle_id"
              value={formData.vehicle_id}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="">Pilih Kendaraan</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate} - {vehicle.type}
                </option>
              ))}
            </select>
          </div>

          {/* Service Date */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tanggal Servis *
            </label>
            <input
              type="date"
              name="service_date"
              value={formData.service_date}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tipe Servis *
            </label>
            <select
              name="service_type"
              value={formData.service_type}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="regular">Servis Reguler</option>
              <option value="with_parts">Servis dengan Suku Cadang</option>
            </select>
          </div>

          {/* Workshop Name */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Nama Bengkel
            </label>
            <input
              type="text"
              name="workshop_name"
              value={formData.workshop_name}
              onChange={handleInputChange}
              placeholder="Bengkel Internal"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          {/* Labor Cost */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Biaya Jasa
            </label>
            <input
              type="number"
              name="labor_cost"
              value={formData.labor_cost}
              onChange={handleInputChange}
              placeholder="0"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Deskripsi Servis *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            placeholder="Jelaskan jenis servis yang dilakukan..."
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>

        {/* Cash Management Settings */}
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="saveToCash"
              checked={saveToCash}
              onChange={(e) => setSaveToCash(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="saveToCash" className="ml-2 font-bold text-gray-700">
              Simpan ke Kas
            </label>
          </div>

          {saveToCash && (
            <div className="ml-6 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isTempo"
                  checked={isTempo}
                  onChange={(e) => setIsTempo(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label htmlFor="isTempo" className="ml-2 text-gray-700">
                  Transaksi Tempo
                </label>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Akun Kas
                </label>
                <select
                  value={cashAccount}
                  onChange={(e) => setCashAccount(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="Ewaldo">Ewaldo</option>
                  <option value="Malvin">Malvin</option>
                  <option value="Company">Company</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Service Items */}
        {formData.service_type === 'with_parts' && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Suku Cadang yang Digunakan</h3>
              <button
                type="button"
                onClick={addServiceItem}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm"
              >
                + Tambah Item
              </button>
            </div>

            {serviceItems.map((item, index) => (
              <div key={index} className="border rounded p-4 mb-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Stock Item Selection */}
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Dari Stok
                    </label>
                    <select
                      value={item.stock_item_id || ''}
                      onChange={(e) => updateServiceItem(index, 'stock_item_id', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="">Pilih dari stok (opsional)</option>
                      {stockItems.map(stockItem => (
                        <option key={stockItem.id} value={stockItem.id}>
                          {stockItem.item_name} (Stok: {stockItem.current_stock} {stockItem.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Item Name */}
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Nama Item
                    </label>
                    <input
                      type="text"
                      value={item.item_name}
                      onChange={(e) => updateServiceItem(index, 'item_name', e.target.value)}
                      placeholder="Nama suku cadang"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      required
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Jumlah
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateServiceItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      required
                    />
                  </div>

                  {/* Unit Price */}
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Harga Satuan
                    </label>
                    <div className="flex">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateServiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeServiceItem(index)}
                        className="bg-red-500 hover:bg-red-700 text-white px-3 rounded-r"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>

                {/* Total Price Display */}
                <div className="mt-2 text-right">
                  <span className="text-sm text-gray-600">
                    Total: Rp {(item.quantity * item.unit_price).toLocaleString('id-ID')}
                  </span>
                  {item.from_stock && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Dari Stok
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Catatan
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            placeholder="Catatan tambahan..."
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Simpan Servis'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServiceCreatePage;
