import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
// FIX: Removed the .ts extension to let the bundler resolve the module, which is a common practice.
import apiClient from '../api/axiosConfig';

// Menggunakan interface yang lebih sesuai dengan data yang ada
interface ServiceSummary {
  id: number;
  service_date: string;
  description: string;
  total_cost: number;
  status: 'completed' | 'cancelled';
  service_number: string;
}

interface Vehicle {
    id: number;
    license_plate: string;
}

const VehicleServiceHistory: React.FC = () => {
  const { id: vehicleId } = useParams<{ id: string }>();
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        // 1. Ambil detail kendaraan untuk menampilkan nama/plat nomor
        const vehicleRes = await apiClient.get(`/vehicles/${vehicleId}`);
        setVehicle(vehicleRes.data);

        // 2. Ambil daftar servis dengan melakukan query berdasarkan vehicle_id
        // Ini adalah endpoint yang benar berdasarkan struktur aplikasi Anda
        const servicesRes = await apiClient.get(`/services`, {
          params: { vehicle_id: vehicleId }
        });
        setServices(servicesRes.data);

      } catch (err: any) {
        setError('Failed to fetch service history. Please check backend routes.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [vehicleId]);

  const formatCurrency = (value: number | undefined | null): string => {
    return (value ?? 0).toLocaleString('id-ID');
  };

  if (loading) return <div className="text-center p-8">Loading service history...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold">Service History</h1>
            {vehicle && <p className="text-xl text-gray-600">{vehicle.license_plate}</p>}
        </div>
        <Link
          to={`/services/create?vehicleId=${vehicleId}`}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          + Add New Service
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service No.</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Cost</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200"></th>
            </tr>
          </thead>
          <tbody>
            {services.length > 0 ? services.map((service) => (
              <tr key={service.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">{service.service_number}</td>
                <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">{new Date(service.service_date).toLocaleDateString('id-ID')}</td>
                <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm max-w-sm truncate">{service.description}</td>
                <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm text-right">Rp {formatCurrency(service.total_cost)}</td>
                <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm text-center">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      service.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                   }`}>
                     {service.status}
                   </span>
                </td>
                <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm text-center">
                  <Link to={`/services/${service.id}`} className="text-indigo-600 hover:text-indigo-900 font-semibold">
                    View Detail
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">No service history found for this vehicle.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
       <div className="mt-6">
          <Link to="/vehicles" className="text-blue-500 hover:text-blue-700">
            &larr; Back to All Vehicles
          </Link>
        </div>
    </div>
  );
};

export default VehicleServiceHistory;