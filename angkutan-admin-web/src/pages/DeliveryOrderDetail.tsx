// src/pages/DeliveryOrderDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface DeliveryOrderDetail {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  status: string;
  status_text: string;
  load_location: string;
  unload_location: string;
  surat_jalan_photo_url?: string;
  driver: {
    username: string;
    driverProfile: {
      full_name: string;
      phone: string;
    };
  };
  vehicle: {
    license_plate: string;
    type: string;
    capacity?: string;
  };
  purchaseOrder: {
    po_number: string;
    customer_name: string;
  };
  financial_summary: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    total_amount: number;
  };
  timeline: {
    created_at: string;
    departed_to_load_location_at?: string;
    arrived_at_load_location_at?: string;
    departed_from_load_location_at?: string;
    arrived_at_unload_location_at?: string;
    departed_from_unload_location_at?: string;
    completed_at?: string;
  };
}

const DeliveryOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deliveryOrder, setDeliveryOrder] = useState<DeliveryOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeliveryOrder = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/delivery-orders/${id}`);
        setDeliveryOrder(response.data);
      } catch (err) {
        setError('Failed to fetch delivery order details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDeliveryOrder();
    }
  }, [id]);

  const handleCancel = async () => {
    if (!deliveryOrder || deliveryOrder.status === 'completed' || deliveryOrder.status === 'cancelled') {
      return;
    }

    const reason = prompt('Enter cancellation reason:');
    if (!reason) return;

    try {
      await apiClient.patch(`/delivery-orders/${id}/cancel`, {
        cancellation_reason: reason
      });
      
      // Refresh data
      const response = await apiClient.get(`/delivery-orders/${id}`);
      setDeliveryOrder(response.data);
    } catch (err) {
      alert('Failed to cancel delivery order.');
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

  if (loading) return <div className="text-center p-8">Loading delivery order...</div>;
  if (error) return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;
  if (!deliveryOrder) return <div className="text-center p-8">Delivery order not found.</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Delivery Order Details</h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate('/delivery-orders')}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            ← Back to List
          </button>
          {deliveryOrder.status !== 'completed' && deliveryOrder.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">DO Number</label>
              <p className="font-medium text-lg">{deliveryOrder.do_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">PO Number</label>
              <p className="font-medium">{deliveryOrder.purchaseOrder.po_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Customer</label>
              <p className="font-medium">{deliveryOrder.customer_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Item</label>
              <p className="font-medium">{deliveryOrder.item_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(deliveryOrder.status)}`}>
                {deliveryOrder.status_text}
              </span>
            </div>
          </div>
        </div>

        {/* Quantity Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quantity Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Target Quantity</label>
              <p className="font-medium text-lg">{deliveryOrder.minimal_load_quantity} ton</p>
            </div>
            {deliveryOrder.actual_load_quantity && (
              <div>
                <label className="text-sm text-gray-600">Actual Quantity</label>
                <p className="font-medium text-green-600 text-lg">{deliveryOrder.actual_load_quantity} ton</p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ 
                        width: `${Math.min((deliveryOrder.actual_load_quantity / deliveryOrder.minimal_load_quantity) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((deliveryOrder.actual_load_quantity / deliveryOrder.minimal_load_quantity) * 100)}% of target
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Driver & Vehicle Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Driver & Vehicle</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Driver</label>
              <p className="font-medium">{deliveryOrder.driver.driverProfile.full_name}</p>
              <p className="text-sm text-gray-500">{deliveryOrder.driver.driverProfile.phone}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Vehicle</label>
              <p className="font-medium">{deliveryOrder.vehicle.license_plate}</p>
              <p className="text-sm text-gray-500">
                {deliveryOrder.vehicle.type}
                {deliveryOrder.vehicle.capacity && ` (${deliveryOrder.vehicle.capacity} kg)`}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Trip Allowance</span>
              <span className="font-medium">Rp {deliveryOrder.financial_summary.trip_allowance.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Driver Salary</span>
              <span className="font-medium">Rp {deliveryOrder.financial_summary.gaji.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600 font-medium">Total for Driver</span>
              <span className="font-bold">Rp {deliveryOrder.financial_summary.total_for_driver.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600 font-medium">Total Amount</span>
              <span className="font-bold text-green-600">Rp {deliveryOrder.financial_summary.total_amount.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Location Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Load Location</label>
              <p className="font-medium">{deliveryOrder.load_location}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Unload Location</label>
              <p className="font-medium">{deliveryOrder.unload_location}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timeline</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Created</span>
              <span className="font-medium">{new Date(deliveryOrder.timeline.created_at).toLocaleString('id-ID')}</span>
            </div>
            {deliveryOrder.timeline.departed_to_load_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Departed to Load Location</span>
                <span className="font-medium">{new Date(deliveryOrder.timeline.departed_to_load_location_at).toLocaleString('id-ID')}</span>
              </div>
            )}
            {deliveryOrder.timeline.arrived_at_load_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Arrived at Load Location</span>
                <span className="font-medium">{new Date(deliveryOrder.timeline.arrived_at_load_location_at).toLocaleString('id-ID')}</span>
              </div>
            )}
            {deliveryOrder.timeline.departed_from_load_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Departed from Load Location</span>
                <span className="font-medium">{new Date(deliveryOrder.timeline.departed_from_load_location_at).toLocaleString('id-ID')}</span>
              </div>
            )}
            {deliveryOrder.timeline.arrived_at_unload_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Arrived at Unload Location</span>
                <span className="font-medium">{new Date(deliveryOrder.timeline.arrived_at_unload_location_at).toLocaleString('id-ID')}</span>
              </div>
            )}
            {deliveryOrder.timeline.departed_from_unload_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Departed from Unload Location</span>
                <span className="font-medium">{new Date(deliveryOrder.timeline.departed_from_unload_location_at).toLocaleString('id-ID')}</span>
              </div>
            )}
            {deliveryOrder.timeline.completed_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-medium text-green-600">{new Date(deliveryOrder.timeline.completed_at).toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Surat Jalan Photo */}
        {deliveryOrder.surat_jalan_photo_url && (
          <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Surat Jalan Photo</h2>
            <div className="max-w-md">
              <img 
                src={deliveryOrder.surat_jalan_photo_url} 
                alt="Surat Jalan"
                className="w-full h-auto rounded-lg border border-gray-300"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryOrderDetailPage;
