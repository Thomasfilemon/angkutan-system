// src/pages/CreateDepositGroup.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";

// ADD: Interface for form data
interface FormData {
  group_name: string;
  target_quantity: string;
  deposited_amount: string;
  unit: string;
}

const CreateDepositGroup = () => {
  const [formData, setFormData] = useState<FormData>({
    group_name: '',
    target_quantity: '',
    deposited_amount: '',
    unit: 'ton'
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // FIX: Add proper type for the event parameter
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // FIX: Add proper type for the event parameter
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.group_name || !formData.target_quantity || !formData.deposited_amount) {
        throw new Error('Please fill in all required fields');
      }

      const payload = {
        ...formData,
        target_quantity: parseFloat(formData.target_quantity),
        deposited_amount: parseFloat(formData.deposited_amount),
        remaining_quantity: parseFloat(formData.target_quantity), // Initially same as target
        status: 'active'
      };

      await apiClient.post('/deposit-groups', payload);
      alert('Deposit group created successfully!');
      navigate('/deposit-groups'); // Navigate back to deposit groups list
    } catch (err: unknown) { // FIX: Add proper type for error
      console.error('Error creating deposit group:', err);
      
      // Type guard for error handling
      let errorMessage = 'Failed to create deposit group';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as any; // Type assertion for axios error
        errorMessage = axiosError.response?.data?.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Create New Deposit Group</h1>
        <button
          onClick={() => navigate('/deposit-groups')}
          className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          ← Back to Deposit Groups
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Group Name *
          </label>
          <input
            type="text"
            name="group_name"
            value={formData.group_name}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter group name"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Target Quantity *
          </label>
          <input
            type="number"
            name="target_quantity"
            value={formData.target_quantity}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter target quantity"
            min="0"
            step="0.01"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Unit *
          </label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          >
            <option value="ton">Ton</option>
            <option value="kubik">Kubik (m³)</option>
            <option value="kilogram">Kilogram</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Deposited Amount (Rp) *
          </label>
          <input
            type="number"
            name="deposited_amount"
            value={formData.deposited_amount}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter deposited amount"
            min="0"
            step="0.01"
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Deposit Group'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateDepositGroup;
