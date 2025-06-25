// src/pages/Vehicles.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireStats {
  total_installed: number;
  total_expected: number;
  needs_attention: number;
  good_condition: number;
}

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: string;
  tire_count: number;
  spare_tire_count: number;
  driver_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_status: string | null;
  stnk_expired_date: string;
  tax_due_date: string;
  status: 'available' | 'in_use' | 'maintenance';
  tire_stats: TireStats;
}

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/vehicles');
      const vehiclesData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setVehicles(vehiclesData);
    } catch (err) {
      setError('Failed to fetch vehicles. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await apiClient.delete(`/vehicles/${id}`);
        setVehicles(prevVehicles => prevVehicles.filter(vehicle => vehicle.id !== id));
      } catch (err) {
        alert('Failed to delete vehicle.');
      }
    }
  };

  const getTireStatusColor = (tireStats: TireStats) => {
    if (tireStats.needs_attention > 0) return 'text-red-600';
    if (tireStats.total_installed < tireStats.total_expected) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTireStatusText = (tireStats: TireStats) => {
    if (tireStats.needs_attention > 0) {
      return `${tireStats.needs_attention} perlu perhatian`;
    }
    if (tireStats.total_installed < tireStats.total_expected) {
      return `${tireStats.total_expected - tireStats.total_installed} belum terpasang`;
    }
    return 'Semua baik';
  };

  if (loading) return <div className="text-center p-8">Loading vehicles...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Kendaraan</h1>
        <div className="flex space-x-2">
          <Link to="/vehicles/tires">
            <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
              🛞 Kelola Ban
            </button>
          </Link>
          <Link to="/vehicles/create">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              + Tambah Kendaraan
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Plat Nomor</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tipe</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kapasitas (kg)</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Ban</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Supir</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">STNK Expired</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Pajak</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length > 0 ? (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">{vehicle.license_plate}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{vehicle.type}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {vehicle.capacity ? parseInt(vehicle.capacity).toLocaleString('id-ID') : '-'}
                    </p>
                  </td>
                  {/* NEW: Tire Information Column */}
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div className="flex flex-col">
                      <div className="text-xs text-gray-600 mb-1">
                        {vehicle.tire_count + vehicle.spare_tire_count} ban ({vehicle.tire_count}+{vehicle.spare_tire_count})
                      </div>
                      <div className="flex items-center">
                        <div className="text-xs">
                          <span className="text-gray-700">{vehicle.tire_stats.total_installed}/{vehicle.tire_stats.total_expected}</span>
                        </div>
                        <div className={`ml-2 text-xs font-medium ${getTireStatusColor(vehicle.tire_stats)}`}>
                          {getTireStatusText(vehicle.tire_stats)}
                        </div>
                      </div>
                      {vehicle.tire_stats.needs_attention > 0 && (
                        <div className="mt-1">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            ⚠️ Perlu Perhatian
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Driver Information Column */}
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {vehicle.driver_name ? (
                      <div>
                        <p className="text-gray-900 whitespace-no-wrap font-medium">{vehicle.driver_name}</p>
                        <p className="text-gray-600 text-xs">{vehicle.driver_phone}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vehicle.driver_status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {vehicle.driver_status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Tidak ada supir</span>
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {vehicle.stnk_expired_date ? new Date(vehicle.stnk_expired_date).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {vehicle.tax_due_date ? new Date(vehicle.tax_due_date).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${
                      vehicle.status === 'available' ? 'text-green-900' : 
                      vehicle.status === 'in_use' ? 'text-blue-900' : 'text-red-900'
                    }`}>
                      <span aria-hidden className={`absolute inset-0 ${
                        vehicle.status === 'available' ? 'bg-green-200' : 
                        vehicle.status === 'in_use' ? 'bg-blue-200' : 'bg-red-200'
                      } opacity-50 rounded-full`}></span>
                      <span className="relative">{vehicle.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                    <div className="flex justify-end space-x-2">
                      <Link to={`/vehicles/tires/${vehicle.id}`} className="text-green-600 hover:text-green-900" title="Kelola Ban">
                        🛞
                      </Link>
                      <Link to={`/vehicles/edit/${vehicle.id}`} className="text-indigo-600 hover:text-indigo-900">
                        Edit
                      </Link>
                      <button onClick={() => handleDelete(vehicle.id)} className="text-red-600 hover:text-red-900">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-500">Tidak ada data kendaraan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VehiclesPage;
