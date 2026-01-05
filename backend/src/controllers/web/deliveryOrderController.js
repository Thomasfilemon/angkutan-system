const {
  DeliveryOrder,
  DepositGroupMember,
  DepositGroup,
  PurchaseOrder,
  Vehicle,
  DriverProfile,
  User,
  BigDeliveryOrder,
  DeliveryOrderAdjustments,
  DeliveryOrderPayments,
  BigDoTambahan,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { Expo } = require("expo-server-sdk");
const { v4: uuidv4 } = require("uuid"); // New import for UUIDs – install if needed: npm i uuid

// Enhanced calculation helpers with unit awareness (unchanged)
const calculateTotalAmount = (quantity, unitPrice, unit) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  switch (unit) {
    case "kilogram":
    case "ton":
    case "kubik":
      return qty * price; // Direct: price is per the unit
    default:
      return 0; // Invalid unit: safe default
  }
};

const calculateOngkosan = (
  totalAmount,
  tripAllowance,
  gaji,
  additionalAllowances = []
) => {
  const total = parseFloat(totalAmount) || 0;
  const allowance = parseFloat(tripAllowance) || 0;
  const salary = parseFloat(gaji) || 0;
  const additional = Array.isArray(additionalAllowances)
    ? additionalAllowances.reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
    : 0;

  return total - allowance - salary - additional;
};

// New helper: Validate driver availability
const validateDriverAvailability = async (driver_id, transaction) => {
  const activeDriverDelivery = await DeliveryOrder.findOne({
    where: {
      driver_id,
      status: {
        [Op.in]: [
          "assigned",
          "otw_to_load_location",
          "at_load_location",
          "otw_to_unload_location",
          "at_unload_location",
          "otw_to_base",
        ],
      },
    },
    transaction,
  });
  if (activeDriverDelivery) {
    throw new Error(
      `Driver is already assigned to active delivery order: ${activeDriverDelivery.do_number}`
    );
  }

  const existingBigDO = await BigDeliveryOrder.findOne({
    where: {
      driver_id,
      status: { [Op.in]: ["assigned", "in_progress"] },
    },
    transaction,
  });
  if (existingBigDO) {
    throw new Error(
      `Driver is already assigned to Big DO: ${existingBigDO.big_do_number}`
    );
  }
};

// New helper: Validate vehicle availability
const validateVehicleAvailability = async (vehicle_id, transaction) => {
  const activeVehicleDelivery = await DeliveryOrder.findOne({
    where: {
      vehicle_id,
      status: {
        [Op.in]: [
          "assigned",
          "otw_to_load_location",
          "at_load_location",
          "otw_to_unload_location",
          "at_unload_location",
          "otw_to_base",
        ],
      },
    },
    transaction,
  });
  if (activeVehicleDelivery) {
    throw new Error(
      `Vehicle is already assigned to active delivery order: ${activeVehicleDelivery.do_number}`
    );
  }
};

// New helper: Validate item against PO
const validateItemAgainstPO = async (
  purchase_order_id,
  item_name,
  transaction
) => {
  if (!purchase_order_id || !item_name) return;

  const po = await PurchaseOrder.findByPk(purchase_order_id, { transaction });
  if (!po) {
    throw new Error("Purchase Order not found");
  }
  const poItems = po.item_name
    ? po.item_name.split(",").map((i) => i.trim().toLowerCase())
    : [];
  if (!poItems.includes(item_name.trim().toLowerCase())) {
    throw new Error(`Invalid item_name for PO`);
  }
  return po; // Return PO for further use
};

