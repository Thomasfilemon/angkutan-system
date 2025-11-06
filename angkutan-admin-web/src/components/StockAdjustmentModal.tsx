import React, { useState, useEffect } from "react";
import apiClient from "../api/axiosConfig"; // Menggunakan nama apiClient sesuai proyek Anda

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSuccess?: (payload: any) => void;
  // When set to 'edit', the modal opens directly in Edit Data mode (no quantity change)
  defaultMode?: "adjust" | "edit";
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
  defaultMode = "adjust",
}) => {
  // State untuk menyimpan nilai input dari form
  const [newQuantity, setNewQuantity] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(defaultMode === "edit");
  
  // Edit mode fields
  const [itemName, setItemName] = useState("");
  const [rackRow, setRackRow] = useState("");
  const [rackLevel, setRackLevel] = useState("");
  const [minStock, setMinStock] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  // Set nilai awal form ketika item berubah (saat modal dibuka)
  useEffect(() => {
    if (item) {
      setNewQuantity(item.current_stock);
      setNotes(""); // Kosongkan catatan setiap kali modal dibuka
      setError("");
      setIsEditMode(defaultMode === "edit");
      
      // Set edit mode fields
      setItemName(item.item_name || "");
      setRackRow(item.rack_row ? item.rack_row.toString() : "");
      setRackLevel(item.rack_level ? item.rack_level.toString() : "");
      setMinStock(item.min_stock ? item.min_stock.toString() : "");
      setItemNotes(item.notes || "");
    }
  }, [item, defaultMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditMode) {
      // Handle edit mode
      setError("");
      setIsSubmitting(true);

      try {
        await apiClient.post("/stock/adjust", {
          itemId: item.id,
          adjustmentType: "edit",
          item_name: itemName,
          rack_row: rackRow,
          rack_level: rackLevel,
          min_stock: minStock,
          item_notes: itemNotes,
          notes: notes || "yang diedit disini tidak merubah data di buku kas ataupun tempo",
        });

        alert("Data barang berhasil diperbarui!");
        if (onSuccess) {
          onSuccess({ 
            updated_item: { id: item.id },
            adjustment_type: "edit"
          });
        }
        onClose();
      } catch (err: any) {
        console.error("Gagal memperbarui data barang:", err);
        const errorMessage =
          err.response?.data?.message || "Terjadi kesalahan saat menyimpan data.";
        setError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Handle quantity adjustment mode
      if (newQuantity === "" || newQuantity < 0) {
        setError("Kuantitas baru tidak boleh kosong atau negatif.");
        return;
      }
      setError("");
      setIsSubmitting(true);

      const currentStock = parseFloat(item.current_stock);
      // Hitung selisihnya. Jika kuantitas baru lebih kecil, hasilnya akan negatif.
      const adjustmentQuantity = newQuantity - currentStock;

      // Jika tidak ada perubahan, langsung tutup modal.
      if (adjustmentQuantity === 0) {
        onClose();
        return;
      }

      try {
        // Determine adjustment type based on quantity change
        const adjustmentType = adjustmentQuantity > 0 ? "add" : "deduct";
        const absoluteQuantity = Math.abs(adjustmentQuantity);
        
        await apiClient.post("/stock/adjust", {
          itemId: item.id,
          adjustmentType: adjustmentType,
          quantity: absoluteQuantity,
          unit_price: item.average_unit_price || 0,
          notes: `Penyesuaian dari ${currentStock} menjadi ${newQuantity}. Catatan: ${notes}`,
        });

        alert("Penyesuaian stok berhasil!");
        if (onSuccess) {
          onSuccess({ 
            updated_item: { id: item.id },
            adjustment_type: adjustmentType
          });
        }
        onClose(); // Tutup modal dan refresh data di halaman utama
      } catch (err: any) {
        console.error("Gagal melakukan penyesuaian stok:", err);
        const errorMessage =
          err.response?.data?.message || "Terjadi kesalahan saat menyimpan data.";
        setError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {isEditMode ? "Edit Data Barang" : "Penyesuaian Stok"}: {item.item_name}
        </h2>
        
        {/* Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditMode(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              !isEditMode 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Penyesuaian Stok
          </button>
          <button
            type="button"
            onClick={() => setIsEditMode(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              isEditMode 
                ? "bg-blue-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Edit Data Barang
          </button>
        </div>

        {!isEditMode && (
          <p className="mb-4">
            Stok Saat Ini:{" "}
            <strong>
              {item.current_stock} {item.unit}
            </strong>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {isEditMode ? (
            // Edit mode fields
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Barang
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Nama barang"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rak Baris (1-4)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={rackRow}
                    onChange={(e) => setRackRow(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="1-4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rak Tingkat (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={rackLevel}
                    onChange={(e) => setRackLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="1-5"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok Minimum
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Stok minimum"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan Barang
                </label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Catatan untuk barang ini"
                />
              </div>
            </>
          ) : (
            // Quantity adjustment mode fields
            <>
              <div className="mb-4">
                <label
                  htmlFor="newQuantity"
                  className="block text-sm font-medium text-gray-700"
                >
                  Kuantitas Baru
                </label>
                <input
                  type="number"
                  id="newQuantity"
                  value={newQuantity}
                  onChange={(e) =>
                    setNewQuantity(
                      e.target.value === "" ? "" : parseFloat(e.target.value)
                    )
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Masukkan kuantitas baru"
                />
              </div>
            </>
          )}

          <div className="mb-4">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700"
            >
              {isEditMode ? "Catatan Edit" : "Catatan Penyesuaian"}
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder={isEditMode ? "Catatan untuk perubahan data" : "Alasan penyesuaian (misal: stok opname, barang rusak)"}
            ></textarea>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Menyimpan..." : (isEditMode ? "Simpan Perubahan" : "Simpan Penyesuaian")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;
