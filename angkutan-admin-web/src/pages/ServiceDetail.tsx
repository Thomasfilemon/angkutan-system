// src/pages/ServiceDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface ServiceDetail {
  id: number;
  service_number: string;
  service_date: string;
  service_type: 'regular' | 'with_parts';
  description: string;
  workshop_name: string;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  status: 'completed' | 'cancelled';
  notes: string;
  created_at: string;
  vehicle: {
    license_plate: string;
    type: string;
    capacity: string;
  };
  serviceItems: Array<{
    id: number;
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    from_stock: boolean;
    stockItem?: {
      item_code: string;
      unit: string;
    };
  }>;
}

const ServiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchServiceDetail();
    }
  }, [id]);

  const fetchServiceDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/services/${id}`);
      setService(response.data);
    } catch (err) {
      setError('Failed to fetch service details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelService = async () => {
    if (!service) return;
    
    if (window.confirm('Are you sure you want to cancel this service? Stock items will be restored.')) {
      try {
        await apiClient.patch(`/services/${service.id}/cancel`);
        fetchServiceDetail(); // Refresh data
      } catch (err) {
        alert('Failed to cancel service');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
        status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {status === 'completed' ? 'Completed' : 'Cancelled'}
      </span>
    );
  };

  const getServiceTypeBadge = (type: string) => {
    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
        type === 'regular' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
      }`}>
        {type === 'regular' ? 'Regular Service' : 'With Parts'}
      </span>
    );
  };

  if (loading) return <div className="text-center p-8">Loading service details...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;
  if (!service) return <div className="text-center p-8">Service not found</div>;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Detail Servis Kendaraan</h1>
          <p className="text-gray-600 mt-2">Service Number: {service.service_number}</p>
        </div>
        <div className="flex space-x-2">
          {service.status === 'completed' && (
            <>
              <Link
                to={`/services/edit/${service.id}`}
                className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
              >
                Edit
              </Link>
              <button
                onClick={handleCancelService}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Cancel Service
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/services')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Service Information */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Informasi Servis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600">Kendaraan</label>
                <p className="text-lg font-semibold text-gray-900">
                  {service.vehicle.license_plate}
                </p>
                <p className="text-sm text-gray-600">
                  {service.vehicle.type} - {service.vehicle.capacity} kg
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600">Tanggal Servis</label>
                <p className="text-lg text-gray-900">
                  {new Date(service.service_date).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600">Tipe Servis</label>
                <div className="mt-1">
                  {getServiceTypeBadge(service.service_type)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600">Status</label>
                <div className="mt-1">
                  {getStatusBadge(service.status)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600">Bengkel</label>
                <p className="text-lg text-gray-900">
                  {service.workshop_name || 'Internal'}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Deskripsi</label>
              <p className="text-gray-900 bg-gray-50 p-3 rounded">
                {service.description}
              </p>
            </div>

            {service.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Catatan</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded">
                  {service.notes}
                </p>
              </div>
            )}
          </div>

          {/* Service Items */}
          {service.serviceItems.length > 0 && (
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Suku Cadang yang Digunakan</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-medium text-gray-600">Item</th>
                      <th className="text-center py-2 px-4 font-medium text-gray-600">Qty</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-600">Harga Satuan</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-600">Total</th>
                      <th className="text-center py-2 px-4 font-medium text-gray-600">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {service.serviceItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{item.item_name}</p>
                            {item.stockItem && (
                              <p className="text-sm text-gray-600">
                                Code: {item.stockItem.item_code}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.quantity} {item.stockItem?.unit || 'pcs'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          Rp {item.unit_price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          Rp {item.total_price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            item.from_stock ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.from_stock ? 'Stock' : 'External'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Cost Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Ringkasan Biaya</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Biaya Jasa:</span>
                <span className="font-medium">Rp {service.labor_cost.toLocaleString('id-ID')}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Biaya Suku Cadang:</span>
                <span className="font-medium">Rp {service.parts_cost.toLocaleString('id-ID')}</span>
              </div>
              
              <hr />
              
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Biaya:</span>
                <span className="text-blue-600">Rp {service.total_cost.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Service Timeline */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Timeline</h2>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <p className="text-sm font-medium">Service Created</p>
                  <p className="text-xs text-gray-600">
                    {new Date(service.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  service.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <p className="text-sm font-medium">
                    {service.status === 'completed' ? 'Service Completed' : 'Service Cancelled'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(service.service_date).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailPage;
