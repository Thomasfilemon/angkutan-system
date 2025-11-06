import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axiosConfig';
import { toast } from 'react-toastify';
import CreatableSelect from 'react-select/creatable';

interface CashCategory {
  id: number;
  category_name: string;
  category_type: 'income' | 'expense';
  description?: string;
}

interface CashTransaction {
  id: number;
  transaction_type: 'debit_tempo' | 'kredit_tempo';
  category_id?: number;
  amount: number | string;
  description: string;
  reference_number?: string;
  transaction_date: string;
  created_at: string;
  running_balance?: number;
  category?: CashCategory;
  account: string;
  attachment_urls?: Array<string>;
  no_nota?: string[];
  date_nota?: string[];
  supplier?: string; // NEW: Added supplier field
  tanggal_jatuh_tempo?: string; // NEW: Added tanggal_jatuh_tempo field
}

interface RekapanTransaction extends CashTransaction {
  parsedDetails?: {
    mainDescription: string;
    transactions: Array<{
      id: number;
      type: string;
      description: string;
      amount: number;
      supplier?: string;
    }>;
  };
}

interface CashSummary {
  total_debit_tempo: number;
  total_kredit_tempo: number;
  saldo: number;
}

const TempoManagementPage = () => {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [categories, setCategories] = useState<CashCategory[]>([]);
  const [summary, setSummary] = useState<CashSummary>({
    total_debit_tempo: 0,
    total_kredit_tempo: 0,
    saldo: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpecialCategory, setIsSpecialCategory] = useState(false);
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    transaction_type: '',
    category_id: '',
    date_from: '',
    date_to: '',
    search: '',
    account: '', // Changed: account is now required, starts empty
    supplier: '',
  });
  const [selectedAccount, setSelectedAccount] = useState<string>(""); // New: track selected account for display

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [showModal, setShowModal] = useState(false);
  const [showTransactionTypeModal, setShowTransactionTypeModal] = useState(false);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [selectedNotaDetails, setSelectedNotaDetails] = useState<CashTransaction | null>(null);
  const [showRekapanModal, setShowRekapanModal] = useState(false);
  const [selectedRekapan, setSelectedRekapan] = useState<RekapanTransaction | null>(null);
  const [selectedTransactionType, setSelectedTransactionType] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
  const [formData, setFormData] = useState({
    transaction_type: 'debit_tempo' as 'debit_tempo' | 'kredit_tempo',
    category_id: '',
    amount: '',
    description: '',
    reference_number: '',
    account: 'General',
    transaction_date: new Date().toISOString().split('T')[0],
    no_nota: [''] as string[],
    date_nota: [''] as string[],
    supplier: '', // NEW: Added supplier to formData
    tanggal_jatuh_tempo: '', // NEW: Added tanggal_jatuh_tempo to formData
  });

  const [accounts, setAccounts] = useState<string[]>([]);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [showLunasiModal, setShowLunasiModal] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<CashTransaction[]>([]);
  const [selectedLunasiAccount, setSelectedLunasiAccount] = useState<string>('');
  const [net, setNet] = useState<number>(0);
  const [newType, setNewType] = useState<string>('');
  // Debounced search input to prevent immediate fetch
  const [searchInput, setSearchInput] = useState<string>('');
  const [supplierInput, setSupplierInput] = useState<string>('');
  const [typeInput, setTypeInput] = useState<string>('');
  const [categoryInput, setCategoryInput] = useState<string>('');
  const [dateFromInput, setDateFromInput] = useState<string>('');
  const [dateToInput, setDateToInput] = useState<string>('');
  const [accountInput, setAccountInput] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { setSearchInput(filters.search || ''); }, []);
  // Manual search only; trigger via button
  useEffect(() => {
    setSearchInput(filters.search || '');
    setSupplierInput(filters.supplier || '');
    setTypeInput(filters.transaction_type || '');
    setCategoryInput(filters.category_id || '');
    setDateFromInput(filters.date_from || '');
    setDateToInput(filters.date_to || '');
    setAccountInput(filters.account || '');
  }, []);

  const parseAmount = (amount: number | string): number => {
    if (typeof amount === 'string') {
      return parseFloat(amount.replace('.', '').replace(',', '.'));
    }
    return amount;
  };

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await apiClient.get('/cash/accounts');
        setAccounts(response.data.data || []);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      alert('Nama akun tidak boleh kosong!');
      return;
    }

    // Validate account name (max 20 chars)
    if (newAccountName.length > 20) {
      alert('Nama akun maksimal 20 karakter!');
      return;
    }

    // Check if account already exists
    if (accounts.includes(newAccountName.trim())) {
      alert('Akun dengan nama tersebut sudah ada!');
      return;
    }

    try {
      const transactionDate = new Date().toISOString().split('T')[0];
      const accountName = newAccountName.trim();

      // Create two transactions: debit_tempo 0.01 and kredit_tempo 0.01 to register the account
      // This ensures the account stays in the list even if one transaction is deleted
      // Net balance = 0, so it won't affect financial calculations

      // Create debit_tempo transaction
      const debitPayload = {
        transaction_type: 'debit_tempo',
        category_id: '',
        amount: '0.01',
        description: 'Inisialisasi Akun',
        reference_number: '',
        transaction_date: transactionDate,
        account: accountName,
        no_nota: [''],
        date_nota: [''],
      };

      const debitFormData = new FormData();
      Object.entries(debitPayload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v)) {
            debitFormData.append(k, JSON.stringify(v));
          } else {
            debitFormData.append(k, v.toString());
          }
        }
      });

      // Create kredit_tempo transaction
      const kreditPayload = {
        transaction_type: 'kredit_tempo',
        category_id: '',
        amount: '0.01',
        description: 'Inisialisasi Akun',
        reference_number: '',
        transaction_date: transactionDate,
        account: accountName,
        no_nota: [''],
        date_nota: [''],
      };

      const kreditFormData = new FormData();
      Object.entries(kreditPayload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v)) {
            kreditFormData.append(k, JSON.stringify(v));
          } else {
            kreditFormData.append(k, v.toString());
          }
        }
      });

      // Create both transactions
      await apiClient.post('/cash/transactions', debitFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await apiClient.post('/cash/transactions', kreditFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Refresh accounts list
      const accountsResponse = await apiClient.get('/cash/accounts');
      const accountsList = accountsResponse.data?.data || accountsResponse.data || [];
      setAccounts(accountsList);
      
      setNewAccountName('');
      setShowCreateAccountModal(false);
      alert('Akun berhasil dibuat!');
    } catch (err: any) {
      console.error('Failed to create account:', err);
      console.error('Error details:', err.response?.data);
      alert('Gagal membuat akun: ' + (err?.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    if (selectedTransactions.length > 0) {
      const sumDebit = selectedTransactions
        .filter(t => t.transaction_type === 'debit_tempo')
        .reduce((s, t) => s + parseAmount(t.amount), 0);
      const sumKredit = selectedTransactions
        .filter(t => t.transaction_type === 'kredit_tempo')
        .reduce((s, t) => s + parseAmount(t.amount), 0);
      const calculatedNet = sumDebit - sumKredit;
      const calculatedNewType = calculatedNet >= 0 ? 'debit' : 'kredit';
      setNet(calculatedNet);
      setNewType(calculatedNewType);

      const initialAccount = selectedTransactions.every(
        t => t.account === selectedTransactions[0].account
      )
        ? selectedTransactions[0].account
        : 'General';
      setSelectedLunasiAccount(initialAccount);
    }
  }, [selectedTransactions]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleLunasi = (transaction: CashTransaction) => {
    setSelectedTransactions([transaction]);
    setShowLunasiModal(true);
  };

  const handleLunasiSelected = () => {
    const sel = transactions.filter(t => selectedIds.has(t.id));
    if (sel.length === 0) return;
    setSelectedTransactions(sel);
    setShowLunasiModal(true);
  };

  const confirmLunasi = async () => {
    if (!selectedLunasiAccount) {
      toast.error('Silakan pilih akun');
      return;
    }

    try {
      const sumDebit = selectedTransactions
        .filter(t => t.transaction_type === 'debit_tempo')
        .reduce((s, t) => s + parseAmount(t.amount), 0);
      const sumKredit = selectedTransactions
        .filter(t => t.transaction_type === 'kredit_tempo')
        .reduce((s, t) => s + parseAmount(t.amount), 0);
      const calculatedNet = sumDebit - sumKredit;

      // If net is zero AND there are multiple transactions, just delete them.
      if (calculatedNet === 0 && selectedTransactions.length > 1) {
        for (const t of selectedTransactions) {
          await apiClient.delete(`/cash/transactions/${t.id}`);
        }
        toast.success('Transaksi tempo dilunasi (net zero, no new transaction created)');
      } else {
        // For single transactions OR non-zero net multiple transactions, create a new consolidated transaction.
        const isSingleSettlement = selectedTransactions.length === 1;
        const transaction = selectedTransactions[0];

        const netAmount = isSingleSettlement ? parseAmount(transaction.amount) : Math.abs(calculatedNet);
        const transactionType = (isSingleSettlement && transaction.transaction_type === 'debit_tempo') || (!isSingleSettlement && calculatedNet >= 0) ? 'debit' : 'kredit';

        const descriptionPrefix = isSingleSettlement ? 'Pelunasan:' : 'Pelunasan transaksi tempo:';

        const detailsDescription = selectedTransactions.map((t: any) => {
            const date = formatDate(t.transaction_date);
            const type = t.transaction_type === 'debit_tempo' ? 'Debit' : 'Kredit';
            const amount = formatCurrency(parseAmount(t.amount));

            if (isRekapan(t.description)) {
              const details = parseRekapanDetails(t.description);
              let recapString = `- ${date}: Rekapan Nota ${t.reference_number} (${type} ${amount})`;
              if (details.transactions.length > 0) {
                recapString += "\n  Detail Transaksi:\n";
                const subTransactions = details.transactions
                  .map((st: { type: string, description: string, amount: number, supplier?: string }) => `    - ${st.type || 'N/A'}: ${st.description} - ${formatCurrency(st.amount)} (Supplier: ${st.supplier || '-'})`)
                  .join('\n');
                recapString += subTransactions;
              }
              return recapString;
            } else {
              return `- ${date}: ${t.description} (${type} ${amount})`;
            }
        }).join('\n');
        
        const finalDescription = `${descriptionPrefix}\n${detailsDescription}`;

        const combinedAttachmentUrls = selectedTransactions.flatMap(t => t.attachment_urls || []);
        const combinedNoNota = selectedTransactions.flatMap(t => t.no_nota || []);
        const combinedDateNota = selectedTransactions.flatMap(t => t.date_nota || []);
        const combinedSuppliers = selectedTransactions.map(t => t.supplier || '').filter(s => s).join(', ');
        
        const submissionData = new FormData();
        submissionData.append('transaction_type', transactionType);
        submissionData.append('amount', netAmount.toString());
        submissionData.append('description', finalDescription);
        submissionData.append('transaction_date', new Date().toISOString().split('T')[0]);
        submissionData.append('account', selectedLunasiAccount);
        submissionData.append('attachment_urls', JSON.stringify(combinedAttachmentUrls));
        submissionData.append('no_nota', JSON.stringify(combinedNoNota));
        submissionData.append('date_nota', JSON.stringify(combinedDateNota));
        submissionData.append('supplier', combinedSuppliers);
        
        await apiClient.post('/cash/transactions', submissionData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        for (const t of selectedTransactions) {
          await apiClient.delete(`/cash/transactions/${t.id}`);
        }

        toast.success(isSingleSettlement ? 'Transaksi tempo berhasil dilunasi' : 'Transaksi tempo berhasil dilunasi dan digabung');
      }

      setShowLunasiModal(false);
      setSelectedTransactions([]);
      setSelectedLunasiAccount('');
      setSelectedIds(new Set());
      fetchTransactions();
    } catch (err) {
      console.error('Failed to lunasi transaction(s):', err);
      toast.error('Gagal melunasi transaksi');
    }
  };

  const fetchTransactions = useCallback(async () => {
    // Don't fetch if no account is selected
    if (!filters.account) {
      setLoading(false);
      setTransactions([]);
      setSummary({ total_debit_tempo: 0, total_kredit_tempo: 0, saldo: 0 });
      setPagination((prev) => ({ ...prev, total: 0 }));
      return;
    }

    try {
      setLoading(true);
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
      });

      const response = await apiClient.get(`/cash/tempo-transactions?${params}`, { signal: controller.signal });

      setTransactions(response.data.data || []);
      setSummary(
        response.data.summary || { total_debit_tempo: 0, total_kredit_tempo: 0, saldo: 0 }
      );
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0,
      }));
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setError('Failed to fetch tempo transactions.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/cash/categories');
      setCategories(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, [fetchTransactions, fetchCategories]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => handleAddFile(file));
    }
  };

  const handleAddFile = (file: File) => {
    setAttachmentFiles((prev) => [...prev, file]);
    setFormData((prev) => ({
      ...prev,
      no_nota: [...prev.no_nota, ''],
      date_nota: [...prev.date_nota, ''],
    }));
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = [...attachmentFiles];
    newFiles.splice(index, 1);
    setAttachmentFiles(newFiles);

    const newNotas = [...formData.no_nota];
    newNotas.splice(index, 1);
    const newDateNotas = [...formData.date_nota];
    newDateNotas.splice(index, 1);
    setFormData((prev) => ({ ...prev, no_nota: newNotas, date_nota: newDateNotas }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSpecialCategory) {
      setShowModal(false);
      if (formData.category_id === 'inventory_redirect') {
        navigate('/stock/create');
      } else {
        navigate('/services/create');
      }
      return;
    }

    const submissionData = new FormData();
    const parsedAmount = parseAmount(formData.amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Jumlah harus berupa angka yang valid dan lebih besar dari 0');
      return;
    }

    Object.entries({
      ...formData,
      amount: parsedAmount,
      supplier: formData.supplier || '', // NEW: Include supplier
      tanggal_jatuh_tempo: formData.tanggal_jatuh_tempo || '', // NEW: Include tanggal_jatuh_tempo
    }).forEach(([key, value]) => {
      if (key === 'no_nota' || key === 'date_nota') return;
      if (typeof value === 'string' || typeof value === 'number') {
        submissionData.append(key, value.toString());
      } else if (Array.isArray(value)) {
        submissionData.append(key, JSON.stringify(value));
      }
    });

    submissionData.append('no_nota', JSON.stringify(formData.no_nota));
    submissionData.append('date_nota', JSON.stringify(formData.date_nota));

    attachmentFiles.forEach((file) => {
      submissionData.append('attachments', file);
    });

    try {
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
      };

      if (editingTransaction) {
        await apiClient.put(`/cash/transactions/${editingTransaction.id}`, submissionData, config);
      } else {
        await apiClient.post('/cash/transactions', submissionData, config);
      }

      setShowModal(false);
      fetchTransactions();
    } catch (err) {
      console.error('Error saving transaction:', err);
      setError('Failed to save transaction.');
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, category_id: value }));
    setIsSpecialCategory(value === 'inventory_redirect' || value === 'service_redirect');
  };

  const handleEdit = (transaction: CashTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_type: transaction.transaction_type,
      category_id: transaction.category_id?.toString() || '',
      amount: transaction.amount.toString(),
      description: transaction.description,
      reference_number: transaction.reference_number || '',
      transaction_date: transaction.transaction_date,
      account: transaction.account || 'General',
      no_nota: Array.isArray(transaction.no_nota) && transaction.no_nota.length > 0 ? transaction.no_nota : [''],
      date_nota: Array.isArray(transaction.date_nota) && transaction.date_nota.length > 0 ? transaction.date_nota : [''],
      supplier: transaction.supplier || '', // NEW: Include supplier
      tanggal_jatuh_tempo: transaction.tanggal_jatuh_tempo || '', // NEW: Include tanggal_jatuh_tempo
    });
    setAttachmentFiles([]);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      return;
    }
    try {
      await apiClient.delete(`/cash/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Failed to delete transaction.');
    }
  };

  const handleShowNotaDetails = (transaction: CashTransaction) => {
    setSelectedNotaDetails(transaction);
    setShowNotaModal(true);
  };

  // Function to parse rekapan details from description field
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
      // Fallback to old format if JSON parsing fails
    }
    
    // Fallback: return empty structure
    return {
      mainDescription: "Rekapan Nota Tempo",
      transactions: []
    };
  };

  // Function to show rekapan details
  const handleShowRekapanDetails = (transaction: CashTransaction) => {
    const details = parseRekapanDetails(transaction.description || '');
    const rekapanTransaction: RekapanTransaction = {
      ...transaction,
      parsedDetails: details
    };
    setSelectedRekapan(rekapanTransaction);
    setShowRekapanModal(true);
  };

  const isRekapan = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      return !!parsed.transactionDetails;
    } catch (e) {
      return false;
    }
  }

  const resetForm = () => {
    setFormData({
      transaction_type: 'debit_tempo',
      category_id: '',
      amount: '',
      description: '',
      reference_number: '',
      account: 'General',
      transaction_date: new Date().toISOString().split('T')[0],
      no_nota: [''],
      date_nota: [''],
      supplier: '', // NEW: Reset supplier
      tanggal_jatuh_tempo: '', // NEW: Reset tanggal_jatuh_tempo
    });
    setAttachmentFiles([]);
    setIsSpecialCategory(false);
  };

  const handleTransactionTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTransactionTypeModal(false);
    if (selectedTransactionType === 'kas_normal') {
      resetForm();
      setEditingTransaction(null);
      setShowModal(true);
    } else if (selectedTransactionType === 'kas_stok_barang') {
      navigate('/stock/create');
    } else if (selectedTransactionType === 'kas_stok_ban') {
      navigate('/tire-inventory/create');
    } else if (selectedTransactionType === 'kas_servis') {
      navigate('/services/create');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) return <div className="text-center p-8">Loading tempo transactions...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Buku Tempo</h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowCreateAccountModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            title="Buat Akun Baru"
          >
            + Akun
          </button>
          <button
            onClick={() => navigate('/tempo/composer')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Tempo Composer
          </button>
          <button
            onClick={() => {
              setSelectedTransactionType('');
              setShowTransactionTypeModal(true);
            }}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            + Tambah Transaksi
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleLunasiSelected}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Lunasi Selected
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Account Selection View - Show if no account selected */}
      {!filters.account && (
        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Pilih Buku Tempo</h2>
          <p className="text-gray-600 mb-6">Pilih akun untuk melihat transaksi tempo dan mengelola buku tempo</p>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {accounts.map((account) => (
              <button
                key={account}
                onClick={() => {
                  setSelectedAccount(account);
                  setFilters((prev) => ({ ...prev, account }));
                  setAccountInput(account);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-lg p-6 text-center transition-all hover:shadow-md"
              >
                <div className="text-2xl mb-2">📖</div>
                <div className="font-semibold text-gray-800 text-lg">{account}</div>
                <div className="text-sm text-gray-500 mt-1">Buku Tempo</div>
              </button>
            ))}
            {accounts.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                Belum ada akun. Klik tombol "+ Akun" untuk membuat akun baru.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Show only when account is selected */}
      {filters.account && (
        <>
          {/* Account Header */}
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Buku Tempo: {selectedAccount || filters.account}</h2>
                <p className="text-sm text-gray-600 mt-1">Transaksi tempo untuk akun ini</p>
              </div>
              <button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, account: "" }));
                  setSelectedAccount("");
                  setAccountInput("");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
              >
                Ganti Akun
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-700">Total Debit Tempo</h3>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_debit_tempo)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-gray-700">Total Kredit Tempo</h3>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_kredit_tempo)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-lg font-medium text-gray-700">Saldo</h3>
          <p className={`text-2xl font-bold ${summary.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(summary.saldo)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <h3 className="text-lg font-semibold text-gray-700">Total Transaksi</h3>
          <p className="text-2xl font-bold text-gray-600">{pagination.total}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
            <select
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Semua Tipe</option>
              <option value="debit_tempo">Debit Tempo</option>
              <option value="kredit_tempo">Kredit Tempo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Pilih Kategori</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cari</label>
            <input
              type="text"
              placeholder="Deskripsi atau referensi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <input
              type="text"
              placeholder="Nama supplier..."
              value={supplierInput}
              onChange={(e) => setSupplierInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  transaction_type: typeInput,
                  category_id: categoryInput,
                  date_from: dateFromInput,
                  date_to: dateToInput,
                  search: searchInput,
                  supplier: supplierInput,
                  account: filters.account, // Keep current account
                }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
            >
              Search
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setFilters({
                transaction_type: '',
                category_id: '',
                date_from: '',
                date_to: '',
                search: '',
                account: filters.account, // Keep current account
                supplier: '',
              });
              // Clear queued local inputs as well
              setTypeInput('');
              setCategoryInput('');
              setDateFromInput('');
              setDateToInput('');
              setSearchInput('');
              setSupplierInput('');
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Reset Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                    onChange={(e) => {
                      const newSet = new Set<number>();
                      if (e.target.checked) {
                        transactions.forEach(t => newSet.add(t.id));
                      }
                      setSelectedIds(newSet);
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal Jatuh Tempo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  No. Nota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tgl Nota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit Tempo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kredit Tempo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akun
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const isTxnRekapan = isRekapan(transaction.description);
                return (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(transaction.id)}
                      onChange={() => toggleSelect(transaction.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(transaction.tanggal_jatuh_tempo || transaction.transaction_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.transaction_type === 'debit_tempo'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {transaction.transaction_type === 'debit_tempo' ? 'Debit Tempo' : 'Kredit Tempo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.category?.category_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const v = isTxnRekapan ? (transaction.reference_number || transaction.no_nota?.[0]) : (transaction.no_nota && transaction.no_nota[0]);
                      const hasDetails = isTxnRekapan || (transaction.no_nota?.length || transaction.date_nota?.length || transaction.attachment_urls?.length);
                      return hasDetails ? (
                        <button onClick={() => isTxnRekapan ? handleShowRekapanDetails(transaction) : handleShowNotaDetails(transaction)} className="text-blue-600 hover:underline">
                          {v || '-'}
                        </button>
                      ) : (v || '-');
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const d = transaction.date_nota && transaction.date_nota[0] ? formatDate(transaction.date_nota[0]) : (isTxnRekapan ? formatDate(transaction.transaction_date) : '-');
                      const hasDetails = isTxnRekapan || (transaction.no_nota?.length || transaction.date_nota?.length || transaction.attachment_urls?.length);
                      return hasDetails ? (
                        <button onClick={() => isTxnRekapan ? handleShowRekapanDetails(transaction) : handleShowNotaDetails(transaction)} className="text-blue-600 hover:underline">
                          {d}
                        </button>
                      ) : d;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div 
                        className={`font-medium ${isTxnRekapan ? 'cursor-pointer text-blue-600 hover:underline' : ''}`}
                        onClick={() => isTxnRekapan && handleShowRekapanDetails(transaction)}
                      >
                        {isTxnRekapan ? `Rekapan Nota ${transaction.reference_number}`: transaction.description}
                      </div>
                      {transaction.reference_number && (
                        <div className="text-xs text-gray-500">Ref: {transaction.reference_number}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.supplier || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {transaction.transaction_type === 'debit_tempo' ? (
                      <span className="text-green-600 font-medium">{formatCurrency(parseAmount(transaction.amount))}</span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {transaction.transaction_type === 'kredit_tempo' ? (
                      <span className="text-red-600 font-medium">{formatCurrency(parseAmount(transaction.amount))}</span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    {transaction.running_balance !== undefined ? (
                      <span className={transaction.running_balance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                        {formatCurrency(transaction.running_balance)}
                      </span>
                    ) : '-'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.account}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleLunasi(transaction)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Lunasi
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum Ada Transaksi Tempo</h3>
            <p className="text-gray-500 mb-4">Mulai dengan membuat transaksi tempo pertama Anda.</p>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))
                }
                disabled={pagination.page === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setPagination((prev) => ({ ...prev, page }))}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pagination.page === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {showTransactionTypeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Pilih Tipe Transaksi</h3>
              <form onSubmit={handleTransactionTypeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Transaksi *</label>
                  <select
                    value={selectedTransactionType}
                    onChange={(e) => setSelectedTransactionType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Pilih Tipe Transaksi</option>
                    <option value="kas_normal">Kas Normal</option>
                    <option value="kas_stok_barang">Kas Stok Barang</option>
                    <option value="kas_stok_ban">Kas Stok Ban</option>
                    <option value="kas_servis">Kas Servis</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTransactionTypeModal(false)}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Lanjutkan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTransaction ? 'Edit Transaksi Tempo' : 'Tambah Transaksi Tempo'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Akun *</label>
                  <CreatableSelect
                    value={{ label: formData.account, value: formData.account }}
                    options={accounts.map(account => ({ label: account, value: account }))}
                    onChange={(selected) => {
                      const newAccount = selected?.value || 'General';
                      setFormData(prev => ({ ...prev, account: newAccount }));
                    }}
                    onCreateOption={(inputValue) => {
                      setFormData(prev => ({ ...prev, account: inputValue }));
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Transaksi *</label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        transaction_type: e.target.value as 'debit_tempo' | 'kredit_tempo',
                        category_id: '',
                      }));
                      setIsSpecialCategory(false);
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="debit_tempo">Debit Tempo (Pemasukan)</option>
                    <option value="kredit_tempo">Kredit Tempo (Pengeluaran)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={formData.category_id}
                    onChange={handleCategoryChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories
                      .filter(
                        (cat) =>
                          (formData.transaction_type === 'debit_tempo' && cat.category_type === 'income') ||
                          (formData.transaction_type === 'kredit_tempo' && cat.category_type === 'expense')
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.category_name}
                        </option>
                      ))}
                    {formData.transaction_type === 'kredit_tempo' && (
                      <option value="inventory_redirect">Inventory (Pembelian Stok)</option>
                    )}
                    {formData.transaction_type === 'kredit_tempo' && (
                      <option value="service_redirect">Servis</option>
                    )}
                  </select>
                </div>
                {!isSpecialCategory && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
                      <input
                        type="text"
                        value={formData.supplier}
                        onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Masukkan nama toko (opsional)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Jatuh Tempo</label>
                      <input
                        type="date"
                        value={formData.tanggal_jatuh_tempo}
                        onChange={(e) => setFormData((prev) => ({ ...prev, tanggal_jatuh_tempo: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah *</label>
                      <input
                        type="text"
                        value={formData.amount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.,]/g, '');
                          setFormData((prev) => ({ ...prev, amount: value }));
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="0,00"
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi *</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        rows={3}
                        placeholder="Deskripsi transaksi..."
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Referensi</label>
                      <input
                        type="text"
                        value={formData.reference_number}
                        onChange={(e) => setFormData((prev) => ({ ...prev, reference_number: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Nomor referensi (opsional)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Transaksi *</label>
                      <input
                        type="date"
                        value={formData.transaction_date}
                        onChange={(e) => setFormData((prev) => ({ ...prev, transaction_date: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        required={!isSpecialCategory}
                      />
                    </div>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Upload Nota</label>
                      <div className="flex items-center space-x-2">
                        <input
                          id="fileInput"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('fileInput')?.click()}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
                        >
                          <span>+</span> <span className="ml-1">Tambah Nota</span>
                        </button>
                        {attachmentFiles.length > 0 && (
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Files</label>
                            <ul className="space-y-1">
                              {attachmentFiles.map((file, index) => (
                                <li key={index} className="text-sm text-gray-600 flex justify-between">
                                  <span>{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingTransaction?.attachment_urls && editingTransaction.attachment_urls.length > 0 && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Existing Files</label>
                        <ul className="space-y-1">
                          {editingTransaction.attachment_urls.map((url, index) => (
                            <li key={index}>
                              <a
                                href={`${process.env.REACT_APP_BACKEND_URL}/${url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                Nota {index + 1}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {attachmentFiles.length > 0 && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Files</label>
                        <ul className="space-y-1">
                          {attachmentFiles.map((file, index) => (
                            <li key={index} className="text-sm text-gray-600">
                              {file.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {formData.no_nota.map((nota, index) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. Nota {index + 1}
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={nota}
                        onChange={(e) => {
                          const newNotas = [...formData.no_nota];
                          newNotas[index] = e.target.value;
                          setFormData({ ...formData, no_nota: newNotas });
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Masukkan nomor nota"
                      />
                      <input
                        type="date"
                        value={formData.date_nota[index] || ''}
                        onChange={(e) => {
                          const newDateNotas = [...formData.date_nota];
                          newDateNotas[index] = e.target.value;
                          setFormData({ ...formData, date_nota: newDateNotas });
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Tanggal nota"
                      />
                    </div>
                  </div>
                ))}

                {isSpecialCategory && (
                  <div className="bg-blue-50 p-3 rounded-md text-blue-800">
                    {formData.category_id === 'inventory_redirect' ? (
                      <p>Anda akan diarahkan ke halaman pembelian stok</p>
                    ) : (
                      <p>Anda akan diarahkan ke halaman penjualan servis</p>
                    )}
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTransaction(null);
                      resetForm();
                    }}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    {editingTransaction ? 'Update' : 'Lanjutkan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showLunasiModal && selectedTransactions.length > 0 && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Lunasi {selectedTransactions.length > 1 ? 'Multiple ' : ''}Transaksi Tempo
              </h3>
              <div className="space-y-4">
                {selectedTransactions.length > 1 ? (
                  <>
                    <h4 className="font-semibold">Transaksi Terpilih:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {selectedTransactions.map(t => (
                        <li key={t.id}>
                          {formatDate(t.transaction_date)} - {t.description} - {t.transaction_type} {formatCurrency(parseAmount(t.amount))}
                        </li>
                      ))}
                    </ul>
                    <p>Total Debit Tempo: {formatCurrency(selectedTransactions
                      .filter(t => t.transaction_type === 'debit_tempo')
                      .reduce((s, t) => s + parseAmount(t.amount), 0))}</p>
                    <p>Total Kredit Tempo: {formatCurrency(selectedTransactions
                      .filter(t => t.transaction_type === 'kredit_tempo')
                      .reduce((s, t) => s + parseAmount(t.amount), 0))}</p>
                    <p>Net: {formatCurrency(net)}</p>
                    <p>Tipe Baru: {newType}</p>
                    <p>Jumlah Baru: {formatCurrency(Math.abs(net))}</p>
                  </>
                ) : (
                  <>
                    <p>Deskripsi: {selectedTransactions[0].description}</p>
                    <p>Jumlah: {formatCurrency(parseAmount(selectedTransactions[0].amount))}</p>
                    <p>Tipe saat ini: {selectedTransactions[0].transaction_type}</p>
                    <p>Tipe baru: {newType}</p>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Akun</label>
                  <CreatableSelect
                    value={{ label: selectedLunasiAccount, value: selectedLunasiAccount }}
                    options={accounts.map(account => ({ label: account, value: account }))}
                    onChange={(selected) => {
                      const newAccount = selected?.value || '';
                      setSelectedLunasiAccount(newAccount);
                    }}
                    onCreateOption={(inputValue) => {
                      setSelectedLunasiAccount(inputValue);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLunasiModal(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmLunasi}
                  disabled={!selectedLunasiAccount || (selectedTransactions.length > 1 && isNaN(net))}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  Lunasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotaModal && selectedNotaDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Detail Nota</h3>
              <div className="space-y-4">
                {(selectedNotaDetails.no_nota && selectedNotaDetails.no_nota.length > 0) || 
                 (selectedNotaDetails.date_nota && selectedNotaDetails.date_nota.length > 0) ? (
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
                        {selectedNotaDetails.no_nota && selectedNotaDetails.no_nota.map((nota, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {nota || '-'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {selectedNotaDetails.date_nota && selectedNotaDetails.date_nota[index] 
                                ? formatDate(selectedNotaDetails.date_nota[index]) 
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
                {selectedNotaDetails.attachment_urls && selectedNotaDetails.attachment_urls.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Attached Files</h4>
                    <ul className="space-y-2">
                      {selectedNotaDetails.attachment_urls.map((url, index) => (
                        <li key={index}>
                          <a
                            href={`${process.env.REACT_APP_BACKEND_URL}/${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12h2m0 0h-2m2 0v-2m0 2v2m-6-6h2m0 0h-2m2 0v-2m0 2v2m-6 6h2m0 0h-2m2 0v-2m0 2v2M12 3C8.134 3 5 6.134 5 10c0 2.506 1.42 4.668 3.5 5.799v4.701h7V15.8c2.08-1.132 3.5-3.294 3.5-5.8 0-3.866-3.134-7-7-7z" />
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

      {/* Rekapan Detail Modal */}
      {showRekapanModal && selectedRekapan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Detail Rekapan Nota Tempo</h2>
                <button
                  onClick={() => setShowRekapanModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Main Transaction Info */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">No. Nota</label>
                    <p className="text-lg font-semibold">{selectedRekapan.reference_number || selectedRekapan.no_nota?.[0] || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                    <p className="text-lg">{new Date(selectedRekapan.transaction_date).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="text-lg font-bold text-red-600">Rp {parseAmount(selectedRekapan.amount).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                {selectedRekapan.supplier && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700">Supplier</label>
                    <p className="text-lg">{selectedRekapan.supplier}</p>
                  </div>
                )}
                {selectedRekapan.tanggal_jatuh_tempo && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700">Tanggal Jatuh Tempo</label>
                    <p className="text-lg">{new Date(selectedRekapan.tanggal_jatuh_tempo).toLocaleDateString('id-ID')}</p>
                  </div>
                )}
              </div>

              {/* Transaction Details */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Detail Transaksi</h3>
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
                      {selectedRekapan.parsedDetails?.transactions
                        ?.filter((t: any) => t.type !== 'Stock Usage') // Filter out stock_usage from general stock recap
                        ?.map((transaction: any, index: number) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.id}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'Service' ? 'bg-blue-100 text-blue-800' :
                              transaction.type === 'Stock Purchase' ? 'bg-green-100 text-green-800' :
                              transaction.type === 'Stock Usage' ? 'bg-yellow-100 text-yellow-800' :
                              transaction.type === 'Tire Purchase' ? 'bg-purple-100 text-purple-800' :
                              transaction.type === 'Tempo' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.supplier || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            Rp {transaction.amount.toLocaleString('id-ID')}
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
                          Rp {parseAmount(selectedRekapan.amount).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRekapanModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Buat Akun Baru
                </h3>
                <button
                  onClick={() => {
                    setShowCreateAccountModal(false);
                    setNewAccountName('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Akun *
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Masukkan nama akun (max 20 karakter)"
                    maxLength={20}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {newAccountName.length}/20 karakter
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAccountModal(false);
                      setNewAccountName('');
                    }}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
                  >
                    Buat Akun
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TempoManagementPage