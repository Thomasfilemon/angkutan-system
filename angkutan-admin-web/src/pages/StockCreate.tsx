// src/pages/StockCreate.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CreatableSelect from 'react-select/creatable';
import apiClient from '../api/axiosConfig';

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
    rack_row?: number | null;
    rack_level?: number | null;
    current_stock: number;
    min_stock: number;
    unit_price: number;
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
    rack_row?: string;
    rack_level?: string;
    merk?: string; // NEW: Brand field
    current_stock: string;
    min_stock: string;
    unit_price: string;
    notes: string;
    isNew: boolean;
    adjustmentType: 'add' | 'deduct';
    adjustmentAmount: string;
    originalStock?: number;
    createNewBatch?: boolean; // NEW: Flag for creating new batch
}

// Helper functions to parse and save merk in notes as JSON
const parseNotesForMerk = (notes: string): { merk: string; otherNotes: string } => {
    if (!notes) return { merk: '', otherNotes: '' };
    try {
        const parsed = JSON.parse(notes);
        if (typeof parsed === 'object' && parsed !== null) {
            return { merk: parsed.merk || '', otherNotes: parsed.notes || parsed.otherNotes || '' };
        }
    } catch (e) {
        // Not JSON, treat as plain text
    }
    return { merk: '', otherNotes: notes };
};

const saveMerkToNotes = (merk: string, otherNotes: string): string => {
    if (!merk && !otherNotes) return '';
    const data: any = {};
    if (merk) data.merk = merk;
    if (otherNotes) data.notes = otherNotes;
    return JSON.stringify(data);
};

