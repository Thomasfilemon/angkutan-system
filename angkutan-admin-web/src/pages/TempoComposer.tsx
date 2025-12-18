import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";
import apiClient from "../api/axiosConfig";
import { createRecap, listRecaps, addItemToRecap } from "../api/recapApi";
import { createStockUsage, CreateStockUsagePayload } from "../api/stockUsageApi";
import CurrencyInput from "../components/CurrencyInput";

export default function TempoComposerPage() {
  const [searchParams] = useSearchParams();
  const accountFromUrl = searchParams.get("account");
  
  const [accounts, setAccounts] = useState<string[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; category_name: string; category_type: "income" | "expense" }>>([]);
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  
  useEffect(() => {
    apiClient.get("/cash/accounts").then((res) => {
      const accountsList = res.data.data || [];
      setAccounts(accountsList);
      // Auto-select account from URL if provided and exists
      if (accountFromUrl && accountsList.includes(accountFromUrl)) {
        setComposerAccount(accountFromUrl);
      }
    }).catch(() => {});
    apiClient.get("/cash/categories").then((res) => setCategories(res.data.data || [])).catch(() => {});
    // Fetch suppliers
    apiClient.get("/stock/suppliers").then((res) => {
      const payload: unknown = res.data;
      const list: string[] = (Array.isArray(payload) ? payload : [])
        .map((s: unknown) => String(s).toUpperCase());
      setSupplierOptions(Array.from(new Set(list)));
    }).catch(() => {});
  }, [accountFromUrl]);

  const [recapNumber, setRecapNumber] = useState("");
  const [isTempo, setIsTempo] = useState(true); // Always tempo for this composer
  const [composerAccount, setComposerAccount] = useState(accountFromUrl || "General");
  const [composerSupplier, setComposerSupplier] = useState("");
  const [composerDueDate, setComposerDueDate] = useState("");
  const [composerTransactionDate, setComposerTransactionDate] = useState(new Date().toISOString().split("T")[0]);

  // Global loading & error helper
  const [isSaving, setIsSaving] = useState(false);
  const [savingText, setSavingText] = useState<string | null>(null);
  const friendlyError = (e: any) => e?.response?.data?.message || e?.response?.data?.error || e?.message || "Terjadi kesalahan. Coba lagi.";

  const ensureRecap = useCallback(async () => {
    const manual = (recapNumber || "").trim();
    try {
      if (manual) {
        const res = await listRecaps({ page: 1, limit: 1, search: manual });
        const found = (res?.data || []).find((r: any) => r.recap_number === manual);
        if (found) return found;
      }
    } catch {}
    const created = await createRecap({ payment_mode: "tempo", recap_number: manual || undefined });
    setRecapNumber(created.recap_number);
    return created;
  }, [recapNumber]);

  // Tempo-specific fields
  const [tempoType, setTempoType] = useState<"debit_tempo" | "kredit_tempo">("kredit_tempo");
  const [tempoCategoryId, setTempoCategoryId] = useState<string>("");
  const [tempoItemName, setTempoItemName] = useState(""); // Nama Item (replaces referenceNumber for tempo biasa)
  const [tempoUnit, setTempoUnit] = useState("Pcs"); // Unit
  const [tempoMerk, setTempoMerk] = useState(""); // Merk/Brand
  const [tempoQty, setTempoQty] = useState(""); // Qty
  const [tempoUnitPrice, setTempoUnitPrice] = useState(""); // Harga Satuan
  // notaNumber and notaDate removed - they come from header (recapNumber and composerTransactionDate)
  const [tempoFiles, setTempoFiles] = useState<File[]>([]);
  const [tempoDescription, setTempoDescription] = useState(""); // Keterangan

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
    itemName?: string;
    unit?: string;
    merk?: string;
    qty?: string;
    unitPrice?: string;
    referenceNumberOverride?: string; // Optional override for reference_number (e.g., for rekapan)
    notaNumber?: string;
    notaDate?: string;
    transactionDate?: string;
    files?: File[];
  }) => {
    const formData = new FormData();
    formData.append("transaction_type", opts.transactionType);
    formData.append("amount", opts.amount.toString());
    
    // Build description with item details as JSON if item details exist
    let finalDescription = opts.description;
    if (opts.itemName || opts.unit || opts.merk || opts.qty || opts.unitPrice) {
      const itemDetails: any = {};
      if (opts.itemName) itemDetails.itemName = opts.itemName;
      if (opts.unit) itemDetails.unit = opts.unit;
      if (opts.merk) itemDetails.merk = opts.merk;
      if (opts.qty) itemDetails.qty = opts.qty;
      if (opts.unitPrice) itemDetails.unitPrice = opts.unitPrice;
      
      // Store as JSON in description, with human-readable description as fallback
      finalDescription = JSON.stringify({
        type: "tempo_biasa_item",
        description: opts.description || `${opts.itemName || 'Item'} - ${opts.qty || 0} ${opts.unit || 'Pcs'}`,
        itemDetails: itemDetails
      });
    }
    
    formData.append("description", finalDescription);
    formData.append("account", composerAccount);
    formData.append("transaction_date", opts.transactionDate || composerTransactionDate || new Date().toISOString().split("T")[0]);
    
    if (opts.categoryId) formData.append("category_id", opts.categoryId);
    // Use referenceNumberOverride if provided (for rekapan), otherwise itemName, otherwise recapNumber
    if (opts.referenceNumberOverride) {
      formData.append("reference_number", opts.referenceNumberOverride);
    } else if (opts.itemName) {
      formData.append("reference_number", opts.itemName);
    } else if (recapNumber) {
      formData.append("reference_number", recapNumber);
    }
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
  }, [composerAccount, composerSupplier, composerDueDate, composerTransactionDate, recapNumber]);

  // Queue states
  const [queuedUsages, setQueuedUsages] = useState<Array<{ vehicleId: string; itemId: string; itemName: string; itemUnit: string; merk?: string; qty: string; unitPrice?: string; description: string }>>([]);
  const [queuedStockAdds, setQueuedStockAdds] = useState<Array<{ itemId: string; itemName: string; itemUnit: string; qty: string; unitPrice: string; createNewBatch: boolean; description: string; rackRow?: string; rackLevel?: string; merk?: string }>>([]);
  const [queuedTirePurchases, setQueuedTirePurchases] = useState<Array<{ brand: string; size: string; type: string; condition: string; qty: string; unitPrice: string; date: string; description: string; serialNumber?: string }>>([]);
  const [queuedServices, setQueuedServices] = useState<Array<{ vehicleId: string; serviceDate: string; serviceType: string; workshopName: string; laborCost: string; description: string }>>([]);
  const [queuedTempo, setQueuedTempo] = useState<Array<{ 
    tempoType: "debit_tempo" | "kredit_tempo"; 
    categoryId: string; 
    amount: string; 
    itemName?: string; 
    unit?: string; 
    merk?: string; 
    qty?: string; 
    unitPrice?: string; 
    // notaNumber and notaDate removed - they come from header (recap)
    transactionDate?: string; 
    description: string; 
    files: File[] 
  }>>([]);

  // Form states for each section
  const [vehicles, setVehicles] = useState<Array<{ id: number; license_plate: string }>>([]);
  const [stockItems, setStockItems] = useState<Array<{ id: number; item_name: string; unit: string; current_stock: number; average_unit_price: number }>>([]);
  const [tireInventory, setTireInventory] = useState<Array<{ id: number; tire_brand: string; tire_size: string; tire_type: string; current_stock: number; unit_price: number }>>([]);

  // Usage form
  const [usageVehicleId, setUsageVehicleId] = useState("");
  const [usageItemId, setUsageItemId] = useState("");
  const [usageItemName, setUsageItemName] = useState("");
  const [usageItemUnit, setUsageItemUnit] = useState("");
  const [usageMerk, setUsageMerk] = useState(""); // Merk/Brand for stock usage
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
  const [stockRackRow, setStockRackRow] = useState("");
  const [stockRackLevel, setStockRackLevel] = useState("");
  const [stockMerk, setStockMerk] = useState(""); // NEW: Brand field

  // Tire purchase form
  const [tireBrand, setTireBrand] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [tireType, setTireType] = useState("");
  const [tireCondition, setTireCondition] = useState("");
  const [tireQty, setTireQty] = useState("");
  const [tireUnitPrice, setTireUnitPrice] = useState("");
  const [tireDate, setTireDate] = useState("");
  const [tireDescription, setTireDescription] = useState("");
  const [tireSerialNumber, setTireSerialNumber] = useState("");

  // Service form
  const [serviceVehicleId, setServiceVehicleId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");

  // Tempo form (replaced with detailed fields)
  // amount and description are now calculated/derived from item fields

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
    setQueuedUsages((prev) => [...prev, { vehicleId: usageVehicleId, itemId: usageItemId, itemName: usageItemName, itemUnit: usageItemUnit, merk: usageMerk || undefined, qty: usageQty, unitPrice: usageUnitPrice, description: usageDescription }]);
    toast.success("Ditambahkan ke antrian");
    // Clear form after queueing
    setUsageVehicleId("");
    setUsageItemId("");
    setUsageItemName("");
    setUsageItemUnit("");
    setUsageMerk("");
    setUsageQty("");
    setUsageUnitPrice("");
    setUsageDescription("");
  };

  const saveStockUsage = async () => {
    if (queuedUsages.length === 0) return;
    try {
      setIsSaving(true); setSavingText("Menyimpan Stok Sekali Pakai...");
      const recap = await ensureRecap();
      for (const u of queuedUsages) {
        const q = parseFloat(u.qty || "0");
        if (!(q > 0)) continue;
        
        // Helper to save merk in notes as JSON
        const saveMerkToNotes = (merk: string, otherNotes: string): string => {
          if (!merk && !otherNotes) return '';
          const data: any = {};
          if (merk) data.merk = merk;
          if (otherNotes) data.notes = otherNotes;
          return JSON.stringify(data);
        };
        
        const payload: CreateStockUsagePayload = {
          vehicle_id: parseInt(u.vehicleId, 10),
          usage_date: new Date().toISOString().split("T")[0],
          notes: saveMerkToNotes(u.merk || "", u.description || `Tempo Composer: ${u.itemName || "Item"}`),
          items: [ { item_id: u.itemId ? parseInt(u.itemId, 10) : undefined, item_name: u.itemName || undefined, unit: u.itemUnit, quantity: q, unit_price: u.unitPrice ? parseFloat(u.unitPrice) : undefined } ],
          recap_number: recap.recap_number,
          cash_options: { create_cash: true, is_tempo: true, account: composerAccount, supplier: composerSupplier || undefined, due_date: composerDueDate || undefined },
        };
        await createStockUsage(payload);
      }
      setQueuedUsages([]);
      toast.success("Semua penggunaan stok berhasil disimpan");
    } catch (e: any) { console.error("Tempo saveStockUsage error:", e); toast.error(friendlyError(e)); }
    finally { setIsSaving(false); setSavingText(null); }
  };

  const queueStockAdd = () => {
    if (!stockQty || !stockUnitPrice) return toast.error("Jumlah dan harga wajib");
    setQueuedStockAdds((prev) => [...prev, { itemId: stockItemId, itemName: stockItemName, itemUnit: stockItemUnit, qty: stockQty, unitPrice: stockUnitPrice, createNewBatch: stockCreateNewBatch, description: stockDescription, rackRow: stockRackRow, rackLevel: stockRackLevel, merk: stockMerk }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveStockAdd = async () => {
    if (queuedStockAdds.length === 0) return;
    try {
      setIsSaving(true); setSavingText("Menambah Stok...");
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
            rack_row: s.rackRow ? parseInt(s.rackRow) : undefined,
            rack_level: s.rackLevel ? parseInt(s.rackLevel) : undefined,
            notes: s.description || `Initial stock creation for ${s.itemName}`
          });
          targetItemId = createRes.data?.data?.id || createRes.data?.id;
        } else {
          await apiClient.post("/stock/adjust", { itemId: targetItemId, adjustmentType: "add", quantity: q, unit_price: p, supplier: composerSupplier || undefined, create_new_batch: s.createNewBatch, notes: s.description || `Tambah stok ${s.itemName || targetItemId}` });
        }
        if (p > 0) {
          const desc = s.description || `Pembelian stok ${s.itemName || targetItemId}`;
          const cash = await createTempoTransaction({ 
            transactionType: "kredit_tempo", 
            categoryId: tempoCategoryId || undefined, 
            amount: q * p, 
            description: desc,
            itemName: s.itemName || undefined // Use stock item name as reference
          });
          await addItemToRecap(recap.id, { type: "cash", reference_id: cash.id, description: cash.description, amount: cash.amount } as any);
        }
        await addItemToRecap(recap.id, { type: "stock", reference_id: targetItemId!, description: s.description || `Stok masuk`, amount: q * p } as any);
      }
      setQueuedStockAdds([]);
      toast.success("Semua penambahan stok berhasil disimpan");
    } catch (e: any) { console.error("Tempo saveStockAdd error:", e); toast.error(friendlyError(e)); }
    finally { setIsSaving(false); setSavingText(null); }
  };

  const queueTirePurchase = () => {
    if (!tireBrand || !tireSize || !tireQty || !tireUnitPrice) return toast.error("Brand, ukuran, jumlah, dan harga wajib");
    setQueuedTirePurchases((prev) => [...prev, { brand: tireBrand, size: tireSize, type: tireType, condition: tireCondition, qty: tireQty, unitPrice: tireUnitPrice, date: tireDate, description: tireDescription, serialNumber: tireSerialNumber }]);
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
        let desc = t.description || `Beli Ban ${t.brand} ${t.size} x ${q}`;
        if ((t.serialNumber || '').trim()) desc += ` (SN: ${t.serialNumber?.trim()})`;
        const cash = await createTempoTransaction({ transactionType: "kredit_tempo", amount: a, description: desc });
        await addItemToRecap(recap.id, { type: "tire_purchase", reference_id: cash.id, description: desc, amount: a } as any);

        // Sync to tire inventory for immediate save too
        try {
          const allInv = await apiClient.get('/tires/tire-inventory/all');
          const match = (allInv.data?.data || []).find((inv: any) => 
            (inv.tire_brand || '').toLowerCase() === (t.brand || '').toLowerCase() &&
            (inv.tire_size || '').toLowerCase() === (t.size || '').toLowerCase() &&
            (inv.tire_type || '').toLowerCase() === (t.type || '').toLowerCase()
          );
          let inventoryId = match?.id;
          if (!inventoryId) {
            const createRes = await apiClient.post('/tires/tire-inventory', {
              tire_brand: t.brand,
              tire_size: t.size,
              tire_type: t.type || 'radial',
              unit_price: price,
              min_stock: 0,
            });
            inventoryId = createRes.data?.data?.id || createRes.data?.id;
          }
          const serials = (t.serialNumber || '')
            .split(/[\s,;\n]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => !!s);
          if (inventoryId && serials.length > 0) {
            await apiClient.post('/tires/tire-instances', {
              tire_inventory_id: inventoryId,
              serial_numbers: serials,
              purchase_price: price,
              purchase_date: t.date || new Date().toISOString().split('T')[0],
              condition: 'new',
            });
          }
        } catch (err) {
          console.warn('Warning: failed to sync tire inventory/instances (tempo save)', err);
        }
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
    // Calculate amount from qty * unitPrice if both are provided, otherwise use manual amount
    // For tempo, we need to get amount from a state variable - let's use a local state
    let calculatedAmount = 0;
    if (tempoQty && tempoUnitPrice) {
      const qty = parseFloat(tempoQty);
      const unitPrice = parseFloat(tempoUnitPrice);
      if (qty > 0 && unitPrice >= 0) {
        calculatedAmount = qty * unitPrice;
      }
    }
    
    if (!(calculatedAmount > 0)) {
      // Try to get from a tempoAmount state if exists, otherwise show error
      toast.error("Jumlah tempo wajib (isi Qty × Harga Satuan)");
      return;
    }
    if (!tempoItemName) {
      toast.error("Nama Item wajib");
      return;
    }
    
    // Note: notaNumber and notaDate are NOT stored per item - they come from header (recap)
    setQueuedTempo((prev) => [...prev, { 
      tempoType, 
      categoryId: tempoCategoryId, 
      amount: calculatedAmount.toString(), 
            itemName: tempoItemName,
            unit: tempoUnit,
            merk: tempoMerk,
            qty: tempoQty,
            unitPrice: tempoUnitPrice,
            transactionDate: composerTransactionDate, 
            description: tempoDescription, 
            files: tempoFiles 
          }]);
          toast.success("Ditambahkan ke antrian");
          
          // Clear form fields after queueing
          setTempoItemName("");
          setTempoUnit("Pcs");
          setTempoMerk("");
          setTempoQty("");
          setTempoUnitPrice("");
          setTempoDescription("");
          setTempoFiles([]);
        };

  const saveAllQueued = async () => {
    try { setIsSaving(true); setSavingText("Menyimpan Antrian Tempo...");
      const recap = await ensureRecap();

      // Collect all transaction details for the rekapan nota
      const transactionDetails: Array<{
        type: string;
        description: string;
        amount: number;
        supplier?: string;
        reference?: string;
        merk?: string;
        details?: any;
      }> = [];

      let totalAmount = 0;

      // Process usages
      for (const u of queuedUsages) {
        const q = parseFloat(u.qty || "0");
        if (!(q > 0)) continue;
        
        // Helper to save merk in notes as JSON
        const saveMerkToNotes = (merk: string, otherNotes: string): string => {
          if (!merk && !otherNotes) return '';
          const data: any = {};
          if (merk) data.merk = merk;
          if (otherNotes) data.notes = otherNotes;
          return JSON.stringify(data);
        };
        
        const payload: CreateStockUsagePayload = {
          vehicle_id: parseInt(u.vehicleId, 10),
          usage_date: new Date().toISOString().split("T")[0],
          notes: saveMerkToNotes(u.merk || "", u.description || `Tempo Composer: ${u.itemName || "Item"}`),
          items: [ { item_id: u.itemId ? parseInt(u.itemId, 10) : undefined, item_name: u.itemName || undefined, unit: u.itemUnit, quantity: q, unit_price: u.unitPrice ? parseFloat(u.unitPrice) : undefined } ],
          recap_number: recap.recap_number,
          cash_options: { create_cash: false }, // Don't create individual cash transactions
        };
        await createStockUsage(payload);
        
        const amount = q * (parseFloat(u.unitPrice || "0") || 0);
        totalAmount += amount;
        
        // Build description with merk if available
        let displayDesc = `${u.itemName || "Item"} - ${q} ${u.itemUnit}`;
        if (u.merk) {
          displayDesc = `${u.itemName || "Item"} (Merk: ${u.merk}) - ${q} ${u.itemUnit}`;
        }
        
        transactionDetails.push({
          type: "Stock Usage",
          description: displayDesc,
          amount: amount,
          supplier: composerSupplier || undefined,
          merk: u.merk || undefined, // Include merk in details
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
            rack_row: s.rackRow ? parseInt(s.rackRow) : undefined,
            rack_level: s.rackLevel ? parseInt(s.rackLevel) : undefined,
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
        const itemDesc = t.serialNumber ? `${t.brand} ${t.size} - ${q} pcs (SN: ${t.serialNumber})` : `${t.brand} ${t.size} - ${q} pcs`;
        transactionDetails.push({
          type: "Tire Purchase",
          description: itemDesc,
          amount: a,
          supplier: composerSupplier || undefined,
          details: t
        });
        // Sync tire inventory and instances
        try {
          const allInv = await apiClient.get('/tires/tire-inventory/all');
          const match = (allInv.data?.data || []).find((inv: any) => 
            (inv.tire_brand || '').toLowerCase() === (t.brand || '').toLowerCase() &&
            (inv.tire_size || '').toLowerCase() === (t.size || '').toLowerCase() &&
            (inv.tire_type || '').toLowerCase() === (t.type || '').toLowerCase()
          );
          let inventoryId = match?.id;
          if (!inventoryId) {
            const createRes = await apiClient.post('/tires/tire-inventory', {
              tire_brand: t.brand,
              tire_size: t.size,
              tire_type: t.type || 'radial',
              unit_price: price,
              min_stock: 0,
            });
            inventoryId = createRes.data?.data?.id || createRes.data?.id;
          }
          const serials = (t.serialNumber || '')
            .split(/[\s,;\n]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => !!s);
          if (inventoryId && serials.length > 0) {
            await apiClient.post('/tires/tire-instances', {
              tire_inventory_id: inventoryId,
              serial_numbers: serials,
              purchase_price: price,
              purchase_date: t.date || new Date().toISOString().split('T')[0],
              condition: 'new',
            });
          }
        } catch (err) {
          console.warn('Warning: failed to sync tire inventory/instances (tempo batch)', err);
        }
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

      // Process plain tempo - DON'T create individual transactions, only collect details for rekapan
      // Individual tempo items will be part of the rekapan transaction only
      const allTempoFiles: File[] = []; // Collect all files from tempo items for rekapan
      for (const c of queuedTempo) {
        const a = parseFloat(c.amount || "0");
        if (!(a > 0)) continue;
        totalAmount += a;
        
        // Collect files for rekapan transaction
        if (c.files && c.files.length > 0) {
          allTempoFiles.push(...c.files);
        }
        
        // Build display description from item details
        let displayDesc = c.description || "Tempo Biasa";
        if (c.itemName) {
          const parts = [c.itemName];
          if (c.qty && c.unit) parts.push(`${c.qty} ${c.unit}`);
          if (c.merk) parts.push(`Merk: ${c.merk}`);
          displayDesc = parts.join(" - ");
        }
        
        transactionDetails.push({
          type: "Tempo",
          description: displayDesc,
          amount: a,
          supplier: composerSupplier || undefined,
          details: c
        });
      }

      // Create single rekapan nota transaction
      if (totalAmount > 0 && transactionDetails.length > 0) {
        const rekapanDescription = `Rekapan Nota Tempo ${recap.recap_number} - ${transactionDetails.length} transaksi`;
        
        // Use transaction date from header (composerTransactionDate)
        // No nota and tanggal nota come from header (recapNumber and composerTransactionDate)
        const rekapanTransactionDate = composerTransactionDate || new Date().toISOString().split('T')[0];
        const rekapanNotaDate = composerTransactionDate || new Date().toISOString().split('T')[0];
        
        // Create the main rekapan transaction with all collected files
        const rekapanTransaction = await createTempoTransaction({
          transactionType: "kredit_tempo",
          categoryId: tempoCategoryId || undefined,
          amount: totalAmount,
          description: rekapanDescription,
          referenceNumberOverride: recap.recap_number, // Use recap number as reference
          notaNumber: recap.recap_number, // Use recap number as nota number from header
          notaDate: rekapanNotaDate, // Use transaction date from header as nota date
          transactionDate: rekapanTransactionDate,
          files: allTempoFiles.length > 0 ? allTempoFiles : undefined // Include all collected files
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
    } catch (e: any) { console.error("Tempo saveAllQueued error:", e); toast.error(friendlyError(e)); }
    finally { setIsSaving(false); setSavingText(null); }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Tempo Composer</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Nota</label>
            <input type="text" value={recapNumber} onChange={(e) => setRecapNumber(e.target.value)} placeholder="Kosongkan untuk auto" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <CreatableSelect value={{ label: composerAccount, value: composerAccount }} options={accounts.map((a) => ({ label: a, value: a }))} onChange={(sel) => setComposerAccount(sel?.value || "General")} onCreateOption={(val) => setComposerAccount(val)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <CreatableSelect
              value={composerSupplier ? { label: composerSupplier, value: composerSupplier } : null}
              options={supplierOptions.map((s) => ({ label: s, value: s }))}
              onChange={(sel) => setComposerSupplier(sel?.value || "")}
              onCreateOption={(val) => setComposerSupplier(val.toUpperCase())}
              isClearable
              isSearchable
              placeholder="Cari atau buat supplier..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Jatuh Tempo</label>
            <input type="date" value={composerDueDate} onChange={(e) => setComposerDueDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Transaksi *</label>
            <input type="date" value={composerTransactionDate} onChange={(e) => setComposerTransactionDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            <p className="text-xs text-gray-500 mt-1">Default: tanggal sekarang. Ubah jika nota lawas.</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Antrian</label>
            <div className="text-lg font-semibold text-blue-600">
              {queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + queuedTempo.length} item
            </div>
          </div>
        </div>

        {/* Queue Table */}
        {(queuedUsages.length > 0 || queuedStockAdds.length > 0 || queuedTirePurchases.length > 0 || queuedServices.length > 0 || queuedTempo.length > 0) && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Antrian Transaksi</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah/Harga</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Queued Usages */}
                  {queuedUsages.map((item, idx) => (
                    <tr key={`usage-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Stok Digunakan</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>Kendaraan: {vehicles.find(v => v.id.toString() === item.vehicleId)?.license_plate || item.vehicleId}</div>
                        <div>Item: {item.itemName || item.itemId}</div>
                        {item.merk && <div className="text-gray-500">Merk: {item.merk}</div>}
                        <div className="text-gray-500">{item.description || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        <div>{item.qty} {item.itemUnit}</div>
                        {item.unitPrice && <div className="text-gray-500">Rp {parseFloat(item.unitPrice).toLocaleString('id-ID')}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => setQueuedUsages(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Queued Stock Adds */}
                  {queuedStockAdds.map((item, idx) => (
                    <tr key={`stock-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{queuedUsages.length + idx + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Tambah Stok</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>Item: {item.itemName || item.itemId}</div>
                        <div className="text-gray-500">{item.description || '-'}</div>
                        {item.rackRow && item.rackLevel && <div className="text-gray-500">Rak: {item.rackRow}-{item.rackLevel}</div>}
                        {item.merk && <div className="text-gray-500">Merk: {item.merk}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        <div>{item.qty} {item.itemUnit}</div>
                        <div>Rp {parseFloat(item.unitPrice).toLocaleString('id-ID')}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => setQueuedStockAdds(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Queued Tire Purchases */}
                  {queuedTirePurchases.map((item, idx) => (
                    <tr key={`tire-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{queuedUsages.length + queuedStockAdds.length + idx + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Beli Ban</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{item.brand} {item.size} - {item.type}</div>
                        {item.serialNumber && <div className="text-gray-600">SN: {item.serialNumber}</div>}
                        <div className="text-gray-500">{item.description || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        <div>{item.qty} pcs</div>
                        <div>Rp {parseFloat(item.unitPrice).toLocaleString('id-ID')}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => setQueuedTirePurchases(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Queued Services */}
                  {queuedServices.map((item, idx) => (
                    <tr key={`service-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + idx + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Servis</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>Kendaraan: {vehicles.find(v => v.id.toString() === item.vehicleId)?.license_plate || item.vehicleId}</div>
                        <div>{item.serviceType} - {item.workshopName}</div>
                        <div className="text-gray-500">{item.description || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        <div>Rp {parseFloat(item.laborCost || "0").toLocaleString('id-ID')}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => setQueuedServices(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Queued Tempo */}
                  {queuedTempo.map((item, idx) => {
                    // Build display description from item details
                    let displayDesc = item.description || "Tempo Biasa";
                    if (item.itemName) {
                      const parts = [item.itemName];
                      if (item.qty && item.unit) parts.push(`${item.qty} ${item.unit}`);
                      if (item.merk) parts.push(`Merk: ${item.merk}`);
                      if (item.unitPrice) parts.push(`@ Rp ${parseFloat(item.unitPrice || "0").toLocaleString('id-ID')}`);
                      displayDesc = parts.join(" - ");
                    }
                    
                    return (
                      <tr key={`tempo-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + idx + 1}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.tempoType === "debit_tempo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {item.tempoType === "debit_tempo" ? "Debit Tempo" : "Kredit Tempo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{item.itemName || displayDesc}</div>
                          {item.itemName && (
                            <div className="text-gray-500 text-xs mt-1">
                              {item.qty && item.unit && <span>{item.qty} {item.unit}</span>}
                              {item.merk && <span className="ml-2">• {item.merk}</span>}
                              {item.unitPrice && <span className="ml-2">• @ Rp {parseFloat(item.unitPrice || "0").toLocaleString('id-ID')}</span>}
                            </div>
                          )}
                          {item.description && item.itemName && (
                            <div className="text-gray-500 text-xs mt-1">{item.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          <div className="font-semibold">Rp {parseFloat(item.amount || "0").toLocaleString('id-ID')}</div>
                          {item.qty && item.unitPrice && (
                            <div className="text-gray-500 text-xs">
                              ({item.qty} × Rp {parseFloat(item.unitPrice || "0").toLocaleString('id-ID')})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button
                            onClick={() => setQueuedTempo(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-900"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                      Total Item dalam Antrian:
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-left text-sm font-bold text-gray-900">
                      {queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + queuedTempo.length} item
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                      Total Harga:
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-left text-sm font-bold text-green-600">
                      {(() => {
                        const totalAmount = 
                          queuedUsages.reduce((sum, u) => sum + (parseFloat(u.qty || "0") * parseFloat(u.unitPrice || "0")), 0) +
                          queuedStockAdds.reduce((sum, s) => sum + (parseFloat(s.qty || "0") * parseFloat(s.unitPrice || "0")), 0) +
                          queuedTirePurchases.reduce((sum, t) => sum + (parseInt(t.qty || "0", 10) * parseFloat(t.unitPrice || "0")), 0) +
                          queuedServices.reduce((sum, sv) => sum + parseFloat(sv.laborCost || "0"), 0) +
                          queuedTempo.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0);
                        return `Rp ${totalAmount.toLocaleString('id-ID')}`;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

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
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={usageItemUnit} onChange={(e) => setUsageItemUnit(e.target.value)} placeholder="pcs" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input type="text" value={usageMerk} onChange={(e) => setUsageMerk(e.target.value)} placeholder="Merk/Brand" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah</label>
            <input type="number" value={usageQty} onChange={(e) => setUsageQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga per Unit</label>
            <CurrencyInput
              value={usageUnitPrice}
              onChange={(numeric) => setUsageUnitPrice(numeric)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Rp 0"
            />
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
            <CurrencyInput
              value={stockUnitPrice}
              onChange={(numeric) => setStockUnitPrice(numeric)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Rp 0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rak Baris (1-4)</label>
            <input type="number" min="1" max="4" value={stockRackRow} onChange={(e) => setStockRackRow(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rak Tingkat (1-5)</label>
            <input type="number" min="1" max="5" value={stockRackLevel} onChange={(e) => setStockRackLevel(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input type="text" value={stockMerk} onChange={(e) => setStockMerk(e.target.value)} placeholder="Merk/Brand" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-2">
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
            <CurrencyInput
              value={tireUnitPrice}
              onChange={(numeric) => setTireUnitPrice(numeric)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Rp 0"
            />
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
          <div>
            <label className="block text-sm font-medium mb-1">Nomor Seri</label>
            <input type="text" value={tireSerialNumber} onChange={(e) => setTireSerialNumber(e.target.value)} placeholder="SN ban (opsional)" className="w-full border border-gray-300 rounded-md px-3 py-2" />
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
            <CurrencyInput
              value={laborCost}
              onChange={(numeric) => setLaborCost(numeric)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Rp 0"
            />
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
              {categories.filter(cat => cat.category_type === "expense").map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Item *</label>
            <input type="text" value={tempoItemName} onChange={(e) => setTempoItemName(e.target.value)} placeholder="Nama item" className="w-full border border-gray-300 rounded-md px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={tempoUnit} onChange={(e) => setTempoUnit(e.target.value)} placeholder="Pcs, Liter, dll" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input type="text" value={tempoMerk} onChange={(e) => setTempoMerk(e.target.value)} placeholder="Merk/Brand" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty</label>
            <input type="number" step="0.01" value={tempoQty} onChange={(e) => setTempoQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga Satuan</label>
            <CurrencyInput
              value={tempoUnitPrice}
              onChange={(numeric) => setTempoUnitPrice(numeric)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Rp 0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah (auto)</label>
            <input 
              type="number" 
              step="0.01" 
              value={tempoQty && tempoUnitPrice ? (parseFloat(tempoQty || "0") * parseFloat(tempoUnitPrice || "0")).toString() : ""} 
              readOnly
              placeholder="Qty × Harga Satuan"
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100" 
            />
            <p className="text-xs text-gray-500 mt-1">Otomatis: Qty × Harga Satuan</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Keterangan</label>
            <textarea 
              value={tempoDescription} 
              onChange={(e) => setTempoDescription(e.target.value)} 
              className="w-full border border-gray-300 rounded-md px-3 py-2" 
              rows={2}
              placeholder="Keterangan tambahan" 
            />
          </div>
          <div className="md:col-span-2">
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedRekapan.parsedDetails?.transactions
                        ?.map((transaction: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
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
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.merk || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.supplier || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            Rp {typeof transaction.amount === 'number' ? transaction.amount.toLocaleString('id-ID') : parseFloat(transaction.amount || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
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
      {isSaving && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-md shadow p-4 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-sm text-gray-700">{savingText || 'Loading...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
