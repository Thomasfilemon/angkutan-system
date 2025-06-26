// src/pages/TireManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/axiosConfig';

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  tire_count: number;
  spare_tire_count: number;
}

interface TireData {
  id: number;
  instance_id?: number;
  serial_number?: string;
  current_pressure: number;
  recommended_pressure: number;
  temperature: number;
  tread_depth: number;
  condition: string;
  brand: string;
  size: string;
  install_date: string;
  total_mileage?: number;
  isPressureLow: boolean;
  isPressureHigh: boolean;
  isTemperatureHigh: boolean;
  needsReplacement: boolean;
}

interface TireStatus {
  position: string;
  installed: boolean;
  tire: TireData | null;
}

interface TireUpdateData {
  current_pressure: number;
  temperature: number;
  tread_depth: number;
  condition: string;
  notes: string;
}

interface TireInventory {
  id: number;
  tire_brand: string;
  tire_size: string;
  tire_type: string;
  current_stock: number;
  unit_price: number;
}

interface TireInstance {
  id: number;
  tire_serial_number: string;
  tire_inventory_id: number;
  condition: string;
  status: string;
  current_tread_depth: number;
  total_mileage: number;
  tireInventory: {
    tire_brand: string;
    tire_size: string;
    tire_type: string;
  };
}

interface InstallData {
  tire_inventory_id: number | null;
  tire_instance_id: number | null;
  position: string;
  recommended_pressure: number;
  mileage_installed: number;
  custom_brand?: string;
  custom_size?: string;
}

const TireManagementPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [tireStatuses, setTireStatuses] = useState<TireStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update Modal States
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedTire, setSelectedTire] = useState<TireData | null>(null);
  const [updateData, setUpdateData] = useState<TireUpdateData>({
    current_pressure: 0,
    temperature: 0,
    tread_depth: 0,
    condition: 'good',
    notes: ''
  });

  // Install Modal States
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [availableTires, setAvailableTires] = useState<TireInventory[]>([]);
  const [availableInstances, setAvailableInstances] = useState<TireInstance[]>([]);
  const [installData, setInstallData] = useState<InstallData>({
    tire_inventory_id: null,
    tire_instance_id: null,
    position: '',
    recommended_pressure: 35,
    mileage_installed: 0,
    custom_brand: '',
    custom_size: ''
  });
  const [useCustomTire, setUseCustomTire] = useState(false);
  const [useSpecificInstance, setUseSpecificInstance] = useState(false);

  // Confirmation Modal States
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/tires/vehicles');
      
      const vehiclesData = response.data?.data || response.data || [];
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      setError('Failed to load vehicles. Please try again.');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVehicleTireStatus = useCallback(async (vehicleId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/tires/vehicles/${vehicleId}/status`);
      
      const responseData = response.data?.data || response.data || {};
      setSelectedVehicle(responseData.vehicle || null);
      setTireStatuses(Array.isArray(responseData.tires) ? responseData.tires : []);
    } catch (error) {
      console.error('Failed to fetch tire status:', error);
      setError('Failed to load tire status. Please try again.');
      setSelectedVehicle(null);
      setTireStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableTires = useCallback(async () => {
    try {
      const response = await apiClient.get('/tires/tire-inventory');
      setAvailableTires(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch tire inventory:', error);
      setAvailableTires([]);
    }
  }, []);

  const fetchAvailableInstances = useCallback(async (tireInventoryId?: number) => {
    try {
      const url = tireInventoryId 
        ? `/tires/tire-instances/available?tire_inventory_id=${tireInventoryId}`
        : '/tires/tire-instances/available';
      const response = await apiClient.get(url);
      setAvailableInstances(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch tire instances:', error);
      setAvailableInstances([]);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = parseInt(e.target.value);
    if (vehicleId) {
      fetchVehicleTireStatus(vehicleId);
    } else {
      setSelectedVehicle(null);
      setTireStatuses([]);
      setError(null);
    }
  };

  const handleTireClick = (tire: TireData) => {
    setSelectedTire(tire);
    setUpdateData({
      current_pressure: tire.current_pressure,
      temperature: tire.temperature,
      tread_depth: tire.tread_depth,
      condition: tire.condition,
      notes: ''
    });
    setUpdateModalOpen(true);
  };

  const handleInstallClick = (position: string) => {
    setSelectedPosition(position);
    setInstallData({
      tire_inventory_id: null,
      tire_instance_id: null,
      position: position,
      recommended_pressure: 35,
      mileage_installed: 0,
      custom_brand: '',
      custom_size: ''
    });
    setUseCustomTire(false);
    setUseSpecificInstance(false);
    fetchAvailableTires();
    fetchAvailableInstances();
    setInstallModalOpen(true);
  };

  const handleUpdateTire = async () => {
    if (!selectedTire) return;

    try {
      await apiClient.put(`/tires/tires/${selectedTire.id}`, updateData);
      setUpdateModalOpen(false);
      if (selectedVehicle) {
        fetchVehicleTireStatus(selectedVehicle.id);
      }
    } catch (error) {
      console.error('Failed to update tire:', error);
      alert('Failed to update tire data');
    }
  };

  const handleInstallTire = async () => {
    if (!selectedVehicle) return;

    try {
      let endpoint = `/tires/vehicles/${selectedVehicle.id}/install`;
      let payload: any = {
        position: installData.position,
        recommended_pressure: installData.recommended_pressure,
        mileage_installed: installData.mileage_installed
      };

      if (useSpecificInstance && installData.tire_instance_id) {
        // Install specific tire instance
        endpoint = `/tires/vehicles/${selectedVehicle.id}/install-instance`;
        payload.tire_instance_id = installData.tire_instance_id;
      } else if (!useCustomTire && installData.tire_inventory_id) {
        // Install from inventory (creates new instance)
        payload.tire_inventory_id = installData.tire_inventory_id;
      } else if (useCustomTire) {
        // Install custom tire (no inventory tracking)
        payload.tire_inventory_id = null;
      }

      await apiClient.post(endpoint, payload);
      setInstallModalOpen(false);
      fetchVehicleTireStatus(selectedVehicle.id);
    } catch (error) {
      console.error('Failed to install tire:', error);
      alert('Failed to install tire');
    }
  };

  const handleRemoveTire = (tire: TireData) => {
  setConfirmMessage('Are you sure you want to remove this tire? It will be available for reinstallation.');
  setConfirmAction(() => async () => {
    try {
      await apiClient.delete(`/tires/tires/${tire.id}`, {
        data: { 
          reason: 'Manual removal via tire management', 
          notes: 'Removed for maintenance or rotation' 
        }
      });
      
      if (selectedVehicle) {
        fetchVehicleTireStatus(selectedVehicle.id);
      }
    } catch (error) {
      console.error('Failed to remove tire:', error);
      alert('Failed to remove tire');
    }
  });
  setConfirmModalOpen(true);
};

  const getTireStatusColor = (tire: TireData | null) => {
    if (!tire) return 'bg-gray-200';
    if (tire.needsReplacement) return 'bg-red-500';
    if (tire.isPressureLow || tire.isPressureHigh || tire.isTemperatureHigh) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTireStatusText = (tire: TireData | null) => {
    if (!tire) return 'Tidak Terpasang';
    if (tire.needsReplacement) return 'Perlu Ganti';
    if (tire.isPressureLow) return 'Tekanan Rendah';
    if (tire.isPressureHigh) return 'Tekanan Tinggi';
    if (tire.isTemperatureHigh) return 'Suhu Tinggi';
    return 'Baik';
  };

  const renderTirePosition = (tireStatus: TireStatus) => {
    const { position, installed, tire } = tireStatus;
    
    return (
      <div
        key={position}
        className={`relative p-4 border-2 rounded-lg transition-all ${
          installed ? 'border-gray-400' : 'border-dashed border-gray-300'
        }`}
      >
        <div className="flex flex-col items-center">
          <div
            className={`w-16 h-20 rounded-lg flex items-center justify-center text-white font-bold ${getTireStatusColor(tire)}`}
          >
            🛞
          </div>
          
          <div className="mt-2 text-sm font-semibold text-gray-700">
            {position}
          </div>
          
          {installed && tire ? (
            <div className="mt-2 text-xs text-center">
              <div className="font-medium">{tire.brand} {tire.size}</div>
              {tire.serial_number && (
                <div className="text-gray-500 text-xs">S/N: {tire.serial_number}</div>
              )}
              <div className="text-gray-600">
                {tire.current_pressure}/{tire.recommended_pressure} PSI
              </div>
              <div className="text-gray-600">
                {tire.temperature}°C | {tire.tread_depth}mm
              </div>
              {tire.total_mileage !== undefined && (
                <div className="text-gray-600">
                  {tire.total_mileage.toLocaleString()} km
                </div>
              )}
              <div className={`mt-1 px-2 py-1 rounded text-xs ${
                tire.needsReplacement ? 'bg-red-100 text-red-800' :
                tire.isPressureLow || tire.isPressureHigh || tire.isTemperatureHigh ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {getTireStatusText(tire)}
              </div>
              
              {/* Action Buttons */}
              <div className="mt-2 flex space-x-1">
                <button
                  onClick={() => handleTireClick(tire)}
                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Update
                </button>
                <button
                  onClick={() => handleRemoveTire(tire)}
                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-center">
              <div className="text-gray-500 mb-2">Tidak Terpasang</div>
              <button
                onClick={() => handleInstallClick(position)}
                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                Pasang Ban
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVehicleLayout = () => {
    if (!selectedVehicle || !Array.isArray(tireStatuses) || tireStatuses.length === 0) return null;

    const frontTires = tireStatuses.filter(t => t.position.startsWith('F'));
    const rearTires = tireStatuses.filter(t => t.position.startsWith('R') && !t.position.startsWith('SPARE'));
    const spareTires = tireStatuses.filter(t => t.position.startsWith('SPARE'));

    const rearAxles: { [key: string]: TireStatus[] } = {};
    rearTires.forEach(tire => {
      const axleNum = tire.position.match(/\d+/)?.[0] || '1';
      if (!rearAxles[axleNum]) rearAxles[axleNum] = [];
      rearAxles[axleNum].push(tire);
    });

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">
          Status Ban - {selectedVehicle.license_plate} ({selectedVehicle.type})
        </h3>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Depan</h4>
            <div className="flex justify-center space-x-4">
              {frontTires.map(renderTirePosition)}
            </div>
          </div>

          {Object.entries(rearAxles).map(([axleNum, axleTires]) => (
            <div key={axleNum}>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Belakang {axleNum}
              </h4>
              <div className="flex justify-center space-x-4">
                {axleTires.map(renderTirePosition)}
              </div>
            </div>
          ))}

          {spareTires.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Serep</h4>
              <div className="flex justify-center space-x-4">
                {spareTires.map(renderTirePosition)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Manajemen Ban</h1>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Vehicle Selection */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pilih Kendaraan:
        </label>
        <select
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={handleVehicleChange}
          defaultValue=""
        >
          <option value="">-- Pilih Kendaraan --</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.license_plate} ({vehicle.type})
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Memuat data ban...</p>
        </div>
      )}

      {/* Vehicle Tire Layout */}
      {renderVehicleLayout()}

      {/* Legend */}
      {selectedVehicle && (
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Keterangan:</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span>Baik</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
              <span>Perlu Perhatian</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
              <span>Perlu Ganti</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-200 rounded mr-2"></div>
              <span>Tidak Terpasang</span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Konfirmasi</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmMessage}</p>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (confirmAction) {
                      confirmAction();
                    }
                    setConfirmModalOpen(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install Modal */}
      {installModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Pasang Ban di Posisi {selectedPosition}
              </h3>
              
              {/* Tire Source Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sumber Ban:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!useCustomTire && !useSpecificInstance}
                      onChange={() => {
                        setUseCustomTire(false);
                        setUseSpecificInstance(false);
                      }}
                      className="mr-2"
                    />
                    Dari Inventaris (Ban Baru)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={useSpecificInstance}
                      onChange={() => {
                        setUseCustomTire(false);
                        setUseSpecificInstance(true);
                      }}
                      className="mr-2"
                    />
                    Ban Bekas (Sudah Dilepas)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={useCustomTire}
                      onChange={() => {
                        setUseCustomTire(true);
                        setUseSpecificInstance(false);
                      }}
                      className="mr-2"
                    />
                    Ban Eksternal
                  </label>
                </div>
              </div>

              {/* Tire Selection from Inventory */}
              {!useCustomTire && !useSpecificInstance && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Ban dari Inventaris:
                  </label>
                  <div className="max-h-40 overflow-y-auto border rounded p-2">
                    {availableTires.length > 0 ? (
                      availableTires.map((tire) => (
                        <div
                          key={tire.id}
                          className={`p-2 border rounded mb-2 cursor-pointer ${
                            installData.tire_inventory_id === tire.id
                              ? 'bg-blue-100 border-blue-500'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() =>
                            setInstallData(prev => ({ ...prev, tire_inventory_id: tire.id }))
                          }
                        >
                          <div className="font-medium">
                            {tire.tire_brand} {tire.tire_size}
                          </div>
                          <div className="text-sm text-gray-600">
                            Stock: {tire.current_stock} | Rp {tire.unit_price?.toLocaleString('id-ID')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        Tidak ada ban tersedia di inventaris
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Specific Tire Instance Selection */}
              {useSpecificInstance && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Ban Bekas:
                  </label>
                  <div className="max-h-40 overflow-y-auto border rounded p-2">
                    {availableInstances.length > 0 ? (
                      availableInstances.map((instance) => (
                        <div
                          key={instance.id}
                          className={`p-2 border rounded mb-2 cursor-pointer ${
                            installData.tire_instance_id === instance.id
                              ? 'bg-blue-100 border-blue-500'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() =>
                            setInstallData(prev => ({ ...prev, tire_instance_id: instance.id }))
                          }
                        >
                          <div className="font-medium">
                            {instance.tireInventory.tire_brand} {instance.tireInventory.tire_size}
                          </div>
                          <div className="text-sm text-gray-600">
                            S/N: {instance.tire_serial_number} | 
                            Kondisi: {instance.condition} | 
                            {instance.total_mileage.toLocaleString()} km
                          </div>
                          <div className="text-xs text-gray-500">
                            Tapak: {instance.current_tread_depth}mm | Status: {instance.status}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        Tidak ada ban bekas tersedia
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Tire Information */}
              {useCustomTire && (
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Brand Ban</label>
                    <input
                      type="text"
                      value={installData.custom_brand}
                      onChange={(e) =>
                        setInstallData(prev => ({ ...prev, custom_brand: e.target.value }))
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Masukkan brand ban"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ukuran Ban</label>
                    <input
                      type="text"
                      value={installData.custom_size}
                      onChange={(e) =>
                        setInstallData(prev => ({ ...prev, custom_size: e.target.value }))
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Contoh: 1000 R20"
                    />
                  </div>
                </div>
              )}

              {/* Installation Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tekanan Rekomendasi (PSI)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={installData.recommended_pressure}
                    onChange={(e) =>
                      setInstallData(prev => ({ ...prev, recommended_pressure: parseFloat(e.target.value) }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Kilometer Saat Pasang
                  </label>
                  <input
                    type="number"
                    value={installData.mileage_installed}
                    onChange={(e) =>
                      setInstallData(prev => ({ ...prev, mileage_installed: parseInt(e.target.value) }))
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setInstallModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Batal
                </button>
                <button
                  onClick={handleInstallTire}
                  disabled={
                    (!useCustomTire && !useSpecificInstance && !installData.tire_inventory_id) ||
                    (useSpecificInstance && !installData.tire_instance_id)
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
                >
                  Pasang Ban
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {updateModalOpen && selectedTire && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Update Ban {selectedTire.brand} {selectedTire.size}
                {selectedTire.serial_number && (
                  <div className="text-sm text-gray-500">S/N: {selectedTire.serial_number}</div>
                )}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tekanan (PSI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={updateData.current_pressure}
                    onChange={(e) => setUpdateData(prev => ({...prev, current_pressure: parseFloat(e.target.value)}))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Suhu (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={updateData.temperature}
                    onChange={(e) => setUpdateData(prev => ({...prev, temperature: parseFloat(e.target.value)}))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kedalaman Tapak (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={updateData.tread_depth}
                    onChange={(e) => setUpdateData(prev => ({...prev, tread_depth: parseFloat(e.target.value)}))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kondisi</label>
                  <select
                    value={updateData.condition}
                    onChange={(e) => setUpdateData(prev => ({...prev, condition: e.target.value}))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="good">Baik</option>
                    <option value="fair">Cukup</option>
                    <option value="poor">Buruk</option>
                    <option value="replace">Perlu Ganti</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Catatan</label>
                  <textarea
                    value={updateData.notes}
                    onChange={(e) => setUpdateData(prev => ({...prev, notes: e.target.value}))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setUpdateModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Batal
                </button>
                <button
                  onClick={handleUpdateTire}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TireManagementPage;
