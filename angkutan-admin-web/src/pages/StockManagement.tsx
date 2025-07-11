import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import { debounce } from 'lodash';

// --- Kumpulan Ikon Aksi ---
const IconHistory = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconAdjust = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m8-8h2M4 12H2m15.364 6.364l-1.414-1.414M6.05 6.05l-1.414-1.414m12.728 0l-1.414 1.414M6.05 17.95l-1.414 1.414" /></svg>;
const IconRestock = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 9a9 9 0 0114.65-4.65L20 5M20 15a9 9 0 01-14.65 4.65L4 19" /></svg>;
const IconEdit = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>;
const IconDelete = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

// Updated interface to include batch-related fields
interface StockItem { 
    id: number; 
    item_code: string; 
    item_name: string; 
    supplier: string; 
    unit: string; 
    current_stock: number; 
    min_stock: number; 
    total_value: number; 
    stock_status: string; 
    category?: { category_name: string; };
    weighted_average_price?: number;
    batch_count?: number;
}

interface StockBatch {
    id: number;
    batch_number: string;
    purchase_price: number;
    initial_quantity: number;
    remaining_quantity: number;
    purchase_date: string;
    supplier: string;
    notes: string;
}

const StockManagementPage = () => {
    // ✅ Initialize with empty arrays to prevent undefined errors
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [batches, setBatches] = useState<StockBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- State untuk Filter dan Pagination ---
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    // State untuk modal (tidak berubah)
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

    // --- New states for FIFO batch tracking ---
    const [selectedItemForBatches, setSelectedItemForBatches] = useState<StockItem | null>(null);
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [selectedItemForRestock, setSelectedItemForRestock] = useState<StockItem | null>(null);

    const [restockData, setRestockData] = useState({
        quantity: 0,
        unit_price: 0,
        supplier: '',
        notes: ''
    });

    // --- FUNGSI FETCHING DATA YANG BARU ---
    const fetchStockItems = useCallback(async (page = 1, search = '', startDate = '', endDate = '') => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '10', search });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            
            const response = await apiClient.get(`/stock?${params.toString()}`);
            
            // ✅ Add null checks and default values
            const responseData = response.data?.data || [];
            const paginationData = response.data?.pagination || {};
            
            setStockItems(responseData);
            setTotalPages(paginationData.totalPages || 0);
            setTotalItems(paginationData.totalItems || 0);
            setCurrentPage(paginationData.currentPage || 1);
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Gagal memuat data stok');
            // ✅ Set empty array on error to prevent map errors
            setStockItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- New function to fetch batches ---
    const fetchBatches = useCallback(async (itemId: number) => {
        console.log('🚀 Fetching batches for item:', itemId);
        
        try {
            const response = await apiClient.get(`/stock/${itemId}/batches`);
            console.log('📦 API Response:', response.data);
            
            // ✅ FIX: Gunakan response.data langsung, bukan response.data.data
            const batchData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            
            console.log('📊 Batch data received:', batchData);
            console.log('📊 Batch count:', batchData.length);
            
            setBatches(batchData);
            
        } catch (error: any) {
            console.error('❌ Error fetching batches:', error);
            setBatches([]);
        }
    }, []);
    // Fetch batches when item is selected
  const [batchLoading, setBatchLoading] = useState(false);

    useEffect(() => {
        const loadBatches = async () => {
            if (selectedItemForBatches?.id) {
                setBatchLoading(true);
                setBatches([]); // Reset state
                
                await fetchBatches(selectedItemForBatches.id);
                setBatchLoading(false);
            } else {
                setBatches([]);
                setBatchLoading(false);
            }
        };
        
        loadBatches();
    }, [selectedItemForBatches?.id, fetchBatches]);

    // Gunakan debounce untuk efisiensi pencarian
    const debouncedFetch = useCallback(debounce((...args) => fetchStockItems(...args), 500), [fetchStockItems]);

    useEffect(() => {
        debouncedFetch(1, searchTerm, dateRange.startDate, dateRange.endDate);
        return () => debouncedFetch.cancel();
    }, [searchTerm, dateRange, debouncedFetch]);

    const resetFilters = () => {
        setSearchTerm('');
        setDateRange({ startDate: '', endDate: '' });
    };

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages) {
            fetchStockItems(newPage, searchTerm, dateRange.startDate, dateRange.endDate);
        }
    };

    // --- New restock function ---
    const handleRestock = async (item: StockItem) => {
        setSelectedItemForRestock(item);
        setRestockData({
            quantity: 0,
            unit_price: item.weighted_average_price || 0,
            supplier: item.supplier || '',
            notes: ''
        });
        setIsRestockModalOpen(true);
    };

    const handleRestockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedItemForRestock) {
                await apiClient.post(`/stock/${selectedItemForRestock.id}/add`, restockData);
                setIsRestockModalOpen(false);
                setSelectedItemForRestock(null);
                setRestockData({ quantity: 0, unit_price: 0, supplier: '', notes: '' });
                fetchStockItems(currentPage, searchTerm, dateRange.startDate, dateRange.endDate);
            }
        } catch (err) {
            console.error('Restock error:', err);
            alert('Gagal melakukan restock');
        }
    };
    
    // Fungsi-fungsi lain (handle modal, delete, etc) tetap sama
    const handleAdjustmentClick = (item: StockItem) => { setSelectedStockItem(item); setIsAdjustmentModalOpen(true); };
    const handleCloseModal = () => { setIsAdjustmentModalOpen(false); setSelectedStockItem(null); fetchStockItems(currentPage, searchTerm, dateRange.startDate, dateRange.endDate); };
    const handleDelete = async (itemId: number) => {
        if(window.confirm('Anda yakin ingin menghapus item ini?')) {
            try {
                await apiClient.delete(`/stock/${itemId}`);
                alert('Item berhasil dihapus');
                fetchStockItems(currentPage, searchTerm, dateRange.startDate, dateRange.endDate);
            } catch(err) {
                console.error('Delete error:', err);
                alert('Gagal menghapus item');
            }
        }
    };
    const getStatusBadge = (status: string) => {
        const classes = { adequate: 'bg-green-100 text-green-800', low_stock: 'bg-yellow-100 text-yellow-800', out_of_stock: 'bg-red-100 text-red-800' };
        const labels = { adequate: 'Cukup', low_stock: 'Stok Rendah', out_of_stock: 'Habis' };
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes[status as keyof typeof classes]}`}>{labels[status as keyof typeof labels]}</span>;
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Manajemen Stok</h1>
                <Link to="/stock/create">
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow">
                        + Restok Barang
                    </button>
                </Link>
            </div>

            {/* --- Filter Bar --- */}
            <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <input type="text" placeholder="Cari nama atau kode barang..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md col-span-2" />
                    <input type="date" name="startDate" value={dateRange.startDate} onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} className="p-2 border rounded-md" />
                    <input type="date" name="endDate" value={dateRange.endDate} onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} className="p-2 border rounded-md" />
                    <button onClick={resetFilters} className="p-2 bg-gray-300 hover:bg-gray-400 rounded-md">Reset</button>
                </div>
            </div>

            {/* --- Tabel Stok --- */}
            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-200">
                        <tr>
                            <th scope="col" className="px-6 py-3 border border-gray-300">Nama Barang</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300">Supplier</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Stok Saat Ini</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Stok Min.</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Harga Satuan</th>                            
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Status</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="text-center p-8 text-gray-500">Memuat data...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={7} className="text-center p-8 text-red-500">{error}</td></tr>
                        ) : !stockItems || stockItems.length === 0 ? (
                            <tr><td colSpan={7} className="text-center p-8 text-gray-500">Tidak ada data yang ditemukan</td></tr>
                        ) : (
                            // ✅ Add additional null check before mapping
                            stockItems && stockItems.map ? stockItems.map((item, index) => (
                                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-6 py-4 border border-gray-300 font-medium text-gray-900">
                                        {item.item_name || '-'}
                                        <p className="text-xs text-gray-500">{item.item_code || '-'}</p>
                                    </td>
                                    <td className="px-6 py-4 border border-gray-300">{item.supplier || '-'}</td>
                                    <td className="px-6 py-4 border border-gray-300 text-center">{item.current_stock || 0} {item.unit || 'Pcs'}</td>
                                    <td className="px-6 py-4 border border-gray-300 text-center">{item.min_stock || 0} {item.unit || 'Pcs'}</td>
                                    <td className="px-6 py-4 border border-gray-300">
                                        <div className="flex flex-col items-start">
                                            <span>Rp {Number(item.weighted_average_price || 0).toLocaleString('id-ID')}</span>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <span className="text-xs text-gray-500">
                                                    (Rata-rata {item.batch_count || 0} batch)
                                                </span>
                                                <button
                                                    onClick={() => setSelectedItemForBatches(item)}
                                                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                                                >
                                                    Lihat Batch
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 border border-gray-300 text-center">{getStatusBadge(item.stock_status || 'adequate')}</td>
                                    <td className="px-6 py-4 border border-gray-300">
                                        <div className="flex justify-center items-center space-x-2">
                                            <button onClick={() => handleRestock(item)} className="p-1 rounded-full hover:bg-blue-100 text-gray-500 hover:text-blue-600" title="Restock"><IconRestock /></button>
                                            <button onClick={() => handleAdjustmentClick(item)} className="p-1 rounded-full hover:bg-yellow-100 text-gray-500 hover:text-yellow-600" title="Adjustment"><IconAdjust /></button>
                                            <Link to={`/stock/history/${item.id}`} className="p-1 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-900" title="Riwayat"><IconHistory /></Link>
                                            <Link to={`/stock/edit/${item.id}`} className="p-1 rounded-full hover:bg-indigo-100 text-gray-500 hover:text-indigo-600" title="Edit"><IconEdit /></Link>
                                            <button onClick={() => handleDelete(item.id)} className="p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600" title="Delete"><IconDelete /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={7} className="text-center p-8 text-red-500">Error loading data</td></tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* --- Pagination --- */}
            <div className="py-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">
                    Total <span className="font-semibold">{totalItems}</span> item
                </span>
                <div className="flex items-center space-x-2">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || loading} className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white">
                        &larr; Sebelumnya
                    </button>
                    <span className="text-sm">
                        Halaman <span className="font-semibold">{currentPage}</span> dari <span className="font-semibold">{totalPages}</span>
                    </span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || loading} className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white">
                        Berikutnya &rarr;
                    </button>
                </div>
            </div>

            {/* --- Restock Modal --- */}
            {isRestockModalOpen && selectedItemForRestock && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Restock - {selectedItemForRestock.item_name}
                            </h3>
                            <form onSubmit={handleRestockSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Jumlah
                                    </label>
                                    <input
                                        type="number"
                                        value={restockData.quantity}
                                        onChange={(e) => setRestockData({...restockData, quantity: parseFloat(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Harga Satuan
                                    </label>
                                    <input
                                        type="number"
                                        value={restockData.unit_price}
                                        onChange={(e) => setRestockData({...restockData, unit_price: parseFloat(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Supplier
                                    </label>
                                    <input
                                        type="text"
                                        value={restockData.supplier}
                                        onChange={(e) => setRestockData({...restockData, supplier: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Catatan
                                    </label>
                                    <textarea
                                        value={restockData.notes}
                                        onChange={(e) => setRestockData({...restockData, notes: e.target.value})}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsRestockModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                                    >
                                        Restock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Batch Details Modal --- */}
            {selectedItemForBatches && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">
                                    Batch Details - {selectedItemForBatches.item_name}
                                </h3>
                                <button
                                    onClick={() => {
                                        setSelectedItemForBatches(null);
                                        setBatches([]);
                                        setBatchLoading(false);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {/* ✅ Debug Info Panel */}
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                                <p><strong>🔍 Debug Info:</strong></p>
                                <p>Item ID: {selectedItemForBatches.id}</p>
                                <p>Loading: {batchLoading ? 'Yes' : 'No'}</p>
                                <p>Batches array: {Array.isArray(batches) ? `Array with ${batches.length} items` : 'Not array'}</p>
                                <p>First batch: {batches[0] ? JSON.stringify(batches[0].batch_number) : 'None'}</p>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Beli</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga Beli</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Awal</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Sisa</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nilai Sisa</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {/* ✅ Enhanced Conditional Rendering */}
                                        {batchLoading ? (
                                            <tr>
                                                <td colSpan={7} className="text-center p-8 text-blue-600">
                                                    ⏳ Memuat data batch...
                                                </td>
                                            </tr>
                                        ) : !Array.isArray(batches) ? (
                                            <tr>
                                                <td colSpan={7} className="text-center p-8 text-red-600">
                                                    ❌ Error: Data format tidak valid
                                                </td>
                                            </tr>
                                        ) : batches.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center p-8 text-gray-500">
                                                    📦 Tidak ada data batch ditemukan
                                                </td>
                                            </tr>
                                        ) : (
                                            batches.map((batch) => (
                                                <tr key={batch.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                        {batch.batch_number}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        {new Date(batch.purchase_date).toLocaleDateString('id-ID')}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold text-green-600">
                                                        Rp {Number(batch.purchase_price).toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        {batch.initial_quantity} {selectedItemForBatches.unit}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        <span className={`font-semibold ${batch.remaining_quantity <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {batch.remaining_quantity} {selectedItemForBatches.unit}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold text-blue-600">
                                                        Rp {Number(batch.remaining_quantity * batch.purchase_price).toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {batch.supplier}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isAdjustmentModalOpen && selectedStockItem && (
                <StockAdjustmentModal isOpen={isAdjustmentModalOpen} onClose={handleCloseModal} item={selectedStockItem} />
            )}
        </div>
    );
};

export default StockManagementPage;
