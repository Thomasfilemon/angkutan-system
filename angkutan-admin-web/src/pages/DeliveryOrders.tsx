// src/pages/DeliveryOrders.tsx
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  status: string;
  status_text: string;
  driver_name: string;
  vehicle_info: string;
  created_at: string;
  financial_summary: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    total_amount: number;
  };
  purchaseOrder?: {
    po_number: string;
  };
  surat_jalan_photo_url?: string;
}

const DeliveryOrdersPage = () => {
  const [searchParams] = useSearchParams();
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0
  });

  const poId = searchParams.get('po_id');

  useEffect(() => {
    fetchDeliveryOrders();
  }, [statusFilter, poId]);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      let url = '/delivery-orders';
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (poId) {
        params.append('po_id', poId);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await apiClient.get(url);
      setDeliveryOrders(response.data || []);
      
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (err) {
      setError('Failed to fetch delivery orders.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'otw_to_load_location': return 'bg-blue-100 text-blue-800';
      case 'at_load_location': return 'bg-purple-100 text-purple-800';
      case 'otw_to_unload_location': return 'bg-indigo-100 text-indigo-800';
      case 'at_unload_location': return 'bg-orange-100 text-orange-800';
      case 'otw_to_base': return 'bg-teal-100 text-teal-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="text-center p-8">Loading delivery orders...</div>;
  if (error) return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Delivery Orders</h1>
          {poId && (
            <p className="text-gray-600 mt-1">
              Filtered by Purchase Order ID: {poId}
              <Link to="/delivery-orders" className="ml-2 text-blue-600 hover:text-blue-800">
                (Clear filter)
              </Link>
            </p>
          )}
        </div>
        <Link to="/trips">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            ← Back to Purchase Orders
          </button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Assigned</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.assigned}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">In Progress</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.in_progress}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Completed</h3>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Cancelled</h3>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status:</label>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="assigned">Assigned</option>
          <option value="otw_to_load_location">On Way to Load</option>
          <option value="at_load_location">At Load Location</option>
          <option value="otw_to_unload_location">On Way to Unload</option>
          <option value="at_unload_location">At Unload Location</option>
          <option value="otw_to_base">Returning to Base</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Delivery Orders List */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">DO Number</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">PO Number</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Driver</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Quantity</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Total Amount</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Surat Jalan</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveryOrders.length > 0 ? (
              deliveryOrders.map((dOrder) => (
                <tr key={dOrder.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">{dOrder.do_number}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{dOrder.purchaseOrder?.po_number || 'N/A'}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div>
                      <p className="text-gray-900 whitespace-no-wrap font-medium">{dOrder.customer_name}</p>
                      <p className="text-gray-600 text-xs">{dOrder.item_name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{dOrder.driver_name}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{dOrder.vehicle_info}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div>
                      <p className="text-gray-900">Target: {dOrder.minimal_load_quantity} ton</p>
                      {dOrder.actual_load_quantity && (
                        <p className="text-green-600 text-xs">Actual: {dOrder.actual_load_quantity} ton</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dOrder.status)}`}>
                      {dOrder.status_text}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 font-medium">
                      Rp {dOrder.financial_summary.total_amount.toLocaleString('id-ID')}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {dOrder.surat_jalan_photo_url ? (
                      <a 
                        href={`${BACKEND_URL}/${dOrder.surat_jalan_photo_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Document
                      </a>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                    <Link to={`/delivery-orders/${dOrder.id}`} className="text-indigo-600 hover:text-indigo-900">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="text-center py-10 text-gray-500">
                  No delivery orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeliveryOrdersPage;
