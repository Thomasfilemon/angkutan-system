// src/pages/VehicleTireDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface TireData {
  id: number;
  current_pressure: number;
  recommended_pressure: number;
  temperature: number;
  tread_depth: number;
  condition: string;
  brand: string;
  size: string;
  install_date: string;
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

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  tire_count: number;
  spare_tire_count: number;
}

interface TireUpdateData {
  current_pressure: number;
  temperature: number;
  tread_depth: number;
  condition: string;
  notes: string;
}

const VehicleTireDetailPage = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [tireStatuses, setTireStatuses] = useState<TireStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedTire, setSelectedTire] = useState<TireData | null>(null);
  const [updateData, setUpdateData] = useState<TireUpdateData>({
    current_pressure: 0,
    temperature: 0,
    tread_depth: 0,
    condition: 'good',
    notes: ''
  });

  useEffect(() => {
    if (vehicleId) {
      fetchVehicleTireStatus();
    }
  }, [vehicleId]);

  // src/pages/VehicleTireDetail.tsx
const fetchVehicleTireStatus = async () => {
  try {
    setLoading(true);
    const response = await apiClient.get(`/tires/vehicles/${vehicleId}/status`);
    
    // Add safe checks before accessing nested properties
    if (response.data && response.data.data) {
      setVehicle(response.data.data.vehicle || null);
      setTireStatuses(response.data.data.tires || []);
    } else if (response.data) {
      // Handle case where response.data doesn't have nested data property
      setVehicle(response.data.vehicle || null);
      setTireStatuses(response.data.tires || []);
    } else {
      console.error('Unexpected response structure:', response);
      setVehicle(null);
      setTireStatuses([]);
    }
  } catch (error) {
    console.error('Failed to fetch tire status:', error);
    setVehicle(null);
    setTireStatuses([]);
  } finally {
    setLoading(false);
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

  const handleUpdateTire = async () => {
    if (!selectedTire) return;

    try {
      await apiClient.put(`/tires/tires/${selectedTire.id}`, updateData);
      setUpdateModalOpen(false);
      fetchVehicleTireStatus(); // Refresh data
    } catch (error) {
      console.error('Failed to update tire:', error);
      alert('Failed to update tire data');
    }
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
    const isSpare = position.startsWith('SPARE');
    
    return (
      <div
        key={position}
        className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
          installed ? 'border-gray-400 hover:border-blue-500' : 'border-dashed border-gray-300'
        }`}
        onClick={() => {
          if (tire) {
            handleTireClick(tire);
          }
        }}
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
              <div className="text-gray-600">
                {tire.current_pressure}/{tire.recommended_pressure} PSI
              </div>
              <div className="text-gray-600">
                {tire.temperature}°C | {tire.tread_depth}mm
              </div>
              <div className={`mt-1 px-2 py-1 rounded text-xs ${
                tire.needsReplacement ? 'bg-red-100 text-red-800' :
                tire.isPressureLow || tire.isPressureHigh || tire.isTemperatureHigh ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {getTireStatusText(tire)}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-500 text-center">
              Tidak Terpasang
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVehicleLayout = () => {
    if (!vehicle || tireStatuses.length === 0) return null;

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
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Status Ban - {vehicle.license_plate} ({vehicle.type})
          </h3>
          <Link to="/vehicles/tires" className="text-blue-600 hover:text-blue-800">
            ← Kembali ke Daftar
          </Link>
        </div>
        
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">Memuat data ban...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Detail Ban Kendaraan</h1>
      </div>

      {renderVehicleLayout()}

      {/* Legend */}
      {vehicle && (
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

      {/* Update Modal */}
      {updateModalOpen && selectedTire && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Update Ban {selectedTire.brand} {selectedTire.size}
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

export default VehicleTireDetailPage;
