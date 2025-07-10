import React, { useState, useEffect } from 'react';
import apiClient from '../api/axiosConfig';

interface Driver {
  id: number;
  name: string;
  status: string;
}

interface Vehicle {
  id: number;
  license_plate: string;
  driver_name: string | null;
  status: 'available' | 'in_use' | 'maintenance';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onSuccess: () => void;
}

const AssignDriverModal: React.FC<Props> = ({ isOpen, onClose, vehicle, onSuccess }) => {
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    if (isOpen && vehicle) {
      const fetchAvailableDrivers = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const response = await apiClient.get('/vehicles/drivers/available');
          
          if (isMounted && Array.isArray(response.data)) {
            const formattedDrivers = response.data.map((apiDriver: any) => ({
              id: apiDriver.id,
              name: apiDriver.full_name,
              status: apiDriver.status,
            }));
            setAvailableDrivers(formattedDrivers);
            
            if (formattedDrivers.length === 0) {
              setSelectedDriver('');
            }
          } else {
            if (isMounted) {
              console.warn("Received unexpected non-array data for available drivers:", response.data);
              setAvailableDrivers([]);
            }
          }
        } catch (err) {
          if (isMounted) {
            setError('Failed to fetch available drivers.');
            console.error('Error fetching available drivers:', err);
            setAvailableDrivers([]);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchAvailableDrivers();
      setSelectedDriver('');
    }
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, vehicle?.id]);

  if (!isOpen || !vehicle) return null;

  const handleAssign = async () => {
    if (!selectedDriver) {
      alert('Please select a driver to assign.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.patch(`/vehicles/${vehicle.id}/assign-driver`, { driver_id: selectedDriver });
      
      // Refresh available drivers list to ensure the assigned driver is removed
      const response = await apiClient.get('/vehicles/drivers/available');
      if (Array.isArray(response.data)) {
        const formattedDrivers = response.data.map((apiDriver: any) => ({
          id: apiDriver.id,
          name: apiDriver.full_name,
          status: apiDriver.status,
        }));
        setAvailableDrivers(formattedDrivers);
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to assign driver.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (window.confirm('Are you sure you want to remove the driver from this vehicle?')) {
      try {
        setLoading(true);
        await apiClient.patch(`/vehicles/${vehicle.id}/assign-driver`, { driver_id: null });
        
        // Refresh available drivers list to include the newly unassigned driver
        const response = await apiClient.get('/vehicles/drivers/available');
        if (Array.isArray(response.data)) {
          const formattedDrivers = response.data.map((apiDriver: any) => ({
            id: apiDriver.id,
            name: apiDriver.full_name,
            status: apiDriver.status,
          }));
          setAvailableDrivers(formattedDrivers);
        }
        
        onSuccess();
        onClose();
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Failed to remove driver.';
        alert(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const canRemoveDriver = vehicle.status !== 'in_use' && vehicle.driver_name;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Assign Driver for {vehicle.license_plate}</h2>
        
        <div className="mb-4">
          <h3 className="font-semibold">Current Driver:</h3>
          {vehicle.driver_name ? (
            <div className="flex items-center justify-between mt-2">
              <p className="text-gray-800">{vehicle.driver_name}</p>
              <button 
                onClick={handleRemove}
                disabled={!canRemoveDriver || loading}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm disabled:bg-gray-400"
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="text-gray-500 italic mt-2">No driver assigned</p>
          )}
          {!canRemoveDriver && vehicle.driver_name && (
            <p className="text-xs text-red-600 mt-1">Cannot remove driver while vehicle is in use.</p>
          )}
        </div>

        <hr className="my-4"/>

        <div className="mb-4">
          <label htmlFor="driver-select" className="block text-sm font-medium text-gray-700 mb-2">
            Assign a New Driver
          </label>
          {loading && <p>Loading drivers...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && (
            <>
              <select
                id="driver-select"
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                disabled={loading || availableDrivers.length === 0}
              >
                <option value="">-- Select an available driver --</option>
                {availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
              {availableDrivers.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  No available drivers found. All drivers may be currently assigned to vehicles.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
          >
            Cancel
          </button>
          <button 
            onClick={handleAssign}
            disabled={!selectedDriver || loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignDriverModal;
