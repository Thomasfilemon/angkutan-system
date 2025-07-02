import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

// --- KONFIGURASI API CLIENT (SESUAI FILE ANDA) ---
const BASE_API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const WEB_API_URL = BASE_API_URL.endsWith("/web") ? BASE_API_URL : `${BASE_API_URL}/web`;
const apiClient = axios.create({
  baseURL: WEB_API_URL,
  timeout: 10000,
  headers: { "ngrok-skip-browser-warning": "true", "Content-Type": "application/json" },
});
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);
apiClient.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success && response.data.data !== undefined) {
      return { ...response, data: response.data.data };
    }
    if (response.data && response.data.vehicleTires) {
        return { ...response, data: response.data };
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);


// --- INTERFACE DATA ---
interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  updatedAt: string;
  current_mileage?: number;
}
interface TireData {
  vehicle_tire_id: number;
  install_date: string;
  updated_at: string;
  current_pressure: number;
  recommended_pressure: number;
  temperature: number;
  tread_depth: number;
  condition: string;
  serial_number: string;
  brand: string;
  size: string;
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
  current_stock: number;
}
interface TireInstance {
  id: number;
  tire_serial_number: string;
  tireInventory: {
    tire_brand: string;
    tire_size: string;
  };
  current_tread_depth: number;
}
interface InstallData {
  tire_inventory_id: number | null;
  tire_instance_id: number | null;
  position: string;
  recommended_pressure: number;
  mileage_installed: number;
}

