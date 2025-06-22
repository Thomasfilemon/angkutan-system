// src/components/PurchaseOrderForm.tsx
import React, { useState, useEffect } from 'react';

interface PurchaseOrderFormData {
  customer_name: string;
  item_name: string;
  total_quantity: string;
  unit_price: string;
  load_location: string;
  unload_location: string;
  notes: string;
}

interface PurchaseOrderFormProps {
  initialData?: any;
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
    customer_name: '',
    item_name: '',
    total_quantity: '',
    unit_price: '',
    load_location: '',
    unload_location: '',
    notes: '',
  });

  // Update form data when initialData changes
  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        customer_name: initialData.customer_name || '',
        item_name: initialData.item_name || '',
        total_quantity: initialData.total_quantity?.toString() || '',
        unit_price: initialData.unit_price?.toString() || '',
        load_location: initialData.load_location || '',
        unload_location: initialData.unload_location || '',
        notes: initialData.notes || '',
      });
    }
  }, [initialData, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Calculate total amount for display
  const calculateTotal = () => {
    const quantity = parseFloat(formData.total_quantity) || 0;
    const price = parseFloat(formData.unit_price) || 0;
    return quantity * price;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
            Customer Name *
          </label>
          <input
            type="text"
            id="customer_name"
            name="customer_name"
            value={formData.customer_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., PT WIKA BETON"
          />
        </div>

        <div>
          <label htmlFor="item_name" className="block text-sm font-medium text-gray-700 mb-2">
            Item Name *
          </label>
          <input
            type="text"
            id="item_name"
            name="item_name"
            value={formData.item_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., Abu Batu, Pasir, Split"
          />
        </div>
      </div>

      {/* Quantity and Price */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="total_quantity" className="block text-sm font-medium text-gray-700 mb-2">
            Total Quantity (ton) *
          </label>
          <input
            type="number"
            id="total_quantity"
            name="total_quantity"
            value={formData.total_quantity}
            onChange={handleChange}
            step="0.01"
            min="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., 200.00"
          />
        </div>

        <div>
          <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700 mb-2">
            Unit Price (Rp/ton)
          </label>
          <input
            type="number"
            id="unit_price"
            name="unit_price"
            value={formData.unit_price}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
            placeholder="e.g., 155000"
          />
        </div>
      </div>

      {/* Total Amount Display */}
      {formData.total_quantity && formData.unit_price && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Estimated Total Amount:</span>
            <span className="text-lg font-semibold text-blue-600">
              Rp {calculateTotal().toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      )}

      {/* Location Information (Optional) */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Location Information (Optional)</h3>
        <p className="text-sm text-gray-600">
          You can leave these empty and specify locations when creating delivery orders.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="load_location" className="block text-sm font-medium text-gray-700 mb-2">
              Load Location
            </label>
            <textarea
              id="load_location"
              name="load_location"
              value={formData.load_location}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              placeholder="e.g., Quarry Jonggol, Bogor"
            />
          </div>

          <div>
            <label htmlFor="unload_location" className="block text-sm font-medium text-gray-700 mb-2">
              Unload Location
            </label>
            <textarea
              id="unload_location"
              name="unload_location"
              value={formData.unload_location}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              placeholder="e.g., Proyek Tol Cibitung, Bekasi"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
          placeholder="Additional notes or requirements..."
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isLoading ? 'Saving...' : buttonText}
        </button>
      </div>
    </form>
  );
};

export default PurchaseOrderForm;
