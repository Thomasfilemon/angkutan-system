// src/pages/ServiceEdit.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
}

interface ServiceDetail {
  id: number;
  vehicle_id: number;
  service_number: string; // ADD THIS LINE
  service_date: string;
  service_type: 'regular' | 'with_parts';
  description: string;
  workshop_name: string;
  labor_cost: number;
  notes: string;
  status: string;
}

const ServiceEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [service, setService] = useState<ServiceDetail | null>(null);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    service_date: '',
    service_type: 'regular' as 'regular' | 'with_parts',
    description: '',
    workshop_name: '',
    labor_cost: '',
    notes: ''
  });

  useEffect(() => {
    fetchVehicles();
    if (id) {
      fetchServiceDetail();
    }
  }, [id]);

  const fetchVehicles = async () => {
    try {
      const response = await apiClient.get('/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  };

  const fetchServiceDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/services/${id}`);
      const serviceData = response.data;
      setService(serviceData);
      
      setFormData({
        vehicle_id: serviceData.vehicle_id.toString(),
        service_date: serviceData.service_date,
        service_type: serviceData.service_type,
        description: serviceData.description,
        workshop_name: serviceData.workshop_name || '',
        labor_cost: serviceData.labor_cost.toString(),
        notes: serviceData.notes || ''
      });
    } catch (err) {
      console.error('Failed to fetch service:', err);
      alert('Failed to load service data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!service) return;

    if (service.status === 'cancelled') {
      alert('Cannot edit cancelled service');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        vehicle_id: parseInt(formData.vehicle_id),
        service_date: formData.service_date,
        service_type: formData.service_type,
        description: formData.description,
        workshop_name: formData.workshop_name,
        labor_cost: parseFloat(formData.labor_cost) || 0,
        notes: formData.notes
      };

      await apiClient.put(`/services/${id}`, submitData);
      navigate(`/services/${id}`);
    } catch (err) {
      console.error('Failed to update service:', err);
      alert('Failed to update service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading service data...</div>;
  }

  if (!service) {
    return <div className="text-center p-8">Service not found</div>;
  }

  if (service.status === 'cancelled') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Cannot Edit Cancelled Service</p>
          <p>This service has been cancelled and cannot be edited.</p>
        </div>
        <div className="mt-4">
          <button
            onClick={() => navigate('/services')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Edit Servis Kendaraan</h1>
        <p className="text-gray-600 mt-2">
          Edit informasi servis - Service Number: {service.service_number}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Vehicle Selection */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kendaraan *
            </label>
            <select
              name="vehicle_id"
              value={formData.vehicle_id}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="">Pilih Kendaraan</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate} - {vehicle.type}
                </option>
              ))}
            </select>
          </div>

          {/* Service Date */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tanggal Servis *
            </label>
            <input
              type="date"
              name="service_date"
              value={formData.service_date}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tipe Servis *
            </label>
            <select
              name="service_type"
              value={formData.service_type}
              onChange={handleInputChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled // Cannot change service type when editing
            >
              <option value="regular">Servis Reguler</option>
              <option value="with_parts">Servis dengan Suku Cadang</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Tipe servis tidak dapat diubah setelah dibuat
            </p>
          </div>

          {/* Workshop Name */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Nama Bengkel
            </label>
            <input
              type="text"
              name="workshop_name"
              value={formData.workshop_name}
              onChange={handleInputChange}
              placeholder="Bengkel Internal"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          {/* Labor Cost */}
          <div className="md:col-span-2">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Biaya Jasa
            </label>
            <input
              type="number"
              name="labor_cost"
              value={formData.labor_cost}
              onChange={handleInputChange}
              placeholder="0"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Deskripsi Servis *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            placeholder="Jelaskan jenis servis yang dilakukan..."
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Catatan
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            placeholder="Catatan tambahan..."
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        {/* Warning for parts */}
        {service.service_type === 'with_parts' && (
          <div className="mb-6 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p className="font-bold">Perhatian:</p>
            <p>Servis ini menggunakan suku cadang. Perubahan pada suku cadang tidak dapat dilakukan melalui form ini. Untuk mengubah suku cadang, batalkan servis ini dan buat servis baru.</p>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(`/services/${id}`)}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Update Servis'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServiceEditPage;
