import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface VehicleExpenditureData {
  vehicle_id: number;
  license_plate: string;
  vehicle_type: string;
  service_stock_cost: number;
  service_count: number;
  service_unique_items: number;
  service_quantity_used: number;
  direct_usage_cost: number;
  usage_note_count: number;
  direct_unique_items: number;
  total_stock_expenditure: number;
}

interface ServiceData {
  id: number;
  service_number: string;
  service_date: string;
  description: string;
  total_cost: number;
  status: string;
}

interface SummaryData {
  total_stock_expenditure: number;
  total_vehicles: number;
  vehicles_with_stock_usage: number;
  average_expenditure_per_vehicle: number;
}

interface AnalyticsResponse {
  summary: SummaryData;
  vehicles: VehicleExpenditureData[];
  timeRange: {
    startDate: string;
    endDate: string;
  };
}

const VehicleExpenditureAnalytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterType, setFilterType] = useState<'preset' | 'custom'>('preset');
  
  // State for service dropdown
  const [expandedVehicle, setExpandedVehicle] = useState<number | null>(null);
  const [vehicleServices, setVehicleServices] = useState<Record<number, ServiceData[]>>({});
  const [loadingServices, setLoadingServices] = useState<Record<number, boolean>>({});

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/analytics/vehicles/expenditure';
      const params = new URLSearchParams();

      if (filterType === 'custom' && customStartDate && customEndDate) {
        params.append('startDate', customStartDate);
        params.append('endDate', customEndDate);
      } else {
        params.append('timeRange', timeRange);
      }

      url += `?${params.toString()}`;

      console.log('Fetching analytics from:', url);
      
      // First test if the analytics endpoint is reachable
      try {
        const testResponse = await apiClient.get('/analytics/test');
        console.log('Analytics test response:', testResponse.data);
      } catch (testErr) {
        console.error('Analytics test failed:', testErr);
      }
      
      // Test the actual endpoint with a simple fetch
      try {
        const directResponse = await fetch(`http://localhost:5000/api/web/analytics/vehicles/expenditure?timeRange=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        const directData = await directResponse.json();
        console.log('Direct fetch response:', directData);
      } catch (directErr) {
        console.error('Direct fetch failed:', directErr);
      }
      
      const response = await apiClient.get(url);
      console.log('Full response object:', response);
      console.log('Analytics response data:', response.data);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data type:', typeof response.data);
      console.log('Response data keys:', Object.keys(response.data || {}));
      
      // Check if the response has the expected structure
      if (response.data && typeof response.data === 'object') {
        if (response.data.success === true) {
          console.log('Success! Setting analytics data:', response.data.data);
          setAnalytics(response.data.data);
        } else if (response.data.success === false) {
          console.error('API returned success: false');
          setError('API returned unsuccessful response');
        } else {
          console.error('API response missing success field:', response.data);
          setError('API response format unexpected');
        }
      } else {
        console.error('API response data is not an object:', response.data);
        setError('API response format unexpected');
      }
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err?.response?.data?.error || err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, customStartDate, customEndDate, filterType]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const fetchVehicleServices = async (vehicleId: number) => {
    try {
      setLoadingServices(prev => ({ ...prev, [vehicleId]: true }));
      
      const response = await apiClient.get(`/services?vehicleId=${vehicleId}&limit=100`);
      const services = response.data.data || response.data;
      
      setVehicleServices(prev => ({ ...prev, [vehicleId]: services }));
    } catch (err: any) {
      console.error('Failed to fetch vehicle services:', err);
      setVehicleServices(prev => ({ ...prev, [vehicleId]: [] }));
    } finally {
      setLoadingServices(prev => ({ ...prev, [vehicleId]: false }));
    }
  };

  const handleToggleServices = (vehicleId: number) => {
    if (expandedVehicle === vehicleId) {
      setExpandedVehicle(null);
    } else {
      setExpandedVehicle(vehicleId);
      if (!vehicleServices[vehicleId]) {
        fetchVehicleServices(vehicleId);
      }
    }
  };

  const handleServiceDetail = (serviceId: number) => {
    navigate(`/services/${serviceId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Memuat data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Pengeluaran Per Mobil
          </h1>
          <p className="text-gray-600 mt-2">
            Analisis penggunaan stok per kendaraan
          </p>
        </div>
        <Link
          to="/vehicles"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded shadow-md transition duration-200"
        >
          ← Kembali ke Kendaraan
        </Link>
      </div>

      {/* Time Range Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Waktu
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilterType('preset')}
                className={`px-3 py-1 rounded text-sm ${
                  filterType === 'preset'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Preset
              </button>
              <button
                onClick={() => setFilterType('custom')}
                className={`px-3 py-1 rounded text-sm ${
                  filterType === 'custom'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {filterType === 'preset' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periode
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Minggu Terakhir</option>
                <option value="month">Bulan Terakhir</option>
                <option value="year">Tahun Terakhir</option>
                <option value="all">Semua Waktu</option>
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              onClick={fetchAnalytics}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Total Pengeluaran Stok
              </h3>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(analytics.summary.total_stock_expenditure)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Total Kendaraan
              </h3>
              <p className="text-2xl font-bold text-green-600">
                {analytics.summary.total_vehicles}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Kendaraan dengan Stok
              </h3>
              <p className="text-2xl font-bold text-orange-600">
                {analytics.summary.vehicles_with_stock_usage}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Rata-rata per Kendaraan
              </h3>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(analytics.summary.average_expenditure_per_vehicle)}
              </p>
            </div>
          </div>

          {/* Vehicle Details Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Detail Pengeluaran per Kendaraan
              </h3>
              <p className="text-sm text-gray-600">
                Periode: {formatDate(analytics.timeRange.startDate)} - {formatDate(analytics.timeRange.endDate)}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kendaraan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Pengeluaran
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dari Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dari Stok Langsung
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jumlah Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Unik
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.vehicles.map((vehicle) => (
                    <React.Fragment key={vehicle.vehicle_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {vehicle.license_plate}
                            </div>
                            <div className="text-sm text-gray-500">
                              {vehicle.vehicle_type}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(vehicle.total_stock_expenditure)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(vehicle.service_stock_cost)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {vehicle.service_count} service
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(vehicle.direct_usage_cost)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {vehicle.usage_note_count} catatan
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {vehicle.service_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {vehicle.service_unique_items + vehicle.direct_unique_items}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => handleToggleServices(vehicle.vehicle_id)}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-xs transition duration-200"
                          >
                            {expandedVehicle === vehicle.vehicle_id ? 'Tutup' : 'Detail'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Service Dropdown Row */}
                      {expandedVehicle === vehicle.vehicle_id && (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
                            <div className="bg-white rounded-lg shadow-sm border">
                              <div className="p-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-3">
                                  Daftar Service - {vehicle.license_plate}
                                </h4>
                                
                                {loadingServices[vehicle.vehicle_id] ? (
                                  <div className="text-center py-4">
                                    <div className="text-sm text-gray-500">Memuat data service...</div>
                                  </div>
                                ) : vehicleServices[vehicle.vehicle_id] && vehicleServices[vehicle.vehicle_id].length > 0 ? (
                                  <div className="space-y-2">
                                    {vehicleServices[vehicle.vehicle_id].map((service) => (
                                      <div
                                        key={service.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition duration-200"
                                        onClick={() => handleServiceDetail(service.id)}
                                      >
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-gray-900">
                                            {service.service_number}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {formatDate(service.service_date)} - {service.description}
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm font-medium text-gray-900">
                                            {formatCurrency(service.total_cost)}
                                          </span>
                                          <span className={`px-2 py-1 text-xs rounded-full ${
                                            service.status === 'completed' 
                                              ? 'bg-green-100 text-green-800' 
                                              : 'bg-yellow-100 text-yellow-800'
                                          }`}>
                                            {service.status}
                                          </span>
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <div className="text-sm text-gray-500">Tidak ada data service</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {analytics.vehicles.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">Tidak ada data pengeluaran stok untuk periode ini.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Data akan muncul jika ada penggunaan stok dari service atau catatan penggunaan langsung.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VehicleExpenditureAnalytics;