// 🎯 CREATE DELIVERY ORDER(S) - Now handles batch or single
// POST /api/web/delivery-orders/batch
// Body: { delivery_orders: [{...do fields...}, ...] } for batch, or just {...do fields...} for single
exports.createBatchDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    let deliveryOrdersData = req.body.delivery_orders || [req.body];
    if (!Array.isArray(deliveryOrdersData) || deliveryOrdersData.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Provide an array of delivery orders or a single object.",
      });
    }

    if (deliveryOrdersData.length > 20) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Maximum 20 DOs per request.",
      });
    }

    const createdDOs = [];
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const usedDrivers = new Set();
    const usedVehicles = new Set();

    for (const doData of deliveryOrdersData) {
      const {
        purchase_order_id = null,
        standalone_po_number,
        vehicle_id,
        driver_id,
        customer_name,
        item_name,
        minimal_load_quantity,
        unit,
        unit_price,
        total_amount,
        trip_allowance = 0,
        additional_allowance = [],
        gaji = 0,
        ongkosan,
        load_location,
        unload_location,
        load_latitude,
        load_longitude,
        unload_latitude,
        unload_longitude,
        payment_status = "proses_tagihan",
        status = "assigned",
        do_name,
        payment_notes = "",
      } = doData;

      if (
        !vehicle_id ||
        !driver_id ||
        !minimal_load_quantity ||
        isNaN(parseFloat(minimal_load_quantity))
      ) {
        throw new Error(
          "Missing or invalid required fields: vehicle_id, driver_id, minimal_load_quantity (must be number)"
        );
      }

      if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
        throw new Error("Invalid unit. Must be one of: kilogram, ton, kubik");
      }

      if (Array.isArray(additional_allowance)) {
        additional_allowance.forEach((val, index) => {
          if (isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
            throw new Error(
              `Invalid additional_allowance at index ${index}: must be a positive number`
            );
          }
        });
      }

      if (usedDrivers.has(driver_id)) {
        throw new Error(
          `Driver ${driver_id} is assigned multiple times in this batch.`
        );
      }
      if (usedVehicles.has(vehicle_id)) {
        throw new Error(
          `Vehicle ${vehicle_id} is assigned multiple times in this batch.`
        );
      }
      usedDrivers.add(driver_id);
      usedVehicles.add(vehicle_id);

      await validateDriverAvailability(driver_id, transaction);
      await validateVehicleAvailability(vehicle_id, transaction);

      let po = null;
      let finalUnit = unit || "ton";
      let finalUnitPrice = unit_price || 0;

      if (purchase_order_id) {
        po = await validateItemAgainstPO(
          purchase_order_id,
          item_name,
          transaction
        );
        finalUnit = unit || (po ? po.unit : "ton");
        finalUnitPrice = unit_price || (po ? po.unit_price : 0);
      } else if (!customer_name || !item_name) {
        throw new Error("Standalone DO requires customer_name and item_name");
      }

      const uniqueSuffix = uuidv4().slice(0, 8).toUpperCase();
      const do_number = `DO-${timestamp}-${uniqueSuffix}`;

      let calculatedTotalAmount =
        total_amount ||
        calculateTotalAmount(minimal_load_quantity, finalUnitPrice, finalUnit);
      let calculatedOngkosan =
        ongkosan ||
        calculateOngkosan(
          calculatedTotalAmount,
          trip_allowance,
          gaji,
          additional_allowance
        );

      const tempDO = DeliveryOrder.build({
        purchase_order_id,
        standalone_po_number,
        driver_id,
        vehicle_id,
        do_number,
        do_name,
        customer_name,
        item_name,
        minimal_load_quantity,
        unit: finalUnit,
        unit_price: finalUnitPrice,
        total_amount: calculatedTotalAmount,
        trip_allowance,
        additional_allowance,
        gaji,
        ongkosan: calculatedOngkosan,
        load_location,
        load_latitude,
        load_longitude,
        unload_location,
        unload_latitude,
        unload_longitude,
        payment_status,
        status,
        payment_notes,
      });

      if (purchase_order_id && tempDO.validateQuantityAgainstPO) {
        await tempDO.validateQuantityAgainstPO(false);
      }

      const deliveryOrder = await DeliveryOrder.create(tempDO.dataValues, {
        transaction,
        scope: "web",
      });

      if (purchase_order_id && po && po.deposit_group_id) {
        await DepositGroupMember.create(
          {
            group_id: po.deposit_group_id,
            delivery_order_id: deliveryOrder.id,
            quantity: minimal_load_quantity,
          },
          { transaction }
        );
        console.log(
          `✅ Auto-added DO ${deliveryOrder.do_number} to deposit group ${po.deposit_group_id}`
        );
      }

      await Vehicle.update(
        { status: "in_use" },
        { where: { id: vehicle_id }, transaction }
      );

      const driverUser = await User.findOne({
        where: { id: driver_id },
        attributes: ["username", "expo_push_token"],
        include: [
          {
            model: DriverProfile,
            as: "driverProfile",
            attributes: ["full_name"],
          },
        ],
        transaction,
      });

      if (
        driverUser &&
        driverUser.expo_push_token &&
        Expo.isExpoPushToken(driverUser.expo_push_token)
      ) {
        const expo = new Expo();
        const driverName =
          driverUser.driverProfile?.full_name || driverUser.username;
        const messages = [
          {
            to: driverUser.expo_push_token,
            sound: "default",
            title: "Tugas Pengantaran Baru",
            body: `Halo ${driverName}, Anda telah ditugaskan untuk DO ${
              deliveryOrder.do_name || deliveryOrder.do_number
            }. Silakan cek detail pengantaran di aplikasi.`,
            data: { do_number: deliveryOrder.do_number },
          },
        ];

        try {
          await expo.sendPushNotificationsAsync(messages);
        } catch (pushError) {
          console.error("Push notification error:", pushError);
        }
      }

      createdDOs.push(deliveryOrder);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Created ${createdDOs.length} delivery order(s).`,
      data: createdDOs.map((doItem) => ({
        ...doItem.toJSON(),
        unit_display: doItem.getUnitDisplay() || "N/A",
        financial_summary: {
          ...(doItem.getFinancialSummary() || {}),
          additional_allowance: doItem.additional_allowance || [],
        },
        big_do_context: doItem.getBigDOContext() || null,
      })),
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error creating delivery order(s):", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 CREATE DELIVERY ORDER
 */
exports.createDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      purchase_order_id,
      standalone_po_number,
      vehicle_id,
      driver_id,
      customer_name,
      item_name,
      minimal_load_quantity,
      unit,
      unit_price,
      total_amount,
      trip_allowance = 0,
      additional_allowance = [],
      gaji = 0,
      ongkosan,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status = "proses_tagihan",
      status = "assigned",
      do_name,
      payment_notes,
    } = req.body;

    if (
      !vehicle_id ||
      !driver_id ||
      !minimal_load_quantity ||
      isNaN(parseFloat(minimal_load_quantity))
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Missing or invalid required fields: vehicle_id, driver_id, minimal_load_quantity (must be number)",
      });
    }

    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // Validate additional allowances
    if (Array.isArray(additional_allowance)) {
      additional_allowance.forEach((val, index) => {
        if (isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
          throw new Error(
            `Invalid additional_allowance at index ${index}: must be a positive number`
          );
        }
      });
    }

    let po;
    if (purchase_order_id && item_name) {
      po = await validateItemAgainstPO(
        purchase_order_id,
        item_name,
        transaction
      );
    } else if (!customer_name || !item_name) {
      throw new Error("Standalone DO requires customer_name and item_name");
    }

    let finalUnit = unit || (po ? po.unit : "ton");
    let finalUnitPrice = unit_price || (po ? po.unit_price : 0);

    await validateDriverAvailability(driver_id, transaction);
    await validateVehicleAvailability(vehicle_id, transaction);

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const uniqueSuffix = uuidv4().slice(0, 8).toUpperCase();
    const do_number = `DO-${timestamp}-${uniqueSuffix}`;

    let calculatedTotalAmount =
      total_amount ||
      calculateTotalAmount(minimal_load_quantity, finalUnitPrice, finalUnit);
    let calculatedOngkosan =
      ongkosan ||
      calculateOngkosan(
        calculatedTotalAmount,
        trip_allowance,
        gaji,
        additional_allowance
      );

    const tempDO = DeliveryOrder.build({
      purchase_order_id,
      standalone_po_number,
      driver_id,
      vehicle_id,
      do_number,
      do_name,
      customer_name,
      item_name,
      minimal_load_quantity,
      unit: finalUnit,
      unit_price: finalUnitPrice,
      total_amount: calculatedTotalAmount,
      trip_allowance,
      additional_allowance,
      gaji,
      ongkosan: calculatedOngkosan,
      load_location,
      load_latitude,
      load_longitude,
      unload_location,
      unload_latitude,
      unload_longitude,
      payment_status,
      status,
      payment_notes,
    });

    if (purchase_order_id && tempDO.validateQuantityAgainstPO) {
      await tempDO.validateQuantityAgainstPO(false);
    }

    const deliveryOrder = await DeliveryOrder.create(tempDO.dataValues, {
      transaction,
      scope: "web",
    });

    if (purchase_order_id && po && po.deposit_group_id) {
      await DepositGroupMember.create(
        {
          group_id: po.deposit_group_id,
          delivery_order_id: deliveryOrder.id,
          quantity: minimal_load_quantity,
        },
        { transaction }
      );
      console.log(
        `✅ Auto-added DO ${deliveryOrder.do_number} to deposit group ${po.deposit_group_id}`
      );
    }

    await Vehicle.update(
      { status: "in_use" },
      { where: { id: vehicle_id }, transaction }
    );

    const driverUser = await User.findOne({
      where: { id: driver_id },
      attributes: ["username", "expo_push_token"],
      include: [
        {
          model: DriverProfile,
          as: "driverProfile",
          attributes: ["full_name"],
        },
      ],
      transaction,
    });

    if (
      driverUser &&
      driverUser.expo_push_token &&
      Expo.isExpoPushToken(driverUser.expo_push_token)
    ) {
      const expo = new Expo();
      const driverName =
        driverUser.driverProfile?.full_name || driverUser.username;
      const messages = [
        {
          to: driverUser.expo_push_token,
          sound: "default",
          title: "Tugas Pengantaran Baru",
          body: `Halo ${driverName}, Anda telah ditugaskan untuk DO ${
            deliveryOrder.do_name || deliveryOrder.do_number
          }. Silakan cek detail pengantaran di aplikasi.`,
          data: { do_number: deliveryOrder.do_number },
        },
      ];
      try {
        await expo.sendPushNotificationsAsync(messages);
      } catch (pushError) {
        console.error("Push notification error:", pushError);
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Delivery order created successfully",
      data: {
        ...deliveryOrder.toJSON(),
        unit_display: deliveryOrder.getUnitDisplay() || "N/A",
        financial_summary: {
          ...(deliveryOrder.getFinancialSummary() || {}),
          additional_allowance: deliveryOrder.additional_allowance || [],
        },
        big_do_context: deliveryOrder.getBigDOContext() || null,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error creating delivery order:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 GET ALL DELIVERY ORDERS
 */
exports.getAllDeliveryOrders = async (req, res, next) => {
  try {
    const {
      status,
      driver_id,
      vehicle_id,
      page = 1,
      limit = 10,
      search,
      po_id,
      big_do_filter,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};
    if (status) whereClause.status = status;
    if (driver_id) whereClause.driver_id = driver_id;
    if (vehicle_id) whereClause.vehicle_id = vehicle_id;
    if (po_id) whereClause.purchase_order_id = po_id;

    if (search) {
      whereClause[Op.or] = [
        { do_number: { [Op.iLike]: `%${search}%` } },
        { do_name: { [Op.iLike]: `%${search}%` } },
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Enhanced Big DO filtering
    if (big_do_filter === "standalone") {
      whereClause.id = {
        [Op.notIn]: sequelize.literal(
          "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
        ),
      };
    } else if (big_do_filter === "main_dos") {
      whereClause.id = {
        [Op.in]: sequelize.literal(
          "(SELECT main_delivery_order_id FROM big_delivery_orders WHERE status != 'cancelled')"
        ),
      };
    }

    const statsPromises = [
      DeliveryOrder.count({ where: whereClause }),
      DeliveryOrder.count({ where: { ...whereClause, status: "assigned" } }),
      DeliveryOrder.count({
        where: {
          ...whereClause,
          status: {
            [Op.in]: [
              "otw_to_load_location",
              "at_load_location",
              "otw_to_unload_location",
              "at_unload_location",
              "otw_to_base",
            ],
          },
        },
      }),
      DeliveryOrder.count({ where: { ...whereClause, status: "completed" } }),
      DeliveryOrder.count({ where: { ...whereClause, status: "cancelled" } }),
      DeliveryOrder.sum("total_amount", { where: whereClause }) || 0,
      DeliveryOrder.sum("ongkosan", { where: whereClause }) || 0,
      DeliveryOrder.count({
        where: {
          ...whereClause,
          id: {
            [Op.notIn]: sequelize.literal(
              "(SELECT main_delivery_order_id FROM big_delivery_orders)"
            ),
          },
        },
      }),
      DeliveryOrder.count({
        where: {
          ...whereClause,
          id: {
            [Op.in]: sequelize.literal(
              "(SELECT main_delivery_order_id FROM big_delivery_orders)"
            ),
          },
        },
      }),
      DeliveryOrder.count({ where: { ...whereClause, unit: "kilogram" } }),
      DeliveryOrder.count({ where: { ...whereClause, unit: "ton" } }),
      DeliveryOrder.count({ where: { ...whereClause, unit: "kubik" } }),
    ];

    const [
      total,
      assigned,
      in_progress,
      completed,
      cancelled,
      total_revenue,
      total_ongkosan,
      standalone_dos,
      main_dos,
      kilogram,
      ton,
      kubik,
    ] = await Promise.all(statsPromises);

    const { count, rows: deliveryOrders } = await DeliveryOrder.findAndCountAll(
      {
        where: whereClause,
        include: [
          {
            model: PurchaseOrder,
            as: "purchaseOrder",
            attributes: [
              "po_number",
              "customer_name",
              "total_quantity",
              "unit",
            ],
          },
          {
            model: User,
            as: "driver",
            attributes: ["id", "username"],
            include: [
              {
                model: DriverProfile,
                as: "driverProfile",
                attributes: ["full_name", "phone"],
              },
            ],
          },
          {
            model: Vehicle,
            as: "vehicle",
            attributes: ["license_plate", "type", "capacity"],
          },
          {
            model: BigDeliveryOrder,
            as: "bigDeliveryOrderAsMain",
            attributes: ["big_do_number", "status", "total_trip_allowance"],
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      }
    );

    const enhancedDOs = deliveryOrders.map((dOrder) => {
      const doData = dOrder.toJSON();
      const orderUnit = doData.unit || doData.purchaseOrder?.unit || "ton";

      let actualTotalAmount = null;
      if (doData.actual_load_quantity && doData.unit_price && orderUnit) {
        actualTotalAmount = calculateTotalAmount(
          doData.actual_load_quantity,
          doData.unit_price,
          orderUnit
        );
      }

      return {
        ...doData,
        unit: orderUnit,
        status_text: dOrder.getStatusText() || doData.status,
        financial_summary: {
          ...(dOrder.getFinancialSummary() || {}),
          actual_total_amount: actualTotalAmount,
          unit: orderUnit,
          unit_display: dOrder.getUnitDisplay() || orderUnit,
        },
        driver_name:
          doData.driver?.driverProfile?.full_name ||
          doData.driver?.username ||
          "N/A",
        vehicle_info:
          `${doData.vehicle?.license_plate} (${doData.vehicle?.type})` || "N/A",
        big_do_context: dOrder.getBigDOContext() || null,
        big_do_info: doData.bigDeliveryOrderAsMain
          ? {
              big_do_number: doData.bigDeliveryOrderAsMain.big_do_number,
              big_do_status: doData.bigDeliveryOrderAsMain.status,
              total_trip_allowance:
                doData.bigDeliveryOrderAsMain.total_trip_allowance,
            }
          : null,
      };
    });

    const stats = {
      total,
      assigned,
      in_progress,
      completed,
      cancelled,
      total_revenue,
      total_ongkosan,
      big_do_breakdown: { standalone_dos, main_dos },
      unit_distribution: { kilogram, ton, kubik },
    };

    res.json({
      success: true,
      data: enhancedDOs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      stats,
    });
  } catch (err) {
    console.error("Error getting delivery orders:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 GET DO BY ID
 */
exports.getDeliveryOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deliveryOrder = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["po_number", "customer_name", "unit"],
        },
        {
          model: User,
          as: "driver",
          include: [{ model: DriverProfile, as: "driverProfile" }],
        },
        { model: Vehicle, as: "vehicle" },
        {
          model: BigDeliveryOrder,
          as: "bigDeliveryOrderAsMain",
          include: [
            {
              model: BigDoTambahan,
              as: "tambahan",
              attributes: ["id", "customer_name", "total_amount", "status"],
            },
          ],
          required: false,
        },
      ],
    });

    if (!deliveryOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    const doData = deliveryOrder.toJSON();
    const orderUnit = doData.unit || doData.purchaseOrder?.unit || "ton";

    // Normalize surat_jalan_photo_url to array of forward-slash paths
    if (doData.surat_jalan_photo_url) {
      if (Array.isArray(doData.surat_jalan_photo_url)) {
        doData.surat_jalan_photo_url = doData.surat_jalan_photo_url.map((p) =>
          String(p || "").replace(/\\/g, "/")
        );
      } else {
        doData.surat_jalan_photo_url = [
          String(doData.surat_jalan_photo_url).replace(/\\/g, "/"),
        ];
      }
    } else {
      doData.surat_jalan_photo_url = [];
    }

    // Calculate totals with additional allowances
    let minimalTotalAmount =
      doData.minimal_load_quantity && doData.unit_price
        ? calculateTotalAmount(
            doData.minimal_load_quantity,
            doData.unit_price,
            orderUnit
          )
        : null;
    let actualTotalAmount =
      doData.actual_load_quantity && doData.unit_price
        ? calculateTotalAmount(
            doData.actual_load_quantity,
            doData.unit_price,
            orderUnit
          )
        : null;
    let calculatedOngkosan = calculateOngkosan(
      actualTotalAmount || minimalTotalAmount || doData.total_amount,
      doData.trip_allowance,
      doData.gaji,
      doData.additional_allowance
    );

    res.json({
      success: true,
      data: {
        ...doData,
        unit: orderUnit,
        status_text: deliveryOrder.getStatusText() || doData.status,
        payment_notes: doData.payment_notes || "", // Changed from notes to payment_notes
        financial_summary: {
          ...(deliveryOrder.getFinancialSummary() || {}),
          minimal_total_amount: minimalTotalAmount,
          actual_total_amount: actualTotalAmount,
          ongkosan: calculatedOngkosan,
          additional_allowance: Array.isArray(doData.additional_allowance)
            ? doData.additional_allowance.map((a) => parseFloat(a) || 0)
            : [],
          unit: orderUnit,
          unit_display: deliveryOrder.getUnitDisplay() || orderUnit,
        },
        timeline: {
          created_at: doData.created_at,
          departed_to_load_location_at: doData.departed_to_load_location_at,
          arrived_at_load_location_at: doData.arrived_at_load_location_at,
          departed_from_load_location_at: doData.departed_from_load_location_at,
          arrived_at_unload_location_at: doData.arrived_at_unload_location_at,
          departed_from_unload_location_at:
            doData.departed_from_unload_location_at,
          completed_at: doData.completed_at,
        },
        driver_name:
          doData.driver?.driverProfile?.full_name ||
          doData.driver?.username ||
          "N/A",
        vehicle_info:
          `${doData.vehicle?.license_plate} (${doData.vehicle?.type})` || "N/A",
        big_do_context: deliveryOrder.getBigDOContext() || null,
        big_do_info: doData.bigDeliveryOrderAsMain
          ? {
              big_do_number: doData.bigDeliveryOrderAsMain.big_do_number,
              big_do_status: doData.bigDeliveryOrderAsMain.status,
              tambahan_count:
                doData.bigDeliveryOrderAsMain.tambahan?.length || 0,
              tambahan_summary: doData.bigDeliveryOrderAsMain.tambahan || [],
            }
          : null,
      },
    });
  } catch (err) {
    console.error("Error getting delivery order by ID:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 UPDATE DELIVERY ORDER
 */
exports.updateDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      purchase_order_id,
      vehicle_id,
      driver_id,
      customer_name,
      item_name,
      minimal_load_quantity,
      actual_load_quantity,
      unit,
      unit_price,
      total_amount,
      trip_allowance,
      gaji,
      additional_allowance,
      ongkosan,
      load_location,
      unload_location,
      load_latitude,
      load_longitude,
      unload_latitude,
      unload_longitude,
      payment_status,
      status,
      do_name,
      payment_notes, // Changed from notes to payment_notes
      additional_allowance_notes, // Optional: New field to handle allowance-specific notes
    } = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id, { transaction });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Enhanced unit validation
    if (unit && !["kilogram", "ton", "kubik"].includes(unit)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid unit. Must be one of: kilogram, ton, kubik",
      });
    }

    // Validate additional allowances
    if (Array.isArray(additional_allowance)) {
      additional_allowance.forEach((val, index) => {
        if (isNaN(parseFloat(val)) || parseFloat(val) < 0) {
          throw new Error(
            `Invalid additional_allow.currency at index ${index}: must be a non-negative number`
          );
        }
      });
    }

    // Enhanced proposed data preparation
    const proposedData = {
      purchase_order_id: purchase_order_id ?? deliveryOrder.purchase_order_id,
      vehicle_id: vehicle_id ?? deliveryOrder.vehicle_id,
      driver_id: driver_id ?? deliveryOrder.driver_id,
      customer_name: customer_name ?? deliveryOrder.customer_name,
      item_name: item_name ?? deliveryOrder.item_name,
      minimal_load_quantity:
        minimal_load_quantity ?? deliveryOrder.minimal_load_quantity,
      actual_load_quantity:
        actual_load_quantity ?? deliveryOrder.actual_load_quantity,
      unit: unit ?? deliveryOrder.unit,
      unit_price: unit_price ?? deliveryOrder.unit_price,
      trip_allowance: trip_allowance ?? deliveryOrder.trip_allowance,
      gaji: gaji ?? deliveryOrder.gaji,
      additional_allowance:
        additional_allowance ?? deliveryOrder.additional_allowance,
      load_location: load_location ?? deliveryOrder.load_location,
      unload_location: unload_location ?? deliveryOrder.unload_location,
      load_latitude: load_latitude ?? deliveryOrder.load_latitude,
      load_longitude: load_longitude ?? deliveryOrder.load_longitude,
      unload_latitude: unload_latitude ?? deliveryOrder.unload_latitude,
      unload_longitude: unload_longitude ?? deliveryOrder.unload_longitude,
      payment_status: payment_status ?? deliveryOrder.payment_status,
      status: status ?? deliveryOrder.status,
      do_name: do_name ?? deliveryOrder.do_name,
      payment_notes: payment_notes ?? deliveryOrder.payment_notes,
    };

    // Append additional allowance notes to payment_notes if provided
    if (additional_allowance_notes) {
      const currentNotes = proposedData.payment_notes || "";
      proposedData.payment_notes = currentNotes
        ? `${currentNotes}\n${additional_allowance_notes}`
        : additional_allowance_notes;
    }

    // Enhanced recalculation
    let calculatedTotalAmount = total_amount;
    const calcQuantity =
      proposedData.actual_load_quantity || proposedData.minimal_load_quantity;
    if (calcQuantity && proposedData.unit_price && proposedData.unit) {
      calculatedTotalAmount = calculateTotalAmount(
        calcQuantity,
        proposedData.unit_price,
        proposedData.unit
      );
    }

    let calculatedOngkosan = ongkosan;
    if (calculatedTotalAmount) {
      calculatedOngkosan = calculateOngkosan(
        calculatedTotalAmount,
        proposedData.trip_allowance,
        proposedData.gaji,
        proposedData.additional_allowance
      );
    }

    proposedData.total_amount = calculatedTotalAmount;
    proposedData.ongkosan = calculatedOngkosan;

    // Enhanced validation with temp DO
    const tempDO = DeliveryOrder.build({
      ...deliveryOrder.dataValues,
      ...proposedData,
    });
    if (tempDO.validateQuantityAgainstPO) {
      await tempDO.validateQuantityAgainstPO(true);
    }

    // Record editor info
    if (req.user && req.user.username) {
      proposedData.last_edited_by = req.user.username;
      proposedData.last_edited_at = new Date();
    }

    // Update delivery order
    const updatedDO = await deliveryOrder.update(proposedData, { transaction });

    await transaction.commit();

    // Enhanced response with PO stats
    const po = await PurchaseOrder.findByPk(updatedDO.purchase_order_id);
    const stats =
      po && po.getRemainingAndForecast
        ? await po.getRemainingAndForecast()
        : null;

    res.json({
      success: true,
      message: "Delivery Order updated successfully",
      data: {
        ...updatedDO.toJSON(),
        financial_summary: updatedDO.getFinancialSummary() || {},
        po_stats: stats,
        last_edited_by: updatedDO.last_edited_by || null,
        last_edited_at: updatedDO.last_edited_at || null,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error updating delivery order:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 CANCEL DELIVERY ORDER
 */
exports.cancelDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id, { transaction });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Check if DO is part of Big DO and is still valid (if big DO has been canceled, then allows cancellation)
    const bigDO = await BigDeliveryOrder.findOne({
      where: {
        main_delivery_order_id: id,
        status: { [Op.not]: "cancelled" }, // Only consider active Big DO
      },
      transaction,
    });

    if (bigDO) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Cannot cancel DO that is main DO of Big DO. Cancel the Big DO instead.",
      });
    }

    await deliveryOrder.update(
      {
        status: "cancelled",
        notes: cancellation_reason || "Cancelled by admin",
      },
      { transaction }
    );

    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: "available" },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    // Free up driver
    if (deliveryOrder.driver_id) {
      await User.update(
        { status: "available" },
        { where: { id: deliveryOrder.driver_id }, transaction }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Delivery Order cancelled successfully",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error cancelling delivery order:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 DELETE STANDALONE DELIVERY ORDER
 * Only allowed for DO without Purchase Order (purchase_order_id is null)
 * and already cancelled or completed. This will remove the DO so it no longer
 * contributes to vehicle revenue / pendapatan mobil calculations.
 */
exports.deleteStandaloneDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    console.log("[deleteStandaloneDeliveryOrder] Request to delete DO id:", id);

    const deliveryOrder = await DeliveryOrder.findByPk(id, { transaction });
    console.log(
      "[deleteStandaloneDeliveryOrder] Loaded DO:",
      deliveryOrder ? { id: deliveryOrder.id, status: deliveryOrder.status, purchase_order_id: deliveryOrder.purchase_order_id } : null
    );

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Only standalone DO (not linked to any Purchase Order)
    if (deliveryOrder.purchase_order_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Only standalone Delivery Orders (without Purchase Order) can be deleted.",
      });
    }

    // Require DO to be cancelled or completed to avoid accidental deletion
    if (!["cancelled", "completed"].includes(deliveryOrder.status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Only cancelled or completed Delivery Orders can be deleted.",
      });
    }

    // Ensure this DO is not the main DO of an active Big DO
    const bigDO = await BigDeliveryOrder.findOne({
      where: {
        main_delivery_order_id: id,
        status: { [Op.not]: "cancelled" },
      },
      transaction,
    });

    if (bigDO) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete Delivery Order that is the main DO of an active Big DO. Cancel the Big DO first.",
      });
    }

    // At this point it's safe to hard delete the DO record.
    await deliveryOrder.destroy({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Standalone Delivery Order deleted successfully.",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error deleting standalone delivery order:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

/**
 * 🎯 COMPLETE DELIVERY ORDER
 */
exports.completeDeliveryOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { actual_load_quantity, notes } = req.body;

    const deliveryOrder = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["id", "deposit_group_id", "unit", "unit_price"],
          include: [
            {
              model: DepositGroup,
              as: "depositGroup",
              attributes: [
                "id",
                "group_name",
                "status",
                "remaining_quantity",
                "balance",
              ],
            },
          ],
        },
      ],
      transaction,
    });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    if (deliveryOrder.status === "completed") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Delivery Order is already completed",
      });
    }

    const po = deliveryOrder.purchaseOrder;
    const isDepositLinked = !!(po && po.deposit_group_id);

    const dgMember = await DepositGroupMember.findOne({
      where: { delivery_order_id: id },
      include: [{ model: DepositGroup, as: "depositGroup" }],
      transaction,
    });

    const isInDepositGroup = !!dgMember;

    let paymentStatus;
    let paymentConfirmationStatus;
    let paymentConfirmedAt = null;

    if (isDepositLinked || isInDepositGroup) {
      paymentStatus = "lunas";
      paymentConfirmationStatus = "confirmed";
      paymentConfirmedAt = new Date();

      console.log(
        `✅ DO ${id} auto-paid via deposit group - Deposit linked: ${isDepositLinked}, In group: ${isInDepositGroup}`
      );
    } else {
      paymentStatus = "awaiting_confirmation";
      paymentConfirmationStatus = "awaiting_confirmation";
    }

    const updateData = {
      status: "completed",
      completed_at: new Date(),
      payment_status: paymentStatus,
      payment_confirmation_status: paymentConfirmationStatus,
      payment_confirmation_at: paymentConfirmedAt,
      actual_load_quantity:
        actual_load_quantity || deliveryOrder.actual_load_quantity,
      notes: notes || deliveryOrder.notes,
    };

    await deliveryOrder.update(updateData, { transaction });

    if (dgMember && dgMember.depositGroup) {
      const grp = dgMember.depositGroup;
      const qtyUsed = parseFloat(updateData.actual_load_quantity);
      const unitPrice = parseFloat(deliveryOrder.unit_price);
      if (isNaN(unitPrice)) {
        throw new Error(`Invalid unit_price for DO ${deliveryOrder.id}`);
      }
      const priceUsed = qtyUsed * unitPrice;

      console.log(`🔄 Processing deposit group ${grp.id} for DO ${id}`);
      console.log(
        `📊 Reducing: ${qtyUsed} qty, Rp ${priceUsed.toLocaleString(
          "id-ID"
        )} amount`
      );

      // Properly reduce both quantity and balance
      const currentRemaining = parseFloat(grp.remaining_quantity) || 0;
      const currentBalance = parseFloat(grp.balance) || 0;

      grp.remaining_quantity = Math.max(0, currentRemaining - qtyUsed);
      grp.balance = Math.max(0, currentBalance - priceUsed);

      if (grp.remaining_quantity <= 0 && grp.balance <= 0) {
        grp.status = "fulfilled";
      } else if (grp.remaining_quantity < 0 || grp.balance < 0) {
        grp.status = "overdrawn";
      } else {
        grp.status = "active";
      }

      await grp.save({ transaction });

      // Also update the quantity in the DepositGroupMember table itself
      await dgMember.update({ quantity: qtyUsed }, { transaction });

      console.log(
        `✅ Updated deposit group: remaining ${
          grp.remaining_quantity
        }, balance Rp ${grp.balance.toLocaleString("id-ID")}`
      );

      // Handle excess quantities (selisih)
      const minimalQuantity = parseFloat(deliveryOrder.minimal_load_quantity);
      const excess = qtyUsed - minimalQuantity;

      if (excess > 0) {
        const excessAmount = excess * unitPrice;

        // Create adjustment record for excess quantity
        await DeliveryOrderAdjustments.create(
          {
            delivery_order_id: id,
            payment_amount: priceUsed,
            payment_type: "deposit", // Use 'deposit' as the payment type
            payment_date: new Date(),
            notes: `Auto-payment from Deposit Group: ${grp.group_name}`,
            received_by: req.user?.id,
            created_by: req.user?.id,
          },
          { transaction }
        );

        console.log(
          `📊 Recorded excess: ${excess} ${
            deliveryOrder.unit
          } = Rp ${excessAmount.toLocaleString("id-ID")}`
        );
      }
    }

    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: "available" },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    await transaction.commit();

    const updatedDO = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: [
            "po_number",
            "customer_name",
            "unit",
            "deposit_group_id",
          ],
          include: [
            {
              model: DepositGroup,
              as: "depositGroup",
              attributes: [
                "id",
                "group_name",
                "status",
                "remaining_quantity",
                "balance",
              ],
            },
          ],
        },
      ],
    });

    const isAutoPaid = !!(isDepositLinked || isInDepositGroup);

    res.json({
      success: true,
      message: isAutoPaid
        ? "✅ DO completed and auto-paid via deposit group"
        : "DO completed successfully",
      data: {
        ...updatedDO.toJSON(),
        is_auto_paid: isAutoPaid,
        deposit_group_handled: isAutoPaid,
        deposit_group_info:
          dgMember && dgMember.depositGroup
            ? {
                id: dgMember.depositGroup.id,
                name: dgMember.depositGroup.group_name,
                status: dgMember.depositGroup.status,
                remaining_quantity: dgMember.depositGroup.remaining_quantity,
                balance: dgMember.depositGroup.balance,
              }
            : null,
        unit_display: updatedDO.getUnitDisplay
          ? updatedDO.getUnitDisplay()
          : updatedDO.unit,
        financial_summary: updatedDO.getFinancialSummary
          ? updatedDO.getFinancialSummary()
          : null,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error completing delivery order:", err);
    next(err);
  }
};

/**
 * 🎯 ADMIN: CONFIRM LOAD (with surat jalan photos) AND COMPLETE DO
 * POST /api/web/delivery-orders/:id/admin-complete
 * FormData: { actual_load_quantity: number, notes?: string, surat_jalan_photos[]: images }
 */
exports.adminConfirmLoadAndComplete = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { actual_load_quantity, notes } = req.body || {};

    // Validate payload
    if (!actual_load_quantity || isNaN(parseFloat(actual_load_quantity))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "actual_load_quantity is required and must be a number",
      });
    }

    // Normalize files list (support array, fields object, or single file)
    let suratJalanFiles = [];
    if (Array.isArray(req.files)) {
      // multer .array()
      suratJalanFiles = req.files;
    } else if (req.files && typeof req.files === "object") {
      // multer .fields() returns object with arrays per field
      Object.values(req.files).forEach((val) => {
        if (Array.isArray(val)) suratJalanFiles.push(...val);
      });
    } else if (req.file) {
      // multer .single()
      suratJalanFiles = [req.file];
    }

    if (!suratJalanFiles.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "At least one surat jalan photo is required",
      });
    }

    const deliveryOrder = await DeliveryOrder.findByPk(id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["id", "deposit_group_id", "unit", "unit_price"],
          include: [
            {
              model: DepositGroup,
              as: "depositGroup",
              attributes: [
                "id",
                "group_name",
                "status",
                "remaining_quantity",
                "balance",
              ],
            },
          ],
        },
      ],
      transaction,
    });

    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Upload each buffer to Cloudinary and collect the returned public links
    const { uploadFromBuffer } = require("../../services/cloudinary.service");

    const uploadPromises = suratJalanFiles.map((file) =>
      uploadFromBuffer(file.buffer)
    );
    const uploadResults = await Promise.all(uploadPromises);
    const cloudinaryLinks = uploadResults.map((result) => result.secure_url);

    // Merge with existing photos to avoid overwriting unintentionally
    let existingPhotos = [];
    try {
      const existing = deliveryOrder.surat_jalan_photo_url;
      if (existing) {
        if (Array.isArray(existing)) {
          existingPhotos = existing.map((p) => String(p).replace(/\\/g, "/"));
        } else {
          existingPhotos = [String(existing).replace(/\\/g, "/")];
        }
      }
    } catch (e) {
      existingPhotos = [];
    }

    const mergedPhotos = Array.from(
      new Set([...existingPhotos, ...cloudinaryLinks])
    );

    // Update DO with actual quantity and merged photos first
    await deliveryOrder.update(
      {
        actual_load_quantity: parseFloat(actual_load_quantity),
        surat_jalan_photo_url: mergedPhotos,
      },
      { transaction }
    );

    // Reuse the standard complete logic (without files) now that actual qty is set
    // Prepare deposit handling similar to completeDeliveryOrder above
    const po = deliveryOrder.purchaseOrder;
    const isDepositLinked = !!(po && po.deposit_group_id);

    const dgMember = await DepositGroupMember.findOne({
      where: { delivery_order_id: id },
      include: [{ model: DepositGroup, as: "depositGroup" }],
      transaction,
    });

    const isInDepositGroup = !!dgMember;

    let paymentStatus;
    let paymentConfirmationStatus;
    let paymentConfirmedAt = null;

    if (isDepositLinked || isInDepositGroup) {
      paymentStatus = "lunas";
      paymentConfirmationStatus = "confirmed";
      paymentConfirmedAt = new Date();
    } else {
      paymentStatus = "awaiting_confirmation";
      paymentConfirmationStatus = "awaiting_confirmation";
    }

    const updateData = {
      status: "completed",
      completed_at: new Date(),
      payment_status: paymentStatus,
      payment_confirmation_status: paymentConfirmationStatus,
      payment_confirmation_at: paymentConfirmedAt,
      notes: notes || deliveryOrder.notes,
    };

    await deliveryOrder.update(updateData, { transaction });

    if (dgMember && dgMember.depositGroup) {
      const grp = dgMember.depositGroup;
      const qtyUsed = parseFloat(deliveryOrder.actual_load_quantity);
      const unitPrice = parseFloat(deliveryOrder.unit_price);
      if (isNaN(unitPrice)) {
        throw new Error(`Invalid unit_price for DO ${deliveryOrder.id}`);
      }
      const priceUsed = qtyUsed * unitPrice;

      const currentRemaining = parseFloat(grp.remaining_quantity) || 0;
      const currentBalance = parseFloat(grp.balance) || 0;

      grp.remaining_quantity = Math.max(0, currentRemaining - qtyUsed);
      grp.balance = Math.max(0, currentBalance - priceUsed);

      if (grp.remaining_quantity <= 0 && grp.balance <= 0) {
        grp.status = "fulfilled";
      } else if (grp.remaining_quantity < 0 || grp.balance < 0) {
        grp.status = "overdrawn";
      } else {
        grp.status = "active";
      }

      await grp.save({ transaction });
      await dgMember.update({ quantity: qtyUsed }, { transaction });
    }

    if (deliveryOrder.vehicle_id) {
      await Vehicle.update(
        { status: "available" },
        { where: { id: deliveryOrder.vehicle_id }, transaction }
      );
    }

    await transaction.commit();

    const updated = await DeliveryOrder.findByPk(id);
    return res.json({
      success: true,
      message: "DO confirmed and completed by admin",
      data: updated,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error in adminConfirmLoadAndComplete:", err);
    return next(err);
  }
};

/**
 * 🎯 GET DELIVERY STATISTICS
 */
exports.getDeliveryStatistics = async (req, res, next) => {
  try {
    const { period = "month" } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { created_at: { [Op.gte]: weekAgo } };
    } else if (period === "month") {
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { created_at: { [Op.gte]: monthAgo } };
    } else if (period === "year") {
      const yearAgo = new Date(now.getFullYear(), 0, 1);
      dateFilter = { created_at: { [Op.gte]: yearAgo } };
    }

    const [
      totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      totalRevenue,
      totalOngkosan,
      totalTripAllowance,
      totalGaji,
      totalAdditionalAllowance,
    ] = await Promise.all([
      DeliveryOrder.count({ where: dateFilter }),
      DeliveryOrder.count({ where: { ...dateFilter, status: "completed" } }),
      DeliveryOrder.count({ where: { ...dateFilter, status: "cancelled" } }),
      DeliveryOrder.sum("total_amount", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum("ongkosan", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum("trip_allowance", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum("gaji", {
        where: { ...dateFilter, status: "completed" },
      }) || 0,
      DeliveryOrder.sum(
        sequelize.fn(
          "SUM",
          sequelize.fn(
            "COALESCE",
            sequelize.literal(
              "(SELECT SUM(allowance) FROM unnest(additional_allowance) AS allowance)"
            ),
            0
          )
        ),
        { where: { ...dateFilter, status: "completed" } }
      ) || 0,
    ]);

    const totalDriverCosts =
      totalTripAllowance + totalGaji + totalAdditionalAllowance;
    const completionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const netProfit = totalOngkosan;

    const unitStats = await DeliveryOrder.findAll({
      where: dateFilter,
      attributes: [
        "unit",
        [sequelize.fn("COUNT", "*"), "count"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              "COALESCE(actual_load_quantity, minimal_load_quantity)"
            )
          ),
          "total_quantity",
        ],
      ],
      group: ["unit"],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        period,
        total_deliveries: totalDeliveries,
        completed_deliveries: completedDeliveries,
        cancelled_deliveries: cancelledDeliveries,
        completion_rate: parseFloat(completionRate.toFixed(2)),
        total_revenue: totalRevenue,
        total_ongkosan: totalOngkosan,
        total_driver_costs: totalDriverCosts,
        net_profit: netProfit,
        unit_distribution: unitStats.reduce((acc, stat) => {
          const unit = stat.unit || "unknown";
          acc[unit] = {
            count: parseInt(stat.count),
            total_quantity: parseFloat(stat.total_quantity) || 0,
          };
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    console.error("Error getting delivery statistics:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

exports.getRecentCustomers = async (req, res, next) => {
  try {
    // Ambil 50 DO terakhir untuk mendapatkan sampel nama pelanggan yang relevan
    const recentDOs = await DeliveryOrder.findAll({
      attributes: ["customer_name"],
      where: {
        customer_name: { [Op.ne]: null, [Op.ne]: "" }, // Abaikan nama yang kosong
      },
      order: [["created_at", "DESC"]],
      limit: 50,
      raw: true,
    });

    // Buat daftar nama unik dan ambil 5 teratas
    const uniqueCustomerNames = [
      ...new Set(recentDOs.map((po) => po.customer_name)),
    ];
    const top5 = uniqueCustomerNames.slice(0, 5);

    res.json({
      success: true,
      data: top5,
    });
  } catch (err) {
    console.error("Error getting recent customers from DOs:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};

exports.getRecentLocations = async (req, res, next) => {
  try {
    const recentDOs = await DeliveryOrder.findAll({
      attributes: ["load_location", "unload_location"],
      order: [["created_at", "DESC"]],
      limit: 100, // Sample last 100 DOs for relevant locations
      raw: true,
    });

    // Get unique, non-empty locations
    const uniqueLoadLocations = [
      ...new Set(recentDOs.map((d) => d.load_location).filter(Boolean)),
    ];
    const uniqueUnloadLocations = [
      ...new Set(recentDOs.map((d) => d.unload_location).filter(Boolean)),
    ];

    res.json({
      success: true,
      data: {
        load_locations: uniqueLoadLocations.slice(0, 10), // Return top 10 unique
        unload_locations: uniqueUnloadLocations.slice(0, 10),
      },
    });
  } catch (err) {
    console.error("Error getting recent locations from DOs:", err);
    res.status(500).json({ success: false, message: err.message });
    next(err);
  }
};
