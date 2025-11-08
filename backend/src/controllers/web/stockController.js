// src/controllers/web/stockController.js
const db = require("../../models");
const {
	StockItem,
	StockCategory,
	StockTransaction,
	StockBatch,
	ServiceItem,
	sequelize,
	StockUsageNote,
	StockUsageNoteItem,
	Vehicle,
	CashTransaction,
	TempoDetail,
	RecapNote,
	RecapNoteItem,
} = db;
const { Op } = require("sequelize");

// Helper to sanitize and build a base code from name
const sanitizeCodePart = (text) => {
	return (text || "")
		.toString()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 12);
};

const generateItemCode = async (itemName, categoryId) => {
	const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const basePart =
		sanitizeCodePart(itemName).split("-").slice(0, 2).join("") || "ITEM";
	const prefix = `${basePart}-${datePart}`;

	const lastItem = await StockItem.findOne({
		where: { item_code: { [Op.iLike]: `${prefix}-%` } },
		order: [["item_code", "DESC"]],
	});

	let sequence = 1;
	if (lastItem && lastItem.item_code) {
		const lastSeq = parseInt(String(lastItem.item_code).split("-").pop()) || 0;
		sequence = lastSeq + 1;
	}

	return `${prefix}-${sequence.toString().padStart(3, "0")}`;
};

// Helper function to generate batch number
const generateBatchNumber = async (itemId, itemCode) => {
	const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const prefix = `${itemCode || "ITM"}-${today}`;

	const lastBatch = await StockBatch.findOne({
		where: {
			item_id: itemId,
			batch_number: {
				[Op.like]: `${prefix}-%`,
			},
		},
		order: [["batch_number", "DESC"]],
	});

	let sequence = 1;
	if (lastBatch) {
		const lastSequence = parseInt(lastBatch.batch_number.split("-").pop()) || 0;
		sequence = lastSequence + 1;
	}

	return `${prefix}-${sequence.toString().padStart(3, "0")}`;
};

// Helper function to calculate current stock from batches
const calculateCurrentStock = async (itemId) => {
	const result = await StockBatch.findOne({
		where: { item_id: itemId },
		attributes: [
			[sequelize.fn("SUM", sequelize.col("quantity")), "total_quantity"],
			[
				sequelize.fn("SUM", sequelize.literal("quantity * unit_price")),
				"total_value",
			],
		],
	});

	const totalQuantity = parseFloat(result?.dataValues?.total_quantity) || 0;
	const totalValue = parseFloat(result?.dataValues?.total_value) || 0;
	const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

	return { totalQuantity, totalValue, averagePrice };
};

// Generate usage note number
const generateUsageNoteNumber = async () => {
	const date = new Date();
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const prefix = `USG-${yyyy}${mm}${dd}`;

	const last = await StockUsageNote.findOne({
		where: { note_number: { [Op.iLike]: `${prefix}-%` } },
		order: [["note_number", "DESC"]],
	});
	let seq = 1;
	if (last?.note_number) {
		const parts = String(last.note_number).split("-");
		const lastSeq = parseInt(parts[parts.length - 1]) || 0;
		seq = lastSeq + 1;
	}
	return `${prefix}-${String(seq).padStart(3, "0")}`;
};

// Get all stock items with calculated current stock (fixed version)
const getAllStockItems = async (req, res, next) => {
	try {
		const {
			category_id,
			low_stock,
			search,
			page = 1,
			limit = 10,
			startDate,
			endDate,
		} = req.query;
		const offset = (page - 1) * limit;

		let whereClause = {};
		if (category_id) whereClause.category_id = category_id;
		if (search) {
			whereClause[Op.or] = [
				{ item_name: { [Op.iLike]: `%${search}%` } },
				{ item_code: { [Op.iLike]: `%${search}%` } },
			];
		}
		if (startDate && endDate) {
			whereClause.created_at = {
				[Op.between]: [new Date(startDate), new Date(endDate)],
			};
		}

		// Step 1: Get accurate total count without includes to avoid join fuckery
		const totalItemsBase = await StockItem.count({
			where: whereClause,
			distinct: true,
			col: "id",
		});

		let totalItems = totalItemsBase;
		let filteredItems;

		if (low_stock === "true") {
			// For low_stock, compute global total: fetch all candidate items (no limit/offset)
			const allCandidates = await StockItem.findAll({
				where: whereClause,
				order: [["created_at", "DESC"]],
				// No includes here yet to keep it fast; we'll enrich below
			});

			// Enrich all candidates to compute is_low_stock
			const enhancedAll = await Promise.all(
				allCandidates.map(async (item) => {
					const { totalQuantity } = await calculateCurrentStock(item.id);
					return {
						id: item.id,
						is_low_stock: totalQuantity <= parseFloat(item.min_stock),
					};
				})
			);

			// Global low_stock IDs
			const lowStockIds = enhancedAll
				.filter((item) => item.is_low_stock)
				.map((item) => item.id);

			totalItems = lowStockIds.length;

			// Now fetch only the paginated low_stock items with full details
			const paginatedItems = await StockItem.findAll({
				where: { id: { [Op.in]: lowStockIds } },
				include: [
					{ model: StockCategory, as: "category", required: false },
					{
						model: StockBatch,
						as: "batches",
						attributes: [
							"id",
							"batch_number",
							"quantity",
							"unit_price",
							"purchase_date",
						],
						required: false,
					},
				],
				order: [["created_at", "DESC"]],
				limit: parseInt(limit),
				offset: offset,
			});

			// Enrich the paginated ones fully
			filteredItems = await Promise.all(
				paginatedItems.map(async (item) => {
					const itemData = item.toJSON();
					itemData.batches = (itemData.batches || []).filter(
						(batch) => batch.quantity > 0
					);
					const { totalQuantity, totalValue, averagePrice } =
						await calculateCurrentStock(item.id);

					return {
						...itemData,
						current_stock: totalQuantity,
						total_value: totalValue,
						average_unit_price: averagePrice,
						is_low_stock: totalQuantity <= parseFloat(item.min_stock),
						stock_status:
							totalQuantity <= 0
								? "out_of_stock"
								: totalQuantity <= parseFloat(item.min_stock)
								? "low_stock"
								: "adequate",
					};
				})
			);
		} else {
			// Normal case: fetch paginated with includes
			const paginatedItems = await StockItem.findAll({
				where: whereClause,
				include: [
					{ model: StockCategory, as: "category", required: false },
					{
						model: StockBatch,
						as: "batches",
						attributes: [
							"id",
							"batch_number",
							"quantity",
							"unit_price",
							"purchase_date",
						],
						required: false,
					},
				],
				order: [["created_at", "DESC"]],
				limit: parseInt(limit),
				offset: offset,
			});

			// Enrich
			filteredItems = await Promise.all(
				paginatedItems.map(async (item) => {
					const itemData = item.toJSON();
					itemData.batches = (itemData.batches || []).filter(
						(batch) => batch.quantity > 0
					);
					const { totalQuantity, totalValue, averagePrice } =
						await calculateCurrentStock(item.id);

					return {
						...itemData,
						current_stock: totalQuantity,
						total_value: totalValue,
						average_unit_price: averagePrice,
						is_low_stock: totalQuantity <= parseFloat(item.min_stock),
						stock_status:
							totalQuantity <= 0
								? "out_of_stock"
								: totalQuantity <= parseFloat(item.min_stock)
								? "low_stock"
								: "adequate",
					};
				})
			);
		}

		res.json({
			data: filteredItems,
			pagination: {
				totalItems,
				totalPages: Math.ceil(totalItems / limit),
				currentPage: parseInt(page),
			},
		});
	} catch (err) {
		console.error("Error in getAllStockItems:", err);
		next(err);
	}
};

