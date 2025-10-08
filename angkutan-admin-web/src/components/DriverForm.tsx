// src/components/DriverForm.tsx

import React, { useState } from "react";

// Form data now includes all fields from your DriverProfile model
interface DriverFormData {
  username?: string;
  password?: string;
  full_name: string;
  phone: string;
  address: string;
  id_card_number?: string; // optional now
  sim_number?: string;     // optional now
  license_type: string;
  status: "available" | "busy" | "on_leave";
  ktp_image?: File | null;
  sim_image?: File | null;
}

interface DriverFormProps {
  initialData?: Partial<DriverFormData>;
  onSubmit: (data: DriverFormData) => void;
  isLoading: boolean;
  isEditMode?: boolean;
}

const DriverForm: React.FC<DriverFormProps> = ({
  initialData = {},
  onSubmit,
  isLoading,
  isEditMode = false,
}) => {
  const [formData, setFormData] = useState<DriverFormData>({
    username: "",
    password: "",
    full_name: "",
    phone: "",
    address: "",
    id_card_number: "",
    sim_number: "",
    ktp_image: null,
    sim_image: null,
    license_type: "B1",
    status: "available",
    ...initialData,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Build FormData for multipart request (text + optional images)
    const fd = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "ktp_image" || key === "sim_image") return; // handle files below
      if (value !== undefined && value !== null) {
        fd.append(key, String(value));
      }
    });
    if (formData.ktp_image) {
      fd.append("ktp_image", formData.ktp_image);
    }
    if (formData.sim_image) {
      fd.append("sim_image", formData.sim_image);
    }
    onSubmit(fd as any);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white p-6 rounded-lg shadow-md"
    >
      {!isEditMode && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder={isEditMode ? "Leave blank to keep unchanged" : ""}
                onChange={handleChange}
                required={!isEditMode}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
          </div>
          <hr />
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nama Lengkap
        </label>
        <input
          type="text"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          required
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nomor Telepon
        </label>
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Alamat
        </label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          required
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
        />
      </div>

      {/* --- ADDED REQUIRED AND OPTIONAL FIELDS --- */}
      {/* KTP & SIM as images (optional) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Foto KTP (opsional)</label>
          <input
            type="file"
            name="ktp_image"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              setFormData((prev) => ({ ...prev, ktp_image: file }));
            }}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Foto SIM (opsional)</label>
          <input
            type="file"
            name="sim_image"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              setFormData((prev) => ({ ...prev, sim_image: file }));
            }}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tipe SIM
          </label>
          <select
            name="license_type"
            value={formData.license_type}
            onChange={handleChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          >
            <option value="A">A</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            required
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          >
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="on_leave">On Leave</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-blue-300"
        >
          {isLoading
            ? "Saving..."
            : isEditMode
            ? "Update Driver"
            : "Create Driver"}
        </button>
      </div>
    </form>
  );
};

export default DriverForm;
