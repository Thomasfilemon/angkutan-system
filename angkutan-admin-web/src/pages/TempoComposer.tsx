import React, { useCallback, useEffect, useState } from "react";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";
import apiClient from "../api/axiosConfig";
import { createRecap, listRecaps, addItemToRecap } from "../api/recapApi";
import { createStockUsage, CreateStockUsagePayload } from "../api/stockUsageApi";

export default function TempoComposerPage() {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; category_name: string; category_type: "income" | "expense" }>>([]);
  useEffect(() => {
    apiClient.get("/cash/accounts").then((res) => setAccounts(res.data.data || [])).catch(() => {});
    apiClient.get("/cash/categories").then((res) => setCategories(res.data.data || [])).catch(() => {});
  }, []);

  const [recapNumber, setRecapNumber] = useState("");
  const [isTempo, setIsTempo] = useState(true); // Always tempo for this composer
  const [composerAccount, setComposerAccount] = useState("General");
  const [composerSupplier, setComposerSupplier] = useState("");
  const [composerDueDate, setComposerDueDate] = useState("");

  const ensureRecap = useCallback(async () => {
    try {
      if (recapNumber && recapNumber.trim()) {
        const res = await listRecaps({ page: 1, limit: 1, search: recapNumber });
        const found = (res?.data || []).find((r: any) => r.recap_number === recapNumber);
        if (found) return found;
      }
    } catch {}
    const created = await createRecap({ payment_mode: "tempo" });
    setRecapNumber(created.recap_number);
    return created;
  }, [recapNumber]);

  // Tempo-specific fields
  const [tempoType, setTempoType] = useState<"debit_tempo" | "kredit_tempo">("kredit_tempo");
  const [tempoCategoryId, setTempoCategoryId] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notaNumber, setNotaNumber] = useState("");
  const [notaDate, setNotaDate] = useState("");
  const [tempoFiles, setTempoFiles] = useState<File[]>([]);

  // Rekapan detail modal state
  const [showRekapanModal, setShowRekapanModal] = useState(false);
  const [selectedRekapan, setSelectedRekapan] = useState<any>(null);

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
  const showRekapanDetails = (transaction: any) => {
    const details = parseRekapanDetails(transaction.description || '');
    setSelectedRekapan({
      ...transaction,
      parsedDetails: details
    });
    setShowRekapanModal(true);
  };

  // Helper to create a tempo transaction with provided fields
  const createTempoTransaction = useCallback(async (opts: {
    transactionType: "debit_tempo" | "kredit_tempo";
    categoryId?: string;
    amount: number;
    description: string;
    referenceNumber?: string;
    notaNumber?: string;
    notaDate?: string;
    files?: File[];
  }) => {
    const formData = new FormData();
    formData.append("transaction_type", opts.transactionType);
    formData.append("amount", opts.amount.toString());
    formData.append("description", opts.description);
    formData.append("account", composerAccount);
    formData.append("transaction_date", new Date().toISOString().split("T")[0]);
    
    if (opts.categoryId) formData.append("category_id", opts.categoryId);
    if (opts.referenceNumber) formData.append("reference_number", opts.referenceNumber);
    if (opts.notaNumber) formData.append("no_nota", JSON.stringify([opts.notaNumber]));
    if (opts.notaDate) formData.append("date_nota", JSON.stringify([opts.notaDate]));
    if (composerSupplier) formData.append("supplier", composerSupplier);
    if (composerDueDate) formData.append("tanggal_jatuh_tempo", composerDueDate);

    if (opts.files && opts.files.length > 0) {
      opts.files.forEach((file) => {
        formData.append("attachments", file);
      });
    }

    const response = await apiClient.post("/cash/transactions", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
  }, [composerAccount, composerSupplier, composerDueDate]);

  // Queue states
  const [queuedUsages, setQueuedUsages] = useState<Array<{ vehicleId: string; itemId: string; itemName: string; itemUnit: string; qty: string; unitPrice?: string; description: string }>>([]);
  const [queuedStockAdds, setQueuedStockAdds] = useState<Array<{ itemId: string; itemName: string; itemUnit: string; qty: string; unitPrice: string; createNewBatch: boolean; description: string }>>([]);
  const [queuedTirePurchases, setQueuedTirePurchases] = useState<Array<{ brand: string; size: string; type: string; condition: string; qty: string; unitPrice: string; date: string; description: string }>>([]);
  const [queuedServices, setQueuedServices] = useState<Array<{ vehicleId: string; serviceDate: string; serviceType: string; workshopName: string; laborCost: string; description: string }>>([]);
  const [queuedTempo, setQueuedTempo] = useState<Array<{ tempoType: "debit_tempo" | "kredit_tempo"; categoryId: string; amount: string; referenceNumber?: string; notaNumber?: string; notaDate?: string; description: string; files: File[] }>>([]);

  // Form states for each section
  const [vehicles, setVehicles] = useState<Array<{ id: number; license_plate: string }>>([]);
  const [stockItems, setStockItems] = useState<Array<{ id: number; item_name: string; unit: string; current_stock: number; average_unit_price: number }>>([]);
  const [tireInventory, setTireInventory] = useState<Array<{ id: number; tire_brand: string; tire_size: string; tire_type: string; current_stock: number; unit_price: number }>>([]);

  // Usage form
  const [usageVehicleId, setUsageVehicleId] = useState("");
  const [usageItemId, setUsageItemId] = useState("");
  const [usageItemName, setUsageItemName] = useState("");
  const [usageItemUnit, setUsageItemUnit] = useState("");
  const [usageQty, setUsageQty] = useState("");
  const [usageUnitPrice, setUsageUnitPrice] = useState("");
  const [usageDescription, setUsageDescription] = useState("");

  // Stock add form
  const [stockItemId, setStockItemId] = useState("");
  const [stockItemName, setStockItemName] = useState("");
  const [stockItemUnit, setStockItemUnit] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockUnitPrice, setStockUnitPrice] = useState("");
  const [stockCreateNewBatch, setStockCreateNewBatch] = useState(false);
  const [stockDescription, setStockDescription] = useState("");

  // Tire purchase form
  const [tireBrand, setTireBrand] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [tireType, setTireType] = useState("");
  const [tireCondition, setTireCondition] = useState("");
  const [tireQty, setTireQty] = useState("");
  const [tireUnitPrice, setTireUnitPrice] = useState("");
  const [tireDate, setTireDate] = useState("");
  const [tireDescription, setTireDescription] = useState("");

  // Service form
  const [serviceVehicleId, setServiceVehicleId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");

  // Tempo form
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await apiClient.get("/vehicles", { params: { page: 1, limit: 200 } });
        const body = res?.data;
        const list = Array.isArray(body) ? body : (body?.data || body?.records || []);
        setVehicles((list || []).map((v: any) => ({ id: v.id, license_plate: v.license_plate })));
      } catch {}
    };
    const fetchStockItems = async () => {
      try {
        const res = await apiClient.get("/stock");
        setStockItems(res.data.data || []);
      } catch {}
    };
    const fetchTireInventory = async () => {
      try {
        const res = await apiClient.get("/tires/tire-inventory");
        setTireInventory(res.data.data || []);
      } catch {}
    };
    fetchVehicles();
    fetchStockItems();
    fetchTireInventory();
  }, []);

  const queueStockUsage = () => {
    if (!usageVehicleId || !usageQty) return toast.error("Kendaraan dan jumlah wajib");
    setQueuedUsages((prev) => [...prev, { vehicleId: usageVehicleId, itemId: usageItemId, itemName: usageItemName, itemUnit: usageItemUnit, qty: usageQty, unitPrice: usageUnitPrice, description: usageDescription }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveStockUsage = async () => {
    if (queuedUsages.length === 0) return;
    try {
      const recap = await ensureRecap();
      for (const u of queuedUsages) {
        const q = parseFloat(u.qty || "0");
        if (!(q > 0)) continue;
        const payload: CreateStockUsagePayload = {
          vehicle_id: parseInt(u.vehicleId, 10),
          usage_date: new Date().toISOString().split("T")[0],
          notes: u.description || `Tempo Composer: ${u.itemName || "Item"}`,
          items: [ { item_id: u.itemId ? parseInt(u.itemId, 10) : undefined, item_name: u.itemName || undefined, unit: u.itemUnit, quantity: q, unit_price: u.unitPrice ? parseFloat(u.unitPrice) : undefined } ],
          recap_number: recap.recap_number,
          cash_options: { create_cash: true, is_tempo: true, account: composerAccount, supplier: composerSupplier || undefined, due_date: composerDueDate || undefined },
        };
        await createStockUsage(payload);
      }
      setQueuedUsages([]);
      toast.success("Semua penggunaan stok berhasil disimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan penggunaan stok");
    }
  };

  const queueStockAdd = () => {
    if (!stockQty || !stockUnitPrice) return toast.error("Jumlah dan harga wajib");
    setQueuedStockAdds((prev) => [...prev, { itemId: stockItemId, itemName: stockItemName, itemUnit: stockItemUnit, qty: stockQty, unitPrice: stockUnitPrice, createNewBatch: stockCreateNewBatch, description: stockDescription }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveStockAdd = async () => {
    if (queuedStockAdds.length === 0) return;
    try {
      const recap = await ensureRecap();
      for (const s of queuedStockAdds) {
        const q = parseFloat(s.qty || "0");
        const p = parseFloat(s.unitPrice || "0");
        if (!(q > 0)) continue;
        let targetItemId = s.itemId ? parseInt(s.itemId, 10) : undefined;
        if (!targetItemId && !s.itemName) continue;
        if (!targetItemId) {
          const createRes = await apiClient.post("/stock", { 
            item_name: s.itemName, 
            unit: s.itemUnit, 
            min_stock: 0,
            initial_stock: q,
            unit_price: p,
            supplier: composerSupplier || undefined,
            notes: s.description || `Initial stock creation for ${s.itemName}`
          });
          targetItemId = createRes.data?.data?.id || createRes.data?.id;
        } else {
          await apiClient.post("/stock/adjust", { itemId: targetItemId, adjustmentType: "add", quantity: q, unit_price: p, supplier: composerSupplier || undefined, create_new_batch: s.createNewBatch, notes: s.description || `Tambah stok ${s.itemName || targetItemId}` });
        }
        if (p > 0) {
          const desc = s.description || `Pembelian stok ${s.itemName || targetItemId}`;
          const cash = await createTempoTransaction({ transactionType: "kredit_tempo", categoryId: tempoCategoryId || undefined, amount: q * p, description: desc, referenceNumber });
          await addItemToRecap(recap.id, { type: "cash", reference_id: cash.id, description: cash.description, amount: cash.amount } as any);
        }
        await addItemToRecap(recap.id, { type: "stock", reference_id: targetItemId!, description: s.description || `Stok masuk`, amount: q * p } as any);
      }
      setQueuedStockAdds([]);
      toast.success("Semua penambahan stok berhasil disimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan penambahan stok");
    }
  };

  const queueTirePurchase = () => {
    if (!tireBrand || !tireSize || !tireQty || !tireUnitPrice) return toast.error("Brand, ukuran, jumlah, dan harga wajib");
    setQueuedTirePurchases((prev) => [...prev, { brand: tireBrand, size: tireSize, type: tireType, condition: tireCondition, qty: tireQty, unitPrice: tireUnitPrice, date: tireDate, description: tireDescription }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveTirePurchase = async () => {
    if (queuedTirePurchases.length === 0) return;
    try {
      const recap = await ensureRecap();
      for (const t of queuedTirePurchases) {
        const q = parseInt(t.qty || "0", 10);
        const price = parseFloat(t.unitPrice || "0");
        if (!t.brand || !t.size || !(q > 0) || !(price > 0)) continue;
        const a = q * price;
        const desc = t.description || `Beli Ban ${t.brand} ${t.size} x ${q}`;
        const cash = await createTempoTransaction({ transactionType: "kredit_tempo", amount: a, description: desc });
        await addItemToRecap(recap.id, { type: "tire_purchase", reference_id: cash.id, description: desc, amount: a } as any);
      }
      setQueuedTirePurchases([]);
      toast.success("Semua pembelian ban berhasil disimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan pembelian ban");
    }
  };

  const queueService = () => {
    if (!serviceVehicleId || !laborCost) return toast.error("Kendaraan dan biaya labor wajib");
    setQueuedServices((prev) => [...prev, { vehicleId: serviceVehicleId, serviceDate: serviceDate, serviceType: serviceType, workshopName: workshopName, laborCost: laborCost, description: serviceDescription }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveService = async () => {
    if (queuedServices.length === 0) return;
    try {
      const recap = await ensureRecap();
      for (const sv of queuedServices) {
        const labor = parseFloat(sv.laborCost || "0");
        if (!sv.vehicleId) continue;
        const a = labor || 0;
        const desc = sv.description || (sv.vehicleId ? `Servis kendaraan ${sv.vehicleId}` : "Servis kendaraan");
        
        // Create actual service record
        const serviceData = new FormData();
        serviceData.append('vehicle_id', parseInt(sv.vehicleId, 10).toString());
        serviceData.append('service_date', sv.serviceDate || new Date().toISOString().split('T')[0]);
        serviceData.append('service_type', sv.serviceType || 'regular');
        serviceData.append('description', desc);
        serviceData.append('workshop_name', sv.workshopName || '');
        serviceData.append('labor_cost', sv.laborCost || '0');
        serviceData.append('notes', `Created from Tempo Composer - ${desc}`);
        serviceData.append('items', JSON.stringify([])); // Empty items array for now
        // Pass cash settings to backend to handle cash transaction creation
        const cashSettings = {
          save_to_cash: true,
          is_tempo: true,
          account: composerAccount || "General",
          supplier: sv.workshopName || composerSupplier,
          due_date: composerDueDate,
        };
        serviceData.append('cash_settings', JSON.stringify(cashSettings));
        
        const serviceResponse = await apiClient.post('/services', serviceData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Backend will create the cash transaction automatically, so we just add to recap
        if (a > 0) {
          // Get the cash transaction ID from the service response
          const cashTxnId = serviceResponse.data?.data?.cash_transaction_id || serviceResponse.data?.cash_transaction_id;
          if (cashTxnId) {
            await addItemToRecap(recap.id, { type: "service", reference_id: cashTxnId, description: `${desc}${sv.workshopName ? ` @ ${sv.workshopName}` : ""}`, amount: a } as any);
          }
        }
      }
      setQueuedServices([]);
      toast.success("Semua servis berhasil disimpan");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan servis");
    }
  };

  const queueTempoNormal = () => {
    const a = parseFloat(amount || "0");
    if (!(a > 0)) return toast.error("Jumlah tempo wajib");
    setQueuedTempo((prev) => [...prev, { tempoType, categoryId: tempoCategoryId, amount, referenceNumber, notaNumber, notaDate, description, files: tempoFiles }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveAllQueued = async () => {
    try {
      const recap = await ensureRecap();

      // Collect all transaction details for the rekapan nota
      const transactionDetails: Array<{
        type: string;
        description: string;
        amount: number;
        supplier?: string;
        reference?: string;
        details?: any;
      }> = [];

      let totalAmount = 0;

      // Process usages
      for (const u of queuedUsages) {
        const q = parseFloat(u.qty || "0");
        if (!(q > 0)) continue;
        const payload: CreateStockUsagePayload = {
          vehicle_id: parseInt(u.vehicleId, 10),
          usage_date: new Date().toISOString().split("T")[0],
          notes: u.description || `Tempo Composer: ${u.itemName || "Item"}`,
          items: [ { item_id: u.itemId ? parseInt(u.itemId, 10) : undefined, item_name: u.itemName || undefined, unit: u.itemUnit, quantity: q, unit_price: u.unitPrice ? parseFloat(u.unitPrice) : undefined } ],
          recap_number: recap.recap_number,
          cash_options: { create_cash: false }, // Don't create individual cash transactions
        };
        await createStockUsage(payload);
        
        const amount = q * (parseFloat(u.unitPrice || "0") || 0);
        totalAmount += amount;
        transactionDetails.push({
          type: "Stock Usage",
          description: `${u.itemName || "Item"} - ${q} ${u.itemUnit}`,
          amount: amount,
          supplier: composerSupplier || undefined,
          details: u
        });
      }

      // Process stock adds
      for (const s of queuedStockAdds) {
        const q = parseFloat(s.qty || "0");
        const p = parseFloat(s.unitPrice || "0");
        if (!(q > 0)) continue;
        let targetItemId = s.itemId ? parseInt(s.itemId, 10) : undefined;
        if (!targetItemId && !s.itemName) continue;
        if (!targetItemId) {
          const createRes = await apiClient.post("/stock", { 
            item_name: s.itemName, 
            unit: s.itemUnit, 
            min_stock: 0,
            initial_stock: q,
            unit_price: p,
            supplier: composerSupplier || undefined,
            notes: s.description || `Initial stock creation for ${s.itemName}`
          });
          targetItemId = createRes.data?.data?.id || createRes.data?.id;
        } else {
          await apiClient.post("/stock/adjust", { itemId: targetItemId, adjustmentType: "add", quantity: q, unit_price: p, supplier: composerSupplier || undefined, create_new_batch: s.createNewBatch, notes: s.description || `Tambah stok ${s.itemName || targetItemId}` });
        }
        
        const amount = q * p;
        totalAmount += amount;
        transactionDetails.push({
          type: "Stock Purchase",
          description: `${s.itemName || "Stock Item"} - ${q} ${s.itemUnit}`,
          amount: amount,
          supplier: composerSupplier || undefined,
          details: s
        });
      }

      // Process tire purchases
      for (const t of queuedTirePurchases) {
        const q = parseInt(t.qty || "0", 10);
        const price = parseFloat(t.unitPrice || "0");
        if (!t.brand || !t.size || !(q > 0) || !(price > 0)) continue;
        const a = q * price;
        totalAmount += a;
        transactionDetails.push({
          type: "Tire Purchase",
          description: `${t.brand} ${t.size} - ${q} pcs`,
          amount: a,
          supplier: composerSupplier || undefined,
          details: t
        });
      }

      // Process services
      for (const sv of queuedServices) {
        const labor = parseFloat(sv.laborCost || "0");
        if (!sv.vehicleId) continue;
        const a = labor || 0;
        const desc = sv.description || (sv.vehicleId ? `Servis kendaraan ${sv.vehicleId}` : "Servis kendaraan");
        
        // Create actual service record
        const serviceData = new FormData();
        serviceData.append('vehicle_id', parseInt(sv.vehicleId, 10).toString());
        serviceData.append('service_date', sv.serviceDate || new Date().toISOString().split('T')[0]);
        serviceData.append('service_type', sv.serviceType || 'regular');
        serviceData.append('description', desc);
        serviceData.append('workshop_name', sv.workshopName || '');
        serviceData.append('labor_cost', sv.laborCost || '0');
        serviceData.append('notes', `Created from Tempo Composer - ${desc}`);
        serviceData.append('items', JSON.stringify([])); // Empty items array for now
        // Don't create individual cash transaction
        serviceData.append('cash_settings', JSON.stringify({ save_to_cash: false }));
        
        await apiClient.post('/services', serviceData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        totalAmount += a;
        transactionDetails.push({
          type: "Service",
          description: `${desc}${sv.workshopName ? ` @ ${sv.workshopName}` : ""}`,
          amount: a,
          supplier: sv.workshopName || composerSupplier || undefined,
          details: sv
        });
      }

      // Process plain tempo
      for (const c of queuedTempo) {
        const a = parseFloat(c.amount || "0");
        if (!(a > 0)) continue;
        totalAmount += a;
        transactionDetails.push({
          type: "Tempo",
          description: c.description || "Tempo Biasa",
          amount: a,
          supplier: composerSupplier || undefined,
          details: c
        });
      }

      // Create single rekapan nota transaction
      if (totalAmount > 0 && transactionDetails.length > 0) {
        const rekapanDescription = `Rekapan Nota Tempo ${recap.recap_number} - ${transactionDetails.length} transaksi`;
        
        // Create the main rekapan transaction with short description
        const rekapanTransaction = await createTempoTransaction({
          transactionType: "kredit_tempo",
          categoryId: tempoCategoryId || undefined,
          amount: totalAmount,
          description: rekapanDescription,
          referenceNumber: recap.recap_number,
          notaNumber: recap.recap_number,
          notaDate: new Date().toISOString().split('T')[0]
        });

        // Store detailed transaction info in a separate field (we'll use notes field)
        const detailedInfo = JSON.stringify({
          transactionDetails: transactionDetails.map((t, i) => ({
            id: i + 1,
            type: t.type,
            description: t.description,
            amount: t.amount,
            supplier: t.supplier
          }))
        });

        // Update the transaction with detailed info in description field
        await apiClient.put(`/cash/transactions/${rekapanTransaction.id}`, {
          description: detailedInfo, // Store detailed info in description
          supplier: composerSupplier || undefined,
          tanggal_jatuh_tempo: composerDueDate || undefined
        });

        // Add to recap
        await addItemToRecap(recap.id, { 
          type: "cash", 
          reference_id: rekapanTransaction.id, 
          description: rekapanDescription, 
          amount: totalAmount 
        } as any);
      }

      // Clear queues
      setQueuedUsages([]);
      setQueuedStockAdds([]);
      setQueuedTirePurchases([]);
      setQueuedServices([]);
      setQueuedTempo([]);

      toast.success(`Rekapan Nota Tempo ${recap.recap_number} berhasil dibuat dengan ${transactionDetails.length} transaksi`);
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan rekapan tempo");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Tempo Composer</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recap Number</label>
            <input type="text" value={recapNumber} onChange={(e) => setRecapNumber(e.target.value)} placeholder="Kosongkan untuk auto" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select value={composerAccount} onChange={(e) => setComposerAccount(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              {accounts.map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <input type="text" value={composerSupplier} onChange={(e) => setComposerSupplier(e.target.value)} placeholder="Nama supplier" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Jatuh Tempo</label>
            <input type="date" value={composerDueDate} onChange={(e) => setComposerDueDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Antrian</label>
            <div className="text-lg font-semibold text-blue-600">
              {queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + queuedTempo.length} transaksi
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={saveAllQueued} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded">
            Simpan Semua ke Rekapan
          </button>
        </div>
      </div>

      {/* Penggunaan Stok */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Penggunaan Stok</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Kendaraan</label>
            <select value={usageVehicleId} onChange={(e) => setUsageVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih kendaraan</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.license_plate}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Item</label>
            <input type="text" value={usageItemName} onChange={(e) => setUsageItemName(e.target.value)} placeholder="Nama item" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah</label>
            <input type="number" value={usageQty} onChange={(e) => setUsageQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={usageItemUnit} onChange={(e) => setUsageItemUnit(e.target.value)} placeholder="pcs" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga per Unit</label>
            <input type="number" value={usageUnitPrice} onChange={(e) => setUsageUnitPrice(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={usageDescription} onChange={(e) => setUsageDescription(e.target.value)} placeholder="Deskripsi penggunaan" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedUsages.length}</div>
          <div className="flex gap-2">
            <button onClick={queueStockUsage} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
            <button onClick={saveStockUsage} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded">Simpan Sekarang</button>
          </div>
        </div>
      </div>

      {/* Penambahan Stok */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Penambahan Stok</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Item</label>
            <input type="text" value={stockItemName} onChange={(e) => setStockItemName(e.target.value)} placeholder="Nama item" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah</label>
            <input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={stockItemUnit} onChange={(e) => setStockItemUnit(e.target.value)} placeholder="pcs" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga per Unit</label>
            <input type="number" value={stockUnitPrice} onChange={(e) => setStockUnitPrice(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={stockDescription} onChange={(e) => setStockDescription(e.target.value)} placeholder="Deskripsi penambahan" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="flex items-center">
              <input type="checkbox" checked={stockCreateNewBatch} onChange={(e) => setStockCreateNewBatch(e.target.checked)} className="mr-2" />
              Buat batch baru
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedStockAdds.length}</div>
          <div className="flex gap-2">
            <button onClick={queueStockAdd} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
            <button onClick={saveStockAdd} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded">Simpan Sekarang</button>
          </div>
        </div>
      </div>

      {/* Pembelian Ban */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Pembelian Ban</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <input type="text" value={tireBrand} onChange={(e) => setTireBrand(e.target.value)} placeholder="Bridgestone" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ukuran</label>
            <input type="text" value={tireSize} onChange={(e) => setTireSize(e.target.value)} placeholder="295/80R22.5" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah</label>
            <input type="number" value={tireQty} onChange={(e) => setTireQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga per Unit</label>
            <input type="number" value={tireUnitPrice} onChange={(e) => setTireUnitPrice(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe</label>
            <select value={tireType} onChange={(e) => setTireType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih tipe</option>
              <option value="radial">Radial</option>
              <option value="bias">Bias</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kondisi</label>
            <select value={tireCondition} onChange={(e) => setTireCondition(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih kondisi</option>
              <option value="new">Baru</option>
              <option value="used">Bekas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal</label>
            <input type="date" value={tireDate} onChange={(e) => setTireDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={tireDescription} onChange={(e) => setTireDescription(e.target.value)} placeholder="Deskripsi pembelian" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedTirePurchases.length}</div>
          <div className="flex gap-2">
            <button onClick={queueTirePurchase} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
            <button onClick={saveTirePurchase} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded">Simpan Sekarang</button>
          </div>
        </div>
      </div>

      {/* Servis */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Servis Kendaraan</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Kendaraan</label>
            <select value={serviceVehicleId} onChange={(e) => setServiceVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih kendaraan</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.license_plate}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Servis</label>
            <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe Servis</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih tipe</option>
              <option value="regular">Regular</option>
              <option value="with_parts">Dengan Suku Cadang</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bengkel</label>
            <input type="text" value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} placeholder="Nama bengkel" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Biaya Labor</label>
            <input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="Deskripsi servis" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedServices.length}</div>
          <div className="flex gap-2">
            <button onClick={queueService} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
            <button onClick={saveService} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded">Simpan Sekarang</button>
          </div>
        </div>
      </div>

      {/* Tempo Biasa */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Tempo Biasa</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tipe</label>
            <select value={tempoType} onChange={(e) => setTempoType(e.target.value as "debit_tempo" | "kredit_tempo")} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="kredit_tempo">Kredit Tempo</option>
              <option value="debit_tempo">Debit Tempo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategori</label>
            <select value={tempoCategoryId} onChange={(e) => setTempoCategoryId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">No. Referensi</label>
            <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">No. Nota</label>
            <input type="text" value={notaNumber} onChange={(e) => setNotaNumber(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Nota</label>
            <input type="date" value={notaDate} onChange={(e) => setNotaDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Tempo biasa" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Lampiran Nota</label>
            <input type="file" multiple accept="image/*" onChange={(e) => setTempoFiles(e.target.files ? Array.from(e.target.files) : [])} className="w-full" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedTempo.length}</div>
          <div className="flex gap-2">
            <button onClick={queueTempoNormal} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
          </div>
        </div>
      </div>

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
                    <p className="text-lg font-bold text-red-600">Rp {selectedRekapan.amount.toLocaleString('id-ID')}</p>
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
                      {selectedRekapan.parsedDetails?.transactions?.map((transaction: any, index: number) => (
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
                          Rp {selectedRekapan.amount.toLocaleString('id-ID')}
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
    </div>
  );
}