const TireManagementPage = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [tireStatuses, setTireStatuses] = useState<TireStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [selectedTire, setSelectedTire] = useState<TireData | null>(null);
    const [updateData, setUpdateData] = useState<TireUpdateData>({
        current_pressure: 0, temperature: 0, tread_depth: 0, condition: 'good', notes: ''
    });
    const [installModalOpen, setInstallModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState('');
    const [availableTires, setAvailableTires] = useState<TireInventory[]>([]);
    const [availableInstances, setAvailableInstances] = useState<TireInstance[]>([]);
    const [installData, setInstallData] = useState<InstallData>({
        tire_inventory_id: null, tire_instance_id: null, position: '', recommended_pressure: 120,
        mileage_installed: 0
    });
    const [useSpecificInstance, setUseSpecificInstance] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const location = useLocation();

    const fetchVehicles = useCallback(async () => {
        const response = await apiClient.get('/tires/vehicles');
        setVehicles(Array.isArray(response.data) ? response.data : []);
    }, []);

    const fetchVehicleTireStatus = useCallback(async (vehicleId: number) => {
        const response = await apiClient.get(`/tires/vehicles/${vehicleId}/status`);
        setTireStatuses(Array.isArray(response.data.vehicleTires) ? response.data.vehicleTires : []);
    }, []);

    const fetchAvailableTires = useCallback(async () => {
        const response = await apiClient.get('/tire-inventory');
        setAvailableTires(Array.isArray(response.data) ? response.data : []);
    }, []);

    const fetchAvailableInstances = useCallback(async () => {
        const response = await apiClient.get('/tire-instances/available');
        setAvailableInstances(Array.isArray(response.data) ? response.data : []);
    }, []);

    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            try {
                await fetchVehicles();
                const params = new URLSearchParams(location.search);
                const vehicleIdFromUrl = params.get('vehicleId');
                if (vehicleIdFromUrl) {
                    setSelectedVehicleId(vehicleIdFromUrl);
                    await fetchVehicleTireStatus(parseInt(vehicleIdFromUrl, 10));
                }
            } catch (err) {
                console.error("Initialization failed:", err);
                setError("Gagal memuat data. Periksa koneksi atau hubungi administrator.");
            } finally {
                setLoading(false);
            }
        };
        initialize();
    }, [location.search, fetchVehicles, fetchVehicleTireStatus]);

    const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const vehicleIdStr = e.target.value;
        setSelectedVehicleId(vehicleIdStr);
        if (vehicleIdStr) fetchVehicleTireStatus(parseInt(vehicleIdStr, 10)); else setTireStatuses([]);
    };

    const selectedVehicle = selectedVehicleId ? vehicles.find(v => v.id === parseInt(selectedVehicleId)) || null : null;
    
    const handleUpdateClick = (tire: TireData) => {
        setSelectedTire(tire);
        setUpdateData({
            current_pressure: tire.current_pressure, temperature: tire.temperature,
            tread_depth: tire.tread_depth, condition: tire.condition, notes: ''
        });
        setUpdateModalOpen(true);
    };

    const handleUpdateTire = async () => {
        if (!selectedTire || !selectedVehicle) return;
        try {
            await apiClient.put(`/tires/tires/${selectedTire.vehicle_tire_id}`, updateData);
            setUpdateModalOpen(false);
            fetchVehicleTireStatus(selectedVehicle.id);
        } catch (error) {
            console.error('Failed to update tire:', error);
            alert('Gagal memperbarui data ban.');
        }
    };

    const handleInstallClick = (position: string) => {
        setSelectedPosition(position);
        setInstallData({
            tire_inventory_id: null, tire_instance_id: null, position: position,
            recommended_pressure: 120, mileage_installed: selectedVehicle?.current_mileage || 0,
        });
        setUseSpecificInstance(false);
        fetchAvailableTires();
        fetchAvailableInstances();
        setInstallModalOpen(true);
    };

    const handleInstallTire = async () => {
        if (!selectedVehicle) return;
        try {
            const endpoint = installData.tire_instance_id ? `/tires/vehicles/${selectedVehicle.id}/install-instance` : `/tires/vehicles/${selectedVehicle.id}/install`;
            await apiClient.post(endpoint, installData);
            setInstallModalOpen(false);
            fetchVehicleTireStatus(selectedVehicle.id);
        } catch (error) {
            console.error('Failed to install tire:', error);
            alert('Gagal memasang ban.');
        }
    };

    const handleRemoveTire = (tire: TireData) => {
        setConfirmMessage(`Anda yakin ingin melepas ban S/N: ${tire.serial_number}?`);
        setConfirmAction(() => async () => {
            if (!selectedVehicle) return;
            try {
                await apiClient.delete(`/tires/tires/${tire.vehicle_tire_id}`);
                fetchVehicleTireStatus(selectedVehicle.id);
            } catch (error) {
                console.error('Failed to remove tire:', error);
                alert('Gagal melepas ban.');
            }
        });
        setConfirmModalOpen(true);
    };

    const renderTire = (tireStatus: TireStatus) => {
        const { position, tire } = tireStatus;
        return <div key={`tire-${position}`} className={tire ? 'tire-graphic installed' : 'tire-graphic empty'}></div>;
    };

    const renderInfoBox = (tireStatus: TireStatus) => {
        const { position, installed, tire } = tireStatus;
        if (!installed || !tire) {
            return (
                <div key={`info-${position}`} className="info-box empty">
                    <div className="info-position">{position}</div>
                    <button onClick={() => handleInstallClick(position)} className="install-button">Pasang</button>
                </div>
            );
        }
        return (
            <div key={`info-${position}`} className="info-box">
                <div className="info-header">
                    <div className="info-position">{position}</div>
                    <button onClick={() => handleUpdateClick(tire)} className="update-button">Update</button>
                </div>
                <div className="info-details">
                    <div className="info-serial">S/N: {tire.serial_number}</div>
                    <div className="info-date">Pasang: {new Date(tire.install_date).toLocaleDateString('id-ID')}</div>
                </div>
                <button onClick={() => handleRemoveTire(tire)} className="remove-button">Lepas</button>
            </div>
        );
    };

    const renderVehicleLayout = () => {
        if (!selectedVehicle) return null;
        const tireStatusMap = new Map<string, TireStatus>();
        tireStatuses.forEach((status: TireStatus) => tireStatusMap.set(status.position, status));
        const getTiresByPosition = (pos: string): TireStatus[] => {
            const tire = tireStatusMap.get(pos);
            return tire ? [tire] : [{ position: pos, installed: false, tire: null }];
        };

        return (
            <div className="diagram-container">
                <div className="diagram-header">
                    <div>PLAT: <span>{selectedVehicle.license_plate}</span></div>
                    <div>TIPE: <span>{selectedVehicle.type}</span></div>
                    <div>LAST UPDATE: <span>{new Date(selectedVehicle.updatedAt).toLocaleString('id-ID')}</span></div>
                </div>
                <div className="diagram-body">
                    <div className="info-column">
                        {getTiresByPosition('FL').map(renderInfoBox)} <div className="info-spacer"></div>
                        {getTiresByPosition('R1LO').map(renderInfoBox)} {getTiresByPosition('R1LI').map(renderInfoBox)} <div className="info-spacer"></div>
                        {getTiresByPosition('R2LO').map(renderInfoBox)} {getTiresByPosition('R2LI').map(renderInfoBox)}
                    </div>
                    <div className="chassis-column">
                        <div className="axle front">
                            {getTiresByPosition('FL').map(renderTire)} <div className="connector"></div> {getTiresByPosition('FR').map(renderTire)}
                        </div>
                        <div className="chassis-main"></div>
                        <div className="axle rear">
                            {getTiresByPosition('R1LO').map(renderTire)} {getTiresByPosition('R1LI').map(renderTire)}
                            <div className="connector dual"></div>
                            {getTiresByPosition('R1RI').map(renderTire)} {getTiresByPosition('R1RO').map(renderTire)}
                        </div>
                        <div className="chassis-main-short"></div>
                        <div className="axle rear">
                            {getTiresByPosition('R2LO').map(renderTire)} {getTiresByPosition('R2LI').map(renderTire)}
                            <div className="connector dual"></div>
                            {getTiresByPosition('R2RI').map(renderTire)} {getTiresByPosition('R2RO').map(renderTire)}
                        </div>
                    </div>
                    <div className="info-column">
                        {getTiresByPosition('FR').map(renderInfoBox)} <div className="info-spacer"></div>
                        {getTiresByPosition('R1RO').map(renderInfoBox)} {getTiresByPosition('R1RI').map(renderInfoBox)} <div className="info-spacer"></div>
                        {getTiresByPosition('R2RO').map(renderInfoBox)} {getTiresByPosition('R2RI').map(renderInfoBox)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <style>{`
                .tire-management-page { padding: 24px; font-family: sans-serif; }
                .page-title { font-size: 2rem; font-weight: bold; margin-bottom: 1.5rem; }
                .vehicle-selector-container { background-color: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 2rem; max-width: 500px; }
                .vehicle-selector-container label { display: block; margin-bottom: 8px; font-weight: 600; }
                .vehicle-selector-container select { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; }
                .diagram-container { background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; max-width: 1200px; margin: auto; }
                .diagram-header { display: flex; justify-content: space-between; padding: 0 16px 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px; font-weight: 600; }
                .diagram-header span { font-weight: normal; background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; margin-left: 8px; }
                .diagram-body { display: flex; justify-content: space-between; align-items: center; }
                .info-column { display: flex; flex-direction: column; gap: 8px; width: 250px; }
                .info-box { border: 1px solid #000; border-radius: 4px; padding: 8px; height: 100px; display: flex; flex-direction: column; justify-content: space-between; }
                .info-box.empty { justify-content: center; align-items: center; border-style: dashed; color: #9ca3af; }
                .info-header { display: flex; justify-content: space-between; align-items: center; }
                .info-position { font-weight: bold; font-size: 14px; }
                .info-details { margin-top: 4px; }
                .info-serial { font-size: 13px; font-weight: 500; }
                .info-date { font-size: 12px; color: #6b7280; }
                .install-button, .remove-button, .update-button { padding: 4px 8px; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px; }
                .install-button { width: 100%; background-color: #22c55e; margin-top: 4px; }
                .install-button:hover { background-color: #16a34a; }
                .remove-button { width: 100%; background-color: #ef4444; margin-top: auto; }
                .remove-button:hover { background-color: #dc2626; }
                .update-button { background-color: #3b82f6; }
                .update-button:hover { background-color: #2563eb; }
                .info-spacer { height: 24px; }
                .chassis-column { display: flex; flex-direction: column; align-items: center; gap: 16px; }
                .chassis-main { width: 10px; height: 150px; background-color: #4b5563; }
                .chassis-main-short { width: 10px; height: 50px; background-color: #4b5563; }
                .axle { display: flex; align-items: center; }
                .connector { height: 10px; background-color: #4b5563; }
                .axle.front .connector { width: 100px; }
                .axle.rear .connector.dual { width: 40px; height: 15px; border-left: 5px solid #4b5563; border-right: 5px solid #4b5563; }
                .tire-graphic { width: 50px; height: 50px; border-radius: 50%; border: 5px solid #374151; background-color: #1f2937; margin: 0 8px; }
                .tire-graphic.empty { border-style: dashed; border-color: #9ca3af; background-color: #f3f4f6; }
                .axle.rear .tire-graphic { margin: 0 2px; }
                .loading-indicator, .error-banner { text-align: center; padding: 40px; }
                .error-banner { color: #b91c1c; background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; }
                .spinner { display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(0,0,0,0.1); border-left-color: #2563eb; border-radius: 50%; animation: spin 1s ease infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .modal-overlay { position: fixed; inset: 0; background-color: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
                .modal-content { background: white; padding: 24px; border-radius: 8px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
                .modal-header { font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem; }
                .modal-body .form-group { margin-bottom: 1rem; }
                .modal-body label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
                .modal-body input, .modal-body select, .modal-body textarea { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
                .modal-footer { margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; }
                .modal-button { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; }
                .modal-button.primary { background-color: #2563eb; color: white; }
                .modal-button.secondary { background-color: #e5e7eb; color: #1f2937; }
                .radio-group label { display: flex; align-items: center; margin-bottom: 0.5rem; }
                .radio-group input { margin-right: 0.5rem; }
                .scrollable-list { max-height: 150px; overflow-y: auto; border: 1px solid #e5e7eb; padding: 8px; border-radius: 6px; }
                .list-item { padding: 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; }
                .list-item:hover { background-color: #f3f4f6; }
                .list-item.selected { background-color: #dbeafe; border: 1px solid #60a5fa; }
            `}</style>
            <div className="tire-management-page">
                <h1 className="page-title">Manajemen Ban</h1>
                {error && (<div className="error-banner">{error}</div>)}
                <div className="vehicle-selector-container">
                    <label htmlFor="vehicle-select">Pilih Kendaraan:</label>
                    <select id="vehicle-select" value={selectedVehicleId} onChange={handleVehicleChange}>
                        <option value="">-- Pilih Kendaraan --</option>
                        {vehicles.map((vehicle) => (<option key={vehicle.id} value={vehicle.id}>{vehicle.license_plate} ({vehicle.type})</option>))}
                    </select>
                </div>
                {loading ? (
                    <div className="loading-indicator"><div className="spinner"></div><p>Memuat...</p></div>
                ) : (
                    !loading && selectedVehicle && renderVehicleLayout()
                )}
                
                {confirmModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 className="modal-header">Konfirmasi Tindakan</h3>
                            <div className="modal-body"><p>{confirmMessage}</p></div>
                            <div className="modal-footer">
                                <button onClick={() => setConfirmModalOpen(false)} className="modal-button secondary">Batal</button>
                                <button onClick={() => { if (confirmAction) confirmAction(); setConfirmModalOpen(false); }} className="modal-button primary" style={{backgroundColor: '#ef4444'}}>Ya, Lanjutkan</button>
                            </div>
                        </div>
                    </div>
                )}
                {installModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 className="modal-header">Pasang Ban di Posisi {selectedPosition}</h3>
                            <div className="modal-body">
                                <div className="form-group radio-group">
                                    <label>Sumber Ban:</label>
                                    <label><input type="radio" checked={!useSpecificInstance} onChange={() => setUseSpecificInstance(false)}/>Dari Inventaris (Ban Baru)</label>
                                    <label><input type="radio" checked={useSpecificInstance} onChange={() => setUseSpecificInstance(true)}/>Ban Bekas (Sudah Dilepas)</label>
                                </div>
                                {useSpecificInstance ? (
                                     <div className="form-group">
                                        <label>Pilih Ban Bekas:</label>
                                        <div className="scrollable-list">
                                            {availableInstances.map((instance) => (
                                                <div key={instance.id} className={`list-item ${installData.tire_instance_id === instance.id ? 'selected' : ''}`} onClick={() => setInstallData(prev => ({ ...prev, tire_instance_id: instance.id, tire_inventory_id: null }))}>
                                                    <strong>{instance.tireInventory.tire_brand} {instance.tireInventory.tire_size}</strong><br/>
                                                    <small>S/N: {instance.tire_serial_number} | Tapak: {instance.current_tread_depth}mm</small>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Pilih Ban dari Inventaris:</label>
                                        <div className="scrollable-list">
                                            {availableTires.map((tire) => (
                                                <div key={tire.id} className={`list-item ${installData.tire_inventory_id === tire.id ? 'selected' : ''}`} onClick={() => setInstallData(prev => ({ ...prev, tire_inventory_id: tire.id, tire_instance_id: null }))}>
                                                    <strong>{tire.tire_brand} {tire.tire_size}</strong><br/>
                                                    <small>Stok: {tire.current_stock}</small>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Kilometer Saat Pasang</label>
                                    <input type="number" value={installData.mileage_installed} onChange={(e) => setInstallData(prev => ({ ...prev, mileage_installed: parseInt(e.target.value) }))} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setInstallModalOpen(false)} className="modal-button secondary">Batal</button>
                                <button onClick={handleInstallTire} className="modal-button primary">Pasang Ban</button>
                            </div>
                        </div>
                    </div>
                )}
                {updateModalOpen && selectedTire && (
                     <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 className="modal-header">Update Ban S/N: {selectedTire.serial_number}</h3>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Tekanan (PSI)</label>
                                    <input type="number" step="0.1" value={updateData.current_pressure} onChange={(e) => setUpdateData(prev => ({...prev, current_pressure: parseFloat(e.target.value)}))} />
                                </div>
                                <div className="form-group">
                                    <label>Suhu (°C)</label>
                                    <input type="number" step="0.1" value={updateData.temperature} onChange={(e) => setUpdateData(prev => ({...prev, temperature: parseFloat(e.target.value)}))} />
                                </div>
                                <div className="form-group">
                                    <label>Kedalaman Tapak (mm)</label>
                                    <input type="number" step="0.1" value={updateData.tread_depth} onChange={(e) => setUpdateData(prev => ({...prev, tread_depth: parseFloat(e.target.value)}))} />
                                </div>
                                <div className="form-group">
                                    <label>Kondisi</label>
                                    <select value={updateData.condition} onChange={(e) => setUpdateData(prev => ({...prev, condition: e.target.value}))}>
                                        <option value="good">Baik</option><option value="fair">Cukup</option>
                                        <option value="poor">Buruk</option><option value="replace">Perlu Ganti</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Catatan</label>
                                    <textarea value={updateData.notes} onChange={(e) => setUpdateData(prev => ({...prev, notes: e.target.value}))} rows={3}/>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setUpdateModalOpen(false)} className="modal-button secondary">Batal</button>
                                <button onClick={handleUpdateTire} className="modal-button primary">Update</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default TireManagementPage;
