// src/pages/StockCreate.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CreatableSelect from "react-select/creatable";
import AsyncSelect from "react-select/async";
import debounce from "lodash.debounce";
import apiClient from "../api/axiosConfig";

interface StockCategory {
  id: number;
  category_name: string;
}

interface StockItem {
  id: number;
  category_id: number | null;
  item_code: string;
  item_name: string;
  supplier: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_unit_price: number;
  notes: string;
  batches?: StockBatch[];
}

interface StockBatch {
  id: number;
  batch_number: string;
  quantity: number;
  unit_price: number;
  purchase_date: string;
  supplier: string;
  notes: string;
}

interface FormItem {
  id: number | null;
  category_id: string;
  item_code: string;
  item_name: string;
  supplier: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  unit_price: string;
  notes: string;
  isNew: boolean;
  adjustmentType: "add" | "deduct";
  adjustmentAmount: string;
  originalStock?: number;
  createNewBatch?: boolean;
}

interface SelectOption {
  value: number;
  label: string;
  fullItem?: StockItem;
}

const StockCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [formItems, setFormItems] = useState<FormItem[]>([
    {
      id: null,
      category_id: "",
      item_code: "",
      item_name: "",
      supplier: "",
      unit: "Pcs",
      current_stock: "",
      min_stock: "",
      unit_price: "",
      notes: "",
      isNew: true,
      adjustmentType: "add",
      adjustmentAmount: "0",
      originalStock: 0,
      createNewBatch: false,
    },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveToCash, setSaveToCash] = useState(true);
  const [isTempo, setIsTempo] = useState(false);
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("General");

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
    if (isEdit && id) {
      fetchStockItem();
    }
  }, [isEdit, id]);

  const fetchAccounts = async () => {
    try {
      const response = await apiClient.get("/cash/accounts");
      setAccounts(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get("/stock/categories");
      setCategories(response.data.data || response.data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const fetchStockItem = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/stock/${id}`);
      const item = response.data.data || response.data;
      setFormItems([
        {
          id: item.id,
          category_id: item.category_id?.toString() || "",
          item_code: item.item_code || "",
          item_name: item.item_name || "",
          supplier: item.supplier || "",
          unit: item.unit || "Pcs",
          current_stock: item.current_stock?.toString() || "0",
          min_stock: item.min_stock?.toString() || "",
          unit_price:
            (item.average_unit_price || item.unit_price)?.toString() || "",
          notes: item.notes || "",
          isNew: false,
          adjustmentType: "add",
          adjustmentAmount: "0",
          originalStock: item.current_stock || 0,
          createNewBatch: false,
        },
      ]);
    } catch (err) {
      console.error("Failed to fetch stock item:", err);
      alert("Failed to load stock item data");
    } finally {
      setLoading(false);
    }
  };

  const fetchStockOptions = async (
    inputValue = ""
  ): Promise<SelectOption[]> => {
    try {
      const params = new URLSearchParams();
      if (inputValue) params.append("search", inputValue);
      params.append("limit", "20");

      const response = await apiClient.get(`/stock?${params.toString()}`);
      const items = response.data.data || response.data || [];

      return items.map((item: StockItem) => ({
        value: item.id,
        label: `${item.item_name} (Stok: ${item.current_stock} ${item.unit})`,
        fullItem: item,
      }));
    } catch (err) {
      console.error("Failed to fetch stock options:", err);
      return [];
    }
  };

  const debouncedLoadOptions = debounce(
    (inputValue: string, callback: (options: SelectOption[]) => void) => {
      fetchStockOptions(inputValue).then(callback);
    },
    300
  );

  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        id: null,
        category_id: "",
        item_code: "",
        item_name: "",
        supplier: "",
        unit: "Pcs",
        current_stock: "",
        min_stock: "",
        unit_price: "",
        notes: "",
        isNew: true,
        adjustmentType: "add",
        adjustmentAmount: "0",
        originalStock: 0,
        createNewBatch: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (
    index: number,
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [name]: value } : item))
    );

    const errorKey = `${name}-${index}`;
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

  const handleAdjustmentTypeChange = (
    index: number,
    type: "add" | "deduct"
  ) => {
    setFormItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              adjustmentType: type,
              createNewBatch: type === "add" ? item.createNewBatch : false,
            }
          : item
      )
    );
  };

  const handleAdjustmentAmountChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, adjustmentAmount: value } : item
      )
    );

    const errorKey = `adjustmentAmount-${index}`;
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

  const handleCreateNewBatchChange = (index: number, value: boolean) => {
    setFormItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, createNewBatch: value } : item
      )
    );
  };

  const handleItemSelect = (
    index: number,
    selectedOption: SelectOption | null
  ) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          if (!selectedOption || !selectedOption.fullItem) {
            return {
              id: null,
              category_id: "",
              item_code: "",
              item_name: "",
              supplier: "",
              unit: "Pcs",
              current_stock: "",
              min_stock: "",
              unit_price: "",
              notes: "",
              isNew: true,
              adjustmentType: "add",
              adjustmentAmount: "0",
              originalStock: 0,
              createNewBatch: false,
            };
          }

          const selectedItem = selectedOption.fullItem;
          return {
            id: selectedItem.id,
            category_id: selectedItem.category_id?.toString() || "",
            item_code: selectedItem.item_code || "",
            item_name: selectedItem.item_name || "",
            supplier: selectedItem.supplier || "",
            unit: selectedItem.unit || "Pcs",
            current_stock: selectedItem.current_stock?.toString() || "0", // FIXED: Added the missing property here
            min_stock: selectedItem.min_stock?.toString() || "",
            unit_price: selectedItem.average_unit_price?.toString() || "",
            notes: selectedItem.notes || "",
            isNew: false,
            adjustmentType: "add",
            adjustmentAmount: "0",
            originalStock: selectedItem.current_stock || 0,
            createNewBatch: false,
          };
        }
        return item;
      })
    );
  };

  const calculateNewStock = (item: FormItem) => {
    const adjustmentAmount = parseFloat(item.adjustmentAmount) || 0;
    const originalStock = item.originalStock || 0;

    if (item.isNew) {
      return item.adjustmentType === "add" ? adjustmentAmount : 0;
    }

    return item.adjustmentType === "add"
      ? originalStock + adjustmentAmount
      : Math.max(0, originalStock - adjustmentAmount);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    formItems.forEach((item, index) => {
      if (!item.item_name)
        newErrors[`item_name-${index}`] = "Nama item diperlukan";
      if (!item.unit) newErrors[`unit-${index}`] = "Satuan diperlukan";
      const adjAmount = parseFloat(item.adjustmentAmount) || 0;
      if (adjAmount < 0)
        newErrors[`adjustmentAmount-${index}`] =
          "Jumlah penyesuaian tidak boleh negatif";
      if (
        !item.isNew &&
        item.adjustmentType === "deduct" &&
        adjAmount > (item.originalStock || 0)
      ) {
        newErrors[`adjustmentAmount-${index}`] =
          "Tidak bisa mengurangi lebih dari stok saat ini";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotaFile(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      let totalRestockCost = 0;
      let restockDescription = "FIFO Batch Stock Update:\n";

      for (const formItem of formItems) {
        const adjustmentAmount = parseFloat(formItem.adjustmentAmount) || 0;

        if (formItem.isNew) {
          const submitData = {
            category_id: formItem.category_id
              ? parseInt(formItem.category_id)
              : null,
            item_code: formItem.item_code,
            item_name: formItem.item_name,
            supplier: formItem.supplier,
            unit: formItem.unit,
            min_stock: parseFloat(formItem.min_stock) || 0,
            unit_price: parseFloat(formItem.unit_price) || 0,
            initial_stock: adjustmentAmount,
            notes: formItem.notes,
          };

          await apiClient.post("/stock", submitData);

          if (adjustmentAmount > 0) {
            const unitPrice = parseFloat(formItem.unit_price) || 0;
            const itemCost = adjustmentAmount * unitPrice;
            totalRestockCost += itemCost;
            restockDescription += `• ${
              formItem.item_name
            } +${adjustmentAmount} @${unitPrice.toLocaleString()} = ${itemCost.toLocaleString()} (New Item)\n`;
          }
        } else {
          const adjustData = {
            itemId: formItem.id,
            adjustmentType: formItem.adjustmentType,
            quantity: adjustmentAmount,
            unit_price: parseFloat(formItem.unit_price) || 0,
            supplier: formItem.supplier,
            notes: formItem.notes,
            create_new_batch: formItem.createNewBatch || false,
          };

          await apiClient.post("/stock/adjust", adjustData);

          if (formItem.adjustmentType === "add" && adjustmentAmount > 0) {
            const unitPrice = parseFloat(formItem.unit_price) || 0;
            const itemCost = adjustmentAmount * unitPrice;
            totalRestockCost += itemCost;
            const batchType = formItem.createNewBatch
              ? "New Batch"
              : "Add to Batch";
            restockDescription += `• ${
              formItem.item_name
            } +${adjustmentAmount} @${unitPrice.toLocaleString()} = ${itemCost.toLocaleString()} (${batchType})\n`;
          }
        }
      }

      if (totalRestockCost > 0 && saveToCash) {
        const transactionType = isTempo ? "kredit_tempo" : "kredit";
        restockDescription += `\nTotal Investment: ${totalRestockCost.toLocaleString()}`;

        const cashFormData = new FormData();
        cashFormData.append("transaction_type", transactionType);
        cashFormData.append("amount", String(totalRestockCost));
        cashFormData.append("description", restockDescription);
        cashFormData.append("transaction_date", new Date().toISOString());
        cashFormData.append("account", selectedAccount);
        cashFormData.append("no_nota", JSON.stringify([]));
        cashFormData.append("category_id", "9");

        if (notaFile) {
          cashFormData.append("attachments", notaFile);
        }

        await apiClient.post("/cash/transactions", cashFormData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      navigate("/stock");
    } catch (err: any) {
      console.error("Failed to save stock item:", err);
      if (err.response?.data?.errors) {
        alert(err.response.data.errors.join(", "));
      } else {
        alert("Gagal menyimpan data. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className="container mx-auto p-4">Loading stock item data...</div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">
          {isEdit
            ? "Edit Barang Stok"
            : formItems.length > 1
            ? "Kelola Barang Stok"
            : "Tambah Barang Stok"}
        </h1>
        <p className="text-gray-600 mb-6">
          {isEdit
            ? "Ubah informasi barang stok dengan sistem FIFO batch"
            : formItems.length > 1
            ? "Kelola beberapa barang sekaligus dengan sistem FIFO batch"
            : "Tambah barang baru ke dalam stok dengan sistem FIFO batch"}
        </p>

        <form onSubmit={handleSubmit}>
          {formItems.map((item, index) => {
            const newStock = calculateNewStock(item);
            return (
              <div
                key={index}
                className="mb-8 p-4 border rounded-lg bg-gray-50"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Barang #{index + 1}</h3>
                  {formItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {!isEdit && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pilih/Tambah Barang (Kosongkan Jika Ingin Menambahkan
                      Barang Baru)
                    </label>
                    <AsyncSelect
                      cacheOptions
                      defaultOptions
                      isClearable
                      placeholder="Cari dan pilih barang..."
                      value={
                        item.id
                          ? ({
                              value: item.id,
                              label: item.item_name,
                            } as SelectOption)
                          : null
                      }
                      onChange={(selected) => handleItemSelect(index, selected)}
                      loadOptions={debouncedLoadOptions}
                      noOptionsMessage={() => "Tidak ada barang ditemukan"}
                      loadingMessage={() => "Memuat..."}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategori
                    </label>
                    <CreatableSelect
                      value={
                        item.category_id
                          ? {
                              value: item.category_id,
                              label:
                                categories.find(
                                  (cat) =>
                                    cat.id.toString() === item.category_id
                                )?.category_name || "",
                            }
                          : null
                      }
                      options={categories.map((cat) => ({
                        value: cat.id.toString(),
                        label: cat.category_name,
                      }))}
                      onChange={(selected) =>
                        handleInputChange(index, {
                          target: {
                            name: "category_id",
                            value: selected?.value || "",
                          },
                        } as any)
                      }
                      onCreateOption={(input) =>
                        handleInputChange(index, {
                          target: { name: "category_id", value: input },
                        } as any)
                      } // Handle new category creation if API supports
                      placeholder="Pilih atau buat kategori..."
                    />
                    {errors[`category_id-${index}`] && (
                      <p className="text-red-500 text-xs italic">
                        {errors[`category_id-${index}`]}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kode Barang
                    </label>
                    <input
                      type="text"
                      name="item_code"
                      value={item.item_code}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Contoh: OLI-001"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nama Barang *
                    </label>
                    <input
                      type="text"
                      name="item_name"
                      value={item.item_name}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Masukkan nama barang"
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                        errors[`item_name-${index}`] ? "border-red-500" : ""
                      }`}
                      required
                    />
                    {errors[`item_name-${index}`] && (
                      <p className="text-red-500 text-xs italic">
                        {errors[`item_name-${index}`]}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier
                    </label>
                    <input
                      type="text"
                      name="supplier"
                      value={item.supplier}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="Nama supplier"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Satuan *
                    </label>
                    <select
                      name="unit"
                      value={item.unit}
                      onChange={(e) => handleInputChange(index, e)}
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                        errors[`unit-${index}`] ? "border-red-500" : ""
                      }`}
                      required
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Liter">Liter</option>
                      <option value="Kg">Kg</option>
                      <option value="Meter">Meter</option>
                      <option value="Set">Set</option>
                      <option value="Botol">Botol</option>
                      <option value="Dus">Dus</option>
                      <option value="Batang">Batang</option>
                      <option value="Lembar">Lembar</option>
                    </select>
                    {errors[`unit-${index}`] && (
                      <p className="text-red-500 text-xs italic">
                        {errors[`unit-${index}`]}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Stok
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="min_stock"
                      value={item.min_stock}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="0"
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                        errors[`min_stock-${index}`] ? "border-red-500" : ""
                      }`}
                    />
                    {errors[`min_stock-${index}`] && (
                      <p className="text-red-500 text-xs italic">
                        {errors[`min_stock-${index}`]}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Harga Satuan
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="unit_price"
                      value={item.unit_price}
                      onChange={(e) => handleInputChange(index, e)}
                      placeholder="0"
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                        errors[`unit_price-${index}`] ? "border-red-500" : ""
                      }`}
                    />
                    {errors[`unit_price-${index}`] && (
                      <p className="text-red-500 text-xs italic">
                        {errors[`unit_price-${index}`]}
                      </p>
                    )}
                  </div>

                  {!item.isNew && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stok Saat Ini
                      </label>
                      <input
                        type="text"
                        value={item.current_stock}
                        readOnly
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-gray-100 leading-tight"
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Penyesuaian Stok
                    </label>
                    <div className="flex space-x-2 mb-2">
                      <button
                        type="button"
                        onClick={() => handleAdjustmentTypeChange(index, "add")}
                        className={`px-4 py-2 rounded ${
                          item.adjustmentType === "add"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200"
                        }`}
                      >
                        Tambah
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAdjustmentTypeChange(index, "deduct")
                        }
                        disabled={item.isNew}
                        className={`px-4 py-2 rounded ${
                          item.adjustmentType === "deduct"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200"
                        } ${item.isNew ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        Kurangi
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.adjustmentAmount}
                      onChange={(e) =>
                        handleAdjustmentAmountChange(index, e.target.value)
                      }
                      placeholder="Jumlah penyesuaian"
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                        errors[`adjustmentAmount-${index}`]
                          ? "border-red-500"
                          : ""
                      }`}
                    />
                    {errors[`adjustmentAmount-${index}`] && (
                      <p className="text-red-500 text-xs italic">
                        {errors[`adjustmentAmount-${index}`]}
                      </p>
                    )}
                  </div>

                  {!item.isNew && item.adjustmentType === "add" && (
                    <div className="mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={item.createNewBatch}
                          onChange={(e) =>
                            handleCreateNewBatchChange(index, e.target.checked)
                          }
                          className="mr-2"
                        />
                        Buat Batch Baru
                      </label>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stok Setelah Penyesuaian
                    </label>
                    <div className="bg-gray-100 p-2 rounded text-gray-700">
                      {newStock} {item.unit}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan
                  </label>
                  <textarea
                    name="notes"
                    value={item.notes}
                    onChange={(e) => handleInputChange(index, e)}
                    placeholder="Catatan tambahan"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddItem}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            + Tambah Item
          </button>

          {/* Cash Settings */}
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
                <span className="ml-2">Simpan ke Kas</span>
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
                    value={{ value: selectedAccount, label: selectedAccount }}
                    options={accounts.map((account) => ({
                      value: account,
                      label: account,
                    }))}
                    onChange={(selected) =>
                      setSelectedAccount(selected?.value || "General")
                    }
                    onCreateOption={(inputValue) => {
                      setSelectedAccount(inputValue);
                      if (!accounts.includes(inputValue)) {
                        setAccounts((prev) => [...prev, inputValue]);
                      }
                    }}
                    placeholder="Cari atau buat akun..."
                    className="shadow appearance-none border rounded text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    styles={{
                      control: (base) => ({ ...base, minHeight: "44px" }),
                      placeholder: (base) => ({ ...base, color: "#a0aec0" }),
                    }}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Foto Nota (Opsional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                  {notaFile && (
                    <p className="text-green-600 text-sm mt-1">
                      File: {notaFile.name}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/stock")}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              {loading ? "Menyimpan..." : isEdit ? "Update" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockCreatePage;
