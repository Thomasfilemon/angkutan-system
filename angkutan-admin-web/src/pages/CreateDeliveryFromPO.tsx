// src/pages/CreateDeliveryFromPO.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import apiClient from '../api/axiosConfig';

// Fix for default markers in Leaflet
const DefaultIcon = L.Icon.Default as any;
DefaultIcon.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons for load/unload locations
const loadIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const unloadIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface PODetails {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  unit_price: number;
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  load_location: string;
  unload_location: string;
  load_latitude?: number;
  load_longitude?: number;
  unload_latitude?: number;
  unload_longitude?: number;
}

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: string;
  status: string;
  driver_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_status: string | null;
}

interface LocationMarker {
  lat: number;
  lng: number;
  type: 'load' | 'unload';
  title: string;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick, selectedLocationType }: { 
  onMapClick: (latlng: any) => void; 
  selectedLocationType: 'load' | 'unload' | null; 
}) {
  useMapEvents({
    click: (e) => {
      if (selectedLocationType && onMapClick) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

const CreateDeliveryFromPO: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const [poDetails, setPODetails] = useState<PODetails | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [selectedLocationType, setSelectedLocationType] = useState<'load' | 'unload' | null>(null);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    minimal_load_quantity: '',
    trip_allowance: '',
    gaji: '',
    ongkosan: '',
    load_location: '',
    unload_location: '',
    load_latitude: '',
    load_longitude: '',
    unload_latitude: '',
    unload_longitude: ''
  });

  // Default center (Jakarta, Indonesia)
  const defaultCenter = { lat: -6.2088, lng: 106.8456 };

  useEffect(() => {
    if (poId) {
      fetchPODetails();
      fetchAvailableVehicles();
    }
  }, [poId]);

  const fetchPODetails = async (): Promise<void> => {
    try {
      const response = await apiClient.get(`/purchase-orders/${poId}`);
      const details = response.data.data || response.data;
      setPODetails(details);
      
      setFormData(prev => ({
        ...prev,
        load_location: details.load_location || '',
        unload_location: details.unload_location || '',
        load_latitude: details.load_latitude?.toString() || '',
        load_longitude: details.load_longitude?.toString() || '',
        unload_latitude: details.unload_latitude?.toString() || '',
        unload_longitude: details.unload_longitude?.toString() || ''
      }));

      // Set initial markers if coordinates exist
      const initialMarkers: LocationMarker[] = [];
      if (details.load_latitude && details.load_longitude) {
        initialMarkers.push({
          lat: details.load_latitude,
          lng: details.load_longitude,
          type: 'load',
          title: 'Load Location'
        });
      }
      if (details.unload_latitude && details.unload_longitude) {
        initialMarkers.push({
          lat: details.unload_latitude,
          lng: details.unload_longitude,
          type: 'unload',
          title: 'Unload Location'
        });
      }
      setMarkers(initialMarkers);
    } catch (error) {
      console.error('Error fetching PO details:', error);
      setError('Failed to fetch purchase order details.');
    }
  };

  const fetchAvailableVehicles = async (): Promise<void> => {
    try {
      const response = await apiClient.get('/vehicles');
      const vehiclesData = response.data.data || response.data || [];
      
      const availableVehicles = vehiclesData.filter((vehicle: Vehicle) => 
        vehicle.driver_id && 
        vehicle.driver_status === 'available' &&
        vehicle.status === 'available'
      );
      
      setVehicles(availableVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError('Failed to fetch available vehicles.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMapClick = (latlng: any) => {
    if (!selectedLocationType) return;

    const lat = latlng.lat;
    const lng = latlng.lng;

    // Update form data
    if (selectedLocationType === 'load') {
      setFormData(prev => ({
        ...prev,
        load_latitude: lat.toString(),
        load_longitude: lng.toString()
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        unload_latitude: lat.toString(),
        unload_longitude: lng.toString()
      }));
    }

    // Update markers
    setMarkers(prev => {
      const filtered = prev.filter(m => m.type !== selectedLocationType);
      return [
        ...filtered,
        {
          lat,
          lng,
          type: selectedLocationType,
          title: selectedLocationType === 'load' ? 'Load Location' : 'Unload Location'
        }
      ];
    });

    // Reverse geocoding using free Nominatim API
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(response => response.json())
      .then(data => {
        const address = data.display_name;
        if (selectedLocationType === 'load') {
          setFormData(prev => ({ ...prev, load_location: address }));
        } else {
          setFormData(prev => ({ ...prev, unload_location: address }));
        }
      })
      .catch(err => console.log('Geocoding error:', err));

    setSelectedLocationType(null);
  };

  const getSelectedVehicle = (): Vehicle | undefined => {
    return vehicles.find((v: Vehicle) => v.id.toString() === formData.vehicle_id);
  };

  const calculateOngkosan = (): number => {
    if (!poDetails?.unit_price || !formData.minimal_load_quantity) return 0;
    
    const totalAmount = parseFloat(formData.minimal_load_quantity) * poDetails.unit_price;
    const tripAllowance = parseFloat(formData.trip_allowance) || 0;
    const gaji = parseFloat(formData.gaji) || 0;
    
    return totalAmount - tripAllowance - gaji;
  };

  // Auto-calculate ongkosan when relevant fields change
  useEffect(() => {
    const calculatedOngkosan = calculateOngkosan();
    if (calculatedOngkosan > 0) {
      setFormData(prev => ({
        ...prev,
        ongkosan: calculatedOngkosan.toString()
      }));
    }
  }, [formData.minimal_load_quantity, formData.trip_allowance, formData.gaji, poDetails?.unit_price]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const selectedVehicle = getSelectedVehicle();
      
      if (!selectedVehicle) {
        throw new Error('Please select a valid vehicle');
      }

      if (!selectedVehicle.driver_id) {
        throw new Error('Selected vehicle does not have an assigned driver');
      }

      const totalAmount = poDetails?.unit_price ? 
        parseFloat(formData.minimal_load_quantity) * poDetails.unit_price : 0;

      const payload = {
        purchase_order_id: poDetails?.id,
        vehicle_id: parseInt(formData.vehicle_id),
        driver_id: selectedVehicle.driver_id,
        customer_name: poDetails?.customer_name,
        item_name: poDetails?.item_name,
        minimal_load_quantity: parseFloat(formData.minimal_load_quantity),
        unit_price: poDetails?.unit_price,
        total_amount: totalAmount,
        trip_allowance: parseFloat(formData.trip_allowance),
        gaji: parseFloat(formData.gaji),
        ongkosan: parseFloat(formData.ongkosan),
        load_location: formData.load_location || poDetails?.load_location,
        unload_location: formData.unload_location || poDetails?.unload_location,
        load_latitude: formData.load_latitude ? parseFloat(formData.load_latitude) : null,
        load_longitude: formData.load_longitude ? parseFloat(formData.load_longitude) : null,
        unload_latitude: formData.unload_latitude ? parseFloat(formData.unload_latitude) : null,
        unload_longitude: formData.unload_longitude ? parseFloat(formData.unload_longitude) : null,
        payment_status: 'proses_tagihan',
        status: 'assigned'
      };

      console.log('Creating delivery order with payload:', payload);

      await apiClient.post('/delivery-orders', payload);
      navigate('/delivery-orders');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create delivery order';
      setError(errorMessage);
      console.error('Error creating delivery order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!poDetails) {
    return <div className="text-center p-8">Loading purchase order details...</div>;
  }

  const selectedVehicle = getSelectedVehicle();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Create Delivery Order</h1>
        <button
          onClick={() => navigate(`/trips/po/${poId}`)}
          className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          ← Back to PO Details
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          {error}
        </div>
      )}
      
      {/* PO Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Purchase Order Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-600">PO Number</label>
            <p className="font-medium">{poDetails.po_number}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Customer</label>
            <p className="font-medium">{poDetails.customer_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Item</label>
            <p className="font-medium">{poDetails.item_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Remaining Quantity</label>
            <p className="font-medium text-green-600">
              {poDetails.remaining_quantity?.toLocaleString('id-ID')} ton
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quantity Section */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Load Quantity</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimal Load Quantity (ton) *
                </label>
                <input
                  type="number"
                  name="minimal_load_quantity"
                  step="0.01"
                  max={poDetails.remaining_quantity}
                  value={formData.minimal_load_quantity}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Maximum: ${poDetails.remaining_quantity} ton`}
                  required
                />
              </div>
            </div>

            {/* Vehicle & Driver Assignment Section */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Vehicle & Driver Assignment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle with Assigned Driver *
                  </label>
                  <select
                    name="vehicle_id"
                    value={formData.vehicle_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Vehicle</option>
                    {vehicles.map((vehicle: Vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} - {vehicle.type} 
                        {vehicle.capacity && ` (${vehicle.capacity} kg)`}
                        {vehicle.driver_name && ` - Driver: ${vehicle.driver_name}`}
                      </option>
                    ))}
                  </select>
                  {vehicles.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      No vehicles with assigned drivers are available. Please assign drivers to vehicles first.
                    </p>
                  )}
                </div>

                {selectedVehicle && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="font-medium text-gray-900 mb-2">Selected Assignment:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Vehicle:</span>
                        <p className="font-medium">{selectedVehicle.license_plate} - {selectedVehicle.type}</p>
                        <p className="text-gray-600">Capacity: {selectedVehicle.capacity} kg</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Assigned Driver:</span>
                        <p className="font-medium">{selectedVehicle.driver_name}</p>
                        <p className="text-gray-600">{selectedVehicle.driver_phone}</p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedVehicle.driver_status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedVehicle.driver_status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location Section with Map Integration */}
            <div className="bg-white border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Location Information</h3>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                >
                  {showMap ? 'Hide Map' : 'Show Map'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Load Location *
                  </label>
                  <textarea
                    name="load_location"
                    value={formData.load_location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    required
                    placeholder="Enter load location or select on map"
                  />
                  {showMap && (
                    <button
                      type="button"
                      onClick={() => setSelectedLocationType('load')}
                      className={`mt-2 px-3 py-1 rounded text-sm ${
                        selectedLocationType === 'load' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {selectedLocationType === 'load' ? 'Click map to set load location' : 'Set Load Location'}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unload Location *
                  </label>
                  <textarea
                    name="unload_location"
                    value={formData.unload_location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    required
                    placeholder="Enter unload location or select on map"
                  />
                  {showMap && (
                    <button
                      type="button"
                      onClick={() => setSelectedLocationType('unload')}
                      className={`mt-2 px-3 py-1 rounded text-sm ${
                        selectedLocationType === 'unload' 
                          ? 'bg-red-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {selectedLocationType === 'unload' ? 'Click map to set unload location' : 'Set Unload Location'}
                    </button>
                  )}
                </div>
              </div>

              {/* Coordinates Display */}
              {(formData.load_latitude || formData.unload_latitude) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Coordinates:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {formData.load_latitude && (
                      <div>
                        <span className="text-gray-600">Load:</span>
                        <span className="ml-2 font-mono">
                          {parseFloat(formData.load_latitude).toFixed(6)}, {parseFloat(formData.load_longitude).toFixed(6)}
                        </span>
                      </div>
                    )}
                    {formData.unload_latitude && (
                      <div>
                        <span className="text-gray-600">Unload:</span>
                        <span className="ml-2 font-mono">
                          {parseFloat(formData.unload_latitude).toFixed(6)}, {parseFloat(formData.unload_longitude).toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Financial Section */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Financial Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Allowance (Rp) *
                  </label>
                  <input
                    type="number"
                    name="trip_allowance"
                    value={formData.trip_allowance}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 2500000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver Salary (Rp) *
                  </label>
                  <input
                    type="number"
                    name="gaji"
                    value={formData.gaji}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1500000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ongkosan/Profit (Rp) *
                  </label>
                  <input
                    type="number"
                    name="ongkosan"
                    value={formData.ongkosan}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-calculated or manual"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-calculated based on total amount minus driver costs
                  </p>
                </div>
              </div>
              
              {/* Financial Summary */}
              {formData.trip_allowance && formData.gaji && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium text-gray-900 mb-2">Financial Summary:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trip Allowance:</span>
                        <span>Rp {Number(formData.trip_allowance).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Driver Salary:</span>
                        <span>Rp {Number(formData.gaji).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span className="text-gray-600">Total Driver Cost:</span>
                        <span className="text-red-600">
                          Rp {(Number(formData.trip_allowance) + Number(formData.gaji)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <div>
                      {poDetails.unit_price && formData.minimal_load_quantity && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Revenue:</span>
                            <span className="text-green-600">
                              Rp {(Number(formData.minimal_load_quantity) * poDetails.unit_price).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ongkosan/Profit:</span>
                            <span className="text-blue-600">
                              Rp {Number(formData.ongkosan).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-1">
                            <span className="text-gray-600">Net Profit:</span>
                            <span className="text-green-600">
                              Rp {(Number(formData.ongkosan) - Number(formData.trip_allowance) - Number(formData.gaji)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate(`/trips/po/${poId}`)}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || vehicles.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {loading ? 'Creating...' : 'Create Delivery Order'}
              </button>
            </div>
          </form>
        </div>

        {/* Map Section */}
        {showMap && (
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Location Map</h3>
            <div className="h-96 w-full">
              <MapContainer
                center={markers.length > 0 ? [markers[0].lat, markers[0].lng] : [defaultCenter.lat, defaultCenter.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler 
                  onMapClick={handleMapClick} 
                  selectedLocationType={selectedLocationType} 
                />
                {markers.map((marker, index) => (
                  <Marker
                    key={index}
                    position={[marker.lat, marker.lng]}
                    icon={marker.type === 'load' ? loadIcon : unloadIcon}
                  >
                    <Popup>{marker.title}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>🔵 Blue marker: Load location</p>
              <p>🔴 Red marker: Unload location</p>
              <p>💡 Click "Set Load Location" or "Set Unload Location" buttons, then click on the map to place markers.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateDeliveryFromPO;
