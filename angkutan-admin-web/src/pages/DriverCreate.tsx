// src/pages/DriverCreate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import DriverForm from '../components/DriverForm';

const DriverCreatePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (data: any) => {
    setIsLoading(true);
    try {
      await apiClient.post('/drivers', data);
      navigate('/drivers');
    } catch (err) {
      alert('Failed to create driver.');
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tambah Supir Baru</h1>
      <DriverForm onSubmit={handleCreate} isLoading={isLoading} />
    </div>
  );
};

export default DriverCreatePage;
