import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import AssignDriverModal from '../components/AssignDriverModal';

// Interface for Tire Stats
interface TireStats {
  total_installed: number;
  total_expected: number;
  needs_attention: number;
  good_condition: number;
}

// Interface for Vehicle, updated with service dates
interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: string;
  tire_count: number;
  spare_tire_count: number;
  driver_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_status: string | null;
  stnk_expired_date: string;
  tax_due_date: string;
  status: 'available' | 'in_use' | 'maintenance';
  tire_stats: TireStats;
  last_service_date: string;
  next_service_due: string;
}


const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const response = await apiClient.get('/vehicles');
      const vehiclesData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setVehicles(vehiclesData);
    } catch (err) {
      setError('Failed to fetch vehicles. Please try again later.');
      console.error(err);
    } finally {
        if(loading) setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await apiClient.delete(`/vehicles/${id}`);
        fetchVehicles();
      } catch (err) {
        alert('Failed to delete vehicle.');
      }
    }
  };
  
  const handleOpenModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedVehicle(null);
    setIsModalOpen(false);
  };

  const handleAssignmentSuccess = () => {
    fetchVehicles();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const getDateColor = (dateString: string) => {
    if (!dateString) return 'text-gray-500';
    const date = new Date(dateString);
    const today = new Date();
    const threeMonths = new Date();
    threeMonths.setMonth(today.getMonth() + 3);

    if (date < today) return 'text-red-600 font-bold';
    if (date < threeMonths) return 'text-yellow-600';
    return 'text-gray-800';
  };

  if (loading) return <div className="text-center p-8">Loading vehicles...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div>
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Kendaraan</h1>
        <div className="flex space-x-2">
          <Link to="/vehicles/create">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-md transition duration-200">
              + Tambah Kendaraan
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {vehicles.length > 0 ? (
          vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-white shadow-lg rounded-lg overflow-hidden flex flex-col transition-transform transform hover:scale-105">
                <div className="p-5 flex-grow">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-gray-800">{vehicle.license_plate}</h2>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    vehicle.status === 'available' ? 'bg-green-100 text-green-800' : 
                    vehicle.status === 'in_use' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {vehicle.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{vehicle.type} - {vehicle.capacity ? parseInt(vehicle.capacity).toLocaleString('id-ID') : '-'} kg</p>

                <hr className="my-4"/>

                <div className="mb-4">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-700 mb-2">Driver Information</h3>
                    <button 
                        onClick={() => handleOpenModal(vehicle)}
                        className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-2 rounded"
                    >
                        Assign / Change
                    </button>
                  </div>
                  {vehicle.driver_name ? (
                    <div className="flex items-center space-x-3 mt-2">
                      <div className="flex-shrink-0">
                        <img className="h-10 w-10 rounded-full" src={`https://ui-avatars.com/api/?name=${vehicle.driver_name}&background=random`} alt="" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{vehicle.driver_name}</p>
                        <p className="text-xs text-gray-500">{vehicle.driver_phone}</p>
                      </div>
                      <span className={`ml-auto inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vehicle.driver_status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {vehicle.driver_status}
                        </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic mt-2">No driver assigned</p>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Service & Documents</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Service:</span>
                      <span className="font-medium text-gray-800">{formatDate(vehicle.last_service_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Next Service Due:</span>
                      <span className={`font-medium ${getDateColor(vehicle.next_service_due)}`}>{formatDate(vehicle.next_service_due)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">STNK Expired:</span>
                      <span className={`font-medium ${getDateColor(vehicle.stnk_expired_date)}`}>{formatDate(vehicle.stnk_expired_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax Due:</span>
                      <span className={`font-medium ${getDateColor(vehicle.tax_due_date)}`}>{formatDate(vehicle.tax_due_date)}</span>
                    </div>
                  </div>
                </div>

                </div>

              {/* Card Footer Actions */}
              <div className="bg-gray-50 px-5 py-3 flex justify-end items-center space-x-3 flex-wrap">
                  <Link 
                    to={`/services/create?vehicleId=${vehicle.id}`} 
                    className="text-sm text-blue-600 hover:text-blue-900 font-medium"
                  >
                    Add Service
                  </Link>
                  <Link 
                    to={`/vehicles/${vehicle.id}/services`} 
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    History
                  </Link>
                   <Link 
                    to={`/vehicles/tires?vehicleId=${vehicle.id}`} 
                    className="text-sm text-green-600 hover:text-green-900 font-medium" 
                    title="Kelola Ban"
                  >
                    Manage Tires
                  </Link>
                  <Link 
                    to={`/vehicles/edit/${vehicle.id}`} 
                    className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                  >
                    Edit
                  </Link>
                 <button onClick={() => handleDelete(vehicle.id)} className="text-sm text-red-600 hover:text-red-900 font-medium">
                    Delete
                 </button>
              </div>
            </div>
          ))
        ) : (
            <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-10 text-gray-500">
                Tidak ada data kendaraan.
            </div>
        )}
      </div>

       <AssignDriverModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        vehicle={selectedVehicle}
        onSuccess={() => {
          handleCloseModal();
          handleAssignmentSuccess();
        }}
      />
    </div>
  );
};

export default VehiclesPage;