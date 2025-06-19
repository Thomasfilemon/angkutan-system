// src/components/PurchaseOrderForm.tsx

import React, { useState, useEffect } from 'react';

interface PurchaseOrderFormData {
  po_number: string;
  customer_name: string;
  load_location: string;
  load_latitude: string;
  load_longitude: string;
  unload_location: string;
  unload_latitude: string;
  unload_longitude: string;
  item_name: string;
  total_quantity: string;
  order_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
}

interface PurchaseOrderFormProps {
  initialData?: Partial<PurchaseOrderFormData>;
  onSubmit: (data: PurchaseOrderFormData) => void;
  isLoading: boolean;
  buttonText?: string;
  isEditMode?: boolean;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({
  initialData = {},
  onSubmit,
  isLoading,
  buttonText = 'Submit',
  isEditMode = false
}) => {
  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    po_number: '',
    customer_name: '',
    load_location: '',
    load_latitude: '',
    load_longitude: '',
    unload_location: '',
    unload_latitude: '',
    unload_longitude: '',
    item_name: '',
    total_quantity: '',
    order_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
    ...initialData,
  });

  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        po_number: initialData.po_number || '',
        customer_name: initialData.customer_name || '',
        load_location: initialData.load_location || '',
        load_latitude: String(initialData.load_latitude || ''),
        load_longitude: String(initialData.load_longitude || ''),
        unload_location: initialData.unload_location || '',
        unload_latitude: String(initialData.unload_latitude || ''),
        unload_longitude: String(initialData.unload_longitude || ''),
        item_name: initialData.item_name || '',
        total_quantity: String(initialData.total_quantity || ''),
        order_date: initialData.order_date ? new Date(initialData.order_date).toISOString().split('T')[0] : '',
        status: initialData.status || 'pending',
        notes: initialData.notes || '',
      });
    }
  }, [initialData, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">PO Number</label>
          <input type="text" name="po_number" value={formData.po_number} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Customer Name</label>
          <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Item Name</label>
          <input type="text" name="item_name" value={formData.item_name} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Total Quantity (ton)</label>
          <input type="number" step="0.01" name="total_quantity" value={formData.total_quantity} onChange={handleChange} required min="0.01" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Order Date</label>
          <input type="date" name="order_date" value={formData.order_date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>

      <hr/>
      <h3 className="text-lg font-medium text-gray-900">Locations</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Load Location</label>
        <textarea name="load_location" value={formData.load_location} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" rows={2}></textarea>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Load Latitude (Optional)</label>
          <input type="number" step="any" name="load_latitude" value={formData.load_latitude} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Load Longitude (Optional)</label>
          <input type="number" step="any" name="load_longitude" value={formData.load_longitude} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Unload Location</label>
        <textarea name="unload_location" value={formData.unload_location} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" rows={2}></textarea>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Unload Latitude (Optional)</label>
          <input type="number" step="any" name="unload_latitude" value={formData.unload_latitude} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Unload Longitude (Optional)</label>
          <input type="number" step="any" name="unload_longitude" value={formData.unload_longitude} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" rows={3}></textarea>
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-blue-300">
          {isLoading ? 'Saving...' : buttonText}
        </button>
      </div>
    </form>
  );
};

export default PurchaseOrderForm;
