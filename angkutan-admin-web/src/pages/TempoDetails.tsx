import React, { useState, useEffect } from 'react';
import apiClient from '../api/axiosConfig';
import { toast } from 'react-toastify';

interface CashTransaction {
  no_nota: string[];
  date_nota: string[];
  description: string;
  transaction_date: string;
  account: string;
  reference_number?: string;
}

interface TempoDetail {
  id: number;
  due_date: string;
  store_name: string;
  amount: number;
  status: 'pending' | 'lunas';
  payment_date: string | null;
  payment_method: string | null;
  nota_attachment_url: string[] | null;
  created_at: string;
  updated_at: string;
  cashTransaction: CashTransaction;
}

const TempoDetails: React.FC = () => {
  const [tempoDetails, setTempoDetails] = useState<TempoDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [storeNameFilter, setStoreNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uniqueSuppliers, setUniqueSuppliers] = useState<string[]>([]);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [selectedNotaDetails, setSelectedNotaDetails] = useState<TempoDetail | null>(null);

  const isRekapan = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      return !!parsed.transactionDetails;
    } catch (e) {
      return false;
    }
  }

  const parseRekapanDetails = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      if (parsed.transactionDetails) {
        return {
          mainDescription: "Rekapan Nota Tempo",
          transactions: parsed.transactionDetails
        };
      }
    } catch (e) {
      // Fallback
    }
    return {
      mainDescription: "Rekapan Nota Tempo",
      transactions: []
    };
  };

  const fetchTempoDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/tempo-details', {
        params: {
          page,
          limit,
          search: search || undefined,
          store_name: storeNameFilter || undefined,
          status: statusFilter || undefined,
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log('Tempo Details Full Response:', response);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      const pagination = response.data.pagination || { total: data.length, totalPages: 1 };
      setTempoDetails(data);
      setTotal(pagination.total || data.length);
      setTotalPages(pagination.totalPages || 1);
    } catch (error: any) {
      console.error('Error fetching tempo details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      toast.error('Failed to fetch tempo details');
      setTempoDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUniqueSuppliers = async () => {
    try {
      const response = await apiClient.get('/tempo-details/unique-suppliers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log('Unique Suppliers Full Response:', response);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setUniqueSuppliers(['All', ...data]);
    } catch (error: any) {
      console.error('Error fetching unique suppliers:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      toast.error('Failed to fetch suppliers');
      setUniqueSuppliers(['All']);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this tempo detail?')) return;
    try {
      await apiClient.delete(`/tempo-details/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      toast.success('Tempo detail deleted successfully');
      fetchTempoDetails();
    } catch (error: any) {
      console.error('Error deleting tempo detail:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      toast.error('Failed to delete tempo detail');
    }
  };

  useEffect(() => {
    fetchTempoDetails();
    fetchUniqueSuppliers();
  }, [page, search, storeNameFilter, statusFilter]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStoreNameFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStoreNameFilter(e.target.value === 'All' ? '' : e.target.value);
    setPage(1);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value === 'All' ? '' : e.target.value);
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleShowNotaDetails = (detail: TempoDetail) => {
    setSelectedNotaDetails(detail);
    setShowNotaModal(true);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tempo Details Management</h1>

      {/* Filters and Search */}
      <div className="mb-4 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by store name or ID..."
          value={search}
          onChange={handleSearchChange}
          className="border p-2 rounded w-full md:w-1/3"
        />
        <select
          value={storeNameFilter || 'All'}
          onChange={handleStoreNameFilterChange}
          className="border p-2 rounded w-full md:w-1/4"
        >
          <option value="All">All Suppliers</option>
          {uniqueSuppliers.map((supplier) => (
            <option key={supplier} value={supplier}>
              {supplier}
            </option>
          ))}
        </select>
        <select
          value={statusFilter || 'All'}
          onChange={handleStatusFilterChange}
          className="border p-2 rounded w-full md:w-1/4"
        >
          <option value="All">All Status</option>
          <option value="pending">Pending</option>
          <option value="lunas">Lunas</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Due Date</th>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Payment Date</th>
              <th className="p-3 text-left">Payment Method</th>
              <th className="p-3 text-left">Nota</th>
              <th className="p-3 text-left">Created At</th>
              <th className="p-3 text-left">Updated At</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="p-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : tempoDetails.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-3 text-center">
                  No data available
                </td>
              </tr>
            ) : (
              tempoDetails.map((detail) => (
                <tr key={detail.id} className="border-t">
                  <td className="p-3">{detail.id}</td>
                  <td className="p-3">{formatDate(detail.due_date)}</td>
                  <td className="p-3">{detail.store_name}</td>
                  <td className="p-3">{formatCurrency(detail.amount)}</td>
                  <td className="p-3 capitalize">{detail.status}</td>
                  <td className="p-3">{formatDate(detail.payment_date)}</td>
                  <td className="p-3">{detail.payment_method || '-'}</td>
                  <td className="p-3">
                    {(detail.cashTransaction.no_nota && detail.cashTransaction.no_nota.length > 0 && detail.cashTransaction.no_nota.some(nota => nota)) ||
                    (detail.cashTransaction.date_nota && detail.cashTransaction.date_nota.length > 0 && detail.cashTransaction.date_nota.some(date => date)) ||
                    (detail.nota_attachment_url && detail.nota_attachment_url.length > 0) ? (
                      <button
                        onClick={() => handleShowNotaDetails(detail)}
                        className="text-blue-500 underline"
                      >
                        Details
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3">{formatDate(detail.created_at)}</td>
                  <td className="p-3">{formatDate(detail.updated_at)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(detail.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <p>
          Showing {tempoDetails.length} of {total} records
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Nota Details Modal */}
      {showNotaModal && selectedNotaDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Detail Nota</h3>
              <div className="space-y-4">
                {selectedNotaDetails.cashTransaction.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                    {isRekapan(selectedNotaDetails.cashTransaction.description) ? (
                      <div className="text-sm text-gray-800">
                        <p className="font-semibold mb-2">Rekapan Nota {selectedNotaDetails.cashTransaction.reference_number || ''}</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {parseRekapanDetails(selectedNotaDetails.cashTransaction.description).transactions.map((st: any, index: number) => (
                            <li key={index}>
                              {st.type || 'N/A'}: {st.description} - {formatCurrency(st.amount)} (Supplier: {st.supplier || '-'})
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedNotaDetails.cashTransaction.description}</p>
                    )}
                  </div>
                )}
                {(selectedNotaDetails.cashTransaction.no_nota && selectedNotaDetails.cashTransaction.no_nota.length > 0) ||
                (selectedNotaDetails.cashTransaction.date_nota && selectedNotaDetails.cashTransaction.date_nota.length > 0) ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Nota Details</h4>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            No. Nota
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tanggal Nota
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedNotaDetails.cashTransaction.no_nota.map((nota, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {nota || '-'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {selectedNotaDetails.cashTransaction.date_nota[index]
                                ? formatDate(selectedNotaDetails.cashTransaction.date_nota[index])
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Tidak ada nomor nota atau tanggal nota.</p>
                )}
                {selectedNotaDetails.nota_attachment_url && selectedNotaDetails.nota_attachment_url.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Attached Files</h4>
                    <ul className="space-y-2">
                      {selectedNotaDetails.nota_attachment_url.map((url, index) => (
                        <li key={index}>
                          <a
                            href={`${process.env.REACT_APP_BACKEND_URL}/${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center"
                          >
                            <svg
                              className="w-4 h-4 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12h2m0 0h-2m2 0v-2m0 2v2m-6-6h2m0 0h-2m2 0v-2m0 2v2m-6 6h2m0 0h-2m2 0v-2m0 2v2M12 3C8.134 3 5 6.134 5 10c0 2.506 1.42 4.668 3.5 5.799v4.701h7V15.8c2.08-1.132 3.5-3.294 3.5-5.8 0-3.866-3.134-7-7-7z"
                              />
                            </svg>
                            Nota {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Tidak ada file terlampir.</p>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowNotaModal(false)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TempoDetails;