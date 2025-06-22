// src/components/VehicleForm.tsx

import React, { useState, useEffect } from 'react';
import apiClient from '../api/axiosConfig';

interface Driver {
  id: number;
  username: string;
  full_name: string;
  phone: string;
  status: string;
}

// FIXED: Updated interface to match the actual data structure
interface VehicleFormData {
  license_plate: string;
  type: string;
  capacity: string;
  driver_id: number | null; // Changed from string to number | null
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
  // Internal form state uses string for driver_id to work with select element
  const [formData, setFormData] = useState({
    license_plate: '', 
    type: '', 
    capacity: '', 
    driver_id: '', // Keep as string for form control
    stnk_number: '', 
    stnk_expired_date: '', 
    tax_due_date: '', 
    last_service_date: '', 
    next_service_due: '', 
    status: 'available' as 'available' | 'in_use' | 'maintenance',
  });

  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Fetch available drivers
  useEffect(() => {
  const fetchDrivers = async () => {
    try {
      setLoadingDrivers(true);
      console.log('🚗 Attempting to fetch drivers from: /vehicles/drivers/available');
      
      const response = await apiClient.get('/vehicles/drivers/available');
      console.log('📡 Raw response:', response);
      console.log('📊 Response data:', response.data);
      
      // FIXED: Handle both response structures
      let drivers = [];
      if (response.data && response.data.data) {
        // Expected structure: { success: true, data: [...] }
        drivers = response.data.data;
        console.log('👥 Using response.data.data:', drivers);
      } else if (Array.isArray(response.data)) {
        // Current structure: [...]
        drivers = response.data;
        console.log('👥 Using response.data directly:', drivers);
      } else {
        console.log('❌ Unexpected response structure:', response.data);
      }
      
      console.log(`✅ Setting ${drivers.length} available drivers:`, drivers);
      setAvailableDrivers(drivers);
    } catch (err) {
      console.error('❌ Failed to fetch drivers:', err);
      
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as any;
        console.error('📋 Error response:', axiosError.response?.data);
        console.error('🔢 Status code:', axiosError.response?.status);
      }
    } finally {
      setLoadingDrivers(false);
    }
  };

  fetchDrivers();
}, []);

  useEffect(() => {
    if (isEditMode && initialData) {
      const formatToDateInput = (dateStr: any) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
      setFormData({
        license_plate: initialData.license_plate || '',
        type: initialData.type || '',
        capacity: String(initialData.capacity || ''),
        driver_id: initialData.driver_id ? String(initialData.driver_id) : '',
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
    e.preventDefault();
    
    // FIXED: Convert form data to match VehicleFormData interface
    const submitData: VehicleFormData = {
      license_plate: formData.license_plate,
      type: formData.type,
      capacity: formData.capacity,
      driver_id: formData.driver_id === '' ? null : parseInt(formData.driver_id, 10), // Convert to number | null
      stnk_number: formData.stnk_number,
      stnk_expired_date: formData.stnk_expired_date,
      tax_due_date: formData.tax_due_date,
      last_service_date: formData.last_service_date,
      next_service_due: formData.next_service_due,
      status: formData.status,
    };
    
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
      {/* Basic Vehicle Information */}
      <div>
        <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700">Plat Nomor</label>
        <input 
          type="text" 
          name="license_plate" 
          id="license_plate" 
          value={formData.license_plate} 
          onChange={handleChange} 
          required 
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">Tipe Kendaraan</label>
        <input 
          type="text" 
          name="type" 
          id="type" 
          value={formData.type} 
          onChange={handleChange} 
          required 
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">Kapasitas (kg)</label>
          <input 
            type="number" 
            name="capacity" 
            id="capacity" 
            value={formData.capacity} 
            onChange={handleChange} 
            required 
            min="0" 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
          <select 
            name="status" 
            id="status" 
            value={formData.status} 
            onChange={handleChange} 
            required 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="available">Available</option>
            <option value="in_use">In Use</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        {/* Driver Assignment */}
        <div>
          <label htmlFor="driver_id" className="block text-sm font-medium text-gray-700">Supir</label>
          <select 
            name="driver_id" 
            id="driver_id" 
            value={formData.driver_id}
            onChange={handleChange}
            disabled={loadingDrivers}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Pilih Supir (Opsional) --</option>
            {availableDrivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name} ({driver.phone})
              </option>
            ))}
          </select>
          {loadingDrivers && <p className="text-sm text-gray-500 mt-1">Loading drivers...</p>}
        </div>
      </div>

      <hr/>
      <h3 className="text-lg font-medium text-gray-900">Detail Dokumen</h3>
      
      <div>
        <label htmlFor="stnk_number" className="block text-sm font-medium text-gray-700">Nomor STNK</label>
        <input 
          type="text" 
          name="stnk_number" 
          id="stnk_number" 
          value={formData.stnk_number} 
          onChange={handleChange} 
          required 
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="stnk_expired_date" className="block text-sm font-medium text-gray-700">Tanggal Expired STNK</label>
          <input 
            type="date" 
            name="stnk_expired_date" 
            id="stnk_expired_date" 
            value={formData.stnk_expired_date} 
            onChange={handleChange} 
            required 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          />
        </div>
        <div>
          <label htmlFor="tax_due_date" className="block text-sm font-medium text-gray-700">Tanggal Jatuh Tempo Pajak</label>
          <input 
            type="date" 
            name="tax_due_date" 
            id="tax_due_date" 
            value={formData.tax_due_date} 
            onChange={handleChange} 
            required 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          />
        </div>
      </div>

      <hr/>
      <h3 className="text-lg font-medium text-gray-900">Detail Servis (Opsional)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="last_service_date" className="block text-sm font-medium text-gray-700">Tanggal Servis Terakhir</label>
          <input 
            type="date" 
            name="last_service_date" 
            id="last_service_date" 
            value={formData.last_service_date} 
            onChange={handleChange} 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          />
        </div>
        <div>
          <label htmlFor="next_service_due" className="block text-sm font-medium text-gray-700">Jatuh Tempo Servis Berikutnya</label>
          <input 
            type="date" 
            name="next_service_due" 
            id="next_service_due" 
            value={formData.next_service_due} 
            onChange={handleChange} 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
          />
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isLoading ? 'Saving...' : buttonText}
        </button>
      </div>
    </form>
  );
};

export default VehicleForm;