// Create new stock item with initial batch
const createStockItem = async (req, res, next) => {
	const transaction = await sequelize.transaction();

	try {
		const {
			category_id,
			item_code,
			item_name,
			supplier,
			unit,
			rack_row,
			rack_level,
			min_stock,
			unit_price,
			initial_stock,
			notes,
		} = req.body;

		// Auto-generate item_code if missing or empty
		const finalItemCode =
			item_code && String(item_code).trim() !== ""
				? item_code
				: await generateItemCode(item_name, category_id);

		const stockItem = await StockItem.create(
			{
				category_id: category_id || null,
				item_code: finalItemCode,
				item_name,
				supplier:
					supplier && String(supplier).trim() !== ""
						? String(supplier).trim()
						: null,
				unit: unit || "Pcs",
				rack_row: rack_row ? parseInt(rack_row) : null,
				rack_level: rack_level ? parseInt(rack_level) : null,
				min_stock: parseFloat(min_stock) || 0,
				notes,
			},
			{ transaction }
		);

		if (initial_stock && parseFloat(initial_stock) > 0) {
			const batchNumber = await generateBatchNumber(
				stockItem.id,
				finalItemCode
			);
			const quantity = parseFloat(initial_stock);
			const price = parseFloat(unit_price) || 0;

			// ✅ FIXED: Create batch and capture reference
			const initialBatch = await StockBatch.create(
				{
					item_id: stockItem.id,
					batch_number: batchNumber,
					quantity: quantity,
					original_quantity: quantity,
					unit_price: price,
					supplier,
					notes: "Initial stock batch",
				},
				{ transaction }
			);

			// ✅ FIXED: Record transaction with proper batch_id
			await StockTransaction.create(
				{
					item_id: stockItem.id,
					batch_id: initialBatch.id, // ← This was missing!
					transaction_type: "in",
					quantity: quantity,
					unit_price: price,
					total_amount: quantity * price,
					reference_type: "initial_stock",
					notes: `Initial stock creation (Batch: ${batchNumber})`,
				},
				{ transaction }
			);

			await stockItem.update(
				{
					average_unit_price: price,
					total_value: quantity * price,
				},
				{ transaction }
			);
		}

		await transaction.commit();

		res.status(201).json({
			success: true,
			message: "Stock item created successfully",
			data: stockItem,
		});
	} catch (err) {
		await transaction.rollback();
		console.error("Error in createStockItem:", err);
		next(err);
	}
};

// Get stock item by ID
const getStockItemById = async (req, res, next) => {
	try {
		const { id } = req.params;

		if (isNaN(parseInt(id))) {
			return res.status(400).json({
				success: false,
				message: "Invalid stock item ID. Must be a number.",
			});
		}

		const stockItem = await StockItem.findByPk(parseInt(id), {
			include: [
				{ model: StockCategory, as: "category", required: false },
				{
					model: StockBatch,
					as: "batches",
					where: { quantity: { [Op.gt]: 0 } },
					required: false,
					order: [["purchase_date", "ASC"]],
				},
			],
		});

		if (!stockItem) {
			return res.status(404).json({
				success: false,
				message: "Stock item not found",
			});
		}

		const { totalQuantity, totalValue, averagePrice } =
			await calculateCurrentStock(id);

		res.json({
			success: true,
			data: {
				...stockItem.toJSON(),
				current_stock: totalQuantity,
				total_value: totalValue,
				average_unit_price: averagePrice,
				is_low_stock: totalQuantity <= parseFloat(stockItem.min_stock),
			},
		});
	} catch (err) {
		console.error("Error in getStockItemById:", err);
		next(err);
	}
};

// Update stock item
const updateStockItem = async (req, res, next) => {
	try {
		const { id } = req.params;
		const stockItem = await StockItem.findByPk(id);

		if (!stockItem) {
			return res.status(404).json({
				success: false,
				message: "Stock item not found",
			});
		}

		const {
			item_name,
			supplier,
			unit,
			rack_row,
			rack_level,
			min_stock,
			notes,
		} = req.body;

		await stockItem.update({
			item_name,
			supplier,
			unit,
			rack_row: rack_row ? parseInt(rack_row) : null,
			rack_level: rack_level ? parseInt(rack_level) : null,
			min_stock,
			notes,
		});
		res.json({
			success: true,
			message: "Stock item updated successfully",
			data: stockItem,
		});
	} catch (err) {
		console.error("Error in updateStockItem:", err);
		next(err);
	}
};

