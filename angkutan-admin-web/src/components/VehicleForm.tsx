// src/components/VehicleForm.tsx

import React, { useState, useEffect } from 'react';

// This interface is complete from our previous steps
interface VehicleFormData {
  license_plate: string;
  type: string;
  capacity: string;
  stnk_number: string;
  stnk_expired_date: string;
  tax_due_date: string;
  last_service_date: string;
  next_service_due: string;
  status: 'available' | 'in_use' | 'maintenance';
}

interface VehicleFormProps {
  initialData?: Partial<VehicleFormData>;
  onSubmit: (data: VehicleFormData) => void;
  isLoading: boolean;
  buttonText?: string;
  isEditMode?: boolean;
}

const VehicleForm: React.FC<VehicleFormProps> = ({
  initialData = {},
  onSubmit,
  isLoading,
  buttonText = 'Submit',
  isEditMode = false
}) => {
  const [formData, setFormData] = useState<VehicleFormData>({
    license_plate: '', type: '', capacity: '', stnk_number: '',
    stnk_expired_date: '', tax_due_date: '', last_service_date: '',
    next_service_due: '', status: 'available',
    ...initialData,
  });

  useEffect(() => {
    if (isEditMode && initialData) {
      const formatToDateInput = (dateStr: any) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
      setFormData({
        license_plate: initialData.license_plate || '',
        type: initialData.type || '',
        capacity: String(initialData.capacity || ''),
        stnk_number: initialData.stnk_number || '',
        stnk_expired_date: formatToDateInput(initialData.stnk_expired_date),
        tax_due_date: formatToDateInput(initialData.tax_due_date),
        last_service_date: formatToDateInput(initialData.last_service_date),
        next_service_due: formatToDateInput(initialData.next_service_due),
        status: initialData.status || 'available',
      });
    }
  }, [initialData, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the browser from reloading the page
    onSubmit(formData);
  };

  return (
    // The onSubmit handler is correctly on the <form> element
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
      {/* All the input fields from our previous steps are here... */}
      <div>
        <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700">Plat Nomor</label>
        <input type="text" name="license_plate" id="license_plate" value={formData.license_plate} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
      </div>
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">Tipe Kendaraan</label>
        <input type="text" name="type" id="type" value={formData.type} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">Kapasitas (kg)</label>
          <input type="number" name="capacity" id="capacity" value={formData.capacity} onChange={handleChange} required min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
          <select name="status" id="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" >
            <option value="available">Available</option>
            <option value="in_use">In Use</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>
      <hr/>
      <h3 className="text-lg font-medium text-gray-900">Detail Dokumen</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
            <label htmlFor="stnk_number" className="block text-sm font-medium text-gray-700">Nomor STNK</label>
            <input type="text" name="stnk_number" id="stnk_number" value={formData.stnk_number} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
       </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="stnk_expired_date" className="block text-sm font-medium text-gray-700">Tanggal Expired STNK</label>
          <input type="date" name="stnk_expired_date" id="stnk_expired_date" value={formData.stnk_expired_date} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label htmlFor="tax_due_date" className="block text-sm font-medium text-gray-700">Tanggal Jatuh Tempo Pajak</label>
          <input type="date" name="tax_due_date" id="tax_due_date" value={formData.tax_due_date} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>
      <hr/>
      <h3 className="text-lg font-medium text-gray-900">Detail Servis (Opsional)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="last_service_date" className="block text-sm font-medium text-gray-700">Tanggal Servis Terakhir</label>
          <input type="date" name="last_service_date" id="last_service_date" value={formData.last_service_date} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label htmlFor="next_service_due" className="block text-sm font-medium text-gray-700">Jatuh Tempo Servis Berikutnya</label>
          <input type="date" name="next_service_due" id="next_service_due" value={formData.next_service_due} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        {/* --- THE FIX IS HERE --- */}
        {/* Explicitly set type="submit" to ensure it triggers the form's onSubmit event. */}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-blue-300"
        >
          {isLoading ? 'Saving...' : buttonText}
        </button>
      </div>
    </form>
  );
};

export default VehicleForm;
