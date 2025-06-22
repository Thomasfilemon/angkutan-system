// src/pages/VehicleCreate.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import VehicleForm from '../components/VehicleForm';

const VehicleCreatePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreateVehicle = async (data: any) => {
    console.log('Received data from form:', data);
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        license_plate: data.license_plate?.trim(),
        type: data.type?.trim(),
        capacity: data.capacity,
        driver_id: data.driver_id, // NEW: Include driver assignment
        status: data.status,
        stnk_number: data.stnk_number?.trim(),
        stnk_expired_date: data.stnk_expired_date || null,
        tax_due_date: data.tax_due_date || null,
        last_service_date: data.last_service_date || null,
        next_service_due: data.next_service_due || null,
      };

      console.log('Sending payload:', payload);
      await apiClient.post('/vehicles', payload);
      navigate('/vehicles');
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || 
                          err.response?.data?.errors?.join('. ') || 
                          err.response?.data?.message || 
                          err.message || 
                          'An unknown error occurred.';
      setError(errorMessage);
      console.error('Error creating vehicle:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tambah Kendaraan Baru</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4" role="alert">
          {error}
        </div>
      )}
      <VehicleForm 
        onSubmit={handleCreateVehicle} 
        isLoading={isLoading}
        buttonText="Simpan Kendaraan"
      />
    </div>
  );
};

export default VehicleCreatePage;