// FIFO Stock Adjustment (FIXED with proper batch_id recording)
const adjustStock = async (req, res, next) => {
	const transaction = await sequelize.transaction();

	try {
		const {
			itemId,
			adjustmentType,
			quantity,
			unit_price,
			supplier,
			notes,
			create_new_batch,
			// Edit mode fields
			item_name,
			rack_row,
			rack_level,
			min_stock,
			item_notes,
		} = req.body;

		// Editor info (set by auth middleware)
		const editor = req.user?.username || null;

		// Check if this is an edit operation (no quantity change)
		const isEditMode = adjustmentType === "edit";
		
		if (!itemId || !adjustmentType) {
			await transaction.rollback();
			return res.status(400).json({
				success: false,
				message: "Item ID and adjustment type are required",
			});
		}

		// For non-edit operations, quantity is required
		if (!isEditMode && (!quantity || parseFloat(quantity) <= 0)) {
			await transaction.rollback();
			return res.status(400).json({
				success: false,
				message: "Positive quantity is required for stock adjustments",
			});
		}

		const stockItem = await StockItem.findByPk(itemId, { transaction });
		if (!stockItem) {
			await transaction.rollback();
			return res.status(404).json({
				success: false,
				message: "Stock item not found",
			});
		}

		// Handle edit mode - update item properties without changing quantity
		if (isEditMode) {
			const updateData = {};
			let hasChanges = false;

			// Check which fields have changed
			if (item_name && item_name !== stockItem.item_name) {
				updateData.item_name = item_name;
				hasChanges = true;
			}
			if (rack_row !== undefined && parseInt(rack_row) !== stockItem.rack_row) {
				updateData.rack_row = rack_row ? parseInt(rack_row) : null;
				hasChanges = true;
			}
			if (rack_level !== undefined && parseInt(rack_level) !== stockItem.rack_level) {
				updateData.rack_level = rack_level ? parseInt(rack_level) : null;
				hasChanges = true;
			}
			if (min_stock !== undefined && parseFloat(min_stock) !== parseFloat(stockItem.min_stock)) {
				updateData.min_stock = parseFloat(min_stock);
				hasChanges = true;
			}
			if (item_notes !== undefined && item_notes !== stockItem.notes) {
				updateData.notes = item_notes;
				hasChanges = true;
			}

			if (hasChanges) {
				// Add audit fields
				updateData.last_edited_by = editor;
				updateData.last_edited_at = new Date();
				updateData.updated_at = new Date();

				await stockItem.update(updateData, { transaction });

				// Create a log entry for the edit
				await StockTransaction.create({
					item_id: itemId,
					batch_id: null,
					transaction_type: "adjustment",
					quantity: 0,
					unit_price: 0,
					total_amount: 0,
					reference_type: "edit",
					notes: `Edit item properties. ${notes || 'yang diedit disini tidak merubah data di buku kas ataupun tempo'}`,
				}, { transaction });

				await transaction.commit();

				// Return updated item
				const updatedItem = await StockItem.findByPk(itemId, {
					include: [
						{
							model: StockBatch,
							as: "batches",
						},
					],
				});

				return res.json({
					success: true,
					message: "Stock item updated successfully",
					data: {
						item_id: itemId,
						adjustment_type: "edit",
						quantity: 0,
						updated_item: updatedItem ? updatedItem.toJSON() : null,
					},
				});
			} else {
				await transaction.rollback();
				return res.json({
					success: true,
					message: "No changes detected",
					data: {
						item_id: itemId,
						adjustment_type: "edit",
						quantity: 0,
						updated_item: stockItem.toJSON(),
					},
				});
			}
		}

		const adjustmentQuantity = parseFloat(quantity);
		const price = parseFloat(unit_price) || 0;

		if (adjustmentType === "add") {
			let shouldCreateNewBatch = create_new_batch;
			let targetBatch = null;

			if (!shouldCreateNewBatch && price > 0) {
				const existingBatch = await StockBatch.findOne({
					where: {
						item_id: itemId,
						unit_price: price,
					},
					order: [["created_at", "DESC"]],
					transaction,
				});

				shouldCreateNewBatch = !existingBatch;
				targetBatch = existingBatch;
			}

			if (shouldCreateNewBatch) {
				const batchNumber = await generateBatchNumber(
					itemId,
					stockItem.item_code
				);

				// ✅ FIXED: Create new batch and capture the batch reference
				const newBatch = await StockBatch.create(
					{
						item_id: itemId,
						batch_number: batchNumber,
						quantity: adjustmentQuantity,
						original_quantity: adjustmentQuantity,
						unit_price: price,
						supplier,
						notes,
						// Audit
						last_edited_by: editor,
						last_edited_at: new Date(),
					},
					{ transaction }
				);

				// ✅ FIXED: Record transaction with proper batch_id
				await StockTransaction.create(
					{
						item_id: itemId,
						batch_id: newBatch.id, // ← This was missing!
						transaction_type: "in",
						quantity: adjustmentQuantity,
						unit_price: price,
						total_amount: adjustmentQuantity * price,
						reference_type: "adjustment",
						notes:
							notes ||
							`Stock adjustment - increase (New batch: ${batchNumber})`,
					},
					{ transaction }
				);
			} else {
				// ✅ FIXED: Adding to existing batch
				if (targetBatch) {
					await targetBatch.update(
						{
							quantity: parseFloat(targetBatch.quantity) + adjustmentQuantity,
							original_quantity:
								parseFloat(targetBatch.original_quantity) + adjustmentQuantity,
							// Audit
							last_edited_by: editor,
							last_edited_at: new Date(),
						},
						{ transaction }
					);

					// ✅ FIXED: Record transaction with proper batch_id
					await StockTransaction.create(
						{
							item_id: itemId,
							batch_id: targetBatch.id, // ← This was missing!
							transaction_type: "in",
							quantity: adjustmentQuantity,
							unit_price: price,
							total_amount: adjustmentQuantity * price,
							reference_type: "adjustment",
							notes:
								notes ||
								`Stock adjustment - increase (Added to batch: ${targetBatch.batch_number})`,
						},
						{ transaction }
					);
				}
			}
		} else if (adjustmentType === "deduct") {
			let remainingToDeduct = adjustmentQuantity;

			const batches = await StockBatch.findAll({
				where: {
					item_id: itemId,
					quantity: { [Op.gt]: 0 },
				},
				order: [
					["purchase_date", "ASC"],
					["created_at", "ASC"],
				],
				transaction,
			});

			const totalAvailable = batches.reduce(
				(sum, batch) => sum + parseFloat(batch.quantity),
				0
			);

			if (remainingToDeduct > totalAvailable) {
				await transaction.rollback();
				return res.status(400).json({
					success: false,
					message: `Insufficient stock. Available: ${totalAvailable}, Requested: ${remainingToDeduct}`,
				});
			}

			for (const batch of batches) {
				if (remainingToDeduct <= 0) break;

				const batchQuantity = parseFloat(batch.quantity);
				const deductFromBatch = Math.min(remainingToDeduct, batchQuantity);

				await batch.update(
					{
						quantity: batchQuantity - deductFromBatch,
						// Audit
						last_edited_by: editor,
						last_edited_at: new Date(),
					},
					{ transaction }
				);

				await StockTransaction.create(
					{
						item_id: itemId,
						batch_id: batch.id, // This was already correctly set
						transaction_type: "out",
						quantity: deductFromBatch,
						unit_price: batch.unit_price,
						total_amount: deductFromBatch * batch.unit_price,
						reference_type: "adjustment",
						notes:
							notes ||
							`Stock adjustment - decrease from batch ${batch.batch_number}`,
					},
					{ transaction }
				);

				remainingToDeduct -= deductFromBatch;
			}
		}

		// Update stock item averages
		const { totalQuantity, totalValue, averagePrice } =
			await calculateCurrentStock(itemId);
		await stockItem.update(
			{
				average_unit_price: averagePrice,
				total_value: totalValue,
				updated_at: new Date(),
				// Audit on item-level as well
				last_edited_by: editor,
				last_edited_at: new Date(),
			},
			{ transaction }
		);

		await transaction.commit();

		// Return updated item and batches so frontend can show audit info immediately
		const updatedItem = await StockItem.findByPk(itemId, {
			include: [
				{
					model: StockBatch,
					as: "batches",
				},
			],
		});

		res.json({
			success: true,
			message: "Stock adjusted successfully",
			data: {
				item_id: itemId,
				adjustment_type: adjustmentType,
				quantity: adjustmentQuantity,
				new_total_stock: totalQuantity,
				updated_item: updatedItem ? updatedItem.toJSON() : null,
			},
		});
	} catch (err) {
		await transaction.rollback();
		console.error("Error in adjustStock:", err);
		next(err);
	}
};

