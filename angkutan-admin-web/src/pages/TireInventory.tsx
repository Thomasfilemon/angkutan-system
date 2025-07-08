// src/pages/TireInventory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireInstance {
  id: number;
  tire_serial_number: string;
  status: string;
  condition: string;
  purchase_date: string;
  purchase_price: string;
  tireInventory: {
    tire_brand: string;
    tire_size: string;
    tire_type: string;
  };
}

const TireInventoryPage = () => {
  const [tires, setTires] = useState<TireInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAvailableTires();
  }, []);

  const fetchAvailableTires = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tires/inventory-instances');
      
      // --- START OF CORRECTION ---
      // This new logic robustly finds the array of tires in the response.
      const responseData = response.data;
      const tiresArray = Array.isArray(responseData.data) 
        ? responseData.data 
        : Array.isArray(responseData) 
        ? responseData 
        : [];

      setTires(tiresArray);
      // --- END OF CORRECTION ---

    } catch (err) {
      setError('Failed to fetch available tire instances');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTires = tires.filter(tire => 
    tire.tire_serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tire.tireInventory.tire_brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tire.tireInventory.tire_size.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalValue = filteredTires.reduce((sum, tire) => {
    const price = parseFloat(tire.purchase_price);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  if (loading) return <div className="text-center p-8">Loading individual tires...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Inventaris Ban (Individual)</h1>
        <Link to="/tire-inventory/create">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Tambah Stok Ban
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Ban Tersedia</h3>
          <p className="text-2xl font-bold text-green-600">{filteredTires.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Nilai Inventaris</h3>
          <p className="text-2xl font-bold text-purple-600">
            Rp {totalValue.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cari Ban (Serial Number, Brand, Ukuran):
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Serial Number</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Brand</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Ukuran</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kondisi</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tgl Beli</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Harga</th>
            </tr>
          </thead>
          <tbody>
            {filteredTires.length > 0 ? (
              filteredTires.map((tire) => (
                <tr key={tire.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">{tire.tire_serial_number}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.tireInventory.tire_brand}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.tireInventory.tire_size}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap capitalize">{tire.condition}</p>
                  </td>
                   <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Tersedia
                    </span>
                  </td>
                   <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {new Date(tire.purchase_date).toLocaleDateString('id-ID')}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      Rp {parseFloat(tire.purchase_price).toLocaleString('id-ID')}
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-500">
                  {loading ? 'Loading...' : 'Tidak ada ban yang tersedia di stok.'}
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