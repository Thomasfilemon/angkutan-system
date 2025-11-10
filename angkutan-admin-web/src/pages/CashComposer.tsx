import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";
import apiClient from "../api/axiosConfig";
import { createRecap, listRecaps, addItemToRecap } from "../api/recapApi";
import { createStockUsage, CreateStockUsagePayload } from "../api/stockUsageApi";

export default function CashComposerPage() {
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
  const [isTempo, setIsTempo] = useState(false);
  const [composerAccount, setComposerAccount] = useState(accountFromUrl || "General");
  const [composerSupplier, setComposerSupplier] = useState("");
  const [composerDueDate, setComposerDueDate] = useState("");
  const [composerTransactionDate, setComposerTransactionDate] = useState(new Date().toISOString().split("T")[0]);

  // Global loading state and error helper
  const [isSaving, setIsSaving] = useState(false);
  const [savingText, setSavingText] = useState<string | null>(null);
  const friendlyError = (err: any) => err?.response?.data?.message || err?.response?.data?.error || err?.message || "Terjadi kesalahan. Coba lagi.";

  const ensureRecap = useCallback(async () => {
    const manual = (recapNumber || "").trim();
    try {
      if (manual) {
        const res = await listRecaps({ page: 1, limit: 1, search: manual });
        const found = (res?.data || []).find((r: any) => r.recap_number === manual);
        if (found) return found;
      }
    } catch {}
    const created = await createRecap({ payment_mode: isTempo ? "tempo" : "cash", recap_number: manual || undefined });
    setRecapNumber(created.recap_number);
    return created;
  }, [recapNumber, isTempo]);

  // Cash-normal extra fields
  const [cashType, setCashType] = useState<"debit" | "kredit">("kredit");
  const [cashCategoryId, setCashCategoryId] = useState<string>("");
  const [cashItemName, setCashItemName] = useState(""); // Nama Item (replaces referenceNumber for kas biasa)
  const [cashUnit, setCashUnit] = useState("Pcs"); // Unit
  const [cashMerk, setCashMerk] = useState(""); // Merk/Brand
  const [cashQty, setCashQty] = useState(""); // Qty
  const [cashUnitPrice, setCashUnitPrice] = useState(""); // Harga Satuan
  // notaNumber and notaDate removed - they come from header (recapNumber and composerTransactionDate)
  const [cashFiles, setCashFiles] = useState<File[]>([]);
  const [cashDescription, setCashDescription] = useState(""); // Keterangan

  // Rekapan detail modal state
  const [showRekapanModal, setShowRekapanModal] = useState(false);
  const [selectedRekapan, setSelectedRekapan] = useState<any>(null);

  // Function to parse rekapan details from description field
  const parseRekapanDetails = (description: string) => {
    try {
      const parsed = JSON.parse(description);
      if (parsed.transactionDetails) {
        return {
          mainDescription: "Rekapan Nota",
          transactions: parsed.transactionDetails
        };
      }
    } catch (e) {
      // Fallback to old format if JSON parsing fails
    }
    
    // Fallback: return empty structure
    return {
      mainDescription: "Rekapan Nota",
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

  // Helper to create a cash transaction with provided fields (used for queued saves)
  const createCashTransaction = useCallback(async (opts: {
    transactionType: "debit" | "kredit" | "debit_tempo" | "kredit_tempo";
    categoryId?: string;
    amount: number;
    description: string;
    itemName?: string;
    unit?: string;
    merk?: string;
    qty?: string;
    unitPrice?: string;
    notaNumber?: string;
    notaDate?: string;
    transactionDate?: string;
    files?: File[];
    referenceNumberOverride?: string; // Optional override for reference_number (e.g., for rekapan)
  }) => {
    const fd = new FormData();
    fd.append("transaction_type", opts.transactionType);
    if (opts.categoryId) fd.append("category_id", opts.categoryId);
    fd.append("amount", opts.amount.toString());
    
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
        type: "kas_biasa_item",
        description: opts.description || `${opts.itemName || 'Item'} - ${opts.qty || 0} ${opts.unit || 'Pcs'}`,
        itemDetails: itemDetails
      });
    }
    
    fd.append("description", finalDescription);
    // Use referenceNumberOverride if provided (for rekapan), otherwise itemName, otherwise recapNumber
    if (opts.referenceNumberOverride) {
      fd.append("reference_number", opts.referenceNumberOverride);
    } else if (opts.itemName) {
      fd.append("reference_number", opts.itemName);
    } else if (recapNumber) {
      fd.append("reference_number", recapNumber);
    }
    fd.append("transaction_date", opts.transactionDate || composerTransactionDate || new Date().toISOString().split("T")[0]);
    fd.append("account", composerAccount);
    if (composerSupplier) fd.append("supplier", composerSupplier);
    if (isTempo && composerDueDate) fd.append("tanggal_jatuh_tempo", composerDueDate);
    fd.append("no_nota", opts.notaNumber ? opts.notaNumber : "");
    fd.append("date_nota", opts.notaDate ? opts.notaDate : "");
    (opts.files || []).forEach((f) => fd.append("attachments", f));
    const res = await apiClient.post("/cash/transactions", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return res.data?.data || res.data;
  }, [composerAccount, composerDueDate, composerSupplier, isTempo, recapNumber, composerTransactionDate]);

  // Backward-compatible single add from current form values
  const addCashTransaction = useCallback(async (amount: number, desc: string) => {
    const transaction_type = cashType === "debit" ? "debit" : (isTempo ? "kredit_tempo" : "kredit");
    return await createCashTransaction({
      transactionType: transaction_type,
      categoryId: cashCategoryId || undefined,
      amount,
      description: desc,
      itemName: cashItemName || undefined,
      unit: cashUnit || undefined,
      merk: cashMerk || undefined,
      qty: cashQty || undefined,
      unitPrice: cashUnitPrice || undefined,
      // notaNumber and notaDate come from header (recapNumber and composerTransactionDate) - not per item
      transactionDate: composerTransactionDate,
      files: cashFiles,
    });
  }, [cashType, isTempo, createCashTransaction, cashCategoryId, cashItemName, cashUnit, cashMerk, cashQty, cashUnitPrice, composerTransactionDate, cashFiles]);

  // Common fields
  const [vehicleId, setVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<Array<{ id: number; license_plate: string }>>([]);
  useEffect(() => {
    apiClient.get("/vehicles", { params: { page: 1, limit: 200 } }).then((res) => {
      const body = res?.data;
      const list = Array.isArray(body) ? body : (body?.data || body?.records || []);
      setVehicles((list || []).map((v: any) => ({ id: v.id, license_plate: v.license_plate })));
    }).catch(() => {});
  }, []);
  // Fields for "Stok Langsung Digunakan"
  const [usageItemId, setUsageItemId] = useState("");
  const [usageItemName, setUsageItemName] = useState("");
  const [usageItemUnit, setUsageItemUnit] = useState("Pcs");
  const [usageMerk, setUsageMerk] = useState(""); // Merk/Brand for stock usage
  const [usageQty, setUsageQty] = useState("");
  const [usageUnitPrice, setUsageUnitPrice] = useState("");
  const [usageDescription, setUsageDescription] = useState("");

  // Fields for "Stok (Tambah)"
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("Pcs");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [rackRow, setRackRow] = useState("");
  const [rackLevel, setRackLevel] = useState("");
  const [merk, setMerk] = useState(""); // NEW: Brand field

  // Stock add options
  const [createNewBatch, setCreateNewBatch] = useState(false);

  // Tire purchase fields (to mirror tire creation)
  const [tireBrand, setTireBrand] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [tireType, setTireType] = useState("");
  const [tireCondition, setTireCondition] = useState("new");
  const [tireQty, setTireQty] = useState("1");
  const [tireUnitPrice, setTireUnitPrice] = useState("");
  const [tirePurchaseDate, setTirePurchaseDate] = useState(new Date().toISOString().split("T")[0]);

  // Service fields (to mirror service creation)
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [serviceType, setServiceType] = useState("regular");
  const [workshopName, setWorkshopName] = useState("");
  const [laborCost, setLaborCost] = useState("");

  // Queues for batch save
  type QueuedUsage = { vehicleId: string; itemId: string; itemName: string; itemUnit: string; merk?: string; qty: string; unitPrice?: string; description: string };
  type QueuedStockAdd = { itemId: string; itemName: string; itemUnit: string; qty: string; unitPrice: string; createNewBatch: boolean; description: string; rackRow?: string; rackLevel?: string; merk?: string };
  type QueuedTirePurchase = { brand: string; size: string; type: string; condition: string; qty: string; unitPrice: string; date: string; description: string };
  type QueuedService = { vehicleId: string; serviceDate: string; serviceType: string; workshopName: string; laborCost: string; description: string };
  type QueuedCash = { 
    cashType: "debit" | "kredit"; 
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
  };

  const [queuedUsages, setQueuedUsages] = useState<QueuedUsage[]>([]);
  const [queuedStockAdds, setQueuedStockAdds] = useState<QueuedStockAdd[]>([]);
  const [queuedTirePurchases, setQueuedTirePurchases] = useState<QueuedTirePurchase[]>([]);
  const [queuedServices, setQueuedServices] = useState<QueuedService[]>([]);
  const [queuedCash, setQueuedCash] = useState<QueuedCash[]>([]);

  const queueStockUsage = () => {
    if (!vehicleId) return toast.error("Vehicle ID wajib");
    const q = parseFloat(usageQty || "0");
    if (!(q > 0)) return toast.error("Qty harus > 0");
    if (!usageItemId && !usageItemName) return toast.error("Isi Item ID atau Nama Item");
    if (!usageItemUnit) return toast.error("Unit wajib");
    setQueuedUsages((prev) => [
      ...prev,
      {
        vehicleId,
        itemId: usageItemId,
        itemName: usageItemName,
        itemUnit: usageItemUnit,
        merk: usageMerk || undefined,
        qty: usageQty,
        unitPrice: usageUnitPrice,
        description: usageDescription,
      },
    ]);
    toast.success("Ditambahkan ke antrian");
    // Clear form after queueing
    setUsageItemId("");
    setUsageItemName("");
    setUsageItemUnit("Pcs");
    setUsageMerk("");
    setUsageQty("");
    setUsageUnitPrice("");
    setUsageDescription("");
  };

  const saveStockUsage = async () => {
    const q = parseFloat(usageQty || "0");
    if (!vehicleId) return toast.error("Vehicle ID wajib");
    if (!(q > 0)) return toast.error("Qty harus > 0");
    if (!usageItemId && !usageItemName) return toast.error("Isi Item ID atau Nama Item");
    if (!usageItemUnit) return toast.error("Unit wajib");
    try {
      setIsSaving(true); setSavingText("Menyimpan Stok Sekali Pakai...");
      const recap = await ensureRecap();
      
      // Helper to save merk in notes as JSON
      const saveMerkToNotes = (merk: string, otherNotes: string): string => {
        if (!merk && !otherNotes) return '';
        const data: any = {};
        if (merk) data.merk = merk;
        if (otherNotes) data.notes = otherNotes;
        return JSON.stringify(data);
      };
      
      const payload: CreateStockUsagePayload = {
        vehicle_id: parseInt(vehicleId, 10),
        usage_date: new Date().toISOString().split("T")[0],
        notes: saveMerkToNotes(usageMerk, usageDescription || `Composer: ${usageItemName || "Item"}`),
        items: [ {
          item_id: usageItemId ? parseInt(usageItemId, 10) : undefined,
          item_name: usageItemName || undefined,
          unit: usageItemUnit,
          quantity: q,
          unit_price: usageUnitPrice ? parseFloat(usageUnitPrice) : undefined,
        } ],
        recap_number: recap.recap_number,
        cash_options: { create_cash: true, is_tempo: isTempo, account: composerAccount, supplier: composerSupplier || undefined, due_date: isTempo ? composerDueDate || undefined : undefined },
      };
      await createStockUsage(payload);
      toast.success("Stok langsung digunakan tersimpan");
    } catch (e: any) { console.error("saveStockUsage error:", e); toast.error(friendlyError(e)); } finally { setIsSaving(false); setSavingText(null); }
  };

  const queueStockAdd = () => {
    const q = parseFloat(qty || "0");
    const p = parseFloat(unitPrice || "0");
    if (!(q > 0)) return toast.error("Qty harus > 0");
    if (isNaN(p) || p < 0) return toast.error("Harga tidak valid");
    if (!itemId && !itemName) return toast.error("Isi itemId atau itemName");
    setQueuedStockAdds((prev) => [...prev, { itemId, itemName, itemUnit, qty, unitPrice, createNewBatch, description, rackRow, rackLevel, merk }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveStockAdd = async () => {
    const q = parseFloat(qty || "0");
    const p = parseFloat(unitPrice || "0");
    if (!(q > 0)) return toast.error("Qty harus > 0");
    if (!(p >= 0)) return toast.error("Harga tidak valid");
    try {
      setIsSaving(true); setSavingText("Menambah Stok...");
      const recap = await ensureRecap();
      let targetItemId = itemId ? parseInt(itemId, 10) : undefined;
      if (!targetItemId && !itemName) return toast.error("Isi itemId atau itemName");
      if (!targetItemId) {
        // Helper to save merk in notes as JSON
        const saveMerkToNotes = (merk: string, otherNotes: string): string => {
          if (!merk && !otherNotes) return '';
          const data: any = {};
          if (merk) data.merk = merk;
          if (otherNotes) data.notes = otherNotes;
          return JSON.stringify(data);
        };
        
        const createRes = await apiClient.post("/stock", { 
          item_name: itemName, 
          unit: itemUnit, 
          min_stock: 0,
          rack_row: rackRow ? parseInt(rackRow) : undefined,
          rack_level: rackLevel ? parseInt(rackLevel) : undefined,
          notes: saveMerkToNotes(merk || '', description || '') // Save merk in notes
        });
        targetItemId = createRes.data?.data?.id || createRes.data?.id;
      }
      await apiClient.post("/stock/adjust", { itemId: targetItemId, adjustmentType: "add", quantity: q, unit_price: p, supplier: composerSupplier || undefined, create_new_batch: createNewBatch, notes: description || `Tambah stok ${itemName || targetItemId}` });
      if (p > 0) {
        const cash = await addCashTransaction(q * p, description || `Pembelian stok ${itemName || targetItemId}`);
        await addItemToRecap(recap.id, { type: "cash", reference_id: cash.id, description: cash.description, amount: cash.amount } as any);
      }
      await addItemToRecap(recap.id, { type: "stock", reference_id: targetItemId!, description: description || `Stok masuk`, amount: q * p } as any);
      toast.success("Stok bertambah");
    } catch (e: any) { console.error("saveStockAdd error:", e); toast.error(friendlyError(e)); } finally { setIsSaving(false); setSavingText(null); }
  };

  const queueTirePurchase = () => {
    const q = parseInt(tireQty || "0", 10);
    const price = parseFloat(tireUnitPrice || "0");
    if (!tireBrand || !tireSize) return toast.error("Isi brand & ukuran");
    if (!(q > 0)) return toast.error("Qty ban wajib");
    if (!(price > 0)) return toast.error("Harga per ban wajib");
    setQueuedTirePurchases((prev) => [...prev, { brand: tireBrand, size: tireSize, type: tireType, condition: tireCondition, qty: tireQty, unitPrice: tireUnitPrice, date: tirePurchaseDate, description }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveTirePurchase = async () => {
    const q = parseInt(tireQty || "0", 10);
    const price = parseFloat(tireUnitPrice || "0");
    if (!tireBrand || !tireSize) return toast.error("Isi brand & ukuran");
    if (!(q > 0)) return toast.error("Qty ban wajib");
    if (!(price > 0)) return toast.error("Harga per ban wajib");
    try {
      setIsSaving(true); setSavingText("Menyimpan Pembelian Ban...");
      const a = q * price;
      const recap = await ensureRecap();
      const desc = description || `Beli Ban ${tireBrand} ${tireSize} x ${q}`;
      const cash = await addCashTransaction(a, desc);
      await addItemToRecap(recap.id, { type: "tire_purchase", reference_id: cash.id, description: desc, amount: a } as any);
      toast.success("Beli ban (kas) tersimpan");
    } catch (e: any) { console.error("saveTirePurchase error:", e); toast.error(friendlyError(e)); } finally { setIsSaving(false); setSavingText(null); }
  };

  const queueService = () => {
    const labor = parseFloat(laborCost || "0");
    if (!vehicleId) return toast.error("Vehicle ID wajib");
    if (serviceType !== "regular" && isNaN(labor)) return toast.error("Biaya jasa tidak valid");
    setQueuedServices((prev) => [...prev, { vehicleId, serviceDate, serviceType, workshopName, laborCost, description }]);
    toast.success("Ditambahkan ke antrian");
  };

  const saveService = async () => {
    const labor = parseFloat(laborCost || "0");
    if (!vehicleId) return toast.error("Kendaraan wajib dipilih");
    if (serviceType !== "regular" && isNaN(labor)) return toast.error("Biaya jasa tidak valid");
    
    // Validate vehicle ID
    const vehicleIdNum = parseInt(vehicleId, 10);
    if (isNaN(vehicleIdNum)) {
      return toast.error("ID kendaraan tidak valid");
    }
    
    const a = labor || 0;
    const recap = await ensureRecap();
    const selectedVehicle = vehicles.find(v => v.id === vehicleIdNum);
    const desc = description || (selectedVehicle ? `Servis kendaraan ${selectedVehicle.license_plate}` : "Servis kendaraan");
    
    try {
      setIsSaving(true); setSavingText("Menyimpan Servis...");
      // Create actual service record
      const serviceData = new FormData();
      serviceData.append('vehicle_id', vehicleIdNum.toString());
      serviceData.append('service_date', serviceDate || new Date().toISOString().split('T')[0]);
      serviceData.append('service_type', serviceType || 'regular');
      serviceData.append('description', desc);
      serviceData.append('workshop_name', workshopName || '');
      serviceData.append('labor_cost', laborCost || '0');
      serviceData.append('notes', `Created from Kas Composer - ${desc}`);
      serviceData.append('items', JSON.stringify([])); // Empty items array for now
      serviceData.append('cash_settings', JSON.stringify({ save_to_cash: true }));
      
      const serviceResponse = await apiClient.post('/services', serviceData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Create cash transaction if there's a cost
      if (a > 0) {
        const cash = await addCashTransaction(a, desc);
        await addItemToRecap(recap.id, { type: "service", reference_id: cash.id, description: `${desc}${workshopName ? ` @ ${workshopName}` : ""}`, amount: a } as any);
      }
      
      // Add service to recap
      await addItemToRecap(recap.id, { type: "service", reference_id: serviceResponse.data.data.id, description: desc, amount: a } as any);
      
      toast.success("Servis berhasil disimpan ke riwayat servis");
    } catch (error: any) { console.error("Service creation error:", error); toast.error(friendlyError(error)); } finally { setIsSaving(false); setSavingText(null); }
  };

  const queueCashNormal = () => {
    // Calculate amount from qty * unitPrice if both are provided, otherwise use manual amount
    let calculatedAmount = parseFloat(amount || "0");
    if (cashQty && cashUnitPrice) {
      const qty = parseFloat(cashQty);
      const unitPrice = parseFloat(cashUnitPrice);
      if (qty > 0 && unitPrice >= 0) {
        calculatedAmount = qty * unitPrice;
      }
    }
    
    if (!(calculatedAmount > 0)) return toast.error("Jumlah kas wajib (isi Qty × Harga Satuan atau Jumlah manual)");
    if (!cashItemName) return toast.error("Nama Item wajib");
    
    // Note: notaNumber and notaDate are NOT stored per item - they come from header (recap)
    setQueuedCash((prev) => [...prev, { 
      cashType, 
      categoryId: cashCategoryId, 
      amount: calculatedAmount.toString(), 
      itemName: cashItemName,
      unit: cashUnit,
      merk: cashMerk,
      qty: cashQty,
      unitPrice: cashUnitPrice,
      // notaNumber and notaDate removed - will use from header (recapNumber and composerTransactionDate)
      transactionDate: composerTransactionDate, 
      description: cashDescription || description, 
      files: cashFiles 
    }]);
    toast.success("Ditambahkan ke antrian");
    
    // Clear form fields after queueing
    setCashItemName("");
    setCashUnit("Pcs");
    setCashMerk("");
    setCashQty("");
    setCashUnitPrice("");
    setAmount("");
    setCashDescription("");
    setCashFiles([]);
    // Don't clear notaNumber and notaDate - they are header fields, not per-item
  };

  const saveAllQueued = async () => {
    try { setIsSaving(true); setSavingText("Menyimpan Antrian...");
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
          notes: saveMerkToNotes(u.merk || "", u.description || `Composer: ${u.itemName || "Item"}`),
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
          // Helper to save merk in notes as JSON
          const saveMerkToNotes = (merk: string, otherNotes: string): string => {
            if (!merk && !otherNotes) return '';
            const data: any = {};
            if (merk) data.merk = merk;
            if (otherNotes) data.notes = otherNotes;
            return JSON.stringify(data);
          };
          
          const createRes = await apiClient.post("/stock", { 
            item_name: s.itemName, 
            unit: s.itemUnit, 
            min_stock: 0,
            initial_stock: q,
            unit_price: p,
            supplier: composerSupplier || undefined,
            rack_row: s.rackRow ? parseInt(s.rackRow) : undefined,
            rack_level: s.rackLevel ? parseInt(s.rackLevel) : undefined,
            notes: saveMerkToNotes(s.merk || '', s.description || `Initial stock creation for ${s.itemName}`) // Save merk in notes
          });
          targetItemId = createRes.data?.data?.id || createRes.data?.id;
        } else {
          // Helper to save merk in notes as JSON
          const saveMerkToNotes = (merk: string, otherNotes: string): string => {
            if (!merk && !otherNotes) return '';
            const data: any = {};
            if (merk) data.merk = merk;
            if (otherNotes) data.notes = otherNotes;
            return JSON.stringify(data);
          };
          
          await apiClient.post("/stock/adjust", { 
            itemId: targetItemId, 
            adjustmentType: "add", 
            quantity: q, 
            unit_price: p, 
            supplier: composerSupplier || undefined, 
            create_new_batch: s.createNewBatch, 
            notes: saveMerkToNotes(s.merk || '', s.description || `Tambah stok ${s.itemName || targetItemId}`) // Save merk in notes
          });
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
        serviceData.append('notes', `Created from Kas Composer - ${desc}`);
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

      // Process plain cash - DON'T create individual transactions, only collect details for rekapan
      // Individual cash items will be part of the rekapan transaction only
      const allCashFiles: File[] = []; // Collect all files from cash items for rekapan
      for (const c of queuedCash) {
        const a = parseFloat(c.amount || "0");
        if (!(a > 0)) continue;
        totalAmount += a;
        
        // Collect files for rekapan transaction
        if (c.files && c.files.length > 0) {
          allCashFiles.push(...c.files);
        }
        
        // Build display description from item details
        let displayDesc = c.description || "Kas Biasa";
        if (c.itemName) {
          const parts = [c.itemName];
          if (c.qty && c.unit) parts.push(`${c.qty} ${c.unit}`);
          if (c.merk) parts.push(`Merk: ${c.merk}`);
          displayDesc = parts.join(" - ");
        }
        
        transactionDetails.push({
          type: "Cash",
          description: displayDesc,
          amount: a,
          supplier: composerSupplier || undefined,
          details: c
        });
      }

      // Create single rekapan nota transaction
      if (totalAmount > 0 && transactionDetails.length > 0) {
        const txnType = isTempo ? "kredit_tempo" : "kredit";
        const rekapanDescription = `Rekapan Nota ${recap.recap_number} - ${transactionDetails.length} transaksi`;
        
        // Use transaction date from header (composerTransactionDate)
        // No nota and tanggal nota come from header (recapNumber and composerTransactionDate)
        const rekapanTransactionDate = composerTransactionDate || new Date().toISOString().split('T')[0];
        const rekapanNotaDate = composerTransactionDate || new Date().toISOString().split('T')[0];
        
        // Create the main rekapan transaction with all collected files
        const rekapanTransaction = await createCashTransaction({
          transactionType: txnType,
          categoryId: cashCategoryId || undefined,
          amount: totalAmount,
          description: rekapanDescription,
          referenceNumberOverride: recap.recap_number, // Use recap number as reference
          notaNumber: recap.recap_number, // Use recap number as nota number from header
          notaDate: rekapanNotaDate, // Use transaction date from header as nota date
          transactionDate: rekapanTransactionDate,
          files: allCashFiles.length > 0 ? allCashFiles : undefined // Include all collected files
        });

        // Store detailed transaction info in a separate field (we'll use description field)
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
          tanggal_jatuh_tempo: isTempo ? composerDueDate || undefined : undefined
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
      setQueuedCash([]);

      toast.success(`Rekapan Nota ${recap.recap_number} berhasil dibuat dengan ${transactionDetails.length} transaksi`);
    } catch (e: any) { console.error("saveAllQueued error:", e); toast.error(friendlyError(e)); } finally { setIsSaving(false); setSavingText(null); }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Kas Composer</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Nota *</label>
            <input type="text" value={recapNumber} onChange={(e) => setRecapNumber(e.target.value)} placeholder="Kosongkan untuk auto" className="w-full border border-gray-300 rounded-md px-3 py-2" />
            <p className="text-xs text-gray-500 mt-1">Akan digunakan untuk semua item dalam rekapan</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tempo?</label>
            <select value={isTempo ? "yes" : "no"} onChange={(e) => setIsTempo(e.target.value === "yes")} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="no">Cash</option>
              <option value="yes">Tempo</option>
            </select>
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
          {isTempo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo</label>
              <input type="date" value={composerDueDate} onChange={(e) => setComposerDueDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Transaksi / Tanggal Nota *</label>
            <input type="date" value={composerTransactionDate} onChange={(e) => setComposerTransactionDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            <p className="text-xs text-gray-500 mt-1">Akan digunakan sebagai tanggal transaksi dan tanggal nota untuk semua item</p>
          </div>
        </div>
        {/* Queue Table */}
        {(queuedUsages.length > 0 || queuedStockAdds.length > 0 || queuedTirePurchases.length > 0 || queuedServices.length > 0 || queuedCash.length > 0) && (
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
                  {/* Queued Cash */}
                  {queuedCash.map((item, idx) => (
                    <tr key={`cash-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + idx + 1}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.cashType === "debit" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {item.cashType === "debit" ? "Debit" : "Kredit"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.itemName && (
                          <div className="font-medium">{item.itemName}</div>
                        )}
                        {item.qty && item.unit && (
                          <div className="text-gray-600">Qty: {item.qty} {item.unit}</div>
                        )}
                        {item.merk && (
                          <div className="text-gray-600">Merk: {item.merk}</div>
                        )}
                        {item.unitPrice && (
                          <div className="text-gray-600">Harga: Rp {parseFloat(item.unitPrice).toLocaleString('id-ID')}</div>
                        )}
                        {item.description && (
                          <div className="text-gray-500 mt-1">{item.description}</div>
                        )}
                        {/* Nota info will be shown at rekapan level, not per item */}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        <div className="font-bold">Rp {parseFloat(item.amount || "0").toLocaleString('id-ID')}</div>
                        {item.qty && item.unitPrice && (
                          <div className="text-xs text-gray-500">
                            ({item.qty} × Rp {parseFloat(item.unitPrice).toLocaleString('id-ID')})
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => setQueuedCash(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                      Total Item dalam Antrian:
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-left text-sm font-bold text-gray-900">
                      {queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + queuedCash.length} item
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Antrian: {queuedUsages.length + queuedStockAdds.length + queuedTirePurchases.length + queuedServices.length + queuedCash.length} item
          </div>
          <div className="flex gap-2">
            <button onClick={saveAllQueued} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded">Simpan Semua</button>
          </div>
        </div>
      </div>

      {/* Stok langsung digunakan */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Stok Langsung Digunakan</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih Kendaraan</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id.toString()}>{v.license_plate} (#{v.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Item ID (opsional)</label>
            <input type="number" value={usageItemId} onChange={(e) => setUsageItemId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Item</label>
            <input type="text" value={usageItemName} onChange={(e) => setUsageItemName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={usageItemUnit} onChange={(e) => setUsageItemUnit(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input type="text" value={usageMerk} onChange={(e) => setUsageMerk(e.target.value)} placeholder="Merk/Brand" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty</label>
            <input type="number" step="0.01" value={usageQty} onChange={(e) => setUsageQty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga Satuan (opsional)</label>
            <input type="number" step="0.01" value={usageUnitPrice} onChange={(e) => setUsageUnitPrice(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Keterangan</label>
            <input type="text" value={usageDescription} onChange={(e) => setUsageDescription(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedUsages.length}</div>
          <div className="flex gap-2">
            <button onClick={queueStockUsage} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
          </div>
        </div>
      </div>

      {/* Stok (Tambah) */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Stok (Tambah)</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Item ID (opsional)</label>
            <input type="number" value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Item</label>
            <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty</label>
            <input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga Satuan</label>
            <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rak Baris (1-4)</label>
            <input type="number" min="1" max="4" value={rackRow} onChange={(e) => setRackRow(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rak Tingkat (1-5)</label>
            <input type="number" min="1" max="5" value={rackLevel} onChange={(e) => setRackLevel(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input type="text" value={merk} onChange={(e) => setMerk(e.target.value)} placeholder="Merk/Brand" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Keterangan</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createNewBatch} onChange={(e) => setCreateNewBatch(e.target.checked)} />
            Buat batch baru (harga berbeda)
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedStockAdds.length}</div>
          <div className="flex gap-2">
            <button onClick={queueStockAdd} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
          </div>
        </div>
      </div>

      {/* Beli Ban */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Beli Ban</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <input type="text" value={tireBrand} onChange={(e) => setTireBrand(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ukuran</label>
            <input type="text" value={tireSize} onChange={(e) => setTireSize(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe</label>
            <select value={tireType} onChange={(e) => setTireType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih</option>
              <option value="Radial">Radial</option>
              <option value="Bias">Bias</option>
              <option value="Tubeless">Tubeless</option>
              <option value="Tube Type">Tube Type</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kondisi</label>
            <select value={tireCondition} onChange={(e) => setTireCondition(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="new">Baru</option>
              <option value="good">Baik</option>
              <option value="fair">Cukup</option>
              <option value="poor">Buruk</option>
              <option value="damaged">Rusak</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty</label>
            <input type="number" step="1" value={tireQty} onChange={(e) => setTireQty(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga/ban</label>
            <input type="number" step="0.01" value={tireUnitPrice} onChange={(e) => setTireUnitPrice(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Beli</label>
            <input type="date" value={tirePurchaseDate} onChange={(e) => setTirePurchaseDate(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Beli ban" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedTirePurchases.length}</div>
          <div className="flex gap-2">
            <button onClick={queueTirePurchase} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
          </div>
        </div>
      </div>

      {/* Servis */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Servis</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Kendaraan</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih Kendaraan</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate}
                </option>
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
              <option value="regular">Servis Reguler</option>
              <option value="with_parts">Servis + Suku Cadang</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Bengkel/Supplier</label>
            <input type="text" value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Biaya Jasa</label>
            <input type="number" step="0.01" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <label className="block text sm font-medium mb-1">Deskripsi</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Servis" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedServices.length}</div>
          <div className="flex gap-2">
            <button onClick={queueService} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
          </div>
        </div>
      </div>

      {/* Kas Biasa */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Kas Biasa</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tipe *</label>
            <select value={cashType} onChange={(e) => setCashType(e.target.value as any)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="debit">Debit (Pemasukan)</option>
              <option value="kredit">Kredit (Pengeluaran)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategori *</label>
            <select value={cashCategoryId} onChange={(e) => setCashCategoryId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih Kategori</option>
              {categories.filter((c) => (cashType === "debit" ? c.category_type === "income" : c.category_type === "expense")).map((c) => (
                <option key={c.id} value={c.id.toString()}>{c.category_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Item *</label>
            <input type="text" value={cashItemName} onChange={(e) => setCashItemName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Nama item" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input type="text" value={cashUnit} onChange={(e) => setCashUnit(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Pcs, Liter, dll" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input type="text" value={cashMerk} onChange={(e) => setCashMerk(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Merk/Brand" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Qty</label>
            <input type="number" step="0.01" value={cashQty} onChange={(e) => {
              setCashQty(e.target.value);
              // Auto-calculate amount if both qty and unitPrice are filled
              if (e.target.value && cashUnitPrice) {
                const qty = parseFloat(e.target.value);
                const unitPrice = parseFloat(cashUnitPrice);
                if (qty > 0 && unitPrice >= 0) {
                  setAmount((qty * unitPrice).toString());
                }
              }
            }} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Harga Satuan</label>
            <input type="number" step="0.01" value={cashUnitPrice} onChange={(e) => {
              setCashUnitPrice(e.target.value);
              // Auto-calculate amount if both qty and unitPrice are filled
              if (e.target.value && cashQty) {
                const qty = parseFloat(cashQty);
                const unitPrice = parseFloat(e.target.value);
                if (qty > 0 && unitPrice >= 0) {
                  setAmount((qty * unitPrice).toString());
                }
              }
            }} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah (auto atau manual)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Qty × Harga Satuan" />
            <p className="text-xs text-gray-500 mt-1">Otomatis: Qty × Harga Satuan</p>
          </div>
          {/* No. Nota and Tanggal Nota removed - they come from header (No. Nota field and Tanggal Transaksi) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Keterangan</label>
            <input type="text" value={cashDescription} onChange={(e) => setCashDescription(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Keterangan tambahan" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-1">Lampiran Nota</label>
            <input type="file" multiple accept="image/*" onChange={(e) => setCashFiles(e.target.files ? Array.from(e.target.files) : [])} className="w-full" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Dalam antrian: {queuedCash.length}</div>
          <div className="flex gap-2">
            <button onClick={queueCashNormal} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded">Tambah ke Antrian</button>
          </div>
        </div>
      </div>

      {/* Rekapan Detail Modal */}
      {showRekapanModal && selectedRekapan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Detail Rekapan Nota</h2>
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
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.merk || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.supplier || '-'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            Rp {transaction.amount.toLocaleString('id-ID')}
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