// Get stock item batches
const getStockBatches = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { includeEmpty = false } = req.query;

		if (!id || isNaN(parseInt(id))) {
			return res.status(400).json({
				success: false,
				message: "Invalid stock item ID",
			});
		}

		let whereClause = { item_id: parseInt(id) };

		// By default, only show batches with remaining stock
		if (includeEmpty !== "true") {
			whereClause.quantity = { [Op.gt]: 0 };
		}

		const batches = await StockBatch.findAll({
			where: whereClause,
			order: [
				["purchase_date", "ASC"],
				["created_at", "ASC"],
			],
		});

		// Enhance batch data with calculated fields
		const enhancedBatches = batches.map((batch) => {
			const usedQuantity = batch.original_quantity - batch.quantity;
			const usagePercentage = (usedQuantity / batch.original_quantity) * 100;

			return {
				...batch.toJSON(),
				used_quantity: usedQuantity,
				remaining_percentage: (100 - usagePercentage).toFixed(2),
				current_value: batch.quantity * batch.unit_price,
				status:
					batch.quantity === 0
						? "exhausted"
						: batch.quantity === batch.original_quantity
						? "unused"
						: "partial",
			};
		});

		res.json({
			success: true,
			data: enhancedBatches,
		});
	} catch (err) {
		console.error("Error in getStockBatches:", err);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: err.message,
		});
	}
};
// Delete stock item
const deleteStockItem = async (req, res, next) => {
	const transaction = await sequelize.transaction();

	try {
		const { id } = req.params;

		if (isNaN(parseInt(id))) {
			await transaction.rollback();
			return res.status(400).json({
				success: false,
				message: "Invalid stock item ID. Must be a number.",
			});
		}

		const stockItem = await StockItem.findByPk(parseInt(id), { transaction });
		if (!stockItem) {
			await transaction.rollback();
			return res.status(404).json({
				success: false,
				message: "Stock item not found",
			});
		}

		// Check for references in service items
		const usedInServices = await ServiceItem.count({
			where: { stock_item_id: id },
		});

		// Check for references in stock usage note items
		const usedInUsageNotes = await StockUsageNoteItem.count({
			where: { item_id: id },
		});

		if (usedInServices > 0 || usedInUsageNotes > 0) {
			await transaction.rollback();
			let message = "Cannot delete stock item. It has been used in:";
			if (usedInServices > 0) {
				message += ` ${usedInServices} service(s)`;
			}
			if (usedInUsageNotes > 0) {
				message += ` ${usedInUsageNotes} stock usage note(s)`;
			}
			message += ".";
			
			return res.status(400).json({
				success: false,
				message: message,
			});
		}

		// Delete related records in proper order to avoid foreign key constraints
		await StockTransaction.destroy({
			where: { item_id: id },
			transaction,
		});

		await StockBatch.destroy({
			where: { item_id: id },
			transaction,
		});

		await stockItem.destroy({ transaction });

		await transaction.commit();

		res.json({
			success: true,
			message: "Stock item deleted successfully",
		});
	} catch (err) {
		await transaction.rollback();
		console.error("Error in deleteStockItem:", err);
		next(err);
	}
};

// Get stock categories
const getStockCategories = async (req, res, next) => {
	try {
		const categories = await StockCategory.findAll({
			order: [["category_name", "ASC"]],
		});
		res.json({
			success: true,
			data: categories,
		});
	} catch (err) {
		console.error("Error in getStockCategories:", err);
		next(err);
	}
};

// Alternative approach - using correct association alias
const getStockItemHistory = async (req, res, next) => {
	try {
		const { id } = req.params;
		const {
			search,
			page = 1,
			limit = 10,
			startDate,
			endDate,
			batchId,
		} = req.query;
		const offset = (page - 1) * limit;

		let whereClause = { item_id: id };

		if (batchId) {
			whereClause.batch_id = batchId;
		}

		if (search) {
			whereClause.notes = { [Op.iLike]: `%${search}%` };
		}

		if (startDate && endDate) {
			whereClause.transaction_date = {
				[Op.between]: [new Date(startDate), new Date(endDate)],
			};
		}

		const result = await StockTransaction.findAndCountAll({
			where: whereClause,
			include: [
				{
					model: StockBatch,
					as: "batch",
					attributes: [
						"batch_number",
						"unit_price",
						"supplier",
						"purchase_date",
					],
					required: false,
				},
			],
			order: [
				["transaction_date", "DESC"],
				["created_at", "DESC"],
			],
			limit: parseInt(limit),
			offset: offset,
		});

		// ✅ FIXED: Use correct association alias
		let batchInfo = null;
		if (batchId) {
			batchInfo = await StockBatch.findByPk(batchId, {
				include: [
					{
						model: StockItem,
						as: "stockItem", // ✅ Use the correct alias defined in your association
						attributes: ["item_name", "item_code", "unit"],
					},
				],
			});
		}

		res.json({
			success: true,
			data: result.rows,
			batch_info: batchInfo,
			pagination: {
				totalItems: result.count,
				totalPages: Math.ceil(result.count / limit),
				currentPage: parseInt(page),
			},
		});
	} catch (err) {
		console.error("Error in getStockItemHistory:", err);
		next(err);
	}
};

const getStockBatchHistory = async (req, res, next) => {
	try {
		const { batchId } = req.params;
		const { page = 1, limit = 10 } = req.query;
		const offset = (page - 1) * limit;

		// Get batch information
		const batchInfo = await StockBatch.findByPk(batchId, {
			include: [
				{
					model: StockItem,
					as: "item",
					attributes: ["item_name", "item_code", "unit"],
				},
			],
		});

		if (!batchInfo) {
			return res.status(404).json({
				success: false,
				message: "Batch not found",
			});
		}

		// Get all transactions related to this batch
		const transactions = await StockTransaction.findAndCountAll({
			where: { batch_id: batchId },
			order: [
				["transaction_date", "DESC"],
				["created_at", "DESC"],
			],
			limit: parseInt(limit),
			offset: offset,
		});

		// Calculate batch lifecycle metrics
		const usedQuantity = batchInfo.original_quantity - batchInfo.quantity;
		const usagePercentage = (usedQuantity / batchInfo.original_quantity) * 100;

		res.json({
			success: true,
			data: {
				batch: {
					...batchInfo.toJSON(),
					used_quantity: usedQuantity,
					usage_percentage: usagePercentage.toFixed(2),
					remaining_percentage: (100 - usagePercentage).toFixed(2),
				},
				transactions: transactions.rows,
				lifecycle: {
					initial_quantity: batchInfo.original_quantity,
					current_quantity: batchInfo.quantity,
					used_quantity: usedQuantity,
					total_transactions: transactions.count,
					current_value: batchInfo.quantity * batchInfo.unit_price,
					total_value_used: usedQuantity * batchInfo.unit_price,
				},
			},
			pagination: {
				totalItems: transactions.count,
				totalPages: Math.ceil(transactions.count / limit),
				currentPage: parseInt(page),
			},
		});
	} catch (err) {
		console.error("Error in getStockBatchHistory:", err);
		next(err);
	}
};

// Add stock (for compatibility)
const addStock = async (req, res, next) => {
	return adjustStock(req, res, next);
};

