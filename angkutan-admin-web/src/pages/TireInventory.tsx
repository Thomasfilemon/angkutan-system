// src/pages/TireInventory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireInstance {
  id: number;
  tire_serial_number: string;
  status: string;
  condition: string;
  purchase_date: string;
  purchase_price: string;
  current_tread_depth: number;
  notes?: string;
  tireInventory: {
    tire_brand: string;
    tire_size: string;
    tire_type: string;
  };
  installations?: {
    vehicle: {
      license_plate: string;
    };
  }[];
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
  typeFilter: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

const TireInventoryPage = () => {
  const [tires, setTires] = useState<TireInstance[]>([]);
  const [filteredTires, setFilteredTires] = useState<TireInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTire, setSelectedTire] = useState<TireInstance | null>(null);
  const [editData, setEditData] = useState<EditModalData>({
    condition: '',
    notes: ''
  });
  const [vehicles, setVehicles] = useState<{ id: number; license_plate: string }[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
  });
  const [globalStats, setGlobalStats] = useState<{ totalValue: number; countsByCondition: Record<string, number> }>({ totalValue: 0, countsByCondition: {} });

  // ✅ ADD SEARCH FILTERS STATE
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    conditionFilter: '',
    brandFilter: '',
    sizeFilter: '',
    typeFilter: ''
  });

  // ✅ ADD FILTER OPTIONS
  const [filterOptions, setFilterOptions] = useState({
    conditions: [] as string[],
    brands: [] as string[],
    sizes: [] as string[],
    types: [] as string[]
  });

  const fetchVehicles = async () => {
    try {
      const response = await apiClient.get('/tires/vehicles');
      const vehiclesData = response.data?.data || response.data;
      if (Array.isArray(vehiclesData)) {
        setVehicles(vehiclesData.map((v: any) => ({ id: v.id, license_plate: v.license_plate })));
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  };

  // Condition mapping
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

  const getStatusDisplay = (tire: TireInstance) => {
    let text = '';
    let subtext = '';
    let colorClass = 'bg-gray-100 text-gray-800';
  
    switch (tire.status) {
      case 'installed':
        text = 'Terpasang';
        colorClass = 'bg-blue-100 text-blue-800';
        if (tire.installations && tire.installations.length > 0) {
          subtext = tire.installations[0].vehicle.license_plate;
        }
        break;
      case 'in_stock':
        text = 'Di Stok';
        colorClass = 'bg-green-100 text-green-800';
        break;
      case 'removed':
        text = 'Stok (Bekas)';
        colorClass = 'bg-yellow-100 text-yellow-800';
        break;
      default:
        text = tire.status;
    }
  
    return (
      <div>
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
          {text}
        </span>
        {subtext && <div className="text-xs text-gray-600 mt-1">{subtext}</div>}
      </div>
    );
  };

  useEffect(() => {
    fetchAvailableTires(1);
    // Fetch vehicles only once
    if (vehicles.length === 0) {
      fetchVehicles();
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    // This effect handles initial load and dependencies that don't include selectedVehicleId
    const initialFetch = async () => {
      await fetchAvailableTires();
      await fetchVehicles();
    };
    initialFetch();
  }, []);

  // ✅ ADD FILTER EFFECT
  useEffect(() => {
    applyFilters();
  }, [tires, filters]);

  const fetchAvailableTires = async (page = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
  
      if (selectedVehicleId) {
        params.append('vehicleId', selectedVehicleId);
      }

      const response = await apiClient.get('/tires/inventory-instances', { params });
      
      const responseData = response.data;

      setTires(responseData.data || []);
      setPagination({
        currentPage: responseData.meta.page,
        totalPages: responseData.meta.totalPages,
        totalItems: responseData.meta.total,
        limit: responseData.meta.limit,
      });
      if (responseData.meta?.stats) {
        setGlobalStats({
          totalValue: Number(responseData.meta.stats.totalValue || 0),
          countsByCondition: responseData.meta.stats.countsByCondition || {},
        });
      }
      
      // ✅ EXTRACT FILTER OPTIONS
      if (page === 1 && !selectedVehicleId) { 
        extractFilterOptions(responseData.data || []);
      }

    } catch (err) {
      setError('Failed to fetch available tire instances');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADD FILTER OPTIONS EXTRACTION
  const extractFilterOptions = (tiresArray: TireInstance[]) => {
    const conditions = Array.from(new Set(tiresArray.map(tire => tire.condition)));
    const brands = Array.from(new Set(tiresArray.map(tire => tire.tireInventory.tire_brand)));
    const sizes = Array.from(new Set(tiresArray.map(tire => tire.tireInventory.tire_size)));
    const types = Array.from(new Set(tiresArray.map(tire => tire.tireInventory.tire_type)));

    setFilterOptions({
      conditions: conditions.sort(),
      brands: brands.sort(),
      sizes: sizes.sort(),
      types: types.filter(type => type).sort()
    });
  };

  // ✅ ADD FILTER LOGIC
  const applyFilters = () => {
    let filtered = [...tires];

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(tire => 
        tire.tire_serial_number.toLowerCase().includes(searchLower) ||
        tire.tireInventory.tire_brand.toLowerCase().includes(searchLower) ||
        tire.tireInventory.tire_size.toLowerCase().includes(searchLower) ||
        tire.notes?.toLowerCase().includes(searchLower)
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

    // Type filter
    if (filters.typeFilter) {
      filtered = filtered.filter(tire => tire.tireInventory.tire_type === filters.typeFilter);
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
      typeFilter: ''
    });
  };

  // ✅ ADD EDIT FUNCTIONS
  const handleEditClick = (tire: TireInstance) => {
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
      await fetchAvailableTires(); // Refresh the list
    } catch (error) {
      console.error('Failed to update tire:', error);
      alert('Gagal memperbarui data ban.');
    }
  };

  // ✅ ADD DELETE FUNCTION
  const handleDeleteClick = async (tire: TireInstance) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus ban dengan serial number ${tire.tire_serial_number}?`)) {
      try {
        await apiClient.delete(`/tires/tire-instances/${tire.id}`);
        await fetchAvailableTires(); // Refresh the list
      } catch (error) {
        console.error('Failed to delete tire:', error);
        alert('Gagal menghapus ban.');
      }
    }
  };

  const getConditionDisplay = (condition: string): string => {
    return conditionMapping[condition] || condition;
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

  // Use global stats from backend (not per-page)
  const getConditionCount = (conditions: string[]) => {
    return conditions.reduce((sum, c) => sum + (globalStats.countsByCondition[c] || 0), 0);
  };

  const totalValue = globalStats.totalValue || 0;

  if (loading) return <div className="text-center p-8">Loading individual tires...</div>;
  if (error) return <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Inventaris Ban (Individual)</h1>
        <Link to="/tire-inventory/create">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Tambah Stok Ban
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Vehicle Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter Kendaraan
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Kendaraan</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate}
                </option>
              ))}
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pencarian
            </label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder="Serial, brand, ukuran, catatan..."
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

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipe
            </label>
            <select
              value={filters.typeFilter}
              onChange={(e) => handleFilterChange('typeFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Semua Tipe</option>
              {filterOptions.types.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ✅ ADD RESULT COUNT */}
        <div className="mt-4 text-sm text-gray-600">
          Menampilkan {filteredTires.length} dari {tires.length} ban
        </div>
      </div>

      {/* ✅ UPDATED STATISTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Ban</h3>
          <p className="text-2xl font-bold text-blue-600">{pagination.totalItems}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Nilai Inventaris</h3>
          <p className="text-lg font-bold text-purple-600">
            Rp {totalValue.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
          <h3 className="text-sm font-medium text-green-600">Baru</h3>
          <p className="text-2xl font-bold text-green-700">{getConditionCount(['new'])}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
          <h3 className="text-sm font-medium text-green-600">Baik</h3>
          <p className="text-2xl font-bold text-green-700">{getConditionCount(['good'])}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow border border-yellow-200">
          <h3 className="text-sm font-medium text-yellow-600">Cukup</h3>
          <p className="text-2xl font-bold text-yellow-700">{getConditionCount(['fair'])}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg shadow border border-orange-200">
          <h3 className="text-sm font-medium text-orange-600">Buruk</h3>
          <p className="text-2xl font-bold text-orange-700">{getConditionCount(['poor'])}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg shadow border border-purple-200">
          <h3 className="text-sm font-medium text-purple-600">Perlu Ganti</h3>
          <p className="text-2xl font-bold text-purple-700">{getConditionCount(['replace'])}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow border border-red-200">
          <h3 className="text-sm font-medium text-red-600">Rusak</h3>
          <p className="text-2xl font-bold text-red-700">{getConditionCount(['damaged', 'meledak', 'bocor'])}</p>
        </div>
      </div>

      {/* ✅ UPDATED TABLE */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Serial Number</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Brand & Size</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Kondisi</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tapak (mm)</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Catatan</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Tgl Beli</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Harga</th>
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
                    {getStatusDisplay(tire)}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConditionColor(tire.condition)}`}>
                      {getConditionDisplay(tire.condition)}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{tire.current_tread_depth}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div className="max-w-xs">
                      {tire.notes ? (
                        <div className="text-gray-700 text-xs leading-relaxed">
                          {tire.notes.length > 50 ? `${tire.notes.substring(0, 50)}...` : tire.notes}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Tidak ada catatan</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {new Date(tire.purchase_date).toLocaleDateString('id-ID')}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      Rp {parseFloat(tire.purchase_price).toLocaleString('id-ID')}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditClick(tire)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tire)}
                        className={`text-xs font-medium ${
                          tire.status === 'installed' 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-red-600 hover:text-red-800'
                        }`}
                        disabled={tire.status === 'installed'}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-500">
                  {tires.length === 0 ? 'Tidak ada ban yang tersedia di stok.' : 'Tidak ada ban yang sesuai dengan filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        <div className="px-5 py-5 bg-white border-t flex flex-col xs:flex-row items-center xs:justify-between">
          <span className="text-xs xs:text-sm text-gray-900">
            Menampilkan {Math.min((pagination.currentPage - 1) * pagination.limit + 1, pagination.totalItems)} sampai {Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)} dari {pagination.totalItems} Ban
          </span>
          <div className="inline-flex mt-2 xs:mt-0">
            <button
              onClick={() => fetchAvailableTires(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-l disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => fetchAvailableTires(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="text-sm bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-r disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* ✅ ADD EDIT MODAL */}
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

export default TireInventoryPage;
