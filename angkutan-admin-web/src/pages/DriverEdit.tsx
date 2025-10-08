// src/pages/DriverEdit.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import DriverForm from '../components/DriverForm';

const DriverEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const [initialData, setInitialData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDriver = async () => {
      try {
        // The backend returns a User with a nested DriverProfile
        const response = await apiClient.get(`/drivers/${id}`); // Assuming you have a GET /users/:id endpoint
        const userData = response.data;
        // Combine user and profile data for the form
        const formData = {
          username: userData.username,
          ...userData.driverProfile
        };
        setInitialData(formData);
      } catch (err) {
      alert('Failed to load driver data.');
      console.error("Error fetching driver:", err);
    }
    };
    fetchDriver();
  }, [id]);

  const handleUpdate = async (data: any) => {
    setIsLoading(true);
    try {
      // data can be FormData now; if not, build it
      let body: any = data;
      if (!(data instanceof FormData)) {
        const { username, password, ktp_image, sim_image, ...profileData } = data;
        const fd = new FormData();
        Object.entries(profileData).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, String(v));
        });
        if (ktp_image) fd.append('ktp_image', ktp_image as any);
        if (sim_image) fd.append('sim_image', sim_image as any);
        body = fd;
      }
      await apiClient.put(`/drivers/${id}`, body);
      navigate('/drivers');
    } catch (err) {
      alert('Failed to update driver.');
      setIsLoading(false);
    }
  };

  if (!initialData) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Edit Supir</h1>
      <DriverForm 
        onSubmit={handleUpdate} 
        isLoading={isLoading} 
        initialData={initialData} 
        isEditMode={true}
      />
    </div>
  );
};

export default DriverEditPage;
