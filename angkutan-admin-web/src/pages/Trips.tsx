// src/pages/Trips.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface PurchaseOrder {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  created_at: string;
  status: 'confirmed' | 'partial' | 'completed' | 'cancelled';
  load_location: string;
  unload_location: string;
  delivery_progress: {
    total_deliveries: number;
    completed_deliveries: number;
    percentage: number;
  };
  can_create_do: boolean;
}

const TripsPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    cancelled: 0
  });

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await apiClient.get(`/purchase-orders${params}`);
      
      setPurchaseOrders(response.data || []);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (err) {
      setError('Failed to fetch purchase orders.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'partial': return 'Partial';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  if (loading) return <div className="text-center p-8">Loading purchase orders...</div>;
  if (error) return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Purchase Orders</h1>
        <Link to="/trips/create-po">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Create New Purchase Order
          </button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total POs</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Active</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.active}</p>
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
          className="border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="all">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="partial">Partial</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Purchase Orders List */}
      <div className="space-y-4">
        {purchaseOrders.map((po) => (
          <div key={po.id} className="bg-white shadow-md rounded-lg p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{po.po_number}</h3>
                <p className="text-gray-600">{po.customer_name}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(po.status)}`}>
                {getStatusText(po.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Item</p>
                <p className="font-medium">{po.item_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Quantity</p>
                <p className="font-medium">{po.total_quantity.toLocaleString('id-ID')} ton</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created Date</p>
                <p className="font-medium">{new Date(po.created_at).toLocaleDateString('id-ID')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Load Location</p>
                <p className="text-sm">{po.load_location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Unload Location</p>
                <p className="text-sm">{po.unload_location}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Delivery Progress: {po.delivered_quantity.toLocaleString('id-ID')} / {po.total_quantity.toLocaleString('id-ID')} ton</span>
                <span>{Math.round(po.delivery_progress.percentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(po.delivery_progress.percentage, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Deliveries: {po.delivery_progress.completed_deliveries} / {po.delivery_progress.total_deliveries}</span>
                <span>Remaining: {po.remaining_quantity.toLocaleString('id-ID')} ton</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Link to={`/trips/po/${po.id}`}>
                <button className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
                  📋 View Details
                </button>
              </Link>
              
              {po.can_create_do && (
                <Link to={`/trips/po/${po.id}/create-do`}>
                  <button className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">
                    ➕ Create Delivery Order
                  </button>
                </Link>
              )}
              
              <Link to={`/delivery-orders?po_id=${po.id}`}>
                <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                  🚚 View Delivery Orders ({po.delivery_progress.total_deliveries})
                </button>
              </Link>
              
              {po.status !== 'completed' && po.status !== 'cancelled' && (
                <Link to={`/trips/po/${po.id}/edit`}>
                  <button className="bg-orange-500 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm">
                    ✏️ Edit PO
                  </button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {purchaseOrders.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Purchase Orders</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first purchase order.</p>
          <Link to="/trips/create-po">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              Create Purchase Order
            </button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default TripsPage;
