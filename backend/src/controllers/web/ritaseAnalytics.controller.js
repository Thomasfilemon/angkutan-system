// src/controllers/web/ritaseAnalytics.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  DeliveryOrder,
  Vehicle,
  User,
  DriverProfile,
  PurchaseOrder,
  DeliveryOrderPayments,
  DeliveryOrderInvoices,
  DeliveryOrderAdjustments,
} = require("../../models");

/**
 * 🎯 COMPREHENSIVE RITASE TABLE - The Excel Killer
 * GET /ritase/comprehensive?startDate=2024-01-01&endDate=2024-12-31&vehicle=1&driver=2&status=completed
 */
exports.getComprehensiveRitaseTable = async (req, res, next) => {
  try {
    const {
      startDate = null,
      endDate = null,
      vehicle = null,
      driver = null,
      status = null,
      paymentStatus = null,
      page = 1,
      limit = 50,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = req.query;

    // Build dynamic where conditions
    const whereConditions = {};

    // Date filtering
    if (startDate && endDate) {
      whereConditions.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Status filtering
    if (status && status !== "all") {
      whereConditions.status = status;
    }

    if (paymentStatus && paymentStatus !== "all") {
      whereConditions.payment_status = paymentStatus;
    }

    // Vehicle filtering
    if (vehicle && vehicle !== "all") {
      whereConditions.vehicle_id = vehicle;
    }

    // Driver filtering
    if (driver && driver !== "all") {
      whereConditions.driver_id = driver;
    }

    // Only include completed orders for financial analysis
    if (!status) {
      whereConditions.status = "completed";
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Main query with all related data
    const { rows: deliveryOrders, count: totalRecords } =
      await DeliveryOrder.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: PurchaseOrder,
            as: "purchaseOrder",
            attributes: ["id", "po_number", "customer_name", "item_name"],
          },
          {
            model: Vehicle,
            as: "vehicle",
            attributes: ["id", "license_plate", "type", "capacity"],
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
            model: DeliveryOrderPayments,
            as: "payments",
            attributes: ["payment_amount", "payment_date", "payment_type"],
          },
          {
            model: DeliveryOrderInvoices,
            as: "invoices",
            attributes: [
              "invoice_amount",
              "pph_amount",
              "net_amount",
              "status",
            ],
          },
          {
            model: DeliveryOrderAdjustments,
            as: "adjustments",
            attributes: ["adjustment_type", "adjustment_amount", "reason"],
          },
        ],
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset,
      });

    // 🔥 EXCEL-STYLE CALCULATIONS FOR EACH TRIP
    const processedData = deliveryOrders.map((order) => {
      const orderData = order.toJSON();

      // Calculate like your Excel formulas
      const actualQuantity =
        parseFloat(orderData.actual_load_quantity) ||
        parseFloat(orderData.minimal_load_quantity);
      const unitPrice = parseFloat(orderData.unit_price) || 0;
      const grossIncome = actualQuantity * unitPrice;

      const uangJalan = parseFloat(orderData.trip_allowance) || 0;
      const gaji = parseFloat(orderData.gaji) || 0;
      const operationalCosts = uangJalan + gaji;

      // Net profit calculation
      const netProfit = grossIncome - operationalCosts;
      const profitMargin =
        grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

      // Payment calculations
      const totalPaid = orderData.payments.reduce(
        (sum, payment) => sum + parseFloat(payment.payment_amount || 0),
        0
      );
      const totalInvoiced = orderData.invoices.reduce(
        (sum, invoice) => sum + parseFloat(invoice.net_amount || 0),
        0
      );
      const outstanding = totalInvoiced - totalPaid;

      // Efficiency metrics
      const costPerTon =
        actualQuantity > 0 ? operationalCosts / actualQuantity : 0;
      const revenuePerTon =
        actualQuantity > 0 ? grossIncome / actualQuantity : 0;

      // Route efficiency (basic)
      const route = `${orderData.load_location} → ${orderData.unload_location}`;

      // Payment timing
      const paymentDays =
        orderData.completed_at && orderData.payments.length > 0
          ? Math.ceil(
              (new Date(orderData.payments[0].payment_date) -
                new Date(orderData.completed_at)) /
                (1000 * 60 * 60 * 24)
            )
          : null;

      return {
        ...orderData,
        // 📊 CALCULATED FIELDS (like your Excel)
        calculated: {
          actualQuantity,
          grossIncome,
          operationalCosts,
          netProfit,
          profitMargin,
          costPerTon,
          revenuePerTon,
          totalPaid,
          totalInvoiced,
          outstanding,
          paymentDays,
          route,
          efficiency: {
            quantityEfficiency:
              (actualQuantity / parseFloat(orderData.minimal_load_quantity)) *
              100,
            profitability: netProfit > 0 ? "profitable" : "loss",
            paymentSpeed:
              paymentDays <= 30
                ? "fast"
                : paymentDays <= 60
                ? "normal"
                : "slow",
          },
        },
      };
    });

    res.json({
      success: true,
      data: {
        records: processedData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / parseInt(limit)),
          totalRecords,
          hasNext: offset + parseInt(limit) < totalRecords,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          startDate,
          endDate,
          vehicle,
          driver,
          status,
          paymentStatus,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 DASHBOARD METRICS - Financial Overview Cards
 * GET /ritase/dashboard-metrics?startDate=2024-01-01&endDate=2024-12-31
 */
exports.getDashboardMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const whereConditions = { status: "completed" };
    if (startDate && endDate) {
      whereConditions.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Get all completed delivery orders with financial data
    const deliveryOrders = await DeliveryOrder.findAll({
      where: whereConditions,
      include: [
        { model: DeliveryOrderPayments, as: "payments" },
        { model: DeliveryOrderInvoices, as: "invoices" },
        { model: DeliveryOrderAdjustments, as: "adjustments" },
      ],
    });

    // Calculate aggregated metrics
    let totalRevenue = 0;
    let totalOperationalCosts = 0;
    let totalNetProfit = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;
    let completedTrips = deliveryOrders.length;

    deliveryOrders.forEach((order) => {
      const actualQuantity =
        parseFloat(order.actual_load_quantity) ||
        parseFloat(order.minimal_load_quantity);
      const unitPrice = parseFloat(order.unit_price) || 0;
      const grossIncome = actualQuantity * unitPrice;

      const operationalCosts =
        parseFloat(order.trip_allowance) + parseFloat(order.gaji);
      const netProfit = grossIncome - operationalCosts;

      totalRevenue += grossIncome;
      totalOperationalCosts += operationalCosts;
      totalNetProfit += netProfit;

      // Payment data
      const orderPaid = order.payments.reduce(
        (sum, p) => sum + parseFloat(p.payment_amount),
        0
      );
      const orderInvoiced = order.invoices.reduce(
        (sum, i) => sum + parseFloat(i.net_amount),
        0
      );

      totalPaid += orderPaid;
      totalInvoiced += orderInvoiced;
    });

    const outstandingAmount = totalInvoiced - totalPaid;
    const profitMargin =
      totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
    const avgProfitPerTrip =
      completedTrips > 0 ? totalNetProfit / completedTrips : 0;

    // Vehicle and driver counts
    const activeVehicleCount = await Vehicle.count({
      where: { status: "in_use" },
    });
    const totalVehicleCount = await Vehicle.count();

    res.json({
      success: true,
      data: {
        financial: {
          totalRevenue,
          totalOperationalCosts,
          totalNetProfit,
          profitMargin,
          avgProfitPerTrip,
          totalInvoiced,
          totalPaid,
          outstandingAmount,
        },
        operational: {
          completedTrips,
          activeVehicles: activeVehicleCount,
          totalVehicles: totalVehicleCount,
          completionRate: 100, // Calculate based on assigned vs completed
        },
        period: {
          startDate,
          endDate,
          generatedAt: new Date(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 🚛 VEHICLE PERFORMANCE ANALYTICS
 * GET /ritase/analytics/vehicles?period=month
 */
exports.getVehicleAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Vehicle performance query with aggregated data
    const vehicleStats = await DeliveryOrder.findAll({
      where: {
        status: "completed",
        ...(startDate &&
          endDate && {
            created_at: {
              [Op.between]: [new Date(startDate), new Date(endDate)],
            },
          }),
      },
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["license_plate", "type", "capacity"],
        },
        { model: DeliveryOrderPayments, as: "payments" },
      ],
      group: ["vehicle.id", "vehicle.license_plate", "vehicle.type"],
      attributes: [
        [Sequelize.fn("COUNT", "*"), "tripCount"],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal("actual_load_quantity * unit_price")
          ),
          "totalRevenue",
        ],
        [
          Sequelize.fn("SUM", Sequelize.literal("trip_allowance + gaji")),
          "totalCosts",
        ],
        [
          Sequelize.fn("AVG", Sequelize.literal("actual_load_quantity")),
          "avgLoad",
        ],
      ],
    });

    res.json({
      success: true,
      data: vehicleStats,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 EXPORT COMPREHENSIVE EXCEL
 * GET /ritase/export/comprehensive?startDate=2024-01-01&endDate=2024-12-31
 */
exports.exportComprehensiveExcel = async (req, res, next) => {
  try {
    // Same logic as getComprehensiveRitaseTable but without pagination
    // Return Excel file with all your current Excel structure

    res.json({
      success: true,
      message: "Excel export feature - to be implemented",
      data: { exportUrl: "/exports/ritase-comprehensive.xlsx" },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 🎯 PO-SPECIFIC COMPREHENSIVE DATA with Unit Support
 * GET /ritase/purchase-orders/:po_id/comprehensive
 */
exports.getPOComprehensiveData = async (req, res, next) => {
  try {
    const { po_id } = req.params;

    // 🎯 ENHANCED: Get PO with unit field included
    const poData = await PurchaseOrder.findByPk(po_id, {
      include: [
        {
          model: DeliveryOrder,
          as: "deliveryOrders",
          include: [
            {
              model: Vehicle,
              as: "vehicle",
              attributes: ["id", "license_plate", "type", "capacity"], // 🎯 ADD: id and capacity for filtering
            },
            {
              model: User,
              as: "driver",
              attributes: ["id", "username"], // 🎯 ADD: id for reference
              include: [
                {
                  model: DriverProfile,
                  as: "driverProfile",
                  attributes: ["full_name", "phone"], // 🎯 ADD: phone for contact
                },
              ],
            },
            { model: DeliveryOrderPayments, as: "payments" },
            { model: DeliveryOrderInvoices, as: "invoices" },
            { model: DeliveryOrderAdjustments, as: "adjustments" },
          ],
        },
      ],
    });

    if (!poData) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // 🎯 NEW: Unit-aware calculation helper
    const calculateTotalAmount = (quantity, unitPrice, unit) => {
      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(unitPrice) || 0;

      switch (unit) {
        case "kilogram":
          return qty * price;
        case "ton":
          return qty * 1000 * price; // Convert ton to kg for pricing
        case "kubik":
          return qty * price; // Direct kubik pricing
        default:
          return qty * price;
      }
    };

    // 🎯 ENHANCED: Process DOs with unit-aware calculations
    const processedDOs = poData.deliveryOrders.map((order) => {
      const orderData = order.toJSON();

      // 🎯 NEW: Ensure unit field exists with fallback
      const orderUnit = orderData.unit || poData.unit || "ton";
      const poUnit = poData.unit || "ton";

      const actualQuantity =
        parseFloat(orderData.actual_load_quantity) ||
        parseFloat(orderData.minimal_load_quantity) ||
        0;
      const unitPrice = parseFloat(orderData.unit_price) || 0;

      // 🎯 ENHANCED: Unit-aware gross income calculation
      const grossIncome = calculateTotalAmount(
        actualQuantity,
        unitPrice,
        orderUnit
      );

      const operationalCosts =
        (parseFloat(orderData.trip_allowance) || 0) +
        (parseFloat(orderData.gaji) || 0);
      const netProfit = grossIncome - operationalCosts;
      const profitMargin =
        grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

      return {
        ...orderData,
        unit: orderUnit, // 🎯 NEW: Ensure unit is always present
        calculated: {
          actualQuantity,
          grossIncome,
          operationalCosts,
          netProfit,
          profitMargin,
        },
        // 🎯 NEW: Add unit context for frontend
        unit_info: {
          unit: orderUnit,
          po_unit: poUnit,
          unit_mismatch: orderUnit !== poUnit,
          unit_display:
            orderUnit === "kilogram"
              ? "kg"
              : orderUnit === "ton"
              ? "ton"
              : orderUnit === "kubik"
              ? "m³"
              : orderUnit,
        },
      };
    });

    // 🎯 ENHANCED: Calculate PO summary with unit awareness
    const summary = {
      total_dos: processedDOs.length,
      completed_dos: processedDOs.filter(
        (order) => order.status === "completed"
      ).length,
      pending_dos: processedDOs.filter((order) => order.status !== "completed")
        .length,
      total_quantity_delivered: processedDOs.reduce(
        (sum, order) => sum + order.calculated.actualQuantity,
        0
      ),
      total_revenue: processedDOs.reduce(
        (sum, order) => sum + order.calculated.grossIncome,
        0
      ),
      total_operational_costs: processedDOs.reduce(
        (sum, order) => sum + order.calculated.operationalCosts,
        0
      ),
      total_net_profit: processedDOs.reduce(
        (sum, order) => sum + order.calculated.netProfit,
        0
      ),
      outstanding_payments: 0, // Calculate from payments vs invoices
      completion_percentage:
        processedDOs.length > 0
          ? (processedDOs.filter((order) => order.status === "completed")
              .length /
              processedDOs.length) *
            100
          : 0,
      profit_margin: 0,

      // 🎯 NEW: Unit-based analytics
      unit_analytics: {
        po_unit: poData.unit || "ton",
        po_unit_display:
          poData.unit === "kilogram"
            ? "kg"
            : poData.unit === "ton"
            ? "ton"
            : poData.unit === "kubik"
            ? "m³"
            : poData.unit || "ton",
        pricing_strategy:
          poData.unit === "kubik"
            ? "Volume-based pricing"
            : "Weight-based pricing",
        unit_consistency: processedDOs.every(
          (order) => (order.unit || poData.unit) === poData.unit
        ),
        mixed_units: [
          ...new Set(processedDOs.map((order) => order.unit || poData.unit)),
        ],
      },

      // 🎯 NEW: Vehicle analytics for filtering
      vehicle_analytics: processedDOs.reduce((acc, order) => {
        const vehicleKey = order.vehicle?.license_plate || "unknown";

        if (!acc[vehicleKey]) {
          acc[vehicleKey] = {
            vehicle_info: order.vehicle,
            trip_count: 0,
            completed_trips: 0,
            total_quantity: 0,
            total_revenue: 0,
            total_profit: 0,
            avg_profit_margin: 0,
          };
        }

        acc[vehicleKey].trip_count++;
        if (order.status === "completed") {
          acc[vehicleKey].completed_trips++;
        }
        acc[vehicleKey].total_quantity += order.calculated.actualQuantity;
        acc[vehicleKey].total_revenue += order.calculated.grossIncome;
        acc[vehicleKey].total_profit += order.calculated.netProfit;

        return acc;
      }, {}),
    };

    // Calculate overall profit margin
    summary.profit_margin =
      summary.total_revenue > 0
        ? (summary.total_net_profit / summary.total_revenue) * 100
        : 0;

    // Calculate average profit margin per vehicle
    Object.values(summary.vehicle_analytics).forEach((vehicle) => {
      vehicle.avg_profit_margin =
        vehicle.total_revenue > 0
          ? (vehicle.total_profit / vehicle.total_revenue) * 100
          : 0;
    });

    // 🎯 ENHANCED: Response with unit and vehicle context
    res.json({
      success: true,
      data: {
        purchase_order: {
          ...poData.toJSON(),
          unit: poData.unit || "ton", // 🎯 ENSURE: Unit is always present
        },
        delivery_orders: processedDOs,
        summary,
        // 🎯 NEW: Additional metadata for frontend
        metadata: {
          filters_available: {
            vehicles: Object.values(summary.vehicle_analytics).map((v) => ({
              id: v.vehicle_info?.id || null,
              license_plate: v.vehicle_info?.license_plate || "unknown",
              type: v.vehicle_info?.type || "unknown",
              display_name: v.vehicle_info
                ? `${v.vehicle_info.license_plate} (${v.vehicle_info.type})`
                : "Unknown Vehicle",
            })),
            statuses: [...new Set(processedDOs.map((order) => order.status))],
            payment_statuses: [
              ...new Set(processedDOs.map((order) => order.payment_status)),
            ],
          },
          unit_context: {
            po_unit: poData.unit || "ton",
            consistent_units: summary.unit_analytics.unit_consistency,
            pricing_type: summary.unit_analytics.pricing_strategy,
          },
        },
      },
    });
  } catch (err) {
    console.error("Error in getPOComprehensiveData:", err);
    next(err);
  }
};
