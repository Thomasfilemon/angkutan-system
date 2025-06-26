// src/pages/VehicleEdit.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import VehicleForm from '../components/VehicleForm';

const VehicleEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const [vehicleData, setVehicleData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        setIsPageLoading(true);
        const response = await apiClient.get(`/vehicles/${id}`);
        setVehicleData(response.data.data || response.data);
      } catch (err) {
        setError('Failed to load vehicle data.');
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchVehicle();
  }, [id]);

  const handleUpdateVehicle = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: any = { 
        ...data,
        tire_count: data.tire_count,           // NEW: Include tire configuration
        spare_tire_count: data.spare_tire_count // NEW: Include spare tire configuration
      };

      if (data.capacity === null || data.capacity.trim() === '') {
        payload.capacity = null;
      } else {
        const numCapacity = parseInt(data.capacity, 10);
        if (isNaN(numCapacity) || numCapacity < 0) {
          throw new Error('Capacity must be a valid non-negative number.');
        }
        payload.capacity = numCapacity;
      }
      
      payload.driver_id = data.driver_id;
      payload.stnk_expired_date = data.stnk_expired_date || null;
      payload.tax_due_date = data.tax_due_date || null;
      payload.last_service_date = data.last_service_date || null;
      payload.next_service_due = data.next_service_due || null;

      await apiClient.put(`/vehicles/${id}`, payload);
      navigate('/vehicles');
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.response?.data?.errors?.join('. ') || err.response?.data?.message || err.message || 'An unknown error occurred.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) return <div>Loading vehicle data...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">{error}</div>;
  if (!vehicleData) return <div>Vehicle not found.</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Edit Kendaraan</h1>
      {error && <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">{error}</div>}
      <VehicleForm
        initialData={vehicleData}
        onSubmit={handleUpdateVehicle}
        isLoading={isLoading}
        buttonText="Update Kendaraan"
        isEditMode={true}
      />
    </div>
  );
};

export default VehicleEditPage;
