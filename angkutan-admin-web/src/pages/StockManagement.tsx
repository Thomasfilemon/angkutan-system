import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import { debounce } from 'lodash';

// --- Enhanced Icon Collection ---
const IconHistory = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconAdjust = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m8-8h2M4 12H2m15.364 6.364l-1.414-1.414M6.05 6.05l-1.414-1.414m12.728 0l-1.414 1.414M6.05 17.95l-1.414 1.414" /></svg>;
const IconRestock = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 9a9 9 0 0114.65-4.65L20 5M20 15a9 9 0 01-14.65 4.65L4 19" /></svg>;
const IconEdit = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>;
const IconDelete = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
// ✅ NEW: Batch icon
const IconBatch = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;

// ✅ UPDATED: Interface to match FIFO system response
interface StockItem { 
    id: number; 
    item_code: string; 
    item_name: string; 
    supplier: string; 
    unit: string; 
    current_stock: number; 
    min_stock: number; 
    average_unit_price: number; // ✅ Changed from unit_price
    total_value: number; 
    stock_status: string; 
    is_low_stock: boolean; // ✅ Added
    batch_count?: number; // ✅ Added for batch info
    category?: { 
        category_name: string; 
    }; 
}

const StockManagementPage = () => {
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State untuk Filter dan Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    // State untuk modal
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

    // ✅ ENHANCED: Better error handling for FIFO system
    const fetchStockItems = useCallback(async (page = 1, search = '', startDate = '', endDate = '') => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '10', search });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            
            const response = await apiClient.get(`/stock?${params.toString()}`);
            
            console.log('Stock items response:', response.data); // Debug log
            
            // ✅ Handle both success response structure and direct data
            if (response.data?.data) {
                setStockItems(response.data.data);
                if (response.data.pagination) {
                    setTotalPages(response.data.pagination.totalPages);
                    setTotalItems(response.data.pagination.totalItems);
                    setCurrentPage(response.data.pagination.currentPage);
                } else {
                    // Fallback pagination
                    setTotalPages(1);
                    setTotalItems(response.data.data.length);
                    setCurrentPage(1);
                }
            } else {
                // Handle direct array response
                const items = Array.isArray(response.data) ? response.data : [];
                setStockItems(items);
                setTotalPages(1);
                setTotalItems(items.length);
                setCurrentPage(1);
            }
        } catch (err: any) {
            console.error('Error fetching stock items:', err);
            setError('Gagal memuat data stok');
            setStockItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

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
    
    // ✅ ENHANCED: Modal and action handlers
    const handleAdjustmentClick = (item: StockItem) => { 
        setSelectedStockItem(item); 
        setIsAdjustmentModalOpen(true); 
    };
    
    const handleCloseModal = () => { 
        setIsAdjustmentModalOpen(false); 
        setSelectedStockItem(null); 
        fetchStockItems(currentPage, searchTerm, dateRange.startDate, dateRange.endDate); 
    };

    // ✅ ENHANCED: Better delete handling
    const handleDelete = async (itemId: number) => {
        if(window.confirm('Anda yakin ingin menghapus item ini? Semua batch terkait akan ikut terhapus.')) {
            try {
                await apiClient.delete(`/stock/${itemId}`);
                alert('Item berhasil dihapus');
                fetchStockItems(currentPage, searchTerm, dateRange.startDate, dateRange.endDate);
            } catch(err: any) {
                console.error('Delete error:', err);
                alert(`Gagal menghapus item: ${err.response?.data?.message || err.message}`);
            }
        }
    };

    // ✅ ENHANCED: Better status badges
    const getStatusBadge = (status: string) => {
        const classes = { 
            adequate: 'bg-green-100 text-green-800', 
            low_stock: 'bg-yellow-100 text-yellow-800', 
            out_of_stock: 'bg-red-100 text-red-800' 
        };
        const labels = { 
            adequate: 'Cukup', 
            low_stock: 'Stok Rendah', 
            out_of_stock: 'Habis' 
        };
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Manajemen Stok FIFO</h1>
                    <p className="text-gray-600 mt-1">Sistem First In, First Out untuk pelacakan batch</p>
                </div>
                <Link to="/stock/create">
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow">
                        + Restok Barang
                    </button>
                </Link>
            </div>

            {/* Filter Bar */}
            <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <input 
                        type="text" 
                        placeholder="Cari nama atau kode barang..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="p-2 border rounded-md col-span-2" 
                    />
                    <input 
                        type="date" 
                        name="startDate" 
                        value={dateRange.startDate} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} 
                        className="p-2 border rounded-md" 
                    />
                    <input 
                        type="date" 
                        name="endDate" 
                        value={dateRange.endDate} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} 
                        className="p-2 border rounded-md" 
                    />
                    <button 
                        onClick={resetFilters} 
                        className="p-2 bg-gray-300 hover:bg-gray-400 rounded-md"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* ✅ ENHANCED: Stock Table with FIFO information */}
            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-200">
                        <tr>
                            <th scope="col" className="px-6 py-3 border border-gray-300">Nama Barang</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300">Supplier</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Stok Saat Ini</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Stok Min.</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300">Harga Rata-rata</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300">Total Nilai</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Status</th>
                            <th scope="col" className="px-6 py-3 border border-gray-300 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center p-8 text-gray-500">Memuat data...</td></tr>
                        ) : error ? (
                            <tr><td colSpan={8} className="text-center p-8 text-red-500">{error}</td></tr>
                        ) : stockItems.length === 0 ? (
                            <tr><td colSpan={8} className="text-center p-8 text-gray-500">Tidak ada data stok</td></tr>
                        ) : stockItems.map((item, index) => (
                            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 border border-gray-300 font-medium text-gray-900">
                                    <div>
                                        <div className="font-semibold">{item.item_name}</div>
                                        <div className="text-xs text-gray-500">
                                            {item.item_code || '-'}
                                            {item.category && (
                                                <span className="ml-2 px-1 bg-blue-100 text-blue-800 rounded">
                                                    {item.category.category_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 border border-gray-300">{item.supplier || '-'}</td>
                                <td className="px-6 py-4 border border-gray-300 text-center">
                                    <span className={`font-semibold ${
                                        item.current_stock <= 0 ? 'text-red-600' : 
                                        item.is_low_stock ? 'text-yellow-600' : 'text-green-600'
                                    }`}>
                                        {item.current_stock} {item.unit}
                                    </span>
                                </td>
                                <td className="px-6 py-4 border border-gray-300 text-center">{item.min_stock} {item.unit}</td>
                                <td className="px-6 py-4 border border-gray-300">
                                    Rp {Number(item.average_unit_price || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="px-6 py-4 border border-gray-300">
                                    <div>
                                        <div className="font-semibold">
                                            Rp {Number(item.total_value || 0).toLocaleString('id-ID')}
                                        </div>
                                        {item.batch_count && (
                                            <div className="text-xs text-gray-500">
                                                {item.batch_count} batch
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 border border-gray-300 text-center">
                                    {getStatusBadge(item.stock_status)}
                                </td>
                                <td className="px-6 py-4 border border-gray-300">
                                    {/* ✅ ENHANCED: Action buttons with batch navigation */}
                                    <div className="flex justify-center items-center space-x-1">
                                        <Link 
                                            to={`/stock/edit/${item.id}`}
                                            className="p-1 rounded-full hover:bg-blue-100 text-gray-500 hover:text-blue-600" 
                                            title="Restock Barang"
                                        >
                                            <IconRestock />
                                        </Link>
                                        <button 
                                            onClick={() => handleAdjustmentClick(item)} 
                                            className="p-1 rounded-full hover:bg-yellow-100 text-gray-500 hover:text-yellow-600" 
                                            title="Adjustment Stok"
                                        >
                                            <IconAdjust />
                                        </button>
                                        <Link 
                                            to={`/stock/${item.id}/batches`}
                                            onClick={() => console.log('🚀 Navigating to batches for item:', item.id)}
                                            className="p-1 rounded-full hover:bg-purple-100 text-gray-500 hover:text-purple-600" 
                                            title="Lihat Batches"
                                        >
                                            <IconBatch />
                                        </Link>
                                        <Link 
                                            to={`/stock/history/${item.id}`} 
                                            className="p-1 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-900" 
                                            title="Riwayat Transaksi"
                                        >
                                            <IconHistory />
                                        </Link>
                                        <Link 
                                            to={`/stock/edit/${item.id}`} 
                                            className="p-1 rounded-full hover:bg-indigo-100 text-gray-500 hover:text-indigo-600" 
                                            title="Edit Barang"
                                        >
                                            <IconEdit />
                                        </Link>
                                        <button 
                                            onClick={() => handleDelete(item.id)} 
                                            className="p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600" 
                                            title="Hapus Barang"
                                        >
                                            <IconDelete />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="py-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">
                    Total <span className="font-semibold">{totalItems}</span> item
                    {stockItems.filter(item => item.is_low_stock).length > 0 && (
                        <span className="ml-4 text-yellow-600">
                            • {stockItems.filter(item => item.is_low_stock).length} stok rendah
                        </span>
                    )}
                </span>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)} 
                        disabled={currentPage <= 1 || loading} 
                        className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white"
                    >
                        &larr; Sebelumnya
                    </button>
                    <span className="text-sm">
                        Halaman <span className="font-semibold">{currentPage}</span> dari <span className="font-semibold">{totalPages}</span>
                    </span>
                    <button 
                        onClick={() => handlePageChange(currentPage + 1)} 
                        disabled={currentPage >= totalPages || loading} 
                        className="px-3 py-1 border rounded-md disabled:opacity-50 bg-white"
                    >
                        Berikutnya &rarr;
                    </button>
                </div>
            </div>

            {/* FIFO Information Panel */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Informasi Sistem FIFO</h3>
                <p className="text-sm text-blue-700">
                    Sistem ini menggunakan metode First In, First Out (FIFO) untuk pelacakan stok dalam batch terpisah. 
                    Setiap pembelian dengan harga berbeda akan membuat batch baru, dan penggunaan stok akan mengambil dari batch terlama terlebih dahulu.
                </p>
            </div>

            {/* Stock Adjustment Modal */}
            {isAdjustmentModalOpen && selectedStockItem && (
                <StockAdjustmentModal 
                    isOpen={isAdjustmentModalOpen} 
                    onClose={handleCloseModal} 
                    item={selectedStockItem} 
                />
            )}
        </div>
    );
};

export default StockManagementPage;
