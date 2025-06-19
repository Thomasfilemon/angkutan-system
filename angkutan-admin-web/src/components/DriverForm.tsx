// src/components/DriverForm.tsx

import React, { useState } from 'react';

// Form data now includes all fields from your DriverProfile model
interface DriverFormData {
  username?: string;
  password?: string;
  full_name: string;
  phone: string;
  address: string;
  id_card_number: string;
  sim_number: string;
  license_type: string;
  status: 'available' | 'busy' | 'on_leave';
}

interface DriverFormProps {
  initialData?: Partial<DriverFormData>;
  onSubmit: (data: DriverFormData) => void;
  isLoading: boolean;
  isEditMode?: boolean;
}

const DriverForm: React.FC<DriverFormProps> = ({ 
  initialData = {},
  onSubmit,
  isLoading,
  isEditMode = false
}) => {
  const [formData, setFormData] = useState<DriverFormData>({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    address: '',
    id_card_number: '', // Added field
    sim_number: '',      // Added field
    license_type: 'B1',  // Added field
    status: 'available',
    ...initialData,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
      {!isEditMode && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input type="text" name="username" value={formData.username} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" name="password" placeholder={isEditMode ? 'Leave blank to keep unchanged' : ''} onChange={handleChange} required={!isEditMode} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
          </div>
          <hr/>
        </>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
        <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nomor Telepon</label>
        <input type="text" name="phone" value={formData.phone} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Alamat</label>
        <textarea name="address" value={formData.address} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
      </div>
      
      {/* --- ADDED REQUIRED AND OPTIONAL FIELDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nomor KTP (16 digit)</label>
          <input type="text" name="id_card_number" value={formData.id_card_number} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nomor SIM</label>
          <input type="text" name="sim_number" value={formData.sim_number} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div>
          <label className="block text-sm font-medium text-gray-700">Tipe SIM</label>
          <select name="license_type" value={formData.license_type} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
            <option value="A">A</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="on_leave">On Leave</option>
          </select>
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-blue-300">
          {isLoading ? 'Saving...' : (isEditMode ? 'Update Driver' : 'Create Driver')}
        </button>
      </div>
    </form>
  );
};

export default DriverForm;
