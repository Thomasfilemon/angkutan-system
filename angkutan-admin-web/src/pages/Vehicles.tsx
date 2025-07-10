import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// Interface for Vehicle
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
  // Data states
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]); // All vehicles from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Fetch all vehicles from API
  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/vehicles');
      console.log('API Response:', response.data);
      
      // Handle different response formats
      let vehiclesData = [];
      if (response.data.success && response.data.data) {
        vehiclesData = response.data.data;
      } else if (response.data.records) {
        vehiclesData = response.data.records;
      } else if (Array.isArray(response.data)) {
        vehiclesData = response.data;
      }
      
      console.log('Vehicles loaded:', vehiclesData.length);
      setAllVehicles(vehiclesData);
    } catch (err) {
      setError('Failed to fetch vehicles. Please try again later.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Client-side filtering and search
  const filteredVehicles = useMemo(() => {
    let filtered = allVehicles;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(vehicle => vehicle.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(vehicle =>
        vehicle.license_plate.toLowerCase().includes(searchLower) ||
        vehicle.type.toLowerCase().includes(searchLower) ||
        (vehicle.capacity && vehicle.capacity.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [allVehicles, statusFilter, searchTerm]);

  // Client-side pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      vehicles: filteredVehicles.slice(startIndex, endIndex),
      totalItems: filteredVehicles.length,
      totalPages: Math.ceil(filteredVehicles.length / itemsPerPage),
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, filteredVehicles.length)
    };
  }, [filteredVehicles, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Event handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await apiClient.delete(`/vehicles/${id}`);
        fetchVehicles(); // Refresh data
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
    fetchVehicles(); // Refresh data
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

  // Pagination component
  const renderPagination = () => {
    const { totalPages, totalItems } = paginatedData;
    
    if (totalPages <= 1) return null;

    const pages = [];
    const showPages = 5; // Show max 5 page numbers
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < showPages - 1) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-white rounded-lg shadow">
        {/* Page info */}
        <div className="text-sm text-gray-600">
          Showing {paginatedData.startIndex} to {paginatedData.endIndex} of {totalItems} vehicles
        </div>

        {/* Pagination controls */}
        <div className="flex items-center space-x-1">
          {/* Previous button */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {/* First page + ellipsis */}
          {startPage > 1 && (
            <>
              <button
                onClick={() => handlePageChange(1)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                1
              </button>
              {startPage > 2 && (
                <span className="px-3 py-2 text-sm font-medium text-gray-500">...</span>
              )}
            </>
          )}

          {/* Page numbers */}
          {pages.map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-2 text-sm font-medium border ${
                currentPage === page
                  ? 'text-white bg-blue-600 border-blue-600'
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}

          {/* Last page + ellipsis */}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <span className="px-3 py-2 text-sm font-medium text-gray-500">...</span>
              )}
              <button
                onClick={() => handlePageChange(totalPages)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                {totalPages}
              </button>
            </>
          )}

          {/* Next button */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-center p-8">Loading vehicles...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
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

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Vehicles
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by license plate, type, or capacity..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="mt-3 text-sm text-gray-600">
          {filteredVehicles.length === allVehicles.length 
            ? `Showing all ${allVehicles.length} vehicles`
            : `Found ${filteredVehicles.length} of ${allVehicles.length} vehicles`
          }
          {searchTerm && ` matching "${searchTerm}"`}
          {statusFilter !== 'all' && ` with status "${statusFilter}"`}
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {paginatedData.vehicles.length > 0 ? (
          paginatedData.vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-white shadow-lg rounded-lg overflow-hidden flex flex-col transition-transform transform hover:scale-105">
              <div className="p-5 flex-grow">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-gray-800">{vehicle.license_plate}</h2>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    vehicle.status === 'available' ? 'bg-green-100 text-green-800' : 
                    vehicle.status === 'in_use' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {vehicle.status.replace('_', ' ')}
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
                        vehicle.driver_status === 'available' ? 'bg-green-100 text-green-800' : 
                        vehicle.driver_status === 'busy' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
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
            {filteredVehicles.length === 0 && allVehicles.length > 0
              ? 'No vehicles found matching your search criteria'
              : 'Tidak ada data kendaraan.'
            }
          </div>
        )}
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Assign Driver Modal */}
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
