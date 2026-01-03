import React, { useState, useEffect } from 'react';
import apiClient from '../api/axiosConfig';
import toast from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';

interface CashTransaction {
  id?: number;
  no_nota?: string[];
  date_nota?: string[];
  description: string;
  transaction_date: string;
  account: string;
  reference_number?: string;
  supplier?: string;
  amount?: number;
  attachment_urls?: string[];
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
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalLunas, setTotalLunas] = useState(0);
  const [search, setSearch] = useState('');
  const [storeNameFilter, setStoreNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [uniqueSuppliers, setUniqueSuppliers] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [selectedNotaDetails, setSelectedNotaDetails] = useState<TempoDetail | null>(null);
  const [fetchedCashTransaction, setFetchedCashTransaction] = useState<CashTransaction | null>(null);
  const [loadingCashTransaction, setLoadingCashTransaction] = useState(false);
  
  // Selection state for bulk settlement
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Bulk settlement modal state
  const [showBulkSettlementModal, setShowBulkSettlementModal] = useState(false);
  const [settlementPaymentDate, setSettlementPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [settlementAccount, setSettlementAccount] = useState<string>('General');
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<string>('cash');

  const isRekapan = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      return !!parsed.transactionDetails;
    } catch (e) {
      return false;
    }
  }

  const parseRekapanDetails = (description: string) => {
    if (!description) {
      return {
        mainDescription: "Rekapan Nota Tempo",
        transactions: []
      };
    }

    // Try to parse JSON format (for rekapan nota)
    try {
      const parsed = JSON.parse(description);
      if (parsed.transactionDetails) {
        return {
          mainDescription: "Rekapan Nota Tempo",
          transactions: parsed.transactionDetails
        };
      }
    } catch (e) {
      // Fallback to text parsing
    }

    // Try to parse Pelunasan text block that contains 'Detail Transaksi'
    const detailsIdx = description.indexOf("Detail Transaksi");
    if (detailsIdx !== -1) {
      const section = description.slice(detailsIdx).split(/\r?\n/);
      const items: Array<{ id: number; type: string; description: string; amount: number; supplier?: string }> = [];
      let lineNo = 0;
      for (const raw of section) {
        const line = (raw || "").trim();
        if (!line.startsWith("-")) continue;
        // Extract amount (Rp 1.000.000,00 or Rp 1.000.000)
        const amountMatch = line.match(/Rp\s*([0-9\.\,]+)/i);
        const supplierMatch = line.match(/Supplier:\s*([^\)]+)/i);
        let amount = 0;
        if (amountMatch) {
          const num = amountMatch[1].replace(/\./g, "").replace(/,/g, ".");
          const parsed = parseFloat(num);
          if (!isNaN(parsed)) amount = parsed;
        }
        // Remove prefix '-' and amount and supplier to get description
        let descText = line.replace(/^-+\s*/, "");
        if (amountMatch) {
          descText = descText.replace(amountMatch[0], "").trim();
        }
        if (supplierMatch) {
          descText = descText.replace(supplierMatch[0], "").trim();
        }
        // Extract a 'type' prefix if present before ':'
        let type = "Item";
        const typeMatch = descText.match(/^([^:]+):\s*(.*)$/);
        if (typeMatch) {
          type = typeMatch[1].trim();
          descText = typeMatch[2].trim();
        }
        items.push({
          id: ++lineNo,
          type,
          description: descText,
          amount,
          supplier: supplierMatch ? supplierMatch[1].trim() : undefined,
        });
      }
      return {
        mainDescription: "Pelunasan",
        transactions: items,
      };
    }

    // Fallback: return empty structure
    return {
      mainDescription: "Rekapan Nota Tempo",
      transactions: []
    };
  };

  const isSettlementText = (description: string) => {
    if (!description) return false;
    return /Pelunasan/i.test(description) && /Detail Transaksi/i.test(description);
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
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          account: accountFilter || undefined,
        },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log('Tempo Details Full Response:', response);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      const pagination = response.data.pagination || { total: data.length, totalPages: 1 };
      setTempoDetails(data);
      setTotal(pagination.total || data.length);
      setTotalPages(pagination.totalPages || 1);
      setTotalAmount(response.data.totalAmount || 0);
      setTotalPending(response.data.totalPending || 0);
      setTotalLunas(response.data.totalLunas || 0);
    } catch (error: any) {
      console.error('Error fetching tempo details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      toast.error('Failed to fetch tempo details');
      setTempoDetails([]);
      setTotalAmount(0);
      setTotalPending(0);
      setTotalLunas(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, storeNameFilter, statusFilter, dateFrom, dateTo, accountFilter]);

  useEffect(() => {
    fetchUniqueSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await apiClient.get('/cash/accounts', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const accountsList = response.data?.data || response.data || [];
        setAccounts(['All', ...accountsList]);
      } catch (error: any) {
        console.error('Error fetching accounts:', error);
        setAccounts(['All']);
      }
    };
    fetchAccounts();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value === 'All' ? '' : e.target.value);
    setPage(1);
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFrom(e.target.value);
    setPage(1);
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateTo(e.target.value);
    setPage(1);
  };

  const handleAccountFilterChange = (selectedOption: any) => {
    setAccountFilter(selectedOption?.value === 'All' ? '' : (selectedOption?.value || ''));
    setPage(1);
  };

  const handleSupplierFilterChange = (selectedOption: any) => {
    setStoreNameFilter(selectedOption?.value === 'All' ? '' : (selectedOption?.value || ''));
    setPage(1);
  };

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingIds = tempoDetails
        .filter(d => d.status === 'pending')
        .map(d => d.id);
      setSelectedIds(new Set(pendingIds));
      setSelectAll(true);
    } else {
      setSelectedIds(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
      setSelectAll(false);
    }
    setSelectedIds(newSelected);
    
    // Update selectAll state based on current selection
    const pendingCount = tempoDetails.filter(d => d.status === 'pending').length;
    setSelectAll(newSelected.size === pendingCount && pendingCount > 0);
  };

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAll(false);
  }, [storeNameFilter, statusFilter, dateFrom, dateTo, accountFilter, search]);

  // Handle bulk settlement
  const handleBulkSettlement = async () => {
    if (selectedIds.size === 0) {
      toast.error('Pilih tagihan yang akan dilunasi terlebih dahulu');
      return;
    }

    if (!settlementPaymentDate) {
      toast.error('Pilih tanggal pembayaran');
      return;
    }

    if (!settlementAccount) {
      toast.error('Pilih akun pembayaran');
      return;
    }

    try {
      const idsArray = Array.from(selectedIds);
      console.log('Settling tempo details:', {
        tempo_detail_ids: idsArray,
        payment_date: settlementPaymentDate,
        payment_account: settlementAccount,
        payment_method: settlementPaymentMethod,
      });

      // Call backend API to settle selected tempo details
      const response = await apiClient.post('/tempo-details/bulk-settle', {
        tempo_detail_ids: idsArray,
        payment_date: settlementPaymentDate,
        payment_account: settlementAccount,
        payment_method: settlementPaymentMethod,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (response.data?.success) {
        toast.success(`Berhasil melunasi ${selectedIds.size} tagihan`);
        setShowBulkSettlementModal(false);
        setSelectedIds(new Set());
        setSelectAll(false);
        fetchTempoDetails();
      } else {
        toast.error('Gagal melunasi tagihan');
      }
    } catch (error: any) {
      console.error('Error settling tempo details:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.message || 'Gagal melunasi tagihan';
      toast.error(errorMessage);
    }
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

  const fetchCashTransactionForPending = async (detail: TempoDetail) => {
    // If we already have cashTransaction with description, use it
    if (detail.cashTransaction && detail.cashTransaction.description) {
      setFetchedCashTransaction(null);
      return;
    }

    setLoadingCashTransaction(true);
    
    // Priority 1: If we have cashTransaction ID, fetch it directly by ID
    if (detail.cashTransaction && detail.cashTransaction.id) {
      try {
        console.log('Fetching cash transaction by ID:', detail.cashTransaction.id);
        const response = await apiClient.get(`/cash/transactions/${detail.cashTransaction.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (response.data?.success && response.data?.data) {
          const tx = response.data.data;
          console.log('Fetched cash transaction:', tx.id, 'Description length:', tx.description?.length);
          if (tx.description) {
            setFetchedCashTransaction({
              id: tx.id,
              no_nota: tx.no_nota || [],
              date_nota: tx.date_nota || [],
              description: tx.description,
              transaction_date: tx.transaction_date,
              account: tx.account,
              reference_number: tx.reference_number,
              supplier: tx.supplier,
              amount: tx.amount,
              attachment_urls: tx.attachment_urls || [],
            });
            setLoadingCashTransaction(false);
            return;
          }
        }
      } catch (error: any) {
        console.error('Error fetching cash transaction by ID:', error);
      }
    }

    // Priority 2: Search in tempo-transactions endpoint
    try {
      console.log('Searching in tempo-transactions for:', detail.store_name, detail.amount);
      const searchParams = new URLSearchParams({
        page: '1',
        limit: '100',
        supplier: detail.store_name || '',
      });

      const response = await apiClient.get(`/cash/tempo-transactions?${searchParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const transactions = response.data?.data || [];
      console.log('Found tempo transactions:', transactions.length);
      
      // Find matching transaction by:
      // 1. Amount matches (within small tolerance) - most important
      // 2. Supplier matches
      // 3. Transaction type is tempo (debit_tempo or kredit_tempo)
      const matchingTransaction = transactions.find((tx: any) => {
        const amountMatch = Math.abs(parseFloat(tx.amount) - parseFloat(detail.amount.toString())) < 0.01;
        const supplierMatch = tx.supplier && detail.store_name && 
          tx.supplier.toLowerCase().includes(detail.store_name.toLowerCase());
        const isTempo = tx.transaction_type && (tx.transaction_type === 'debit_tempo' || tx.transaction_type === 'kredit_tempo');
        
        const matches = amountMatch && supplierMatch && isTempo;
        if (matches) {
          console.log('Found matching transaction:', tx.id, 'Description:', tx.description?.substring(0, 50));
        }
        return matches;
      });

      if (matchingTransaction && matchingTransaction.description) {
        console.log('Using matching transaction:', matchingTransaction.id);
        setFetchedCashTransaction({
          id: matchingTransaction.id,
          no_nota: matchingTransaction.no_nota || [],
          date_nota: matchingTransaction.date_nota || [],
          description: matchingTransaction.description,
          transaction_date: matchingTransaction.transaction_date,
          account: matchingTransaction.account,
          reference_number: matchingTransaction.reference_number,
          supplier: matchingTransaction.supplier,
          amount: matchingTransaction.amount,
          attachment_urls: matchingTransaction.attachment_urls || [],
        });
      } else {
        console.log('No matching transaction found with description');
        setFetchedCashTransaction(null);
      }
    } catch (error: any) {
      console.error('Error fetching tempo transaction:', error);
      setFetchedCashTransaction(null);
    } finally {
      setLoadingCashTransaction(false);
    }
  };

  const fetchCashTransactionForLunas = async (detail: TempoDetail) => {
    if (detail.cashTransaction) {
      setFetchedCashTransaction(null);
      return;
    }

    setLoadingCashTransaction(true);
    try {
      // Try multiple search strategies to find the cash transaction
      // Strategy 1: Search by supplier and "Pelunasan" keyword
      let searchParams = new URLSearchParams({
        page: '1',
        limit: '50',
        search: 'Pelunasan',
        supplier: detail.store_name || '',
      });

      let response = await apiClient.get(`/cash/transactions?${searchParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      let transactions = response.data?.data || [];
      
      // Find matching transaction by:
      // 1. Amount matches (within small tolerance) - most important
      // 2. Supplier matches
      // 3. Description contains "Pelunasan" and "Detail Transaksi"
      // 4. Payment date matches transaction date (if available)
      let matchingTransaction = transactions.find((tx: any) => {
        const amountMatch = Math.abs(parseFloat(tx.amount) - parseFloat(detail.amount.toString())) < 0.01;
        const supplierMatch = tx.supplier && detail.store_name && 
          tx.supplier.toLowerCase().includes(detail.store_name.toLowerCase());
        const hasPelunasan = tx.description && (
          /Pelunasan/i.test(tx.description) && /Detail Transaksi/i.test(tx.description)
        );
        const dateMatch = detail.payment_date && tx.transaction_date === detail.payment_date;
        
        // Must have amount match and (supplier match or pelunasan format)
        return amountMatch && (supplierMatch || hasPelunasan || dateMatch);
      });

      // Strategy 2: If not found, search by payment date and amount
      if (!matchingTransaction && detail.payment_date) {
        searchParams = new URLSearchParams({
          page: '1',
          limit: '50',
          date_from: detail.payment_date,
          date_to: detail.payment_date,
        });

        response = await apiClient.get(`/cash/transactions?${searchParams}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        transactions = response.data?.data || [];
        
        matchingTransaction = transactions.find((tx: any) => {
          const amountMatch = Math.abs(parseFloat(tx.amount) - parseFloat(detail.amount.toString())) < 0.01;
          const hasPelunasan = tx.description && /Pelunasan/i.test(tx.description);
          return amountMatch && hasPelunasan;
        });
      }

      if (matchingTransaction) {
        setFetchedCashTransaction({
          id: matchingTransaction.id,
          no_nota: matchingTransaction.no_nota || [],
          date_nota: matchingTransaction.date_nota || [],
          description: matchingTransaction.description,
          transaction_date: matchingTransaction.transaction_date,
          account: matchingTransaction.account,
          reference_number: matchingTransaction.reference_number,
          supplier: matchingTransaction.supplier,
          amount: matchingTransaction.amount,
          attachment_urls: matchingTransaction.attachment_urls || [],
        });
      } else {
        setFetchedCashTransaction(null);
      }
    } catch (error: any) {
      console.error('Error fetching cash transaction:', error);
      setFetchedCashTransaction(null);
    } finally {
      setLoadingCashTransaction(false);
    }
  };

  const handleShowNotaDetails = async (detail: TempoDetail) => {
    setSelectedNotaDetails(detail);
    setFetchedCashTransaction(null);
    setShowNotaModal(true);
    
    // If pending and no cashTransaction or no description, try to fetch from tempo transactions
    if (detail.status === 'pending' && (!detail.cashTransaction || !detail.cashTransaction.description)) {
      await fetchCashTransactionForPending(detail);
    }
    // If lunas and no cashTransaction, try to fetch it from cash transactions
    else if (detail.status === 'lunas' && !detail.cashTransaction) {
      await fetchCashTransactionForLunas(detail);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tempo Details Management</h1>

      {/* Filters and Search */}
      <div className="mb-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by store name or ID..."
            value={search}
            onChange={handleSearchChange}
            className="border p-2 rounded w-full md:w-1/3"
          />
          <div className="w-full md:w-1/4">
            <CreatableSelect
              value={storeNameFilter ? { label: storeNameFilter, value: storeNameFilter } : { label: 'All Suppliers', value: 'All' }}
              options={uniqueSuppliers.map((s) => ({ label: s, value: s }))}
              onChange={handleSupplierFilterChange}
              onCreateOption={(val) => {
                setStoreNameFilter(val.toUpperCase());
                setPage(1);
              }}
              isClearable
              isSearchable
              placeholder="Cari supplier..."
              className="text-sm"
            />
          </div>
          <div className="w-full md:w-1/4">
            <CreatableSelect
              value={accountFilter ? { label: accountFilter, value: accountFilter } : { label: 'All Accounts', value: 'All' }}
              options={accounts.map((a) => ({ label: a, value: a }))}
              onChange={handleAccountFilterChange}
              onCreateOption={(val) => {
                setAccountFilter(val);
                setPage(1);
              }}
              isClearable
              isSearchable
              placeholder="Pilih akun..."
              className="text-sm"
            />
          </div>
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal (Due Date)</label>
            <input
              type="date"
              value={dateFrom}
              onChange={handleDateFromChange}
              className="border p-2 rounded w-full"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal (Due Date)</label>
            <input
              type="date"
              value={dateTo}
              onChange={handleDateToChange}
              className="border p-2 rounded w-full"
            />
          </div>
        </div>
        
        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size} tagihan dipilih - Total: {formatCurrency(
                  tempoDetails
                    .filter(d => selectedIds.has(d.id))
                    .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0)
                )}
              </span>
              <button
                onClick={() => setShowBulkSettlementModal(true)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Lunasi Selected
              </button>
            </div>
          </div>
        )}
        
        {/* Total Amount Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Total Amount (Filtered):</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-gray-600 mt-1">Berdasarkan filter yang aktif</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Belum Lunas (Pending):</span>
            </div>
            <div className="text-2xl font-bold text-orange-700">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-gray-600 mt-1">Jumlah yang belum dibayar</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Lunas (Paid):</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalLunas)}</div>
            <p className="text-xs text-gray-600 mt-1">Jumlah yang sudah dibayar</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectAll && tempoDetails.filter(d => d.status === 'pending').length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4"
                />
              </th>
              <th className="p-3 text-left">No Nota</th>
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
                <td colSpan={12} className="p-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : tempoDetails.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-3 text-center">
                  No data available
                </td>
              </tr>
            ) : (
              [...tempoDetails]
                .sort((a, b) => {
                  const aPending = (a.status || "").toLowerCase() === "pending";
                  const bPending = (b.status || "").toLowerCase() === "pending";
                  if (aPending !== bPending) {
                    // Pending first
                    return aPending ? -1 : 1;
                  }
                  // Newest created_at first within same status
                  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                  return bTime - aTime;
                })
                .map((detail) => (
                <tr key={detail.id} className={`border-t ${selectedIds.has(detail.id) ? 'bg-blue-50' : ''}`}>
                  <td className="p-3">
                    {detail.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(detail.id)}
                        onChange={(e) => handleSelectItem(detail.id, e.target.checked)}
                        className="w-4 h-4"
                      />
                    )}
                  </td>
                  <td className="p-3">
                    {detail.cashTransaction?.reference_number ||
                      detail.cashTransaction?.no_nota?.[0] ||
                      '-'}
                  </td>
                  <td className="p-3">{formatDate(detail.due_date)}</td>
                  <td className="p-3">{detail.store_name}</td>
                  <td className="p-3">{formatCurrency(detail.amount)}</td>
                  <td className="p-3 capitalize">{detail.status}</td>
                  <td className="p-3">{formatDate(detail.payment_date)}</td>
                  <td className="p-3">{detail.payment_method || '-'}</td>
                  <td className="p-3">
                    {detail.cashTransaction || (detail.nota_attachment_url && detail.nota_attachment_url.length > 0) || detail.status === 'lunas' ? (
                      <button
                        onClick={() => handleShowNotaDetails(detail)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Lihat Detail
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Detail Nota Tempo</h2>
                <button
                  onClick={() => setShowNotaModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Main Transaction Info */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                {loadingCashTransaction && (
                  <div className="mb-4 text-center">
                    <p className="text-sm text-gray-600">
                      {selectedNotaDetails.status === 'pending' 
                        ? 'Memuat data dari Tempo Management...' 
                        : 'Memuat data dari Buku Kas...'}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">No. Nota</label>
                    <p className="text-lg font-semibold">
                      {(selectedNotaDetails.cashTransaction || fetchedCashTransaction)?.reference_number || 
                       (selectedNotaDetails.cashTransaction || fetchedCashTransaction)?.no_nota?.[0] || 
                       '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tanggal Transaksi</label>
                    <p className="text-lg">
                      {(selectedNotaDetails.cashTransaction || fetchedCashTransaction)?.transaction_date 
                        ? formatDate((selectedNotaDetails.cashTransaction || fetchedCashTransaction)!.transaction_date)
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(selectedNotaDetails.amount)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Supplier</label>
                    <p className="text-lg">{selectedNotaDetails.store_name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <p className="text-lg">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedNotaDetails.status === 'lunas' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {selectedNotaDetails.status === 'lunas' ? 'Lunas' : 'Pending'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Due Date</label>
                    <p className="text-lg">{formatDate(selectedNotaDetails.due_date)}</p>
                  </div>
                  {selectedNotaDetails.status === 'lunas' && selectedNotaDetails.payment_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Payment Date</label>
                      <p className="text-lg">{formatDate(selectedNotaDetails.payment_date)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Details */}
              {(() => {
                const cashTxn = selectedNotaDetails.cashTransaction || fetchedCashTransaction;
                const description = cashTxn?.description;
                
                // Debug logging
                console.log('Transaction Details Debug:', {
                  status: selectedNotaDetails.status,
                  hasCashTxn: !!selectedNotaDetails.cashTransaction,
                  cashTxnId: selectedNotaDetails.cashTransaction?.id,
                  cashTxnDescription: selectedNotaDetails.cashTransaction?.description?.substring(0, 100),
                  hasFetchedTxn: !!fetchedCashTransaction,
                  fetchedTxnId: fetchedCashTransaction?.id,
                  hasDescription: !!description,
                  descriptionLength: description?.length,
                  descriptionPreview: description?.substring(0, 200),
                  isRekapan: description ? isRekapan(description) : false,
                  isSettlement: description ? isSettlementText(description) : false,
                  parsedDetails: description ? parseRekapanDetails(description).transactions.length : 0,
                });
                
                if (!description) {
                  if (loadingCashTransaction) {
                    return (
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Detail Transaksi</h3>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-600">Memuat detail transaksi...</p>
                        </div>
                      </div>
                    );
                  }
                  // Show message if no description available
                  return (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Detail Transaksi</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600">Detail transaksi tidak tersedia</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Detail Transaksi</h3>
                    {(isRekapan(description) || isSettlementText(description)) ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {parseRekapanDetails(description).transactions
                              ?.map((transaction: any, index: number) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    transaction.type === 'Service' ? 'bg-blue-100 text-blue-800' :
                                    transaction.type === 'Stock Purchase' ? 'bg-green-100 text-green-800' :
                                    transaction.type === 'Stock Usage' ? 'bg-yellow-100 text-yellow-800' :
                                    transaction.type === 'Tire Purchase' ? 'bg-purple-100 text-purple-800' :
                                    transaction.type === 'Cash' ? 'bg-gray-100 text-gray-800' :
                                    transaction.type === 'Tempo' ? 'bg-orange-100 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {transaction.type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">{transaction.description}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{transaction.supplier || '-'}</td>
                                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                  {formatCurrency(typeof transaction.amount === 'number' ? transaction.amount : parseFloat(transaction.amount || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                Total:
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                                {formatCurrency(selectedNotaDetails.amount)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{description}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Nota Details */}
              {(() => {
                const cashTxn = selectedNotaDetails.cashTransaction || fetchedCashTransaction;
                const noNota = cashTxn?.no_nota;
                const dateNota = cashTxn?.date_nota;
                
                if (noNota && noNota.length > 0 && noNota.some(n => n)) {
                  return (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Nota Details</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                No. Nota
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tanggal Nota
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {noNota.map((nota, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {nota || '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {dateNota?.[index]
                                    ? formatDate(dateNota[index])
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Attached Files */}
              {(() => {
                const cashTxn = selectedNotaDetails.cashTransaction || fetchedCashTransaction;
                const attachmentUrls = cashTxn?.attachment_urls || selectedNotaDetails.nota_attachment_url;
                
                if (attachmentUrls && attachmentUrls.length > 0) {
                  return (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Attached Files</h3>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <ul className="space-y-2">
                          {attachmentUrls.map((url, index) => (
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
                    </div>
                  );
                }
                return null;
              })()}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowNotaModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Settlement Modal */}
      {showBulkSettlementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Lunasi Tagihan</h2>
                <button
                  onClick={() => {
                    setShowBulkSettlementModal(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    Akan melunasi <strong>{selectedIds.size} nota</strong> dengan total{' '}
                    <strong>{formatCurrency(
                      tempoDetails
                        .filter(d => selectedIds.has(d.id))
                        .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0)
                    )}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Pembayaran *
                  </label>
                  <input
                    type="date"
                    value={settlementPaymentDate}
                    onChange={(e) => setSettlementPaymentDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Akun Pembayaran *
                  </label>
                  <CreatableSelect
                    value={settlementAccount ? { label: settlementAccount, value: settlementAccount } : null}
                    options={accounts.filter(a => a !== 'All').map((a) => ({ label: a, value: a }))}
                    onChange={(sel) => setSettlementAccount(sel?.value || 'General')}
                    onCreateOption={(val) => setSettlementAccount(val)}
                    isSearchable
                    placeholder="Pilih akun..."
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={settlementPaymentMethod}
                    onChange={(e) => setSettlementPaymentMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                    <option value="check">Cek</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowBulkSettlementModal(false);
                  }}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                >
                  Batal
                </button>
                <button
                  onClick={handleBulkSettlement}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                >
                  Lunasi Selected
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