// New: get distinct suppliers for autocomplete (5 most recent from stock activity, then others)
const getDistinctSuppliers = async (req, res, next) => {
	try {
		// 1) Recent suppliers by activity from stock_batches and stock_transactions
		const recentFromBatches = await StockBatch.findAll({
			attributes: [
				[sequelize.literal("TRIM(supplier)"), "supplier"],
				"created_at",
			],
			where: { supplier: { [Op.ne]: null } },
			order: [["created_at", "DESC"]],
			limit: 20,
			raw: true,
		});

		const recentFromTransactions = await StockTransaction.findAll({
			attributes: [
				[sequelize.literal("TRIM(supplier)"), "supplier"],
				"created_at",
			],
			where: { supplier: { [Op.ne]: null } },
			order: [["created_at", "DESC"]],
			limit: 20,
			raw: true,
		});

		const recentCombined = [...recentFromBatches, ...recentFromTransactions]
			.map((r) => ({
				supplier: String(r.supplier || "").trim(),
				created_at: new Date(r.created_at),
			}))
			.filter((r) => r.supplier.length > 0)
			.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

		const recentUnique = [];
		const seen = new Set();
		for (const r of recentCombined) {
			const key = r.supplier.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				recentUnique.push(r.supplier);
			}
			if (recentUnique.length >= 5) break;
		}

		// 2) All distinct suppliers from stock_items (for completeness)
		const allDistinct = await StockItem.findAll({
			attributes: [
				[sequelize.literal("DISTINCT TRIM(LOWER(supplier))"), "supplier"],
			],
			where: { supplier: { [Op.ne]: null } },
			raw: true,
		});

		const allList = allDistinct
			.map((r) => String(r.supplier || "").trim())
			.filter((s) => s.length > 0);

		// 3) Merge: recent first (original case from recent), then others (lower-cased), de-duped, and uppercase for UI consistency
		const lowerRecent = new Set(recentUnique.map((s) => s.toLowerCase()));
		const merged = [
			...recentUnique,
			...allList.filter((s) => !lowerRecent.has(s.toLowerCase())),
		].map((s) => s.toUpperCase());

		res.json({ success: true, data: merged });
	} catch (err) {
		console.error("Error in getDistinctSuppliers:", err);
		next(err);
	}
};

// Create usage note: stok yang langsung digunakan
const createUsageNote = async (req, res, next) => {
	const t = await sequelize.transaction();
	try {
		const { usage_date, vehicle_id, notes, items } = req.body;
		// items: [{ item_id? , item_name, quantity, unit_price? }]

		if (!vehicle_id) {
			await t.rollback();
			return res.status(400).json({ success: false, message: "vehicle_id is required" });
		}
		const vehicle = await Vehicle.findByPk(vehicle_id);
		if (!vehicle) {
			await t.rollback();
			return res.status(404).json({ success: false, message: "Vehicle not found" });
		}
		if (!Array.isArray(items) || items.length === 0) {
			await t.rollback();
			return res.status(400).json({ success: false, message: "items is required" });
		}

		const noteNumber = await generateUsageNoteNumber();
		const creator = req.user?.username || null;
		const note = await StockUsageNote.create(
			{
				note_number: noteNumber,
				usage_date: usage_date || new Date(),
				vehicle_id,
				notes: notes || null,
				created_by: creator,
			},
			{ transaction: t }
		);

		// Process each item with FIFO deduction; create item if needed
		for (const input of items) {
			let targetItemId = input.item_id || null;
			let unitPriceForTxn = 0;

			// Ensure stock item exists when item_id is provided, otherwise create it
			if (targetItemId) {
				const exists = await StockItem.findByPk(targetItemId, { transaction: t });
				if (!exists) {
					const code = await generateItemCode(input.item_name || "ITEM", null);
					const createdItem = await StockItem.create(
						{
							item_code: code,
							item_name: input.item_name || `Item ${targetItemId}`,
							unit: input.unit || "Pcs",
							min_stock: 0,
						},
						{ transaction: t }
					);
					targetItemId = createdItem.id;
				}
			} else {
				// Create stock item (non-batched yet)
				const code = await generateItemCode(input.item_name || "ITEM", null);
				const createdItem = await StockItem.create(
					{
						item_code: code,
						item_name: input.item_name || "Item",
						unit: input.unit || "Pcs",
						min_stock: 0,
					},
					{ transaction: t }
				);
				targetItemId = createdItem.id;
			}

			const qty = parseFloat(input.quantity);
			if (!qty || qty <= 0) {
				await t.rollback();
				return res.status(400).json({ success: false, message: "Invalid quantity" });
			}

			// FIFO deduct from existing batches
			let remaining = qty;
			let batches = await StockBatch.findAll({
				where: { item_id: targetItemId, quantity: { [Op.gt]: 0 } },
				order: [["purchase_date", "ASC"], ["created_at", "ASC"]],
				transaction: t,
			});

			const totalAvailable = batches.reduce((sum, b) => sum + parseFloat(b.quantity), 0);
			if (remaining > totalAvailable) {
				// Auto top-up: if unit_price provided, create a new batch for the shortfall, then continue
				const shortfall = remaining - totalAvailable;
				const topUpUnitPrice = parseFloat(input.unit_price || 0);
				if (topUpUnitPrice && topUpUnitPrice > 0) {
					const itemRecord = await StockItem.findByPk(targetItemId, { transaction: t });
					const newBatchNumber = await generateBatchNumber(targetItemId, itemRecord?.item_code);
					const creator = req.user?.username || null;
					const newBatch = await StockBatch.create({
						item_id: targetItemId,
						batch_number: newBatchNumber,
						quantity: shortfall,
						original_quantity: shortfall,
						unit_price: topUpUnitPrice,
						purchase_date: usage_date || new Date(),
						supplier: (req.body?.cash_options?.supplier) || null,
						notes: `Auto batch from usage note ${noteNumber}`,
						last_edited_by: creator,
						last_edited_at: new Date(),
					}, { transaction: t });
					// Append to batches list so FIFO loop can deduct from it as last resort
					batches = [...batches, newBatch];
				} else {
					await t.rollback();
					return res.status(400).json({ success: false, message: `Insufficient stock for ${input.item_name || targetItemId}. Available: ${totalAvailable}, requested: ${qty}. Provide unit_price to auto-top up.` });
				}
			}

			let accumulatedValue = 0;
			for (const batch of batches) {
				if (remaining <= 0) break;
				const batchQty = parseFloat(batch.quantity);
				const deduct = Math.min(remaining, batchQty);

				await batch.update({ quantity: batchQty - deduct }, { transaction: t });

				await StockTransaction.create(
					{
						item_id: targetItemId,
						batch_id: batch.id,
						transaction_type: "out",
						quantity: deduct,
						unit_price: batch.unit_price,
						total_amount: deduct * batch.unit_price,
						reference_type: "usage_note",
						reference_id: note.id,
						notes: `Usage note ${noteNumber} vehicle ${vehicle_id}`,
						transaction_date: usage_date || new Date(),
					},
					{ transaction: t }
				);

				accumulatedValue += deduct * parseFloat(batch.unit_price);
				remaining -= deduct;
			}

			unitPriceForTxn = qty > 0 ? accumulatedValue / qty : 0;

			await StockUsageNoteItem.create(
				{
					note_id: note.id,
					item_id: targetItemId,
					quantity: qty,
					unit_price: unitPriceForTxn,
					total_price: unitPriceForTxn * qty,
					from_stock: true,
				},
				{ transaction: t }
			);

			// Update stock item averages after deduction
			const { totalQuantity, totalValue, averagePrice } = await calculateCurrentStock(targetItemId);
			await StockItem.update(
				{
					average_unit_price: averagePrice,
					total_value: totalValue,
				},
				{ where: { id: targetItemId }, transaction: t }
			);
		}

		// After computing note and items, optionally create cash out and link to recap
		// Link to recap if recap_number provided
		const { recap_number, cash_options } = req.body;
		let recapRecord = null;
		let totalNoteAmount = 0;
		// compute total from created items and fetch item details for transactionDetails
		const createdItems = await StockUsageNoteItem.findAll({ 
			where: { note_id: note.id },
			include: [{ model: db.StockItem, as: 'stockItem', attributes: ['item_name', 'unit'], required: false }],
			transaction: t 
		});
		for (const it of createdItems) totalNoteAmount += parseFloat(it.total_price || 0);

		if (recap_number) {
			recapRecord = await db.RecapNote.findOne({ where: { recap_number }, transaction: t });
			if (!recapRecord) {
				recapRecord = await db.RecapNote.create(
					{
						recap_number,
						recap_date: usage_date || new Date(),
						payment_mode: (cash_options?.is_tempo ? "tempo" : "cash"),
						vehicle_id,
						notes: `Auto recap from usage note ${note.note_number}`,
						total_amount: 0,
						paid_amount: 0,
						status: "open",
						created_by: creator,
					},
					{ transaction: t }
				);
			}
			await db.RecapNoteItem.create(
				{
					recap_id: recapRecord.id,
					type: "stock_usage",
					reference_id: note.id,
					description: `Stok langsung digunakan ${note.note_number}`,
					amount: totalNoteAmount,
				},
				{ transaction: t }
			);
			await recapRecord.update({ total_amount: parseFloat(recapRecord.total_amount) + totalNoteAmount }, { transaction: t });
		}

		// Create cash out if requested
		if (cash_options?.create_cash === true) {
			const isTempo = cash_options?.is_tempo === true;
			const transaction_type = isTempo ? "kredit_tempo" : "kredit";
			const { CashTransaction, CashCategory, TempoDetail } = db;
			let cashCategory = await CashCategory.findOne({ where: { category_name: "Pengeluaran Mobil", category_type: "expense" }, transaction: t });
			if (!cashCategory) {
				cashCategory = await CashCategory.create({ category_name: "Pengeluaran Mobil", category_type: "expense", description: "Auto-created for stock usage" }, { transaction: t });
			}
			
			// Build transactionDetails for rekapan nota preview
			const transactionDetails = createdItems.map((item) => ({
				type: "Stock Usage",
				description: `${item.stockItem?.item_name || 'Item'} - ${item.quantity} ${item.stockItem?.unit || ''}`,
				amount: parseFloat(item.total_price || 0),
				supplier: cash_options?.supplier || null,
			}));
			
			// Create description with transactionDetails for rekapan nota support
			const descriptionObj = {
				transactionDetails: transactionDetails
			};
			const description = JSON.stringify(descriptionObj);
			
			const cashTxn = await CashTransaction.create(
				{
					transaction_type,
					category_id: cashCategory.id,
					amount: totalNoteAmount,
					description,
					reference_number: note.note_number,
					account: cash_options?.account || "cashbox",
					transaction_date: usage_date || new Date(),
					supplier: cash_options?.supplier || null,
					tanggal_jatuh_tempo: isTempo ? (cash_options?.due_date || null) : null,
					last_edited_by: creator,
					last_edited_at: new Date(),
				},
				{ transaction: t }
			);
			if (isTempo) {
				await db.TempoDetail.create(
					{
						cash_transaction_id: cashTxn.id,
						due_date: cash_options?.due_date || null,
						store_name: cash_options?.supplier || null,
						amount: totalNoteAmount,
						status: "pending",
						payment_date: null,
						payment_method: null,
						nota_attachment_url: [],
					},
					{ transaction: t }
				);
			}
			// Link cash to recap if present
			if (recapRecord) {
				await db.RecapNoteItem.create(
					{
						recap_id: recapRecord.id,
						type: "cash",
						reference_id: cashTxn.id,
						description: `Kas untuk ${note.note_number}`,
						amount: totalNoteAmount,
					},
					{ transaction: t }
				);
				await recapRecord.update({ paid_amount: parseFloat(recapRecord.paid_amount) + (isTempo ? 0 : totalNoteAmount), status: isTempo ? recapRecord.status : (parseFloat(recapRecord.paid_amount) + totalNoteAmount >= parseFloat(recapRecord.total_amount) ? "paid" : "partial") }, { transaction: t });
			}
		}

		await t.commit();
		return res.status(201).json({ success: true, message: "Usage note created", data: note });
	} catch (err) {
		await t.rollback();
		console.error("Error in createUsageNote:", err);
		return next(err);
	}
};

