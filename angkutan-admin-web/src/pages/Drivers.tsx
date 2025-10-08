// src/pages/Drivers.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

// Define the shape of the data from the backend
interface DriverProfile {
  full_name: string;
  phone: string;
  status: 'available' | 'busy' | 'on_leave';
  ktp_image_url?: string | null;
  sim_image_url?: string | null;
}

interface Driver {
  id: number; // This is the user_id
  username: string;
  driverProfile: DriverProfile;
}

interface Vehicle {
  id: number;
  license_plate: string;
  driver_id: number | null;
  status: string;
}

const DriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      
      // Fetch drivers
      const driversResponse = await apiClient.get('/drivers');
      const driversData = Array.isArray(driversResponse.data) ? driversResponse.data : [];
      
      // Fetch vehicles to get assignment information
      const vehiclesResponse = await apiClient.get('/vehicles');
      const vehiclesData = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : [];
      
      // Create assignment map (driver_id -> vehicle license_plate)
      const assignmentMap = new Map<number, string>();
      vehiclesData.forEach((vehicle: Vehicle) => {
        if (vehicle.driver_id) {
          assignmentMap.set(vehicle.driver_id, vehicle.license_plate);
        }
      });
      
      setDrivers(driversData);
      setVehicleAssignments(assignmentMap);
    } catch (err) {
      setError('Failed to fetch drivers.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this driver? This action cannot be undone.')) {
      try {
        await apiClient.delete(`/drivers/${id}`);
        setDrivers(prevDrivers => prevDrivers.filter(driver => driver.id !== id));
        // Also remove from vehicle assignments if exists
        setVehicleAssignments(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } catch (err) {
        alert('Failed to delete driver.');
      }
    }
  };

  const getStatusDisplay = (driver: Driver) => {
    const assignedVehicle = vehicleAssignments.get(driver.id);
    
    // If driver is assigned to a vehicle, show assignment status
    if (assignedVehicle) {
      return {
        text: `Assigned to ${assignedVehicle}`,
        className: 'bg-blue-100 text-blue-800'
      };
    }
    
    // Otherwise, show the driver's profile status
    switch (driver.driverProfile.status) {
      case 'available':
        return {
          text: 'Available',
          className: 'bg-green-100 text-green-800'
        };
      case 'busy':
        return {
          text: 'Busy',
          className: 'bg-yellow-100 text-yellow-800'
        };
      case 'on_leave':
        return {
          text: 'On Leave',
          className: 'bg-red-100 text-red-800'
        };
      default:
        return {
          text: driver.driverProfile.status,
          className: 'bg-gray-100 text-gray-800'
        };
    }
  };

  if (loading) return <div>Loading drivers...</div>;
  if (error) return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Supir</h1>
        <Link to="/drivers/create">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Tambah Supir
          </button>
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Nama Lengkap</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Nomor Telepon</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Dokumen</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => {
              const statusDisplay = getStatusDisplay(driver);
              return (
                <tr key={driver.id}>
                  <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900">{driver.driverProfile.full_name}</p>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900">{driver.driverProfile.phone}</p>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                    <div className="flex items-center gap-3">
                      {/* KTP */}
                      {driver.driverProfile.ktp_image_url ? (
                        <button
                          type="button"
                          onClick={() => setViewerUrl(driver.driverProfile.ktp_image_url || null)}
                          title="Lihat KTP"
                          className="border rounded hover:ring-2 hover:ring-blue-400"
                        >
                          <img
                            src={driver.driverProfile.ktp_image_url}
                            alt="KTP"
                            className="h-10 w-16 object-cover"
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">KTP: -</span>
                      )}
                      {/* SIM */}
                      {driver.driverProfile.sim_image_url ? (
                        <button
                          type="button"
                          onClick={() => setViewerUrl(driver.driverProfile.sim_image_url || null)}
                          title="Lihat SIM"
                          className="border rounded hover:ring-2 hover:ring-blue-400"
                        >
                          <img
                            src={driver.driverProfile.sim_image_url}
                            alt="SIM"
                            className="h-10 w-16 object-cover"
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">SIM: -</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusDisplay.className}`}>
                      {statusDisplay.text}
                    </span>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-200 bg-white text-sm text-right">
                    <Link to={`/drivers/edit/${driver.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</Link>
                    <button onClick={() => handleDelete(driver.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Simple Image Viewer Modal */}
      {viewerUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setViewerUrl(null)}>
          <div className="max-w-4xl max-h-[85vh] p-2 bg-white rounded shadow" onClick={(e) => e.stopPropagation()}>
            <img src={viewerUrl} alt="Dokumen" className="max-h-[80vh] object-contain" />
            <div className="text-right mt-2">
              <a href={viewerUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline mr-4">Buka di Tab Baru</a>
              <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300" onClick={() => setViewerUrl(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversPage;
