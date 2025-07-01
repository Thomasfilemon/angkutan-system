import React, { useState, useEffect } from 'react';
import apiClient from '../api/axiosConfig'; // Menggunakan nama apiClient sesuai proyek Anda

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ isOpen, onClose, item }) => {
  // State untuk menyimpan nilai input dari form
  const [newQuantity, setNewQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set nilai awal form ketika item berubah (saat modal dibuka)
  useEffect(() => {
    if (item) {
      setNewQuantity(item.current_stock);
      setNotes(''); // Kosongkan catatan setiap kali modal dibuka
      setError('');
    }
  }, [item]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuantity === '' || newQuantity < 0) {
      setError('Kuantitas baru tidak boleh kosong atau negatif.');
      return;
    }
    setError('');
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
      // PERBAIKAN: Hapus awalan '/web' dari URL
      await apiClient.post('/stock/adjust', {
        itemId: item.id,
        quantity: adjustmentQuantity,
        notes: `Penyesuaian dari ${currentStock} menjadi ${newQuantity}. Catatan: ${notes}`,
      });
      
      alert('Penyesuaian stok berhasil!');
      onClose(); // Tutup modal dan refresh data di halaman utama
    } catch (err: any) {
      console.error('Gagal melakukan penyesuaian stok:', err);
      const errorMessage = err.response?.data?.message || 'Terjadi kesalahan saat menyimpan data.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Penyesuaian Stok: {item.item_name}</h2>
        <p className="mb-4">Stok Saat Ini: <strong>{item.current_stock} {item.unit}</strong></p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="newQuantity" className="block text-sm font-medium text-gray-700">Kuantitas Baru</label>
            <input
              type="number"
              id="newQuantity"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Masukkan kuantitas baru"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Catatan</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Alasan penyesuaian (misal: stok opname, barang rusak)"
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
              {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;