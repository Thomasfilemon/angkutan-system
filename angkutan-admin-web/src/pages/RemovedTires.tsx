// src/pages/RemovedTires.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface RemovedTire {
  id: number;
  tire_serial_number: string;
  condition: string;
  current_tread_depth: number;
  status: string;
  notes?: string;
  tireInventory: {
    tire_brand: string;
    tire_size: string;
    tire_type: string;
  };
  installations: Array<{
    vehicle: {
      license_plate: string;
      current_mileage?: number; // ✅ Add current_mileage for calculation
    };
    install_date: string;
    remove_date: string;
    mileage_installed?: number; // ✅ Add mileage_installed field
    mileage_removed?: number; // ✅ Change from remove_mileage to mileage_removed
  }>;
}

interface EditModalData {
  condition: string;
  notes: string;
}

interface SearchFilters {
  searchTerm: string;
  conditionFilter: string;
  brandFilter: string;
  sizeFilter: string;
  statusFilter: string;
  vehicleFilter: string;
}

const RemovedTiresPage = () => {
  const [removedTires, setRemovedTires] = useState<RemovedTire[]>([]);
  const [filteredTires, setFilteredTires] = useState<RemovedTire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTire, setSelectedTire] = useState<RemovedTire | null>(null);
  const [editData, setEditData] = useState<EditModalData>({
    condition: '',
    notes: ''
  });

  // ✅ ADD SEARCH FILTERS STATE
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    conditionFilter: '',
    brandFilter: '',
    sizeFilter: '',
    statusFilter: '',
    vehicleFilter: ''
  });

  // ✅ ADD FILTER OPTIONS
  const [filterOptions, setFilterOptions] = useState({
    conditions: [] as string[],
    brands: [] as string[],
    sizes: [] as string[],
    vehicles: [] as string[]
  });

  // Condition mapping object for better maintainability
  const conditionMapping: { [key: string]: string } = {
    'new': 'Baru',
    'good': 'Baik',
    'fair': 'Cukup',
    'poor': 'Buruk',
    'damaged': 'Rusak',
    'disposed': 'Dibuang',
    'replace': 'Perlu Ganti',
    'meledak': 'Meledak',
    'bocor': 'Bocor',
    'kampasa': 'Kampasa'
  };

  useEffect(() => {
    fetchRemovedTires();
  }, []);

  // ✅ ADD FILTER EFFECT
  useEffect(() => {
    applyFilters();
  }, [removedTires, filters]);

  const fetchRemovedTires = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tires/tire-instances/available?status=removed');
      const tires = response.data?.data || response.data || [];
      setRemovedTires(tires);
      
      // ✅ EXTRACT FILTER OPTIONS
      extractFilterOptions(tires);
    } catch (err) {
      setError('Failed to fetch removed tires');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADD FILTER OPTIONS EXTRACTION
  const extractFilterOptions = (tires: RemovedTire[]) => {
    const conditions = Array.from(new Set(tires.map(tire => tire.condition)));
    const brands = Array.from(new Set(tires.map(tire => tire.tireInventory.tire_brand)));
    const sizes = Array.from(new Set(tires.map(tire => tire.tireInventory.tire_size)));
    const vehicles = Array.from(new Set(tires.flatMap(tire => 
      tire.installations.map(inst => inst.vehicle.license_plate)
    )));

    setFilterOptions({
      conditions: conditions.sort(),
      brands: brands.sort(),
      sizes: sizes.sort(),
      vehicles: vehicles.sort()
    });
  };

  // ✅ ADD FILTER LOGIC
  const applyFilters = () => {
    let filtered = [...removedTires];

    // Search term filter (searches in serial number, notes, and vehicle plate)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(tire => 
        tire.tire_serial_number.toLowerCase().includes(searchLower) ||
        tire.notes?.toLowerCase().includes(searchLower) ||
        tire.installations.some(inst => 
          inst.vehicle.license_plate.toLowerCase().includes(searchLower)
        )
      );
    }

    // Condition filter
    if (filters.conditionFilter) {
      filtered = filtered.filter(tire => tire.condition === filters.conditionFilter);
    }

    // Brand filter
    if (filters.brandFilter) {
      filtered = filtered.filter(tire => tire.tireInventory.tire_brand === filters.brandFilter);
    }

    // Size filter
    if (filters.sizeFilter) {
      filtered = filtered.filter(tire => tire.tireInventory.tire_size === filters.sizeFilter);
    }

    // Status filter (available/not available for installation)
    if (filters.statusFilter) {
      if (filters.statusFilter === 'available') {
        filtered = filtered.filter(tire => ['new', 'good', 'fair'].includes(tire.condition));
      } else if (filters.statusFilter === 'not_available') {
        filtered = filtered.filter(tire => !['new', 'good', 'fair'].includes(tire.condition));
      }
    }

    // Vehicle filter
    if (filters.vehicleFilter) {
      filtered = filtered.filter(tire => 
        tire.installations.some(inst => inst.vehicle.license_plate === filters.vehicleFilter)
      );
    }

    setFilteredTires(filtered);
  };

  // ✅ ADD FILTER HANDLERS
  const handleFilterChange = (filterType: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      conditionFilter: '',
      brandFilter: '',
      sizeFilter: '',
      statusFilter: '',
      vehicleFilter: ''
    });
  };

  const handleEditClick = (tire: RemovedTire) => {
    setSelectedTire(tire);
    setEditData({
      condition: tire.condition,
      notes: tire.notes || ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTire) return;

    try {
      await apiClient.put(`/tires/tire-instances/${selectedTire.id}`, editData);
      setEditModalOpen(false);
      await fetchRemovedTires(); // Refresh the list
    } catch (error) {
      console.error('Failed to update tire:', error);
      alert('Gagal memperbarui data ban.');
    }
  };

  const formatRemoveDate = (tire: RemovedTire): string => {
    if (!tire.installations || tire.installations.length === 0) {
      return 'Tanggal tidak tersedia';
    }
    
    const removeDate = tire.installations[0].remove_date;
    
    if (!removeDate) {
      return 'Tanggal tidak tersedia';
    }
    
    const date = new Date(removeDate);
    
    if (isNaN(date.getTime())) {
      return 'Tanggal tidak valid';
    }
    
    if (date.getFullYear() === 1970) {
      return 'Tanggal tidak tersedia';
    }
    
    return date.toLocaleDateString('id-ID');
  };

  // ✅ ADD MILEAGE CALCULATION FUNCTION
  const calculateTireUsageKm = (tire: RemovedTire): string => {
    if (!tire.installations || tire.installations.length === 0) {
      return 'Data tidak tersedia';
    }

    const installation = tire.installations[0];
    
    // ✅ Simple solution: Just show mileage_installed when available
    if (installation.mileage_installed !== undefined && installation.mileage_installed !== null) {
      return `${installation.mileage_installed.toLocaleString('id-ID')} km`;
    }
    
    return 'Data tidak tersedia';
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'new':
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-orange-100 text-orange-800';
      case 'replace':
      case 'kampasa':
        return 'bg-purple-100 text-purple-800';
      case 'damaged':
      case 'meledak':
      case 'bocor':
        return 'bg-red-100 text-red-800';
      case 'disposed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionDisplay = (condition: string): string => {
    return conditionMapping[condition] || condition;
  };

  // ✅ UPDATE TO USE FILTERED TIRES
  const getConditionCount = (conditions: string[]) => {
    return filteredTires.filter(t => conditions.includes(t.condition)).length;
  };

  if (loading) return <div className="text-center p-8">Loading removed tires...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Ban Bekas (Sudah Dilepas)</h1>
        <Link to="/vehicles/tires">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            ← Kembali ke Manajemen Ban
          </button>
        </Link>
      </div>

      {/* ✅ ADD SEARCH AND FILTER SECTION */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Filter & Pencarian</h2>
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Hapus Semua Filter
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Search Term */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pencarian
            </label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder="Serial, catatan, plat nomor..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Condition Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kondisi
            </label>
            <select
              value={filters.conditionFilter}
              onChange={(e) => handleFilterChange('conditionFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Kondisi</option>
              {filterOptions.conditions.map(condition => (
                <option key={condition} value={condition}>
                  {getConditionDisplay(condition)}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merek
            </label>
            <select
              value={filters.brandFilter}
              onChange={(e) => handleFilterChange('brandFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Merek</option>
              {filterOptions.brands.map(brand => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          {/* Size Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ukuran
            </label>
            <select
              value={filters.sizeFilter}
              onChange={(e) => handleFilterChange('sizeFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Ukuran</option>
              {filterOptions.sizes.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Pemasangan
            </label>
            <select
              value={filters.statusFilter}
              onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Status</option>
              <option value="available">Tersedia untuk Dipasang</option>
              <option value="not_available">Tidak Dapat Dipasang</option>
            </select>
          </div>

          {/* Vehicle Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kendaraan
            </label>
            <select
              value={filters.vehicleFilter}
              onChange={(e) => handleFilterChange('vehicleFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Kendaraan</option>
              {filterOptions.vehicles.map(vehicle => (
                <option key={vehicle} value={vehicle}>
                  {vehicle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ✅ ADD RESULT COUNT */}
        <div className="mt-4 text-sm text-gray-600">
          Menampilkan {filteredTires.length} dari {removedTires.length} ban bekas
        </div>
      </div>

      {/* ✅ UPDATED STATISTICS - Using filtered tires */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
        <div className="bg-white p-3 rounded-lg shadow text-center">
          <h3 className="text-xs font-medium text-gray-500">Total</h3>
          <p className="text-xl font-bold text-blue-600">{filteredTires.length}</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg shadow border border-green-200 text-center">
          <h3 className="text-xs font-medium text-green-600">Baru</h3>
          <p className="text-xl font-bold text-green-700">{getConditionCount(['new'])}</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg shadow border border-green-200 text-center">
          <h3 className="text-xs font-medium text-green-600">Baik</h3>
          <p className="text-xl font-bold text-green-700">{getConditionCount(['good'])}</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg shadow border border-yellow-200 text-center">
          <h3 className="text-xs font-medium text-yellow-600">Cukup</h3>
          <p className="text-xl font-bold text-yellow-700">{getConditionCount(['fair'])}</p>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg shadow border border-orange-200 text-center">
          <h3 className="text-xs font-medium text-orange-600">Buruk</h3>
          <p className="text-xl font-bold text-orange-700">{getConditionCount(['poor'])}</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg shadow border border-purple-200 text-center">
          <h3 className="text-xs font-medium text-purple-600">Perlu Ganti</h3>
          <p className="text-xl font-bold text-purple-700">{getConditionCount(['replace'])}</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg shadow border border-purple-200 text-center">
          <h3 className="text-xs font-medium text-purple-600">Kampasa</h3>
          <p className="text-xl font-bold text-purple-700">{getConditionCount(['kampasa'])}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg shadow border border-red-200 text-center">
          <h3 className="text-xs font-medium text-red-600">Rusak</h3>
          <p className="text-xl font-bold text-red-700">{getConditionCount(['damaged'])}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg shadow border border-red-200 text-center">
          <h3 className="text-xs font-medium text-red-600">Meledak</h3>
          <p className="text-xl font-bold text-red-700">{getConditionCount(['meledak'])}</p>
        </div>
        <div className="bg-red-50 p-3 rounded-lg shadow border border-red-200 text-center">
          <h3 className="text-xs font-medium text-red-600">Bocor</h3>
          <p className="text-xl font-bold text-red-700">{getConditionCount(['bocor'])}</p>
        </div>
      </div>

      {/* ✅ UPDATE TABLE TO USE FILTERED TIRES AND ADD MILEAGE COLUMN */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
         <thead>
          <tr>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Serial Number</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Brand & Size</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kondisi</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tapak (mm)</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kilometer</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Catatan</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Terakhir di Kendaraan</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Aksi</th>
          </tr>
        </thead>
          <tbody>
            {filteredTires.length > 0 ? (
              filteredTires.map((tire) => (
                <tr key={tire.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-mono">{tire.tire_serial_number}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">
                      {tire.tireInventory.tire_brand} {tire.tireInventory.tire_size}
                    </p>
                    <p className="text-gray-600 text-xs">{tire.tireInventory.tire_type}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConditionColor(tire.condition)}`}>
                      {getConditionDisplay(tire.condition)}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.current_tread_depth}</p>
                  </td>
                  {/* ✅ ADD MILEAGE COLUMN */}
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap text-xs">
                      {calculateTireUsageKm(tire)}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div className="max-w-xs">
                      {tire.notes ? (
                        <div className="text-gray-700 text-xs leading-relaxed">
                          <div className="notes-preview">
                            {tire.notes.length > 100 ? 
                              `${tire.notes.substring(0, 100)}...` : 
                              tire.notes
                            }
                          </div>
                          {tire.notes.length > 100 && (
                            <button 
                              className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                              onClick={() => {
                                alert(tire.notes);
                              }}
                            >
                              Lihat Selengkapnya
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Tidak ada catatan</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {tire.installations.length > 0 && (
                      <div>
                        <p className="text-gray-900 whitespace-no-wrap">
                          {tire.installations[0].vehicle.license_plate}
                        </p>
                        <p className="text-gray-600 text-xs">
                          Dilepas: {formatRemoveDate(tire)}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      ['new', 'good', 'fair'].includes(tire.condition) 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {['new', 'good', 'fair'].includes(tire.condition) 
                        ? 'Tersedia untuk Dipasang' 
                        : 'Tidak Dapat Dipasang'}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <button
                      onClick={() => handleEditClick(tire)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-500">
                  {removedTires.length === 0 ? 'Belum ada ban bekas yang tersedia' : 'Tidak ada ban yang sesuai dengan filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal - Same as before */}
      {editModalOpen && selectedTire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              Edit Ban S/N: {selectedTire.tire_serial_number}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kondisi Ban
                </label>
                <select
                  value={editData.condition}
                  onChange={(e) => setEditData(prev => ({ ...prev, condition: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">Baru</option>
                  <option value="good">Baik</option>
                  <option value="fair">Cukup</option>
                  <option value="poor">Buruk</option>
                  <option value="replace">Perlu Ganti</option>
                  <option value="damaged">Rusak</option>
                  <option value="meledak">Meledak</option>
                  <option value="bocor">Bocor</option>
                  <option value="kampasa">Kampasa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catatan
                </label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tambahkan catatan..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemovedTiresPage;
