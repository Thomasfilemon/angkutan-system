// src/pages/StockBatches.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';

interface StockBatch {
    id: number;
    batch_number: string;
    quantity: string | number;        // ✅ Fixed: Handle both string and number types
    original_quantity: string | number; // ✅ Fixed: Handle both string and number types
    unit_price: number;
    purchase_date: string;
    supplier: string;
    notes: string;
}

interface StockItem {
    id: number;
    item_name: string;
    unit: string;
    current_stock: number;
}

const StockBatchesPage = () => {
    console.log('🔥 StockBatchesPage component mounted!');
    
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    console.log('📋 URL Parameter ID:', id);
    
    const [loading, setLoading] = useState(true);
    const [stockItem, setStockItem] = useState<StockItem | null>(null);
    const [batches, setBatches] = useState<StockBatch[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.log('🎯 useEffect triggered with ID:', id);
        if (id) {
            console.log('✅ About to fetch data for ID:', id);
            fetchStockItem();
            fetchBatches();
        } else {
            console.error('❌ ID is undefined in useEffect');
            setError('No item ID provided');
            setLoading(false);
        }
    }, [id]);

    const fetchStockItem = async () => {
        try {
            console.log('📦 Fetching stock item for ID:', id);
            const response = await apiClient.get(`/stock/${id}`);
            console.log('📦 Stock item response:', response.data);
            
            // ✅ Simplified: Use response.data directly since that's where your data is
            if (response.data && (response.data.id || response.data.item_name)) {
                setStockItem(response.data);
                console.log('📦 Stock item set successfully');
            } else {
                console.error('❌ Invalid stock item response structure');
                setError('Invalid stock item data received');
            }
            
        } catch (err: any) {
            console.error('Failed to fetch stock item:', err);
            setError(`Failed to fetch stock item: ${err.message}`);
        }
    };

    const fetchBatches = async () => {
        try {
            setError(null);
            console.log('Fetching batches for item ID:', id);
            
            const response = await apiClient.get(`/stock/${id}/batches`);
            console.log('Full API response:', response);
            
            // ✅ Enhanced response handling
            let batchData: StockBatch[] = [];
            if (Array.isArray(response.data)) {
                // Direct array response
                batchData = response.data;
                console.log('📊 Using direct array response');
            } else if (response.data?.success && Array.isArray(response.data?.data)) {
                // Structured response with success flag
                batchData = response.data.data;
                console.log('📊 Using structured response with success flag');
            } else if (response.data?.data && Array.isArray(response.data.data)) {
                // Alternative structured response
                batchData = response.data.data;
                console.log('📊 Using alternative structured response');
            } else {
                console.warn('Unexpected response structure:', response.data);
                setError('Unexpected response format from server');
                return;
            }
            
            console.log(`Setting ${batchData.length} batches:`, batchData);
            setBatches(batchData);
            
        } catch (err: any) {
            console.error('Failed to fetch batches:', err);
            console.error('Error response:', err.response?.data);
            setError(`Failed to fetch batches: ${err.message || 'Unknown error'}`);
            setBatches([]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Helper function to safely convert to number
    const toNumber = (value: string | number): number => {
        if (typeof value === 'number') return value;
        return parseFloat(value) || 0;
    };

    // ✅ Enhanced error handling
    if (error) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                    <h2 className="text-red-800 font-semibold">Error Loading Batches</h2>
                    <p className="text-red-700">{error}</p>
                    <div className="mt-4 space-x-2">
                        <button 
                            onClick={() => {
                                setError(null);
                                if (id) {
                                    fetchStockItem();
                                    fetchBatches();
                                }
                            }}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Retry
                        </button>
                        <button 
                            onClick={() => navigate('/stock')}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
                        >
                            Back to Stock
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading batch data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!stockItem) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                    <h2 className="text-yellow-800 font-semibold">Stock Item Not Found</h2>
                    <p className="text-yellow-700">The requested stock item could not be found.</p>
                    <button 
                        onClick={() => navigate('/stock')}
                        className="mt-4 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                    >
                        Back to Stock List
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            {/* ✅ Enhanced debug info - can be removed in production */}
            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p><strong>Debug Info:</strong></p>
                <p>Loading: {loading.toString()}</p>
                <p>Error: {error || 'None'}</p>
                <p>Stock Item: {stockItem ? 'Loaded' : 'Not loaded'}</p>
                <p>Stock Item Name: {stockItem?.item_name || 'N/A'}</p>
                <p>Batches Length: {batches.length}</p>
                <p>First Batch Quantity Type: {batches[0] ? typeof batches[0].quantity : 'N/A'}</p>
                <p>Batches Sample: {JSON.stringify(batches.slice(0, 1), null, 2)}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">FIFO Batches</h1>
                        <p className="text-gray-600">
                            {stockItem.item_name} - Current Stock: {stockItem.current_stock} {stockItem.unit}
                        </p>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => navigate(`/stock/history/${id}`)}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            View History
                        </button>
                        <button
                            onClick={() => navigate('/stock')}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Back to Stock
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="py-2 px-4 border-b text-left">Batch Number</th>
                                <th className="py-2 px-4 border-b text-left">Purchase Date</th>
                                <th className="py-2 px-4 border-b text-left">Original Qty</th>
                                <th className="py-2 px-4 border-b text-left">Current Qty</th>
                                <th className="py-2 px-4 border-b text-left">Used Qty</th>
                                <th className="py-2 px-4 border-b text-left">Unit Price</th>
                                <th className="py-2 px-4 border-b text-left">Current Value</th>
                                <th className="py-2 px-4 border-b text-left">Status</th>
                                <th className="py-2 px-4 border-b text-left">Supplier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-4 px-4 text-center text-gray-500">
                                        No batches found
                                    </td>
                                </tr>
                            ) : (
                                batches.map((batch) => {
                                    // ✅ Convert strings to numbers safely
                                    const currentQty = toNumber(batch.quantity);
                                    const originalQty = toNumber(batch.original_quantity);
                                    const usedQty = originalQty - currentQty;
                                    const usagePercentage = originalQty > 0 ? (usedQty / originalQty) * 100 : 0;
                                    
                                    return (
                                        <tr key={batch.id} className="hover:bg-gray-50">
                                            <td className="py-2 px-4 border-b">
                                                <span className="font-mono text-sm">{batch.batch_number}</span>
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                {new Date(batch.purchase_date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                {originalQty.toLocaleString('id-ID')} {stockItem.unit}
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                <span className={`font-semibold ${
                                                    currentQty > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {currentQty.toLocaleString('id-ID')} {stockItem.unit}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-red-600">
                                                        {usedQty.toLocaleString('id-ID')} {stockItem.unit}
                                                    </span>
                                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                                        <div 
                                                            className="bg-red-500 h-2 rounded-full" 
                                                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {usagePercentage.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                Rp {batch.unit_price.toLocaleString('id-ID')}
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                Rp {(currentQty * batch.unit_price).toLocaleString('id-ID')}
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    currentQty === 0 
                                                        ? 'bg-red-100 text-red-800' 
                                                        : currentQty === originalQty
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {currentQty === 0 ? 'Exhausted' : 
                                                     currentQty === originalQty ? 'Full' : 'Partial'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                {batch.supplier || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ✅ Enhanced summary section */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-semibold text-blue-800 mb-2">FIFO Information</h3>
                        <p className="text-sm text-blue-700">
                            Batches are sorted by purchase date (oldest first). When stock is deducted, 
                            the system automatically uses the oldest batches first (FIFO - First In, First Out).
                        </p>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-semibold text-green-800 mb-2">Batch Summary</h3>
                        <div className="text-sm text-green-700 space-y-1">
                            <p>Total Batches: <span className="font-semibold">{batches.length}</span></p>
                            <p>Active Batches: <span className="font-semibold">{batches.filter(b => toNumber(b.quantity) > 0).length}</span></p>
                            <p>Total Value: <span className="font-semibold">
                                Rp {batches.reduce((sum, batch) => sum + (toNumber(batch.quantity) * batch.unit_price), 0).toLocaleString('id-ID')}
                            </span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockBatchesPage;
