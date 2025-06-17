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
    const deliveredSum = await DeliveryOrder.sum("quantity", {
      where: { purchase_order_id: id },
    });

    // 2. Hitung jumlah DO yang sudah ada untuk PO ini untuk menentukan nomor urut berikutnya
    const doCount = await DeliveryOrder.count({
      where: { purchase_order_id: id },
    });
    const nextDoSequence = (doCount + 1).toString().padStart(3, "0");
    const generatedDoNumber = `${purchaseOrder.po_number}/${nextDoSequence}`;

    // 3. Siapkan data untuk dikirim ke frontend (DENGAN LOKASI)
    const details = {
      po_id: purchaseOrder.id,
      po_number: purchaseOrder.po_number,
      customer_name: purchaseOrder.customer_name,
      item_name: purchaseOrder.item_name,
      total_quantity: parseFloat(purchaseOrder.total_quantity),
      delivered_quantity: parseFloat(deliveredSum) || 0,
      remaining_quantity:
        parseFloat(purchaseOrder.total_quantity) -
        (parseFloat(deliveredSum) || 0),
      generated_do_number: generatedDoNumber,
      // === TAMBAHKAN DATA LOKASI ===
      load_location: purchaseOrder.load_location || "",
      unload_location: purchaseOrder.unload_location || "",
      has_location_data: !!(
        purchaseOrder.load_location && purchaseOrder.unload_location
      ),
    };

    console.log("PO Details response:", details); // Debug log

    res.json(details);
  } catch (err) {
    console.error("Error in getPurchaseOrderDetailsForNewDO:", err);
    next(err);
  }
};
