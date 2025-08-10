// src/pages/ServiceCreate.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import CreatableSelect from "react-select/creatable";
import AsyncSelect from "react-select/async";
import debounce from "lodash.debounce";

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
}

interface StockItem {
  id: number;
  item_name: string;
  current_stock: number;
  unit: string;
  average_unit_price: number; // Updated to match your backend field
}

interface ServiceItem {
  stock_item_id?: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  from_stock: boolean;
}

interface SelectOption {
  value: number;
  label: string;
  fullItem?: StockItem;
}

const ServiceCreatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<FileList | null>(null);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    service_date: new Date().toISOString().split("T")[0],
    service_type: "regular",
    description: "",
    workshop_name: "",
    labor_cost: "",
    notes: "",
  });
  const [saveToCash, setSaveToCash] = useState(true);
  const [isTempo, setIsTempo] = useState(false);
  const [cashAccount, setCashAccount] = useState("General");
  const [accounts, setAccounts] = useState<string[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Fetch cash accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const response = await apiClient.get("/cash/accounts");
        setAccounts(response.data.data || []);
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await apiClient.get("/vehicles");
      setVehicles(response.data);
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    }
  };

  const fetchStockItems = async (inputValue = ""): Promise<SelectOption[]> => {
    try {
      const params = new URLSearchParams();
      if (inputValue) params.append("search", inputValue);
      params.append("limit", "20");

      const response = await apiClient.get(
        `/services/stock-items?${params.toString()}`
      );
      const items = response.data.data || response.data || [];

      return items.map((item: StockItem) => ({
        value: item.id,
        label: `${item.item_name} (Stok: ${item.current_stock} ${item.unit})`,
        fullItem: item,
      }));
    } catch (err) {
      console.error("Failed to fetch stock items:", err);
      return [];
    }
  };

  const debouncedLoadOptions = debounce(
    (inputValue: string, callback: (options: SelectOption[]) => void) => {
      fetchStockItems(inputValue).then((options) => callback(options));
    },
    300
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 5) {
        alert("Maksimal 5 file yang dapat diupload");
        e.target.value = "";
        setAttachmentFiles(null);
        return;
      }
      setAttachmentFiles(e.target.files);
    } else {
      setAttachmentFiles(null);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addServiceItem = () => {
    setServiceItems((prev) => [
      ...prev,
      {
        item_name: "",
        quantity: 0,
        unit_price: 0,
        from_stock: false,
      },
    ]);
  };

  const updateServiceItem = (
    index: number,
    field: keyof ServiceItem,
    value: any
  ) => {
    setServiceItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const removeServiceItem = (index: number) => {
    setServiceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submissionData = new FormData();

      submissionData.append("vehicle_id", formData.vehicle_id);
      submissionData.append("service_date", formData.service_date);
      submissionData.append("service_type", formData.service_type);
      submissionData.append("description", formData.description);
      submissionData.append("workshop_name", formData.workshop_name);
      submissionData.append("labor_cost", formData.labor_cost || "0");
      submissionData.append("notes", formData.notes);

      const itemsToSubmit = serviceItems.filter(
        (item) => item.item_name && item.quantity > 0
      );
      submissionData.append("items", JSON.stringify(itemsToSubmit));

      const cashSettings = saveToCash
        ? {
            save_to_cash: true,
            is_tempo: isTempo,
            account: cashAccount,
            include_zero_price_items: true,
          }
        : {
            save_to_cash: false,
          };
      submissionData.append("cash_settings", JSON.stringify(cashSettings));

      if (saveToCash && attachmentFiles && attachmentFiles.length > 0) {
        Array.from(attachmentFiles).forEach((file) => {
          submissionData.append("attachments", file);
        });
      }

      await apiClient.post("/services", submissionData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      navigate("/services");
    } catch (err) {
      console.error("Failed to create service:", err);
      alert("Failed to create service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h1 className="text-2xl font-bold mb-4">Tambah Servis Kendaraan</h1>
        <p className="text-gray-600 mb-6">
          Catat servis kendaraan dan penggunaan suku cadang (termasuk yang harga
          0)
        </p>

        <form onSubmit={handleSubmit}>
          {/* Vehicle Selection */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kendaraan *
            </label>
            <select
              name="vehicle_id"
              value={formData.vehicle_id}
              onChange={handleInputChange}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            >
              <option value="">Pilih Kendaraan</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate} - {vehicle.type}
                </option>
              ))}
            </select>
          </div>

          {/* Service Date */}
          <div className="mb-4">
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
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tipe Servis *
            </label>
            <select
              name="service_type"
              value={formData.service_type}
              onChange={handleInputChange}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="regular">Servis Reguler</option>
              <option value="with_parts">Servis dengan Suku Cadang</option>
            </select>
          </div>

          {/* Workshop Name */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Nama Bengkel
            </label>
            <input
              type="text"
              name="workshop_name"
              value={formData.workshop_name}
              onChange={handleInputChange}
              placeholder="Nama bengkel (opsional)"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>

          {/* Labor Cost */}
          <div className="mb-4">
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

          {/* Description */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Deskripsi Servis *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Jelaskan pekerjaan yang dilakukan..."
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          {/* Cash Management Settings */}
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">Pengaturan Kas</h3>

            <div className="mb-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={saveToCash}
                  onChange={(e) => setSaveToCash(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="ml-2">
                  Simpan ke Kas (termasuk item harga 0)
                </span>
              </label>
            </div>

            {saveToCash && (
              <>
                <div className="mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isTempo}
                      onChange={(e) => setIsTempo(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2">Transaksi Tempo</span>
                  </label>
                </div>

                <div className="mb-3">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Akun Kas
                  </label>
                  <CreatableSelect
                    value={{ value: cashAccount, label: cashAccount }}
                    options={accounts.map((account) => ({
                      value: account,
                      label: account,
                    }))}
                    onChange={(selected) => {
                      setCashAccount(selected?.value || "General");
                    }}
                    onCreateOption={(inputValue) => {
                      setCashAccount(inputValue);
                      if (!accounts.includes(inputValue)) {
                        setAccounts((prev) => [...prev, inputValue]);
                      }
                    }}
                    placeholder="Cari atau buat akun..."
                    isLoading={isLoadingAccounts}
                    className="shadow appearance-none border rounded text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    styles={{
                      control: (base) => ({ ...base, minHeight: "44px" }),
                      placeholder: (base) => ({ ...base, color: "#a0aec0" }),
                    }}
                  />
                </div>

                {/* Multiple file input with enhanced UI */}
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Foto Nota (Opsional - Maksimal 5 file)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                  {attachmentFiles && attachmentFiles.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm font-medium text-blue-800 mb-2">
                        📎 {attachmentFiles.length} file(s) dipilih:
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Array.from(attachmentFiles).map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white p-2 rounded text-xs border"
                          >
                            <span
                              className="truncate flex-1 mr-2"
                              title={file.name}
                            >
                              {file.name}
                            </span>
                            <span className="text-gray-500 whitespace-nowrap">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Pilih gambar atau PDF. Maksimal 5 file.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Service Items */}
          {formData.service_type === "with_parts" && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Suku Cadang yang Digunakan
                </h3>
                <button
                  type="button"
                  onClick={addServiceItem}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  + Tambah Item
                </button>
              </div>

              {serviceItems.map((item, index) => (
                <div key={index} className="border p-4 mb-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Stock Item Selection */}
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Dari Stok
                      </label>
                      <AsyncSelect
                        cacheOptions
                        isClearable
                        isSearchable
                        defaultOptions
                        placeholder="Cari dan pilih dari stok (opsional)..."
                        value={
                          item.stock_item_id
                            ? ({
                                value: item.stock_item_id,
                                label: item.item_name,
                              } as SelectOption)
                            : null
                        }
                        onChange={(selectedOption) => {
                          updateServiceItem(
                            index,
                            "stock_item_id",
                            selectedOption ? selectedOption.value : undefined
                          );

                          if (selectedOption && selectedOption.fullItem) {
                            updateServiceItem(
                              index,
                              "item_name",
                              selectedOption.fullItem.item_name
                            );
                            updateServiceItem(
                              index,
                              "unit_price",
                              selectedOption.fullItem.average_unit_price || 0
                            );
                            updateServiceItem(index, "from_stock", true);
                          } else {
                            updateServiceItem(index, "item_name", "");
                            updateServiceItem(index, "unit_price", 0);
                            updateServiceItem(index, "from_stock", false);
                          }
                        }}
                        loadOptions={debouncedLoadOptions}
                        classNamePrefix="react-select"
                        noOptionsMessage={() =>
                          "Tidak ada item ditemukan—coba cari lagi atau tambah baru"
                        }
                        loadingMessage={() => "Memuat stok..."}
                      />
                    </div>

                    {/* Item Name */}
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Nama Item
                      </label>
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) =>
                          updateServiceItem(index, "item_name", e.target.value)
                        }
                        placeholder="Nama suku cadang"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Jumlah
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateServiceItem(
                            index,
                            "quantity",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Harga Satuan (boleh 0)
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateServiceItem(
                              index,
                              "unit_price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                          className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                        <button
                          type="button"
                          onClick={() => removeServiceItem(index)}
                          className="bg-red-500 hover:bg-red-700 text-white px-3 rounded-r"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Total Price Display */}
                  <div className="mt-2 text-right">
                    <span className="text-lg font-semibold">
                      Total: Rp{" "}
                      {(item.quantity * item.unit_price).toLocaleString(
                        "id-ID"
                      )}
                    </span>
                    {item.from_stock && (
                      <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        Dari Stok
                      </span>
                    )}
                    {item.unit_price === 0 && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        Gratis/Internal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

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

          {/* Submit Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/services")}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              {loading ? "Menyimpan..." : "Simpan Servis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceCreatePage;
