// src/pages/Ritase/DOProfitabilityReport.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axiosConfig';
import TableSkeleton from '../../components/ui/TableSkeleton';
import toast from 'react-hot-toast';

// Define the structure of our report data from the API
interface ProfitabilityData {
  id: number;
  purchaseOrderId: number | null;
  doNumber: string;
  doName: string;
  customerName: string;
  load_location: string;
  unload_location: string;
  load_latitude?: number;
  load_longitude?: number;
  unload_latitude?: number;
  unload_longitude?: number;
  suratJalan: string;
  deliveryDate: string;
  vehicle: string;
  driverName: string;
  uangJalan: number;
  gaji: number;
  grossProfit: number;
  netProfit: number;
}

interface PurchaseOrderOption {
    id: number;
    po_number: string;
    customer_name: string;
}

interface AddressInfo {
    load: string;
    unload: string;
}

const ITEMS_PER_PAGE = 15;

const getAddressFromCoordinates = async (lat?: number, lon?: number): Promise<string> => {
    if (!lat || !lon) return "Address not available";
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        if (!response.ok) return "Failed to fetch address";
        const data = await response.json();
        return data.display_name || "Address not found";
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        return "Error fetching address";
    }
};

const DOProfitabilityReport: React.FC = () => {
  const [reportData, setReportData] = useState<ProfitabilityData[]>([]);
  const [poList, setPoList] = useState<PurchaseOrderOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Record<string, AddressInfo>>({});
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(true);
  
  // State for filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPo, setSelectedPo] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  const fetchAddresses = useCallback(async (data: ProfitabilityData[]) => {
    setIsAddressLoading(true);
    const addressPromises = data.map(async (item) => {
        const loadAddress = item.load_latitude && item.load_longitude 
            ? await getAddressFromCoordinates(item.load_latitude, item.load_longitude)
            : item.load_location || "Load address not set";

        const unloadAddress = item.unload_latitude && item.unload_longitude
            ? await getAddressFromCoordinates(item.unload_latitude, item.unload_longitude)
            : item.unload_location || "Unload address not set";
            
        return { id: item.id, addresses: { load: loadAddress, unload: unloadAddress } };
    });

    const resolvedAddresses = await Promise.all(addressPromises);
    const newAddresses = resolvedAddresses.reduce((acc, { id, addresses }) => {
        acc[id] = addresses;
        return acc;
    }, {} as Record<string, AddressInfo>);

    setAddresses(newAddresses);
    setIsAddressLoading(false);
  }, []);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/ritase/analytics/profitability');
        setReportData(response.data.reportData);
        setPoList(response.data.purchaseOrders);
        fetchAddresses(response.data.reportData);
        setError(null);
      } catch (err: any) {
        const errorMessage = 'Failed to fetch profitability report.';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReportData();
  }, [fetchAddresses]);

  const filteredData = useMemo(() => {
    return reportData.filter(item => {
        const poFilterMatch = selectedPo === 'all' ||
            (selectedPo === 'standalone' && item.purchaseOrderId === null) ||
            String(item.purchaseOrderId) === selectedPo;

        const searchTermMatch = searchTerm === '' ||
            item.doNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.doName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (addresses[item.id]?.load || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (addresses[item.id]?.unload || '').toLowerCase().includes(searchTerm.toLowerCase());

        return poFilterMatch && searchTermMatch;
    });
  }, [reportData, searchTerm, selectedPo, addresses]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

  const renderContent = () => {
    if (loading) return <TableSkeleton />;
    if (error) return <div className="text-center text-red-500 p-4">{error}</div>;
    if (reportData.length === 0) return <div className="text-center text-gray-500 p-4">No data available.</div>;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DO Number / Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi Muat / Bongkar</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver / Vehicle</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Uang Jalan</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gaji</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Profit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="font-medium text-gray-900">{item.doNumber}</div>
                    <div className="text-xs text-gray-500">{item.doName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(item.deliveryDate)}</td>
                <td className="px-6 py-4 whitespace-normal text-sm text-gray-600">
                    <div className="font-semibold">
                        <span className="text-xs text-gray-500">Muat: </span>
                        {isAddressLoading ? 'Loading...' : (addresses[item.id]?.load || 'N/A')}
                    </div>
                    <div className="mt-1">
                        <span className="text-xs text-gray-500">Bongkar: </span>
                        {isAddressLoading ? 'Loading...' : (addresses[item.id]?.unload || 'N/A')}
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div>{item.driverName}</div>
                    <div className="text-xs text-gray-500">{item.vehicle}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">{formatCurrency(item.uangJalan)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right">{formatCurrency(item.gaji)}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${item.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.grossProfit)}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${item.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(item.netProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h1 className="text-2xl font-bold">DO Profitability Report</h1>
                <p className="text-gray-600">Financial overview of each delivery order.</p>
            </div>
        </div>

        <div className="mb-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
            <input
                type="text"
                placeholder={isAddressLoading ? "Loading addresses..." : "Search by location, customer, driver..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isAddressLoading}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-200"
            />
            <select
                value={selectedPo}
                onChange={(e) => setSelectedPo(e.target.value)}
                disabled={isAddressLoading}
                className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-200"
            >
                <option value="all">All Purchase Orders</option>
                <option value="standalone">Standalone DO</option>
                {poList.map(po => (
                    <option key={po.id} value={po.id}>{po.po_number} - {po.customer_name}</option>
                ))}
            </select>
        </div>

        <div className="bg-white shadow-md rounded-lg">
            {renderContent()}
        </div>

        {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                        Previous
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                        Next
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default DOProfitabilityReport;
