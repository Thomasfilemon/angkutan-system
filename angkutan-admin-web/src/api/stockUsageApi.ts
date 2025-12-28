import apiClient from "./axiosConfig";

export interface StockUsageItemInput {
	item_id?: number;
	item_name?: string;
	unit?: string;
	quantity: number;
	unit_price?: number; // optional price per unit to record cost
	serial_number?: string; // optional serial number (for tires)
}

export interface CreateStockUsagePayload {
	usage_date?: string;
	vehicle_id: number;
	odometer?: number | null;
	hour_meter?: number | null;
	notes?: string;
	items: StockUsageItemInput[];
	recap_number?: string;
	cash_options?: {
		create_cash: boolean;
		is_tempo?: boolean;
		account?: string;
		supplier?: string;
		due_date?: string;
	};
}

export async function createStockUsage(payload: CreateStockUsagePayload) {
	const res = await apiClient.post("/stock/usage-notes", payload);
	return res.data;
}
