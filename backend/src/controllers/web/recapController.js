// src/controllers/web/recapController.js
const db = require("../../models");
const { Op } = require("sequelize");

const { RecapNote, RecapNoteItem, Vehicle, CashTransaction, CashCategory, TempoDetail } = db;

const generateRecapNumber = async () => {
	const date = new Date();
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const prefix = `RCP-${yyyy}${mm}${dd}`;
	const last = await RecapNote.findOne({ where: { recap_number: { [Op.iLike]: `${prefix}-%` } }, order: [["recap_number", "DESC"]] });
	let seq = 1;
	if (last?.recap_number) {
		const parts = String(last.recap_number).split("-");
		seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
	}
	return `${prefix}-${String(seq).padStart(3, "0")}`;
};

exports.createRecap = async (req, res, next) => {
	const t = await db.sequelize.transaction();
	try {
		const { recap_number, recap_date, payment_mode, supplier, vehicle_id, notes } = req.body;
		if (!payment_mode || !["cash", "tempo"].includes(payment_mode)) {
			await t.rollback();
			return res.status(400).json({ success: false, message: "payment_mode must be 'cash' or 'tempo'" });
		}
		if (vehicle_id) {
			const vehicle = await Vehicle.findByPk(vehicle_id);
			if (!vehicle) {
				await t.rollback();
				return res.status(404).json({ success: false, message: "Vehicle not found" });
			}
		}
		const number = recap_number || (await generateRecapNumber());
		const creator = req.user?.username || null;
		const recap = await RecapNote.create({
			recap_number: number,
			recap_date: recap_date || new Date(),
			payment_mode,
			supplier: supplier || null,
			vehicle_id: vehicle_id || null,
			notes: notes || null,
			total_amount: 0,
			paid_amount: 0,
			status: "open",
			created_by: creator,
		}, { transaction: t });
		await t.commit();
		return res.status(201).json({ success: true, data: recap });
	} catch (err) {
		await t.rollback();
		return next(err);
	}
};

exports.listRecaps = async (req, res, next) => {
	try {
		const { page = 1, limit = 20, search, payment_mode, date_from, date_to, status } = req.query;
		const offset = (page - 1) * limit;
		const where = {};
		if (payment_mode) where.payment_mode = payment_mode;
		if (status) where.status = status;
		if (search) where.recap_number = { [Op.iLike]: `%${search}%` };
		if (date_from && date_to) where.recap_date = { [Op.between]: [new Date(date_from), new Date(date_to)] };
		const result = await RecapNote.findAndCountAll({
			where,
			include: [{ model: Vehicle, as: "vehicle", attributes: ["id", "license_plate"] }],
			order: [["recap_date", "DESC"], ["created_at", "DESC"]],
			limit: parseInt(limit),
			offset,
		});
		return res.json({ success: true, data: result.rows, pagination: { totalItems: result.count, totalPages: Math.ceil(result.count / limit), currentPage: parseInt(page) } });
	} catch (err) {
		return next(err);
	}
};

exports.getRecapDetail = async (req, res, next) => {
	try {
		const { id } = req.params;
		const recap = await RecapNote.findByPk(id, {
			include: [
				{ model: Vehicle, as: "vehicle", attributes: ["id", "license_plate"] },
				{ model: RecapNoteItem, as: "items" },
			],
		});
		if (!recap) return res.status(404).json({ success: false, message: "Recap not found" });
		return res.json({ success: true, data: recap });
	} catch (err) {
		return next(err);
	}
};

exports.addItemToRecap = async (req, res, next) => {
	const t = await db.sequelize.transaction();
	try {
		const { recap_id } = req.params;
		const { type, reference_id, description, amount } = req.body;
		const recap = await RecapNote.findByPk(recap_id, { transaction: t });
		if (!recap) {
			await t.rollback();
			return res.status(404).json({ success: false, message: "Recap not found" });
		}
		if (!type || !["service", "stock", "stock_usage", "cash", "tire_purchase"].includes(type)) {
			await t.rollback();
			return res.status(400).json({ success: false, message: "Invalid type" });
		}
		const amt = parseFloat(amount || 0);
		if (!(amt > 0)) {
			await t.rollback();
			return res.status(400).json({ success: false, message: "amount must be > 0" });
		}
		const item = await RecapNoteItem.create({ recap_id, type, reference_id: reference_id || null, description, amount: amt }, { transaction: t });
		await recap.update({ total_amount: parseFloat(recap.total_amount) + amt }, { transaction: t });
		await t.commit();
		return res.status(201).json({ success: true, data: item });
	} catch (err) {
		await t.rollback();
		return next(err);
	}
};

exports.payRecap = async (req, res, next) => {
	const t = await db.sequelize.transaction();
	try {
		const { recap_id } = req.params;
		const { pay_amount, account, description, settle_tempo } = req.body;
		const recap = await RecapNote.findByPk(recap_id, { include: [{ model: RecapNoteItem, as: "items" }], transaction: t });
		if (!recap) {
			await t.rollback();
			return res.status(404).json({ success: false, message: "Recap not found" });
		}
		const amount = parseFloat(pay_amount || 0);
		if (!(amount > 0)) {
			await t.rollback();
			return res.status(400).json({ success: false, message: "pay_amount must be > 0" });
		}
		let cashCategory = await CashCategory.findOne({ where: { category_name: "Pembayaran Recap", category_type: "expense" }, transaction: t });
		if (!cashCategory) {
			cashCategory = await CashCategory.create({ category_name: "Pembayaran Recap", category_type: "expense" }, { transaction: t });
		}
		const creator = req.user?.username || null;
		const cashTxn = await CashTransaction.create({
			transaction_type: "kredit",
			category_id: cashCategory.id,
			amount: amount,
			description: description || `Pembayaran recap ${recap.recap_number}`,
			reference_number: recap.recap_number,
			account: account || "cashbox",
			transaction_date: new Date(),
			last_edited_by: creator,
			last_edited_at: new Date(),
		}, { transaction: t });
		await recap.update({
			paid_amount: parseFloat(recap.paid_amount) + amount,
			status: parseFloat(recap.paid_amount) + amount >= parseFloat(recap.total_amount) ? "paid" : "partial",
		}, { transaction: t });

		if (settle_tempo === true) {
			// Optionally mark related tempo entries as paid up to the payment amount
			let remaining = amount;
			// Find recap cash items that originated as tempo (best-effort: rely on description/amount mapping)
			const cashItems = recap.items.filter((it) => it.type === "cash");
			for (const it of cashItems) {
				if (remaining <= 0) break;
				const tx = await CashTransaction.findByPk(it.reference_id, { transaction: t });
				if (tx && ["debit_tempo", "kredit_tempo"].includes(tx.transaction_type)) {
					const tempo = await TempoDetail.findOne({ where: { cash_transaction_id: tx.id }, transaction: t });
					if (tempo && tempo.status !== "lunas") {
						const cover = Math.min(parseFloat(tempo.amount), remaining);
						await tempo.update({ status: cover >= parseFloat(tempo.amount) ? "lunas" : "pending", payment_date: new Date(), payment_method: "recap" }, { transaction: t });
						remaining -= cover;
					}
				}
			}
		}

		await t.commit();
		return res.json({ success: true, data: { recap, cash_payment_id: cashTxn.id } });
	} catch (err) {
		await t.rollback();
		return next(err);
	}
};
