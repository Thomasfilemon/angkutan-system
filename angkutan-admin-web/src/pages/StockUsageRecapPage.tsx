import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";

interface StockUsageNoteItem {
	id: number;
	item_id?: number;
	item_name?: string;
	unit?: string;
	quantity: number | string;
	unit_price?: number;
	total_price?: number;
	stockItem?: {
		id: number;
		item_name: string;
		item_code: string;
		unit: string;
	};
}

interface RecapInfo {
	id: number;
	recap_number: string;
	recap_date: string;
	payment_mode: "cash" | "tempo";
	supplier?: string;
	status: "open" | "partial" | "paid";
	total_amount: number;
	paid_amount: number;
}

interface RecapItem {
	id: number;
	recap_id: number;
	type: string;
	amount: number;
	description: string;
	recap?: RecapInfo;
}

interface StockUsageNote {
	id: number;
	note_number: string;
	usage_date: string;
	vehicle_id: number;
	odometer?: number | null;
	hour_meter?: number | null;
	notes?: string;
	vehicle: {
		id: number;
		license_plate: string;
	};
	items: StockUsageNoteItem[];
	recapItems?: RecapItem[];
}

const StockUsageRecapPage = () => {
	const [usageNotes, setUsageNotes] = useState<StockUsageNote[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [totalItems, setTotalItems] = useState(0);
	const [searchTerm, setSearchTerm] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [vehicleFilter, setVehicleFilter] = useState("");
	const [supplierFilter, setSupplierFilter] = useState("");
	const [vehicles, setVehicles] = useState<Array<{ id: number; license_plate: string }>>([]);

	const formatCurrency = (value: number | null | undefined): string => {
		if (value === null || value === undefined || isNaN(value)) {
			return "-";
		}
		return `Rp ${value.toLocaleString("id-ID")}`;
	};

	const formatDate = (dateString: string | null | undefined): string => {
		if (!dateString) return "-";
		try {
			return new Date(dateString).toLocaleDateString("id-ID");
		} catch {
			return "-";
		}
	};

	// Helper function to parse merk & keterangan from notes (stored as JSON)
	const parseNotesMetadata = (notes?: string): { merk: string; keterangan: string } => {
		if (!notes) return { merk: "-", keterangan: "-" };
		try {
			const parsed = JSON.parse(notes);
			const merk = parsed.merk || "-";
			const keterangan = parsed.notes || parsed.otherNotes || "-";
			return {
				merk: merk || "-",
				keterangan: keterangan && String(keterangan).trim().length > 0 ? String(keterangan) : "-",
			};
		} catch {
			// If not JSON, treat the raw notes as keterangan
			return { merk: "-", keterangan: notes || "-" };
		}
	};

	// Fetch vehicles for filter
	useEffect(() => {
		apiClient.get("/vehicles", { params: { page: 1, limit: 200 } }).then((res) => {
			const body = res?.data;
			const list = Array.isArray(body) ? body : (body?.data || body?.records || []);
			setVehicles((list || []).map((v: any) => ({ id: v.id, license_plate: v.license_plate })));
		}).catch(() => {});
	}, []);

	const fetchUsageNotes = async (page: number = 1) => {
		try {
			setLoading(true);
			const params: any = {
				page,
				limit: 20,
			};
			if (searchTerm) params.search = searchTerm;
			if (dateFrom && dateTo) {
				params.date_from = dateFrom;
				params.date_to = dateTo;
			}
			if (vehicleFilter) params.vehicle_id = vehicleFilter;
			if (supplierFilter) params.supplier = supplierFilter;

			const response = await apiClient.get("/stock/usage-notes", { params });
			
			// Log the full response structure
			console.log("Response structure:", {
				hasData: !!response.data,
				hasDataData: !!response.data?.data,
				dataType: Array.isArray(response.data?.data) ? 'array' : typeof response.data?.data,
				dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 'N/A',
				firstItemKeys: response.data?.data?.[0] ? Object.keys(response.data.data[0]) : []
			});
			
			const data = response.data?.data || [];
			const pagination = response.data?.pagination || {};

			console.log("Full response:", response);
			console.log("Fetched usage notes:", data);
			console.log("Usage notes count:", data.length);
			
			// Detailed logging for recap items
			data.forEach((n: StockUsageNote, index: number) => {
				console.log(`Note ${index + 1}:`, {
					id: n.id,
					note_number: n.note_number,
					recapItems_count: n.recapItems?.length || 0,
					recapItems: n.recapItems,
					recap: n.recapItems?.[0]?.recap,
					recap_number: n.recapItems?.[0]?.recap?.recap_number,
					supplier: n.recapItems?.[0]?.recap?.supplier
				});
			});

			setUsageNotes(data);
			setTotalPages(pagination.totalPages || 0);
			setTotalItems(pagination.totalItems || 0);
			setCurrentPage(pagination.currentPage || 1);
		} catch (err: any) {
			const errorMsg = err?.response?.data?.message || err?.message || "Gagal memuat data stok skali lewat";
			setError(errorMsg);
			console.error("Error fetching usage notes:", err);
			if (err?.response?.status === 400) {
				console.error("400 Bad Request - Check backend route order");
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUsageNotes(1);
	}, []);

	const handleSearch = (e?: React.MouseEvent<HTMLButtonElement>) => {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		fetchUsageNotes(1);
	};

	const handleResetFilters = () => {
		// Reset all filters and refresh the page
		window.location.reload();
	};

	const handlePageChange = (page: number) => {
		fetchUsageNotes(page);
	};

	const getStatusBadge = (status: string) => {
		const colors: Record<string, string> = {
			open: "bg-yellow-100 text-yellow-800",
			partial: "bg-blue-100 text-blue-800",
			paid: "bg-green-100 text-green-800",
		};
		const labels: Record<string, string> = {
			open: "Belum Lunas",
			partial: "Sebagian",
			paid: "Lunas",
		};
		return (
			<span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}>
				{labels[status] || status}
			</span>
		);
	};

	if (loading && usageNotes.length === 0) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-gray-500">Memuat data...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-3xl font-bold text-gray-800">Stok Skali Lewat Recap</h1>
				<Link to="/cash/composer">
					<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
						+ Tambah Stok Skali Lewat
					</button>
				</Link>
			</div>

			{/* Filters */}
			<div className="bg-white p-4 rounded-lg shadow mb-6">
				<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Cari No. Nota</label>
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="No. nota..."
							className="w-full border border-gray-300 rounded-md px-3 py-2"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
						<input
							type="text"
							value={supplierFilter}
							onChange={(e) => setSupplierFilter(e.target.value)}
							placeholder="Supplier..."
							className="w-full border border-gray-300 rounded-md px-3 py-2"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Kendaraan</label>
						<select
							value={vehicleFilter}
							onChange={(e) => setVehicleFilter(e.target.value)}
							className="w-full border border-gray-300 rounded-md px-3 py-2"
						>
							<option value="">Semua Kendaraan</option>
							{vehicles.map((v) => (
								<option key={v.id} value={v.id.toString()}>
									{v.license_plate} (#{v.id})
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
						<input
							type="date"
							value={dateFrom}
							onChange={(e) => setDateFrom(e.target.value)}
							className="w-full border border-gray-300 rounded-md px-3 py-2"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
						<input
							type="date"
							value={dateTo}
							onChange={(e) => setDateTo(e.target.value)}
							className="w-full border border-gray-300 rounded-md px-3 py-2"
						/>
					</div>
					<div className="flex items-end gap-2">
						<button
							type="button"
							onClick={(e) => handleSearch(e)}
							className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
						>
							Cari
						</button>
						<button
							type="button"
							onClick={handleResetFilters}
							className="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
						>
							Reset
						</button>
					</div>
				</div>
			</div>

			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
					{error}
				</div>
			)}

			<div className="bg-white shadow-md rounded-lg overflow-x-auto">
				<table className="min-w-full leading-normal">
					<thead>
						<tr>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								No. Nota
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Tanggal
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Odo / Hour Meter
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								No. Pol
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Supplier
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Nama Barang - Merk
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Satuan
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Harga Satuan
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Total Harga
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								Keterangan
							</th>
							<th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
								No Seri
							</th>
						</tr>
					</thead>
					<tbody>
						{usageNotes.map((note) => {
							// Try multiple ways to access recap data
							const recapItem = note.recapItems?.[0] || (note as any).recapItems?.[0];
							const recap = recapItem?.recap || (recapItem as any)?.recap;
							
							// Debug for each note to see what we have
							if (!recap && note.id === usageNotes[0]?.id) {
								console.log("DEBUG - First note recap data:", {
									note_id: note.id,
									note_number: note.note_number,
									hasRecapItems: !!note.recapItems,
									recapItemsLength: note.recapItems?.length || 0,
									recapItems: note.recapItems,
									recapItem: recapItem,
									recap: recap,
									allKeys: Object.keys(note)
								});
							}
							
							const totalItems = note.items?.length || 0;
							const totalQuantity = note.items?.reduce((sum, item) => {
								const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity?.toString() || "0");
								return sum + qty;
							}, 0) || 0;
							const firstItem = note.items?.[0];
							const unit = firstItem?.stockItem?.unit || firstItem?.unit || "Pcs";
							
							// Calculate total price and unit price
							const totalPrice = note.items?.reduce((sum, item) => {
								const price = parseFloat(item.total_price?.toString() || "0");
								return sum + price;
							}, 0) || 0;
							
							const unitPrice = firstItem ? parseFloat(firstItem.unit_price?.toString() || "0") : 0;
							const serialNumber = (firstItem as any)?.serial_number || "-";
							const { merk, keterangan } = parseNotesMetadata(note.notes);

							const odoDisplay =
								(note.odometer !== null && note.odometer !== undefined && !isNaN(Number(note.odometer)))
									? `Odo: ${note.odometer}`
									: undefined;
							const hourDisplay =
								(note.hour_meter !== null && note.hour_meter !== undefined && !isNaN(Number(note.hour_meter)))
									? `Hour: ${note.hour_meter}`
									: undefined;

							return (
								<tr key={note.id} className="hover:bg-gray-50">
									<td className="px-5 py-3 border-b border-gray-200 text-sm">
										<span className="font-medium text-gray-900">{note.note_number}</span>
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
										{formatDate(note.usage_date)}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
										{odoDisplay || hourDisplay ? (
											<span>
												{odoDisplay}
												{odoDisplay && hourDisplay ? " / " : ""}
												{!odoDisplay && hourDisplay ? hourDisplay : hourDisplay && !odoDisplay ? hourDisplay : ""}
											</span>
										) : (
											<span className="text-gray-400">-</span>
										)}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
										{note.vehicle?.license_plate || `#${note.vehicle_id}`}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
										{recap?.supplier || "-"}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
										{firstItem
											? `${firstItem.stockItem?.item_name || firstItem.item_name || "-"}${merk && merk !== "-" ? ` - ${merk}` : ""}`
											: "-"}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
										{unit || "-"}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-right">
										{unitPrice > 0 ? formatCurrency(unitPrice) : "-"}
									</td>
									<td className="px-5 py-3 border-b border-gray-200 text-sm text-right">
										{totalPrice > 0 ? formatCurrency(totalPrice) : "-"}
									</td>
							<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
								{keterangan}
							</td>
							<td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-900">
								{serialNumber || "-"}
							</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="mt-4 flex justify-center items-center gap-2">
					<button
						onClick={() => handlePageChange(currentPage - 1)}
						disabled={currentPage === 1}
						className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
					>
						Sebelumnya
					</button>
					<span className="px-4 py-2 text-sm text-gray-700">
						Halaman {currentPage} dari {totalPages} ({totalItems} total)
					</span>
					<button
						onClick={() => handlePageChange(currentPage + 1)}
						disabled={currentPage >= totalPages}
						className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
					>
						Selanjutnya
					</button>
				</div>
			)}

			{usageNotes.length === 0 && !loading && (
				<div className="text-center py-8 text-gray-500">
					Tidak ada data stok skali lewat
				</div>
			)}
		</div>
	);
};

export default StockUsageRecapPage;

