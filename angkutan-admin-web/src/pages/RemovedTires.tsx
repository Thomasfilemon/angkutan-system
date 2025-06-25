// src/pages/RemovedTires.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface RemovedTire {
  id: number;
  tire_serial_number: string;
  condition: string;
  current_tread_depth: number;
  total_mileage: number;
  status: string;
  tireInventory: {
    tire_brand: string;
    tire_size: string;
    tire_type: string;
  };
  installations: Array<{
    vehicle: {
      license_plate: string;
    };
    install_date: string;
    remove_date: string;
  }>;
}

const RemovedTiresPage = () => {
  const [removedTires, setRemovedTires] = useState<RemovedTire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRemovedTires();
  }, []);

  const fetchRemovedTires = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tires/tire-instances/available?status=removed');
      setRemovedTires(response.data?.data || response.data || []);
    } catch (err) {
      setError('Failed to fetch removed tires');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="text-center p-8">Loading removed tires...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Ban Bekas (Sudah Dilepas)</h1>
        <Link to="/vehicles/tires">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            ← Kembali ke Manajemen Ban
          </button>
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Ban Bekas</h3>
          <p className="text-2xl font-bold text-blue-600">{removedTires.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Kondisi Baik</h3>
          <p className="text-2xl font-bold text-green-600">
            {removedTires.filter(t => t.condition === 'good').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Kondisi Cukup</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {removedTires.filter(t => t.condition === 'fair').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Perlu Perbaikan</h3>
          <p className="text-2xl font-bold text-red-600">
            {removedTires.filter(t => t.condition === 'poor').length}
          </p>
        </div>
      </div>

      {/* Removed Tires Table */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Serial Number</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Brand & Size</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kondisi</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tapak (mm)</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Total KM</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Terakhir di Kendaraan</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {removedTires.length > 0 ? (
              removedTires.map((tire) => (
                <tr key={tire.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-mono">{tire.tire_serial_number}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">
                      {tire.tireInventory.tire_brand} {tire.tireInventory.tire_size}
                    </p>
                    <p className="text-gray-600 text-xs">{tire.tireInventory.tire_type}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConditionColor(tire.condition)}`}>
                      {tire.condition === 'good' ? 'Baik' : 
                       tire.condition === 'fair' ? 'Cukup' : 
                       tire.condition === 'poor' ? 'Buruk' : tire.condition}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.current_tread_depth}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.total_mileage.toLocaleString()}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {tire.installations.length > 0 && (
                      <div>
                        <p className="text-gray-900 whitespace-no-wrap">
                          {tire.installations[0].vehicle.license_plate}
                        </p>
                        <p className="text-gray-600 text-xs">
                          Dilepas: {new Date(tire.installations[0].remove_date).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      Tersedia untuk Dipasang
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-500">
                  Belum ada ban bekas yang tersedia
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RemovedTiresPage;
