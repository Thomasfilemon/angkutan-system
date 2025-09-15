// src/pages/ServiceManagement.tsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";

interface Service {
  id: number;
  service_number: string;
  service_date: string;
  service_type: "regular" | "with_parts";
  description: string;
  workshop_name: string;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  status: "completed" | "cancelled";
  vehicle: {
    license_plate: string;
    type: string;
  };
  serviceItems: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    from_stock: boolean;
  }>;
  last_edited_by?: string;
  last_edited_at?: string;
}

const ServiceManagementPage = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to safely format currency
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "-";
    }
    return value.toLocaleString("id-ID");
  };

  // Helper function to safely format date
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("id-ID");
    } catch {
      return "-";
    }
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/services");

      // Ensure data is an array and has proper structure
      const servicesData = Array.isArray(response.data)
        ? response.data
        : response.data?.data
        ? response.data.data
        : [];

      setServices(servicesData);
    } catch (err) {
      setError("Failed to fetch services");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleCancelService = async (id: number) => {
    if (
      window.confirm(
        "Are you sure you want to cancel this service? Stock items will be restored."
      )
    ) {
      try {
        await apiClient.patch(`/services/${id}/cancel`);
        fetchServices();
      } catch (err) {
        alert("Failed to cancel service");
      }
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          status === "completed"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {status === "completed" ? "Completed" : "Cancelled"}
      </span>
    );
  };

  const getServiceTypeBadge = (type: string) => {
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          type === "regular"
            ? "bg-blue-100 text-blue-800"
            : "bg-purple-100 text-purple-800"
        }`}
      >
        {type === "regular" ? "Regular Service" : "With Parts"}
      </span>
    );
  };

  if (loading)
    return <div className="text-center p-8">Loading services...</div>;
  if (error)
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Riwayat Servis Kendaraan
        </h1>
        <Link to="/services/create">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Tambah Servis
          </button>
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Service No
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Tanggal
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Kendaraan
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Tipe
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Bengkel
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Total Biaya
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                Status
              </th>
              <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {services.length > 0 ? (
              services.map((service) => (
                <tr key={service.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap font-medium">
                      {service.service_number || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {formatDate(service.service_date)}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div>
                      <p className="text-gray-900 whitespace-no-wrap font-medium">
                        {service.vehicle?.license_plate || "-"}
                      </p>
                      <p className="text-gray-600 text-xs">
                        {service.vehicle?.type || "-"}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {getServiceTypeBadge(service.service_type)}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {service.workshop_name || "Internal"}
                    </p>
                    {service.last_edited_by && (
                      <div className="text-xs text-gray-600 mt-2">
                        Diubah oleh {service.last_edited_by} •{" "}
                        {new Date(service.last_edited_at || "").toLocaleString(
                          "id-ID"
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <div>
                      <p className="text-gray-900 whitespace-no-wrap font-medium">
                        Rp {formatCurrency(service.total_cost)}
                      </p>
                      <p className="text-gray-600 text-xs">
                        Labor: Rp {formatCurrency(service.labor_cost)} | Parts:
                        Rp {formatCurrency(service.parts_cost)}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {getStatusBadge(service.status)}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                    <Link
                      to={`/services/${service.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Detail
                    </Link>
                    {service.status === "completed" && (
                      <>
                        <Link
                          to={`/services/edit/${service.id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleCancelService(service.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-500">
                  Tidak ada data servis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServiceManagementPage;
