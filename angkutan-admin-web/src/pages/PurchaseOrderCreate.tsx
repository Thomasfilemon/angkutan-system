// src/pages/PurchaseOrderCreate.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import PurchaseOrderForm from '../components/PurchaseOrderForm';

const PurchaseOrderCreatePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreatePO = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        ...data,
        total_quantity: parseFloat(data.total_quantity),
        load_latitude: data.load_latitude ? parseFloat(data.load_latitude) : null,
        load_longitude: data.load_longitude ? parseFloat(data.load_longitude) : null,
        unload_latitude: data.unload_latitude ? parseFloat(data.unload_latitude) : null,
        unload_longitude: data.unload_longitude ? parseFloat(data.unload_longitude) : null,
      };

      await apiClient.post('/purchase-orders', payload);
      navigate('/trips');
    } catch (err: any) {
      const errorMessage = err.response?.data?.details || err.response?.data?.message || err.message || 'Failed to create purchase order.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Buat Purchase Order Baru</h1>
      {error && <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">{error}</div>}
      <PurchaseOrderForm 
        onSubmit={handleCreatePO} 
        isLoading={isLoading}
        buttonText="Buat Purchase Order"
      />
    </div>
  );
};

export default PurchaseOrderCreatePage;
