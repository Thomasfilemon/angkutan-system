// src/pages/DriverCreate.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import DriverForm from "../components/DriverForm";

const DriverCreatePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (data: any) => {
    setIsLoading(true);
    try {
      // data is FormData now
      await apiClient.post("/drivers", data);
      navigate("/drivers");
    } catch (err: any) {
      // Error handling with user feedback
      let errorMessage = "Failed to create driver";
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // Handle validation errors (array of error messages)
        if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage = "Validation failed:\n\n" + errorData.errors.join("\n");
        } else if (errorData.message) {
          errorMessage = errorData.message;
          if (errorData.details) {
            errorMessage += "\n\n" + errorData.details;
          }
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(errorMessage);
      console.error("Error creating driver:", err);
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
