const { PurchaseOrder, DeliveryOrder, Sequelize } = require("../models");

// GET /api/purchase-orders - Get all POs with a count of their DOs
exports.getAllPurchaseOrders = async (req, res, next) => {
  try {
    const purchaseOrders = await PurchaseOrder.findAll({
      attributes: {
        include: [
          [
            Sequelize.fn("COUNT", Sequelize.col("deliveryOrders.id")),
            "total_delivery_orders",
          ],
          [
            Sequelize.fn(
              "SUM",
              Sequelize.literal(
                'CASE WHEN "deliveryOrders"."status" = \'completed\' THEN 1 ELSE 0 END'
              )
            ),
            "completed_delivery_orders",
          ],
        ],
      },
      include: [
        {
          model: DeliveryOrder,
          as: "deliveryOrders",
          attributes: [], // Don't include the actual DOs in this list view
        },
      ],
      group: ["PurchaseOrder.id"],
      order: [["order_date", "DESC"]],
    });
    res.json(purchaseOrders);
  } catch (err) {
    next(err);
  }
};

// GET /api/purchase-orders/:id - Get a single PO with all its DOs
exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: DeliveryOrder,
          as: "deliveryOrders", // This alias must match the one in models/index.js
          include: ["driver", "vehicle"], // Eager load driver and vehicle info for each DO
        },
      ],
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }
    res.json(purchaseOrder);
  } catch (err) {
    next(err);
  }
};

exports.getPurchaseOrderDetailsForNewDO = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tambahkan logging untuk debugging
    console.log(`Getting PO details for ID: ${id}`);

    const purchaseOrder = await PurchaseOrder.findByPk(id);

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    // 1. Hitung total kuantitas yang sudah terkirim untuk PO ini
    const deliveredSum = await DeliveryOrder.sum("actual_load_quantity", {
      where: {
        purchase_order_id: id,
        status: "completed", // Hanya hitung yang sudah selesai
        actual_load_quantity: { [Sequelize.Op.ne]: null }, // Yang punya actual quantity
      },
    });

    // 2. Hitung total kuantitas yang sudah di-assign (termasuk yang belum selesai)
    const assignedSum = await DeliveryOrder.sum("minimal_load_quantity", {
      where: {
        purchase_order_id: id,
        status: { [Sequelize.Op.ne]: "cancelled" }, // Kecuali yang dibatalkan
      },
    });

    // 3. Hitung jumlah DO yang sudah ada untuk PO ini untuk menentukan nomor urut berikutnya
    const doCount = await DeliveryOrder.count({
      where: { purchase_order_id: id },
    });
    const nextDoSequence = (doCount + 1).toString().padStart(3, "0");
    const generatedDoNumber = `${purchaseOrder.po_number}/${nextDoSequence}`;

    // 4. Siapkan data untuk dikirim ke frontend (DENGAN LOKASI)
    const totalQuantity = parseFloat(purchaseOrder.total_quantity);
    const initialQuantity = parseFloat(purchaseOrder.initial_quantity) || totalQuantity;
    const actualDelivered = parseFloat(deliveredSum) || 0;
    const totalAssigned = parseFloat(assignedSum) || 0;

    const details = {
      po_id: purchaseOrder.id,
      po_number: purchaseOrder.po_number,
      customer_name: purchaseOrder.customer_name,
      item_name: purchaseOrder.item_name,
      total_quantity: parseFloat(purchaseOrder.total_quantity),
      initial_quantity: parseFloat(purchaseOrder.initial_quantity),

      delivered_quantity: actualDelivered,
      assigned_quantity: totalAssigned,
      remaining_quantity: totalQuantity - totalAssigned,
      available_for_new_do: totalQuantity - totalAssigned,

      generated_do_number: generatedDoNumber,

      // === TAMBAHKAN DATA LOKASI ===
      load_location: purchaseOrder.load_location || "",
      unload_location: purchaseOrder.unload_location || "",
      load_latitude: purchaseOrder.load_latitude,
      load_longitude: purchaseOrder.load_longitude,
      unload_latitude: purchaseOrder.unload_latitude,
      unload_longitude: purchaseOrder.unload_longitude,
      has_location_data: !!(purchaseOrder.load_location && purchaseOrder.unload_location),
      has_coordinates: !!(
        purchaseOrder.load_latitude && purchaseOrder.load_longitude &&
        purchaseOrder.unload_latitude && purchaseOrder.unload_longitude
      ),
    };

    console.log("PO Details response:", details); // Debug log

    res.json(details);
  } catch (err) {
    console.error("Error in getPurchaseOrderDetailsForNewDO:", err);
    next(err);
  }
};
