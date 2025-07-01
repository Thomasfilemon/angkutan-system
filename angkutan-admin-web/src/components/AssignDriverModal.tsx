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
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      const fetchAvailableDrivers = async () => {
        try {
          setLoading(true);
          // Fetch only available drivers from the API
          const response = await apiClient.get('/drivers?status=available');
          setAvailableDrivers(response.data.data || []);
          setError(null);
        } catch (err) {
          setError('Failed to fetch available drivers.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchAvailableDrivers();
      // Reset selection when modal opens
      setSelectedDriver(''); 
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleAssign = async () => {
    if (!selectedDriver) {
      alert('Please select a driver to assign.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.patch(`/vehicles/${vehicle.id}/assign-driver`, { driverId: selectedDriver });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to assign driver.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (window.confirm('Are you sure you want to remove the driver from this vehicle?')) {
      try {
        setLoading(true);
        await apiClient.patch(`/vehicles/${vehicle.id}/assign-driver`, { driverId: null });
        onSuccess();
        onClose();
      } catch (err) {
        alert('Failed to remove driver.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Prevent removing driver if vehicle is in use
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
                Remove Driver
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
                 <select
                    id="driver-select"
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    disabled={loading}
                >
                    <option value="">-- Select an available driver --</option>
                    {availableDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                        {driver.name}
                    </option>
                    ))}
                </select>
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