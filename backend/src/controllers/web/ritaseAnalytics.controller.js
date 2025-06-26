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
 * 🎯 PO-SPECIFIC COMPREHENSIVE DATA
 * GET /ritase/purchase-orders/:po_id/comprehensive
 */
exports.getPOComprehensiveData = async (req, res, next) => {
  try {
    const { po_id } = req.params;

    // Get PO with all related delivery orders
    const poData = await PurchaseOrder.findByPk(po_id, {
      include: [
        {
          model: DeliveryOrder,
          as: "deliveryOrders",
          include: [
            {
              model: Vehicle,
              as: "vehicle",
              attributes: ["license_plate", "type"],
            },
            {
              model: User,
              as: "driver",
              attributes: ["username"],
              include: [
                {
                  model: DriverProfile,
                  as: "driverProfile",
                  attributes: ["full_name"],
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

    // Calculate comprehensive metrics for each DO
    const processedDOs = poData.deliveryOrders.map((order) => {
      const orderData = order.toJSON();

      const actualQuantity =
        parseFloat(orderData.actual_load_quantity) ||
        parseFloat(orderData.minimal_load_quantity);
      const unitPrice = parseFloat(orderData.unit_price) || 0;
      const grossIncome = actualQuantity * unitPrice;
      const operationalCosts =
        parseFloat(orderData.trip_allowance) + parseFloat(orderData.gaji);
      const netProfit = grossIncome - operationalCosts;
      const profitMargin =
        grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

      return {
        ...orderData,
        calculated: {
          actualQuantity,
          grossIncome,
          operationalCosts,
          netProfit,
          profitMargin,
        },
      };
    });

    // Calculate PO summary
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
      profit_margin: 0, // Calculate overall margin
    };

    summary.profit_margin =
      summary.total_revenue > 0
        ? (summary.total_net_profit / summary.total_revenue) * 100
        : 0;

    res.json({
      success: true,
      data: {
        purchase_order: poData,
        delivery_orders: processedDOs,
        summary,
      },
    });
  } catch (err) {
    next(err);
  }
};