const listUsageNotes = async (req, res, next) => {
	try {
		const { page = 1, limit = 10, search, date_from, date_to, vehicle_id, supplier } = req.query;
		const offset = (page - 1) * limit;
		const where = {};
		if (vehicle_id) where.vehicle_id = vehicle_id;
		if (date_from && date_to) where.usage_date = { [Op.between]: [new Date(date_from), new Date(date_to)] };
		if (search) where.note_number = { [Op.iLike]: `%${search}%` };

		// If supplier filter is provided, find matching usage note IDs first
		let supplierFilteredIds = null;
		if (supplier) {
			const supplierPattern = `%${supplier}%`;
			
			// Find recap notes with matching supplier
			const matchingRecapNotes = await RecapNote.findAll({
				where: {
					supplier: { [Op.iLike]: supplierPattern }
				},
				attributes: ["id"],
				raw: true
			});
			const matchingRecapIds = matchingRecapNotes.map(r => r.id);
			
			// Find recap items linked to these recaps (stock_usage type)
			const matchingRecapItems = matchingRecapIds.length > 0 ? await RecapNoteItem.findAll({
				where: {
					recap_id: { [Op.in]: matchingRecapIds },
					type: "stock_usage"
				},
				attributes: ["reference_id"],
				raw: true
			}) : [];
			const usageNoteIdsFromRecap = matchingRecapItems.map(item => item.reference_id).filter(id => id);
			
			// Find cash transactions with matching supplier by note_number
			const matchingCashByNote = await CashTransaction.findAll({
				where: {
					supplier: { [Op.iLike]: supplierPattern },
					reference_number: { [Op.like]: "USG-%" }
				},
				attributes: ["reference_number"],
				raw: true
			});
			const matchingNoteNumbers = matchingCashByNote.map(ct => ct.reference_number).filter(n => n);
			const matchingUsageNotes = matchingNoteNumbers.length > 0 ? await StockUsageNote.findAll({
				where: {
					note_number: { [Op.in]: matchingNoteNumbers }
				},
				attributes: ["id"],
				raw: true
			}) : [];
			const usageNoteIdsFromCash = matchingUsageNotes.map(n => n.id);
			
			// Find cash transactions by recap_number
			const matchingCashByRecap = await CashTransaction.findAll({
				where: {
					supplier: { [Op.iLike]: supplierPattern },
					reference_number: { [Op.like]: "RCP-%" }
				},
				attributes: ["reference_number"],
				raw: true
			});
			const matchingRecapNumbers = matchingCashByRecap.map(ct => ct.reference_number).filter(n => n);
			const recapsWithSupplier = matchingRecapNumbers.length > 0 ? await RecapNote.findAll({
				where: {
					recap_number: { [Op.in]: matchingRecapNumbers }
				},
				attributes: ["id"],
				raw: true
			}) : [];
			const recapIdsFromCash = recapsWithSupplier.map(r => r.id);
			const recapItemsFromCash = recapIdsFromCash.length > 0 ? await RecapNoteItem.findAll({
				where: {
					recap_id: { [Op.in]: recapIdsFromCash },
					type: "stock_usage"
				},
				attributes: ["reference_id"],
				raw: true
			}) : [];
			const usageNoteIdsFromRecapCash = recapItemsFromCash.map(item => item.reference_id).filter(id => id);
			
			// Find cash items in recaps (RecapNoteItem with type='cash')
			const allRecapIds = [...new Set([...matchingRecapIds, ...recapIdsFromCash])];
			const recapCashItems = allRecapIds.length > 0 ? await RecapNoteItem.findAll({
				where: {
					recap_id: { [Op.in]: allRecapIds },
					type: "cash"
				},
				include: [{
					model: CashTransaction,
					as: "cashTransaction",
					where: {
						supplier: { [Op.iLike]: supplierPattern }
					},
					attributes: ["id"],
					required: true
				}],
				attributes: ["recap_id"]
			}) : [];
			const recapIdsFromCashItems = [...new Set(recapCashItems.map(item => {
				const plain = item.get ? item.get({ plain: true }) : item;
				return plain.recap_id || item.recap_id;
			}).filter(id => id))];
			const recapItemsFromCashItems = recapIdsFromCashItems.length > 0 ? await RecapNoteItem.findAll({
				where: {
					recap_id: { [Op.in]: recapIdsFromCashItems },
					type: "stock_usage"
				},
				attributes: ["reference_id"],
				raw: true
			}) : [];
			const usageNoteIdsFromCashItems = recapItemsFromCashItems.map(item => item.reference_id).filter(id => id);
			
			// Combine all matching usage note IDs
			supplierFilteredIds = [...new Set([
				...usageNoteIdsFromRecap,
				...usageNoteIdsFromCash,
				...usageNoteIdsFromRecapCash,
				...usageNoteIdsFromCashItems
			])].filter(id => id);
			
			console.log(`[listUsageNotes] Supplier filter "${supplier}" matched ${supplierFilteredIds.length} usage notes`);
			
			// If no matches found, return empty result
			if (supplierFilteredIds.length === 0) {
				return res.json({ 
					success: true, 
					data: [], 
					pagination: { totalItems: 0, totalPages: 0, currentPage: parseInt(page) } 
				});
			}
			
			// Add filter to where clause
			where.id = { [Op.in]: supplierFilteredIds };
		}

		// First get usage notes with vehicle
		const result = await StockUsageNote.findAndCountAll({
			where,
			include: [
				{ model: Vehicle, as: "vehicle", attributes: ["id", "license_plate"] },
				{ 
					model: StockUsageNoteItem, 
					as: "items", 
					attributes: ["id", "item_id", "quantity", "unit_price", "total_price"],
					include: [{
						model: StockItem,
						as: "stockItem",
						attributes: ["id", "item_name", "item_code", "unit"],
						required: false
					}]
				}
			],
			order: [["usage_date", "DESC"], ["created_at", "DESC"]],
			limit: parseInt(limit),
			offset,
		});

		console.log(`[listUsageNotes] Found ${result.rows.length} usage notes`);

		// Get recap items for these usage notes
		const usageNoteIds = result.rows.map(note => note.id);
		const usageNoteNumbers = result.rows.map(note => note.note_number);
		console.log(`[listUsageNotes] Looking for recap items for usage note IDs:`, usageNoteIds);
		
		const recapItems = usageNoteIds.length > 0 ? await RecapNoteItem.findAll({
			where: {
				type: "stock_usage",
				reference_id: { [Op.in]: usageNoteIds }
			},
			include: [{
				model: RecapNote,
				as: "recap",
				attributes: ["id", "recap_number", "recap_date", "payment_mode", "supplier", "status", "total_amount", "paid_amount"]
			}]
		}) : [];
		
		// Get recap IDs to find cash transactions linked to recaps
		const recapIds = [...new Set(recapItems.map(item => item.recap_id).filter(id => id))];
		
		// Get cash transactions for these usage notes by note_number
		const cashTransactionsByNote = usageNoteNumbers.length > 0 ? await CashTransaction.findAll({
			where: {
				reference_number: { [Op.in]: usageNoteNumbers }
			},
			attributes: ["id", "reference_number", "supplier"],
			raw: true
		}) : [];
		
		// Also get cash transactions linked to recaps via recap_number
		const recapNumbers = [...new Set(recapItems.map(item => item.recap?.recap_number).filter(n => n))];
		const cashTransactionsByRecap = recapNumbers.length > 0 ? await CashTransaction.findAll({
			where: {
				reference_number: { [Op.in]: recapNumbers }
			},
			attributes: ["id", "reference_number", "supplier"],
			raw: true
		}) : [];
		
		// Also get cash items from recaps (items with type 'cash' in the same recap)
		const recapCashItems = recapIds.length > 0 ? await RecapNoteItem.findAll({
			where: {
				recap_id: { [Op.in]: recapIds },
				type: "cash"
			},
			include: [{
				model: CashTransaction,
				as: "cashTransaction",
				attributes: ["id", "supplier"],
				required: false
			}],
			attributes: ["recap_id", "reference_id"]
		}) : [];
		
		// Create maps: note_number -> supplier, recap_number -> supplier, recap_id -> supplier
		const supplierMapByNote = {};
		cashTransactionsByNote.forEach(ct => {
			if (ct.supplier) {
				supplierMapByNote[ct.reference_number] = ct.supplier;
			}
		});
		
		const supplierMapByRecap = {};
		cashTransactionsByRecap.forEach(ct => {
			if (ct.supplier) {
				supplierMapByRecap[ct.reference_number] = ct.supplier;
			}
		});
		
		const supplierMapByRecapId = {};
		recapCashItems.forEach(item => {
			const plainItem = item.get ? item.get({ plain: true }) : item;
			let cashTxn = plainItem.cashTransaction || item.cashTransaction;
			// Ensure cashTransaction is also plain object
			if (cashTxn && cashTxn.get) {
				cashTxn = cashTxn.get({ plain: true });
			}
			if (cashTxn && cashTxn.supplier) {
				supplierMapByRecapId[plainItem.recap_id || item.recap_id] = cashTxn.supplier;
			}
		});
		
		console.log(`[listUsageNotes] Found ${cashTransactionsByNote.length} cash transactions by note_number`);
		console.log(`[listUsageNotes] Found ${cashTransactionsByRecap.length} cash transactions by recap_number`);
		console.log(`[listUsageNotes] Found ${recapCashItems.length} recap cash items`);

		console.log(`[listUsageNotes] Found ${recapItems.length} recap items`);

		// Group recap items by reference_id - ensure both are treated as numbers for matching
		const recapItemsMap = {};
		recapItems.forEach(item => {
			// Convert reference_id to number to match note.id
			const refId = parseInt(item.reference_id, 10);
			if (!isNaN(refId)) {
				if (!recapItemsMap[refId]) {
					recapItemsMap[refId] = [];
				}
				recapItemsMap[refId].push(item);
			}
		});
		
		console.log(`[listUsageNotes] Recap items map:`, Object.keys(recapItemsMap).map(key => ({
			reference_id: key,
			reference_id_type: typeof key,
			count: recapItemsMap[key].length,
			recap_number: recapItemsMap[key][0]?.recap?.recap_number
		})));
		
		console.log(`[listUsageNotes] Usage note IDs:`, usageNoteIds.map(id => ({ id, type: typeof id })));

		// Attach recap items to usage notes and convert to plain objects
		const notesWithRecaps = result.rows.map(note => {
			const plainNote = note.get({ plain: true });
			const matchingRecapItems = recapItemsMap[note.id] || [];
			
			// Get supplier from multiple sources: cash transaction by note_number, by recap_number, or from recap cash items
			const supplierFromNote = supplierMapByNote[plainNote.note_number];
			const recapNumber = matchingRecapItems[0]?.recap?.recap_number;
			const supplierFromRecap = recapNumber ? supplierMapByRecap[recapNumber] : null;
			const recapId = matchingRecapItems[0]?.recap?.id;
			const supplierFromRecapCash = recapId ? supplierMapByRecapId[recapId] : null;
			
			// Use first available supplier
			const supplierFromCash = supplierFromNote || supplierFromRecap || supplierFromRecapCash;
			
			// Convert recap items to plain objects
			const plainRecapItems = matchingRecapItems.map(item => {
				const plainItem = item.get({ plain: true });
				if (item.recap) {
					plainItem.recap = item.recap.get({ plain: true });
					// Override supplier from cash transaction if recap supplier is null
					if (!plainItem.recap.supplier && supplierFromCash) {
						plainItem.recap.supplier = supplierFromCash;
					}
					console.log(`[listUsageNotes] Note ${plainNote.note_number} recap:`, {
						recap_number: plainItem.recap.recap_number,
						supplier: plainItem.recap.supplier,
						supplier_from_cash: supplierFromCash,
						status: plainItem.recap.status
					});
				}
				return plainItem;
			});
			
			// Explicitly attach recapItems to the plain object - use Object.assign to ensure it's included
			const finalNote = Object.assign({}, plainNote, {
				recapItems: plainRecapItems
			});
			
			// Double-check that recapItems is in the object
			if (!finalNote.hasOwnProperty('recapItems')) {
				console.error(`[listUsageNotes] ERROR: recapItems not in finalNote for note ${plainNote.note_number}!`);
			}
			
			if (finalNote.recapItems && finalNote.recapItems.length > 0) {
				console.log(`[listUsageNotes] Note ${finalNote.note_number} (id: ${note.id}) has ${finalNote.recapItems.length} recap items`);
				console.log(`[listUsageNotes] Final note keys:`, Object.keys(finalNote));
				console.log(`[listUsageNotes] Final note recapItems:`, JSON.stringify(finalNote.recapItems[0], null, 2));
			} else {
				console.log(`[listUsageNotes] Note ${finalNote.note_number} (id: ${note.id}) has NO recap items. Map keys:`, Object.keys(recapItemsMap));
				console.log(`[listUsageNotes] Map check for id ${note.id}:`, recapItemsMap[note.id]);
			}
			
			return finalNote;
		});

		// Log final response structure for debugging
		if (notesWithRecaps.length > 0) {
			const firstNote = notesWithRecaps[0];
			console.log(`[listUsageNotes] Final response - first note keys:`, Object.keys(firstNote));
			console.log(`[listUsageNotes] Final response - first note has recapItems:`, !!firstNote.recapItems);
			console.log(`[listUsageNotes] Final response - first note recapItems length:`, firstNote.recapItems?.length || 0);
			if (firstNote.recapItems && firstNote.recapItems.length > 0) {
				console.log(`[listUsageNotes] Final response - first note recapItems:`, JSON.stringify(firstNote.recapItems[0], null, 2));
			}
		}
		
		return res.json({ success: true, data: notesWithRecaps, pagination: { totalItems: result.count, totalPages: Math.ceil(result.count / limit), currentPage: parseInt(page) } });
	} catch (err) {
		console.error("Error in listUsageNotes:", err);
		return next(err);
	}
};

