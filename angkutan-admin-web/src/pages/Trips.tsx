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
  order_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  load_location: string;
  unload_location: string;
  deliveryOrders?: DeliveryOrder[];
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  quantity: number;
  status: string;
}

const TripsPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

   const fetchPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await apiClient.get(`/purchase-orders${params}`);
      setPurchaseOrders(response.data);
    } catch (err) {
      setError('Failed to fetch purchase orders.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]); // Only recreate when statusFilter changes

   useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]); // This is now safe and satisfies ESLint

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTotalDeliveredQuantity = (deliveryOrders: DeliveryOrder[] = []) => {
    return deliveryOrders.reduce((total, do_item) => total + (do_item.quantity || 0), 0);
  };

  if (loading) return <div className="text-center p-8">Loading trips...</div>;
  if (error) return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Trips</h1>
        <Link to="/trips/create-po">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Buat Purchase Order Baru
          </button>
        </Link>
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
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Purchase Orders List */}
      <div className="space-y-4">
        {purchaseOrders.map((po) => {
          const deliveredQty = getTotalDeliveredQuantity(po.deliveryOrders);
          const remainingQty = po.total_quantity - deliveredQty;
          
          return (
            <div key={po.id} className="bg-white shadow-md rounded-lg p-6 border-l-4 border-blue-500">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">{po.po_number}</h3>
                  <p className="text-gray-600">{po.customer_name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(po.status)}`}>
                  {po.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Item</p>
                  <p className="font-medium">{po.item_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Quantity</p>
                  <p className="font-medium">{po.total_quantity} ton</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-medium">{new Date(po.order_date).toLocaleDateString('id-ID')}</p>
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
                  <span>Progress: {deliveredQty} / {po.total_quantity} ton</span>
                  <span>{Math.round((deliveredQty / po.total_quantity) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${Math.min((deliveredQty / po.total_quantity) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Delivery Orders List */}
              {po.deliveryOrders && po.deliveryOrders.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Delivery Orders ({po.deliveryOrders.length})</h4>
                  <div className="space-y-2">
                    {po.deliveryOrders.map((do_item) => (
                      <div key={do_item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <div>
                          <span className="font-medium">{do_item.do_number}</span>
                          <span className="text-gray-600 ml-2">({do_item.quantity} ton)</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(do_item.status)}`}>
                          {do_item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Link to={`/trips/po/${po.id}`}>
                  <button className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
                    View Details
                  </button>
                </Link>
                {remainingQty > 0 && po.status !== 'completed' && po.status !== 'cancelled' && (
                    <Link to={`/trips/po/${po.id}/create-do`}>
                    <button className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">
                        + Create Delivery Order ({remainingQty.toFixed(2)} ton remaining)
                    </button>
                    </Link>
                )}
                <Link to={`/trips/po/${po.id}/edit`}>
                  <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                    Edit PO
                  </button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {purchaseOrders.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No purchase orders found. Create your first PO to get started.
        </div>
      )}
    </div>
  );
};

export default TripsPage;
