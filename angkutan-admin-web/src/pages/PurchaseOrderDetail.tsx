// src/pages/PurchaseOrderDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface PurchaseOrderDetail {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  unit_price?: number;
  total_amount?: number;
  status: string;
  load_location?: string;
  unload_location?: string;
  notes?: string;
  order_date: string;
  created_at: string;
  delivery_progress: {
    percentage: number;
    is_complete: boolean;
  };
  deliveryOrders: Array<{
    id: number;
    do_number: string;
    status: string;
    minimal_load_quantity: number;
    actual_load_quantity?: number;
    total_amount: number;
    ongkosan?: number; // NEW: Include ongkosan for web view
    driver: {
      driverProfile: {
        full_name: string;
      };
    };
    vehicle: {
      license_plate: string;
    };
    created_at: string;
  }>;
}

const PurchaseOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [po, setPO] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPO = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/purchase-orders/${id}`);
        const data = response.data.data || response.data;
        setPO(data);
      } catch (err) {
        setError('Failed to fetch purchase order details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPO();
    }
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDOStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) return <div className="text-center p-8">Loading purchase order...</div>;
  if (error) return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;
  if (!po) return <div className="text-center p-8">Purchase order not found.</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Purchase Order Details</h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate('/trips')}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            ← Back to List
          </button>
          <Link to={`/trips/po/${po.id}/edit`}>
            <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded">
              ✏️ Edit PO
            </button>
          </Link>
          {po.remaining_quantity > 0 && po.status !== 'completed' && po.status !== 'cancelled' && (
            <Link to={`/trips/po/${po.id}/create-do`}>
              <button className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded">
                + Create Delivery Order
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">PO Number</label>
              <p className="font-medium text-lg">{po.po_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(po.status)}`}>
                {po.status}
              </span>
            </div>
            <div>
              <label className="text-sm text-gray-600">Customer</label>
              <p className="font-medium">{po.customer_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Item</label>
              <p className="font-medium">{po.item_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Total Quantity</label>
              <p className="font-medium">{po.total_quantity.toLocaleString('id-ID')} ton</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Order Date</label>
              <p className="font-medium">{new Date(po.order_date).toLocaleDateString('id-ID')}</p>
            </div>
          </div>

          {/* Financial Information */}
          {(po.unit_price || po.total_amount) && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-semibold mb-3">Financial Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {po.unit_price && (
                  <div>
                    <label className="text-sm text-gray-600">Unit Price</label>
                    <p className="font-medium">Rp {po.unit_price.toLocaleString('id-ID')}/ton</p>
                  </div>
                )}
                {po.total_amount && (
                  <div>
                    <label className="text-sm text-gray-600">Total Amount</label>
                    <p className="font-medium text-green-600">Rp {po.total_amount.toLocaleString('id-ID')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {po.notes && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-semibold mb-3">Notes</h3>
              <p className="text-gray-700">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Progress Summary */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Progress Summary</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Delivered</label>
              <p className="font-medium text-green-600">{po.delivered_quantity.toLocaleString('id-ID')} ton</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Remaining</label>
              <p className="font-medium text-orange-600">{po.remaining_quantity.toLocaleString('id-ID')} ton</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Progress</label>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-1">
                <div 
                  className="bg-blue-600 h-3 rounded-full" 
                  style={{ width: `${Math.min(po.delivery_progress.percentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{Math.round(po.delivery_progress.percentage)}% completed</p>
            </div>
          </div>
        </div>

        {/* Location Information */}
        {(po.load_location || po.unload_location) && (
          <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Location Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Load Location</label>
                <p className="font-medium">{po.load_location || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Unload Location</label>
                <p className="font-medium">{po.unload_location || 'Not specified'}</p>
              </div>
            </div>
            {(!po.load_location || !po.unload_location) && (
              <p className="text-sm text-gray-500 mt-2">
                💡 Locations can be specified when creating delivery orders
              </p>
            )}
          </div>
        )}

        {/* Delivery Orders */}
        <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Delivery Orders ({po.deliveryOrders?.length || 0})</h2>
            <Link to={`/delivery-orders?po_id=${po.id}`}>
              <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                View All Delivery Orders
              </button>
            </Link>
          </div>
          
          {po.deliveryOrders && po.deliveryOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full leading-normal">
                <thead>
                  <tr>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">DO Number</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Driver</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Vehicle</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Revenue</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Ongkosan</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {po.deliveryOrders.map((dOrder) => (
                    <tr key={dOrder.id}>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap font-medium">{dOrder.do_number}</p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">{dOrder.driver?.driverProfile?.full_name || 'N/A'}</p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">{dOrder.vehicle?.license_plate || 'N/A'}</p>
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
                        <p className="text-green-600 font-medium">
                          Rp {dOrder.total_amount.toLocaleString('id-ID')}
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        {dOrder.ongkosan ? (
                          <p className="text-blue-600 font-medium">
                            Rp {dOrder.ongkosan.toLocaleString('id-ID')}
                          </p>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDOStatusColor(dOrder.status)}`}>
                          {dOrder.status}
                        </span>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                        <Link to={`/delivery-orders/${dOrder.id}`} className="text-indigo-600 hover:text-indigo-900">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Summary */}
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold text-gray-800 mb-2">Financial Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Revenue:</span>
                    <span className="font-semibold text-green-600 ml-2">
                      Rp {po.deliveryOrders.reduce((sum, dOrder) => sum + dOrder.total_amount, 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Ongkosan:</span>
                    <span className="font-semibold text-blue-600 ml-2">
                      Rp {po.deliveryOrders.reduce((sum, dOrder) => sum + (dOrder.ongkosan || 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Completed Orders:</span>
                    <span className="font-semibold ml-2">
                      {po.deliveryOrders.filter(dOrder => dOrder.status === 'completed').length} / {po.deliveryOrders.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No delivery orders created yet.</p>
              {po.remaining_quantity > 0 && (
                <Link to={`/trips/po/${po.id}/create-do`}>
                  <button className="mt-4 bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded">
                    Create First Delivery Order
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetailPage;