const getUsageNoteDetail = async (req, res, next) => {
	try {
		const { id } = req.params;
		const note = await StockUsageNote.findByPk(id, {
			include: [
				{ model: Vehicle, as: "vehicle", attributes: ["id", "license_plate"] },
				{ model: StockUsageNoteItem, as: "items", include: [{ model: StockItem, as: "item", attributes: ["id", "item_name", "item_code", "unit"] }] },
			],
		});
		if (!note) return res.status(404).json({ success: false, message: "Usage note not found" });
		return res.json({ success: true, data: note });
	} catch (err) {
		return next(err);
	}
};

// Delete usage note with cascade cleanup (reverse stock, remove cash/recap)
const deleteUsageNote = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const note = await StockUsageNote.findByPk(id, { transaction: t });
    if (!note) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Usage note not found" });
    }

    // Reverse stock transactions for this note
    const txns = await StockTransaction.findAll({ where: { reference_type: "usage_note", reference_id: id }, transaction: t });
    for (const st of txns) {
      if (st.transaction_type === "out" && st.batch_id) {
        const batch = await StockBatch.findByPk(st.batch_id, { transaction: t });
        if (batch) {
          await batch.update({ quantity: parseFloat(batch.quantity) + parseFloat(st.quantity) }, { transaction: t });
        }
      }
      await st.destroy({ transaction: t });
    }

    // Remove recap links for this note and adjust totals
    const suItems = await RecapNoteItem.findAll({ where: { type: "stock_usage", reference_id: id }, transaction: t });
    for (const ri of suItems) {
      const recap = await RecapNote.findByPk(ri.recap_id, { transaction: t });
      if (recap) {
        const newTotal = Math.max(0, parseFloat(recap.total_amount || 0) - parseFloat(ri.amount || 0));
        await recap.update({ total_amount: newTotal, status: parseFloat(recap.paid_amount || 0) >= newTotal ? "paid" : (parseFloat(recap.paid_amount || 0) > 0 ? "partial" : "open") }, { transaction: t });
      }
      await ri.destroy({ transaction: t });
    }

    // Remove associated cash transaction by reference_number
    if (note.note_number) {
      const cash = await CashTransaction.findOne({ where: { reference_number: note.note_number }, transaction: t });
      if (cash) {
        const recapCashItems = await RecapNoteItem.findAll({ where: { type: "cash", reference_id: cash.id }, transaction: t });
        for (const ci of recapCashItems) {
          const recap = await RecapNote.findByPk(ci.recap_id, { transaction: t });
          if (recap) {
            const newPaid = Math.max(0, parseFloat(recap.paid_amount || 0) - parseFloat(ci.amount || 0));
            const newStatus = newPaid >= parseFloat(recap.total_amount || 0) ? "paid" : (newPaid > 0 ? "partial" : "open");
            await recap.update({ paid_amount: newPaid, status: newStatus }, { transaction: t });
          }
          await ci.destroy({ transaction: t });
        }
        await TempoDetail.destroy({ where: { cash_transaction_id: cash.id }, transaction: t });
        await cash.destroy({ transaction: t });
      }
    }

    await StockUsageNoteItem.destroy({ where: { note_id: id }, transaction: t });
    await note.destroy({ transaction: t });
    await t.commit();
    return res.json({ success: true, message: "Usage note deleted" });
  } catch (err) {
    await t.rollback();
    console.error("Error in deleteUsageNote:", err);
    return next(err);
  }
};

module.exports = {
	getAllStockItems,
	createStockItem,
	getStockItemById,
	updateStockItem,
	adjustStock,
	getStockBatchHistory,
	getStockBatches,
	deleteStockItem,
	getStockCategories,
	getStockItemHistory,
	addStock,
	getDistinctSuppliers,
	createUsageNote,
	listUsageNotes,
	getUsageNoteDetail,
	deleteUsageNote,
};