const StockCreatePage = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<StockCategory[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [formItems, setFormItems] = useState<FormItem[]>([{
        id: null,
        category_id: '',
        item_code: '',
        item_name: '',
        supplier: '',
        unit: 'Pcs',
        rack_row: '',
        rack_level: '',
        merk: '', // NEW: Brand field
        current_stock: '',
        min_stock: '',
        unit_price: '',
        notes: '',
        isNew: true,
        adjustmentType: 'add',
        adjustmentAmount: '0',
        originalStock: 0,
        createNewBatch: false
    }]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saveToCash, setSaveToCash] = useState(true);
    const [isTempo, setIsTempo] = useState(false);
    const [notaFile, setNotaFile] = useState<File | null>(null);
    // State declarations
    const [accounts, setAccounts] = useState<string[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('General');
    const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
    const [lastSupplier, setLastSupplier] = useState<string | null>(null);
    const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState('');

    // Fetch accounts
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

    const fetchSuppliers = async () => {
        try {
            const res = await apiClient.get('/stock/suppliers');
            // Our axios interceptor unwraps stock responses -> res.data is already the array
            const payload: unknown = res.data;
            const list: string[] = (Array.isArray(payload) ? payload : [])
                .map((s: unknown) => String(s).toUpperCase());
            const unique = Array.from(new Set(list));
            if (lastSupplier && !unique.includes(lastSupplier)) {
                unique.unshift(lastSupplier);
            } else if (lastSupplier) {
                const filtered = unique.filter(s => s !== lastSupplier);
                unique.splice(0, unique.length, lastSupplier, ...filtered);
            }
            setSupplierOptions(unique);
            if (!lastSupplier && unique.length > 0) {
                setLastSupplier(unique[0]);
            }
        } catch (e) {
            // ignore
        }
    };

    useEffect(() => {
        fetchCategories();
        fetchStockItems();
        fetchSuppliers();
        if (isEdit && id) {
            fetchStockItem();
        }
    }, [isEdit, id]);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await apiClient.get('/stock/categories');
            setCategories(response.data.data || response.data);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchStockItems = async () => {
        try {
            const response = await apiClient.get('/stock');
            setStockItems(response.data.data || []);
        } catch (err) {
            console.error('Failed to fetch stock items:', err);
        }
    };

    const fetchStockItem = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/stock/${id}`);
            const item = response.data.data;
            setFormItems([{
                id: item.id,
                category_id: item.category_id?.toString() || '',
                item_code: item.item_code || '',
                item_name: item.item_name || '',
                supplier: item.supplier || '',
                unit: item.unit || 'Pcs',
                rack_row: item.rack_row?.toString() || '',
                rack_level: item.rack_level?.toString() || '',
                merk: parseNotesForMerk(item.notes || '').merk, // Extract merk
                current_stock: item.current_stock?.toString() || '0',
                min_stock: item.min_stock?.toString() || '',
                unit_price: item.average_unit_price?.toString() || '',
                notes: parseNotesForMerk(item.notes || '').otherNotes, // Extract other notes
                isNew: false,
                adjustmentType: 'add',
                adjustmentAmount: '0',
                originalStock: item.current_stock || 0,
                createNewBatch: false
            }]);
        } catch (err) {
            console.error('Failed to fetch stock item:', err);
            alert('Failed to load stock item data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = () => {
        setFormItems([
            ...formItems,
            {
                id: null,
                category_id: '',
                item_code: '',
                item_name: '',
                supplier: lastSupplier || '',
                unit: 'Pcs',
                current_stock: '',
                min_stock: '',
                unit_price: '',
                notes: '',
                isNew: true,
                adjustmentType: 'add',
                adjustmentAmount: '0',
                originalStock: 0,
                createNewBatch: false
            }
        ]);
    };

    const handleRemoveItem = (index: number) => {
        if (formItems.length <= 1) return;
        const newItems = [...formItems];
        newItems.splice(index, 1);
        setFormItems(newItems);
    };

    const handleInputChange = (
        index: number,
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        const newItems = [...formItems];
        newItems[index] = { ...newItems[index], [name]: value };
        setFormItems(newItems);

        const errorKey = `${name}-${index}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const handleAdjustmentTypeChange = (index: number, type: 'add' | 'deduct') => {
        const newItems = [...formItems];
        newItems[index].adjustmentType = type;
        setFormItems(newItems);
    };

    const handleAdjustmentAmountChange = (index: number, value: string) => {
        const newItems = [...formItems];
        newItems[index].adjustmentAmount = value;
        setFormItems(newItems);

        const errorKey = `adjustmentAmount-${index}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const handleCreateNewBatchChange = (index: number, value: boolean) => {
        const newItems = [...formItems];
        newItems[index].createNewBatch = value;
        setFormItems(newItems);
    };

    const handleItemSelect = async (index: number, itemId: number | null) => {
    const newItems = [...formItems];
    if (itemId === null) {
            const emptyItem: FormItem = {
                id: null,
                category_id: '',
                item_code: '',
                item_name: '',
                supplier: '',
                unit: 'Pcs',
                rack_row: '',
                rack_level: '',
                merk: '',
                current_stock: '',
                min_stock: '',
                unit_price: '',
                notes: '',
                isNew: true,
                adjustmentType: 'add',
                adjustmentAmount: '0',
                originalStock: 0,
                createNewBatch: false
            };
            newItems[index] = emptyItem;
    } else {
        try {
            setLoading(true);
            console.log('Fetching stock item with ID:', itemId);
            
            const response = await apiClient.get(`/stock/${itemId}`);
            
            // ✅ Comprehensive debugging
            console.log('Full API Response:', response);
            console.log('Response Status:', response.status);
            console.log('Response Data:', response.data);
            console.log('Response Data Type:', typeof response.data);
            console.log('Response Data Keys:', response.data ? Object.keys(response.data) : 'No data');
            
            // ✅ Check for different possible response structures
            let selectedItem = null;
            
            if (response.data?.success && response.data?.data) {
                selectedItem = response.data.data;
                console.log('Using response.data.data:', selectedItem);
            } else if (response.data && !response.data.success) {
                selectedItem = response.data;
                console.log('Using response.data directly:', selectedItem);
            } else {
                console.error('Unexpected response structure:', response.data);
                throw new Error(`Unexpected API response structure. Status: ${response.status}`);
            }
            
            if (!selectedItem || !selectedItem.id) {
                console.error('Selected item is invalid:', selectedItem);
                throw new Error('Item data is missing or invalid');
            }
            
            console.log('Selected item details:', selectedItem);
            
            // Parse merk from notes
            const { merk, otherNotes } = parseNotesForMerk(selectedItem.notes || '');
            
            newItems[index] = {
                id: selectedItem.id,
                category_id: selectedItem.category_id?.toString() || '',
                item_code: selectedItem.item_code || '',
                item_name: selectedItem.item_name || '',
                supplier: selectedItem.supplier || '',
                unit: selectedItem.unit || 'Pcs',
                rack_row: selectedItem.rack_row?.toString() || '',
                rack_level: selectedItem.rack_level?.toString() || '',
                merk: merk, // Extract merk from notes
                current_stock: selectedItem.current_stock?.toString() || '0',
                min_stock: selectedItem.min_stock?.toString() || '',
                unit_price: (selectedItem.average_unit_price || selectedItem.unit_price)?.toString() || '',
                notes: otherNotes, // Store other notes separately
                isNew: false,
                adjustmentType: 'add',
                adjustmentAmount: '0',
                originalStock: selectedItem.current_stock || 0,
                createNewBatch: false
            };
            
            console.log('Form item updated successfully:', newItems[index]);
            
        } catch (err: any) {
            console.error('Failed to fetch item details:', err);
            console.error('Error response:', err.response?.data);
            console.error('Error status:', err.response?.status);
            console.error('Error message:', err.message);
            
            alert(`Gagal memuat detail barang: ${err.message || 'Unknown error'}\nCheck console for details.`);
        } finally {
            setLoading(false);
        }
    }
    setFormItems(newItems);
};


    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        formItems.forEach((item, index) => {
            if (!item.item_name.trim()) {
                newErrors[`item_name-${index}`] = 'Nama barang harus diisi';
                isValid = false;
            }

            if (!item.unit.trim()) {
                newErrors[`unit-${index}`] = 'Satuan harus diisi';
                isValid = false;
            }

            const adjustmentAmount = parseFloat(item.adjustmentAmount) || 0;
            if (adjustmentAmount <= 0) {
                newErrors[`adjustmentAmount-${index}`] = 'Jumlah penyesuaian harus lebih dari 0';
                isValid = false;
            }

            if (item.adjustmentType === 'deduct') {
                const currentStock = item.originalStock || 0;
                if (adjustmentAmount > currentStock) {
                    newErrors[`adjustmentAmount-${index}`] = 'Jumlah pengurangan tidak boleh melebihi stok saat ini';
                    isValid = false;
                }
            }

            if (item.min_stock && parseFloat(item.min_stock) < 0) {
                newErrors[`min_stock-${index}`] = 'Minimum stok tidak boleh negatif';
                isValid = false;
            }

            if (item.unit_price && parseFloat(item.unit_price) < 0) {
                newErrors[`unit_price-${index}`] = 'Harga tidak boleh negatif';
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setNotaFile(e.target.files[0]);
        } else {
            setNotaFile(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            let totalRestockCost = 0;
            let restockDescription = 'FIFO Batch Stock Update:\n';

            for (const formItem of formItems) {
                const adjustmentAmount = parseFloat(formItem.adjustmentAmount) || 0;
                
                if (formItem.isNew) {
                    const submitData = {
                        category_id: formItem.category_id ? parseInt(formItem.category_id) : null,
                        item_code: formItem.item_code,
                        item_name: formItem.item_name,
                        supplier: formItem.supplier,
                        unit: formItem.unit,
                        rack_row: formItem.rack_row ? parseInt(formItem.rack_row) : null,
                        rack_level: formItem.rack_level ? parseInt(formItem.rack_level) : null,
                        min_stock: parseFloat(formItem.min_stock) || 0,
                        unit_price: parseFloat(formItem.unit_price) || 0,
                        initial_stock: adjustmentAmount,
                        notes: saveMerkToNotes(formItem.merk || '', formItem.notes || '') // Save merk in notes as JSON
                    };

                    await apiClient.post('/stock', submitData);
                    
                    if (adjustmentAmount > 0) {
                        const unitPrice = parseFloat(formItem.unit_price) || 0;
                        const itemCost = adjustmentAmount * unitPrice;
                        totalRestockCost += itemCost;
                        restockDescription += `• ${formItem.item_name} +${adjustmentAmount} @${unitPrice.toLocaleString()} = ${itemCost.toLocaleString()} (New Item)\n`;
                    }
                } else {
                    const adjustData = {
                        itemId: formItem.id,
                        adjustmentType: formItem.adjustmentType,
                        quantity: adjustmentAmount,
                        unit_price: parseFloat(formItem.unit_price) || 0,
                        supplier: formItem.supplier,
                        notes: saveMerkToNotes(formItem.merk || '', formItem.notes || ''), // Save merk in notes as JSON
                        create_new_batch: formItem.createNewBatch || false
                    };

                    await apiClient.post('/stock/adjust', adjustData);

                    if (formItem.adjustmentType === 'add' && adjustmentAmount > 0) {
                        const unitPrice = parseFloat(formItem.unit_price) || 0;
                        const itemCost = adjustmentAmount * unitPrice;
                        totalRestockCost += itemCost;
                        const batchType = formItem.createNewBatch ? 'New Batch' : 'Add to Batch';
                        restockDescription += `• ${formItem.item_name} +${adjustmentAmount} @${unitPrice.toLocaleString()} = ${itemCost.toLocaleString()} (${batchType})\n`;
                    }
                }
            }

            if (totalRestockCost > 0 && saveToCash) {
                const transactionType = isTempo ? "kredit_tempo" : "kredit";
                restockDescription += `\nTotal Investment: ${totalRestockCost.toLocaleString()}`;

                // Combine suppliers from all items
                const combinedSuppliers = Array.from(
                    new Set(formItems.map(item => item.supplier).filter(Boolean))
                ).join(', ');
                
                const cashFormData = new FormData();
                cashFormData.append('transaction_type', transactionType);
                cashFormData.append('amount', String(totalRestockCost));
                cashFormData.append('description', restockDescription);
                cashFormData.append('transaction_date', new Date().toISOString());
                cashFormData.append('account', selectedAccount);
                cashFormData.append('no_nota', JSON.stringify([]));
                cashFormData.append('category_id', '9');
                // NEW: Add supplier and tanggal_jatuh_tempo fields
                cashFormData.append('supplier', combinedSuppliers);
                if (isTempo && tanggalJatuhTempo) {
                    cashFormData.append('tanggal_jatuh_tempo', tanggalJatuhTempo);
                }

                if (notaFile) {
                    cashFormData.append('attachments', notaFile);
                }

                await apiClient.post("/cash/transactions", cashFormData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            // After successful save, refresh suppliers so new supplier appears immediately
            await fetchSuppliers();

            navigate('/stock');

            // After successful save, refresh suppliers so new supplier appears immediately
            await fetchSuppliers();

            navigate('/stock');
        } catch (err: any) {
            console.error('Failed to save stock item:', err);
            if (err.response?.data?.errors) {
                alert(err.response.data.errors.join(', '));
            } else {
                alert('Gagal menyimpan data. Silakan coba lagi.');
            }
        } finally {
            setLoading(false);
        }
    };

    const calculateNewStock = (item: FormItem) => {
        const adjustmentAmount = parseFloat(item.adjustmentAmount) || 0;
        const originalStock = parseFloat(item.originalStock?.toString() || '0');

        if (item.isNew) {
            return item.adjustmentType === 'add' ? adjustmentAmount : 0;
        }

        return item.adjustmentType === 'add'
            ? originalStock + adjustmentAmount
            : Math.max(0, originalStock - adjustmentAmount);
    };

    if (loading && isEdit) {
        return <div className="container mx-auto p-4">Loading stock item data...</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold mb-4">
                    {isEdit ? 'Edit Barang Stok' : formItems.length > 1 ? 'Kelola Barang Stok' : 'Tambah Barang Stok'}
                </h1>
                <p className="text-gray-600 mb-6">
                    {isEdit
                        ? 'Ubah informasi barang stok dengan sistem FIFO batch'
                        : formItems.length > 1
                        ? 'Kelola beberapa barang sekaligus dengan sistem FIFO batch'
                        : 'Tambah barang baru ke dalam stok dengan sistem FIFO batch'}
                </p>

                <form onSubmit={handleSubmit}>
                    {formItems.map((item, index) => {
                        const newStock = calculateNewStock(item);
                        return (
                            <div key={index} className="mb-8 p-4 border rounded-lg bg-gray-50">
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
                                            Pilih Barang
                                        </label>
                                        <select
                                            value={item.id || ''}
                                            onChange={(e) => handleItemSelect(index, e.target.value ? parseInt(e.target.value) : null)}
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            disabled={loading}
                                        >
                                            <option value="">+ Tambah Barang Baru</option>
                                            {stockItems.map(stockItem => (
                                                <option key={stockItem.id} value={stockItem.id}>
                                                    {stockItem.item_name} (Stok: {stockItem.current_stock} {stockItem.unit})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Kategori
                                        </label>
                                        <select
                                            name="category_id"
                                            value={item.category_id}
                                            onChange={(e) => handleInputChange(index, e)}
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        >
                                            <option value="">Pilih Kategori</option>
                                            {categories.map(category => (
                                                <option key={category.id} value={category.id}>
                                                    {category.category_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Kode Barang (otomatis)
                                        </label>
                                        <input
                                            type="text"
                                            name="item_code"
                                            value={item.item_code}
                                            disabled
                                            placeholder="Akan dibuat otomatis saat menyimpan"
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-500 bg-gray-100 leading-tight focus:outline-none focus:shadow-outline"
                                        />
                                    </div>
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
                                            errors[`item_name-${index}`] ? 'border-red-500' : ''
                                        }`}
                                        required
                                    />
                                    {errors[`item_name-${index}`] && (
                                        <p className="text-red-500 text-xs italic">{errors[`item_name-${index}`]}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Supplier
                                        </label>
                                        <CreatableSelect
                                            value={item.supplier ? { label: item.supplier, value: item.supplier } : null}
                                            options={supplierOptions.map(s => ({ label: s, value: s }))}
                                            onChange={(selected) => {
                                                const newItems = [...formItems];
                                                const chosen = (selected?.value || '').toUpperCase();
                                                newItems[index].supplier = chosen;
                                                setFormItems(newItems);
                                                if (chosen) {
                                                    setLastSupplier(chosen);
                                                    // optimistic UI: keep it on top locally
                                                    setSupplierOptions(prev => {
                                                        const unique = Array.from(new Set([chosen, ...prev.map(s => s.toUpperCase())]));
                                                        return unique;
                                                    });
                                                }
                                            }}
                                            onCreateOption={(inputValue) => {
                                                const created = inputValue.toUpperCase();
                                                const newItems = [...formItems];
                                                newItems[index].supplier = created;
                                                setFormItems(newItems);
                                                if (!supplierOptions.includes(created)) {
                                                    setSupplierOptions([created, ...supplierOptions]);
                                                }
                                                setLastSupplier(created);
                                            }}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Merk
                                        </label>
                                        <input
                                            type="text"
                                            name="merk"
                                            value={item.merk || ''}
                                            onChange={(e) => handleInputChange(index, e)}
                                            placeholder="Masukkan merk/brand"
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Satuan *
                                        </label>
                                        <select
                                            name="unit"
                                            value={item.unit}
                                            onChange={(e) => handleInputChange(index, e)}
                                            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                                                errors[`unit-${index}`] ? 'border-red-500' : ''
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
                                            <p className="text-red-500 text-xs italic">{errors[`unit-${index}`]}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Rak lokasi: 4 baris x 5 tingkat */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rak - Baris (1-4)
                                        </label>
                                        <select
                                            name="rack_row"
                                            value={item.rack_row || ''}
                                            onChange={(e) => handleInputChange(index, e)}
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        >
                                            <option value="">Pilih Baris</option>
                                            {[1,2,3,4].map(v => (
                                                <option key={v} value={String(v)}>Baris {v}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Rak - Tingkat (1-5)
                                        </label>
                                        <select
                                            name="rack_level"
                                            value={item.rack_level || ''}
                                            onChange={(e) => handleInputChange(index, e)}
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        >
                                            <option value="">Pilih Tingkat</option>
                                            {[1,2,3,4,5].map(v => (
                                                <option key={v} value={String(v)}>Tingkat {v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Penyesuaian Stok
                                    </label>
                                    <div className="flex items-center space-x-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => handleAdjustmentTypeChange(index, 'add')}
                                            className={`px-3 py-1 rounded-l ${
                                                item.adjustmentType === 'add'
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-200 text-gray-700'
                                            }`}
                                        >
                                            Tambah
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAdjustmentTypeChange(index, 'deduct')}
                                            className={`px-3 py-1 rounded-r ${
                                                item.adjustmentType === 'deduct'
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-200 text-gray-700'
                                            }`}
                                        >
                                            Kurangi
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.adjustmentAmount}
                                        onChange={(e) => handleAdjustmentAmountChange(index, e.target.value)}
                                        placeholder="Jumlah"
                                        className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                                            errors[`adjustmentAmount-${index}`] ? 'border-red-500' : ''
                                        }`}
                                    />
                                    {errors[`adjustmentAmount-${index}`] && (
                                        <p className="text-red-500 text-xs italic">{errors[`adjustmentAmount-${index}`]}</p>
                                    )}
                                </div>

                                {!item.isNew && item.adjustmentType === 'add' && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Opsi Batch
                                        </label>
                                        <div className="flex items-center space-x-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.createNewBatch || false}
                                                    onChange={(e) => handleCreateNewBatchChange(index, e.target.checked)}
                                                    className="mr-2"
                                                />
                                                Buat batch baru (untuk harga berbeda)
                                            </label>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {item.createNewBatch 
                                                ? 'Akan membuat batch baru dengan harga yang berbeda'
                                                : 'Akan menambahkan ke batch yang sudah ada dengan harga yang sama'}
                                        </p>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Stok Baru
                                    </label>
                                    <div className="bg-gray-100 p-2 rounded">
                                        <span className="font-semibold">{newStock} {item.unit}</span>
                                        {!item.isNew && (
                                            <span className="text-gray-600 ml-2">(Sebelumnya: {item.originalStock})</span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                errors[`min_stock-${index}`] ? 'border-red-500' : ''
                                            }`}
                                        />
                                        {errors[`min_stock-${index}`] && (
                                            <p className="text-red-500 text-xs italic">{errors[`min_stock-${index}`]}</p>
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
                                                errors[`unit_price-${index}`] ? 'border-red-500' : ''
                                            }`}
                                        />
                                        {errors[`unit_price-${index}`] && (
                                            <p className="text-red-500 text-xs italic">{errors[`unit_price-${index}`]}</p>
                                        )}
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
                                        rows={4}
                                        placeholder="Catatan tambahan tentang barang ini..."
                                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {!isEdit && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="mb-6 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Tambah Barang Lain
                        </button>
                    )}

                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-semibold text-blue-800 mb-4">Pengaturan Buku Kas</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={saveToCash}
                                        onChange={(e) => setSaveToCash(e.target.checked)}
                                        className="form-checkbox h-5 w-5 text-blue-600"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700">Simpan ke Buku Kas</span>
                                </label>
                            </div>

                            {saveToCash && (
                                <>
                                    <div>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={isTempo}
                                                onChange={(e) => setIsTempo(e.target.checked)}
                                                className="form-checkbox h-5 w-5 text-blue-600"
                                            />
                                            <span className="ml-2 text-sm font-medium text-gray-700">Transaksi Tempo</span>
                                        </label>
                                    </div>

                                    {/* NEW: Tanggal Jatuh Tempo field */}
                                    {isTempo && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Tanggal Jatuh Tempo
                                            </label>
                                            <input
                                                type="date"
                                                value={tanggalJatuhTempo}
                                                onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Akun *</label>
                                        <CreatableSelect
                                            value={{ label: selectedAccount, value: selectedAccount }}
                                            options={accounts.map(account => ({ label: account, value: account }))}
                                            onChange={(selected) => {
                                                const newAccount = selected?.value || 'General';
                                                setSelectedAccount(newAccount);
                                            }}
                                            onCreateOption={(inputValue) => {
                                                setSelectedAccount(inputValue);
                                            }}
                                            className="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Foto Nota (Opsional)
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                        />
                                        {notaFile && (
                                            <p className="text-sm text-green-600 mt-1">File dipilih: {notaFile.name}</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => navigate('/stock')}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={loading}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={loading}
                        >
                            {loading
                                ? 'Menyimpan...'
                                : isEdit
                                ? 'Update Barang'
                                : formItems.length > 1
                                ? 'Simpan Semua Barang'
                                : 'Simpan Barang'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockCreatePage;