// src/pages/VehicleEdit.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import VehicleForm from "../components/VehicleForm";
import toast from "react-hot-toast";

const VehicleEditPage = () => {
  const params = useParams();
  const id = params?.id;

  type Vehicle = {
    id?: string;
    [key: string]: any;
    last_edited_by?: string;
    last_edited_at?: string;
  };
  const [vehicleData, setVehicleData] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVehicle = async () => {
      if (!id) {
        setError("Invalid vehicle id.");
        setIsPageLoading(false);
        return;
      }

      try {
        setIsPageLoading(true);
        const response = await apiClient.get(`/vehicles/${id}`);
        setVehicleData(response.data.data || response.data);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message || "Failed to load vehicle data.";
        setError(msg);
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchVehicle();
  }, [id]);

  const handleUpdateVehicle = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!id) throw new Error("Invalid vehicle id.");

      // Build payload carefully, normalizing types coming from VehicleForm
      const payload: any = { ...data };

      // normalize tire counts (could be number or string)
      payload.tire_count =
        data.tire_count !== undefined ? Number(data.tire_count) : undefined;
      payload.spare_tire_count =
        data.spare_tire_count !== undefined
          ? Number(data.spare_tire_count)
          : undefined;

      // normalize capacity: allow string or number, treat empty as null
      const capRaw = data.capacity;
      if (
        capRaw === null ||
        capRaw === undefined ||
        (typeof capRaw === "string" && capRaw.trim() === "")
      ) {
        payload.capacity = null;
      } else {
        const numCapacity =
          typeof capRaw === "string" ? parseInt(capRaw, 10) : Number(capRaw);
        if (isNaN(numCapacity) || numCapacity < 0) {
          throw new Error("Capacity must be a valid non-negative number.");
        }
        payload.capacity = numCapacity;
      }

      // driver id: keep null or numeric
      payload.driver_id =
        data.driver_id === ""
          ? null
          : data.driver_id === null
          ? null
          : Number(data.driver_id);
      payload.stnk_expired_date = data.stnk_expired_date || null;
      payload.tax_due_date = data.tax_due_date || null;
      payload.last_service_date = data.last_service_date || null;
      payload.next_service_due = data.next_service_due || null;

      const res = await apiClient.put(`/vehicles/${id}`, payload);
      const updated = res.data?.data || res.data;
      const editor = updated?.last_edited_by;
      toast.success("Kendaraan berhasil diperbarui");
      if (editor) toast(`Diubah oleh ${editor}`);
      navigate("/vehicles");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.details ||
        err.response?.data?.errors?.join(". ") ||
        err.response?.data?.message ||
        err.message ||
        "An unknown error occurred.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) return <div>Loading vehicle data...</div>;
  if (error)
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">
        {error}
      </div>
    );
  if (!vehicleData) return <div>Vehicle not found.</div>;

  // map vehicleData to VehicleForm initialData shape
  const formatToDateInput = (dateStr: any) =>
    dateStr ? new Date(dateStr).toISOString().split("T")[0] : "";

  const initialFormData = vehicleData
    ? {
        license_plate:
          vehicleData.license_plate || vehicleData.plate_number || "",
        type: vehicleData.type || vehicleData.vehicle_type || "",
        capacity:
          vehicleData.capacity !== undefined && vehicleData.capacity !== null
            ? String(vehicleData.capacity)
            : "",
        tire_count: vehicleData.tire_count ?? vehicleData.main_tire_count ?? 6,
        spare_tire_count:
          vehicleData.spare_tire_count ?? vehicleData.spare_tires ?? 2,
        driver_id:
          vehicleData.driver_id ?? vehicleData.assigned_driver_id ?? null,
        stnk_number: vehicleData.stnk_number || vehicleData.stnk || "",
        stnk_expired_date:
          vehicleData.stnk_expired_date || vehicleData.stnk_expiry || "",
        tax_due_date: vehicleData.tax_due_date || vehicleData.tax_due || "",
        last_service_date: vehicleData.last_service_date || "",
        next_service_due: vehicleData.next_service_due || "",
        status: vehicleData.status || "available",
      }
    : undefined;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Edit Kendaraan</h1>
      {vehicleData?.last_edited_by && (
        <div className="text-sm text-gray-600 mb-4">
          Diubah oleh {vehicleData.last_edited_by} •{" "}
          {new Date(vehicleData.last_edited_at || "").toLocaleString("id-ID")}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}
      <VehicleForm
        initialData={initialFormData}
        onSubmit={handleUpdateVehicle}
        isLoading={isLoading}
        buttonText="Update Kendaraan"
        isEditMode={true}
      />
    </div>
  );
};

export default VehicleEditPage;
