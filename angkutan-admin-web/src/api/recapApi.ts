import apiClient from "./axiosConfig";

export interface RecapNote {
	id: number;
	recap_number: string;
	recap_date: string;
	payment_mode: "cash" | "tempo";
	supplier?: string | null;
	vehicle_id?: number | null;
	notes?: string | null;
	total_amount: number;
	paid_amount: number;
	status: "open" | "partial" | "paid";
}

export interface RecapNoteItem {
	id: number;
	recap_id: number;
	type: "service" | "stock" | "stock_usage" | "cash" | "tire_purchase";
	reference_id?: number | null;
	description: string;
	amount: number;
	created_at: string;
}

export interface CreateRecapPayload {
	recap_number?: string;
	recap_date?: string;
	payment_mode: "cash" | "tempo";
	supplier?: string;
	vehicle_id?: number;
	notes?: string;
}

export interface ListRecapsParams {
	page?: number;
	limit?: number;
	search?: string;
	payment_mode?: "cash" | "tempo";
	date_from?: string;
	date_to?: string;
	status?: "open" | "partial" | "paid";
}

export interface PayRecapPayload {
	pay_amount: number;
	account?: string;
	description?: string;
	settle_tempo?: boolean;
}

export async function createRecap(payload: CreateRecapPayload) {
    const res = await apiClient.post("/recaps", payload);
    const body = res.data as any;
    return (body?.data ?? body) as RecapNote;
}

export async function listRecaps(params: ListRecapsParams = {}) {
	const res = await apiClient.get("/recaps", { params });
	return res.data; // full response preserved via interceptor skip
}

export async function getRecapDetail(id: number) {
    const res = await apiClient.get(`/recaps/${id}`);
    const body = res.data as any;
    return body?.data ?? body;
}

export async function addItemToRecap(recapId: number, item: Omit<RecapNoteItem, "id" | "recap_id" | "created_at">) {
    const res = await apiClient.post(`/recaps/${recapId}/items`, item);
    const body = res.data as any;
    return (body?.data ?? body) as RecapNoteItem;
}

export async function payRecap(recapId: number, payload: PayRecapPayload) {
	const res = await apiClient.post(`/recaps/${recapId}/pay`, payload);
	return res.data;
}
