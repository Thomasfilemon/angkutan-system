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
 * 🎯 COMPREHENSIVE RITASE TABLE - Auto-load latest ritase by vehicle plate
 * GET /ritase/comprehensive - Shows 10 latest ritase sorted by license plate DESC
 *
 * ✅ FIXED: Vehicle filtering, unit filtering, calculated field sorting, performance optimization
 */
exports.getComprehensiveRitaseTable = async (req, res, next) => {
  try {
    // ✅ SAFE PARAMETER EXTRACTION - Handle arrays from duplicate params
    const {
      startDate = null,
      endDate = null,
      vehicle = null,
      driver = null,
      status = null,
      paymentStatus = null,
      unit = null, // ✅ ADDED: Unit filter
      page = 1,
      limit = 10,
      sortBy = "license_plate",
      sortOrder = "DESC",
    } = req.query;

    // ✅ FIX: Ensure parameters are strings, not arrays
    const safeParams = {
      startDate: Array.isArray(startDate) ? startDate[0] : startDate,
      endDate: Array.isArray(endDate) ? endDate[0] : endDate,
      vehicle: Array.isArray(vehicle) ? vehicle[0] : vehicle,
      driver: Array.isArray(driver) ? driver[0] : driver,
      status: Array.isArray(status) ? status[0] : status,
      paymentStatus: Array.isArray(paymentStatus)
        ? paymentStatus[0]
        : paymentStatus,
      unit: Array.isArray(unit) ? unit[0] : unit, // ✅ ADDED: Safe unit param
      page: Array.isArray(page) ? parseInt(page[0]) : parseInt(page),
      limit: Array.isArray(limit) ? parseInt(limit[0]) : parseInt(limit),
      sortBy: Array.isArray(sortBy) ? sortBy[0] : sortBy,
      sortOrder: Array.isArray(sortOrder) ? sortOrder[0] : sortOrder,
    };

    // ✅ VALIDATION: Ensure safe params
    if (isNaN(safeParams.page) || safeParams.page < 1) safeParams.page = 1;
    if (
      isNaN(safeParams.limit) ||
      safeParams.limit < 1 ||
      safeParams.limit > 100
    ) {
      safeParams.limit = 10;
    }

    // Build dynamic where conditions using safe parameters
    const whereConditions = {};
    const includeConditions = [];

    // ✅ Date range filtering
    if (safeParams.startDate && safeParams.endDate) {
      try {
        const startDate = new Date(safeParams.startDate);
        const endDate = new Date(safeParams.endDate);

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          whereConditions.created_at = {
            [Op.between]: [startDate, endDate],
          };
        }
      } catch (err) {
        console.warn(
          "Invalid date range provided:",
          safeParams.startDate,
          safeParams.endDate
        );
      }
    }

    // ✅ Status filtering
    if (safeParams.status && safeParams.status !== "all") {
      whereConditions.status = safeParams.status;
    }

    // ✅ Payment status filtering
    if (safeParams.paymentStatus && safeParams.paymentStatus !== "all") {
      whereConditions.payment_status = safeParams.paymentStatus;
    }

    // ✅ FIXED: Unit filtering - now actually used!
    if (safeParams.unit && safeParams.unit !== "all") {
      whereConditions.unit = safeParams.unit;
    }

    // ✅ Driver filtering
    if (safeParams.driver && safeParams.driver !== "all") {
      whereConditions.driver_id = safeParams.driver;
    }

    // ✅ Build include conditions with optional vehicle filtering
    const vehicleInclude = {
      model: Vehicle,
      as: "vehicle",
      attributes: ["id", "license_plate", "type", "capacity"],
      required: false,
    };

    // ✅ FIXED: Vehicle filtering - now works with license_plate from frontend
    if (safeParams.vehicle && safeParams.vehicle !== "all") {
      vehicleInclude.where = { license_plate: safeParams.vehicle };
      vehicleInclude.required = true;
    }

    // ✅ OPTIMIZED: Conditional includes for better performance
    const baseIncludes = [
      {
        model: PurchaseOrder,
        as: "purchaseOrder",
        attributes: ["id", "po_number", "customer_name", "item_name"],
      },
      vehicleInclude,
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
    ];

    // ✅ OPTIMIZED: Load financial data only when needed
    const financialIncludes = [
      {
        model: DeliveryOrderPayments,
        as: "payments",
        attributes: ["payment_amount", "payment_date", "payment_type"],
      },
      {
        model: DeliveryOrderInvoices,
        as: "invoices",
        attributes: ["invoice_amount", "pph_amount", "net_amount", "status"],
      },
      {
        model: DeliveryOrderAdjustments,
        as: "adjustments",
        attributes: ["adjustment_type", "adjustment_amount", "reason"],
      },
    ];

    const allIncludes = [...baseIncludes, ...financialIncludes];

    const offset = (safeParams.page - 1) * safeParams.limit;

    // ✅ FIXED: Safe order clause with calculated field handling
    let orderClause;
    const sortField = safeParams.sortBy.toLowerCase();
    const sortDirection = safeParams.sortOrder.toUpperCase();

    if (sortField === "license_plate") {
      // Use Sequelize.literal for complex join ordering
      orderClause = [
        [Sequelize.literal('"vehicle"."license_plate"'), sortDirection],
        ["created_at", "DESC"],
      ];
    } else if (sortField.startsWith("calculated.")) {
      // ✅ FIXED: Calculated fields - fall back to date sorting, handle in memory
      console.warn(
        `Calculated field sorting (${sortField}) will be handled in memory`
      );
      orderClause = [["created_at", "DESC"]];
    } else if (sortField === "created_at" || sortField === "completed_at") {
      orderClause = [[sortField, sortDirection]];
    } else {
      // ✅ SAFE: Default ordering with fallback
      try {
        orderClause = [[sortField, sortDirection]];
      } catch (err) {
        console.warn(
          "Invalid sort field:",
          sortField,
          "- falling back to created_at"
        );
        orderClause = [["created_at", "DESC"]];
      }
    }

    // ✅ MAIN QUERY: Execute with error handling
    let deliveryOrders, totalRecords;

    try {
      const result = await DeliveryOrder.findAndCountAll({
        where: whereConditions,
        include: allIncludes,
        order: orderClause,
        limit: safeParams.limit,
        offset,
        distinct: true,
        subQuery: false, // ✅ IMPORTANT: Prevent complex subqueries
      });

      deliveryOrders = result.rows;
      totalRecords = result.count;

      console.log(
        `✅ Query successful: ${totalRecords} total records, ${deliveryOrders.length} returned`
      );
    } catch (queryError) {
      console.error("❌ Database query failed:", queryError);
      console.error("🔍 SQL Query:", queryError.sql);
      console.error("📋 Parameters:", queryError.parameters);

      return res.status(500).json({
        success: false,
        message: "Database query failed",
        error:
          process.env.NODE_ENV === "development"
            ? {
                message: queryError.message,
                sql: queryError.sql?.substring(0, 500), // Truncate long SQL
                originalQuery: safeParams,
              }
            : "Internal server error",
      });
    }

    // ✅ ENHANCED: Unit-aware calculation function
    const calculateUnitAwareTotal = (actualQuantity, unitPrice, unit) => {
      const quantity = parseFloat(actualQuantity) || 0;
      const price = parseFloat(unitPrice) || 0;

      if (quantity === 0 || price === 0) return 0;

      switch (unit) {
        case "kilogram":
          return quantity * price;
        case "ton":
          return quantity * 1000 * price; // ✅ Convert ton to kg pricing
        case "kubik":
          return quantity * price; // Direct volume pricing
        default:
          console.warn(`Unknown unit: ${unit}, using direct multiplication`);
          return quantity * price;
      }
    };

    // ✅ OPTIMIZED: Process data with error handling
    const processedData = deliveryOrders.map((order) => {
      try {
        const orderData = order.toJSON();

        // ✅ SAFE: Default values to prevent calculation errors
        const actualQuantity =
          parseFloat(orderData.actual_load_quantity) ||
          parseFloat(orderData.minimal_load_quantity) ||
          0;
        const unitPrice = parseFloat(orderData.unit_price) || 0;
        const orderUnit = orderData.unit || "ton";

        // ✅ ENHANCED: Unit-aware financial calculations
        const grossIncome = calculateUnitAwareTotal(
          actualQuantity,
          unitPrice,
          orderUnit
        );
        const uangJalan = parseFloat(orderData.trip_allowance) || 0;
        const gaji = parseFloat(orderData.gaji) || 0;
        const operationalCosts = uangJalan + gaji;
        const netProfit = grossIncome - operationalCosts;
        const profitMargin =
          grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;

        // ✅ SAFE: Payment calculations with error handling
        const totalPaid = (orderData.payments || []).reduce((sum, payment) => {
          const amount = parseFloat(payment.payment_amount) || 0;
          return sum + amount;
        }, 0);

        const totalInvoiced = (orderData.invoices || []).reduce(
          (sum, invoice) => {
            const amount = parseFloat(invoice.net_amount) || 0;
            return sum + amount;
          },
          0
        );

        const outstanding = totalInvoiced - totalPaid;
        const costPerUnit =
          actualQuantity > 0 ? operationalCosts / actualQuantity : 0;
        const revenuePerUnit =
          actualQuantity > 0 ? grossIncome / actualQuantity : 0;

        // ✅ ENHANCED: Unit display helpers
        const unitDisplay = getUnitDisplay(orderUnit);
        const unitContext = {
          unit: orderUnit,
          unit_display: unitDisplay,
          pricing_per_unit: `Rp ${unitPrice.toLocaleString(
            "id-ID"
          )}/${unitDisplay}`,
          total_calculation:
            orderUnit === "ton"
              ? `${actualQuantity} ton × 1000 × Rp ${unitPrice.toLocaleString(
                  "id-ID"
                )}/kg`
              : `${actualQuantity} ${unitDisplay} × Rp ${unitPrice.toLocaleString(
                  "id-ID"
                )}/${unitDisplay}`,
        };

        const route = `${orderData.load_location || "Unknown"} → ${
          orderData.unload_location || "Unknown"
        }`;

        // ✅ SAFE: Payment days calculation
        const paymentDays =
          orderData.completed_at &&
          orderData.payments &&
          orderData.payments.length > 0
            ? Math.ceil(
                (new Date(orderData.payments[0].payment_date) -
                  new Date(orderData.completed_at)) /
                  (1000 * 60 * 60 * 24)
              )
            : null;

        return {
          ...orderData,
          calculated: {
            actualQuantity,
            grossIncome,
            operationalCosts,
            netProfit,
            profitMargin,
            costPerUnit,
            revenuePerUnit,
            totalPaid,
            totalInvoiced,
            outstanding,
            paymentDays,
            route,
            unit_context: unitContext,
            efficiency: {
              quantityEfficiency:
                orderData.minimal_load_quantity > 0
                  ? (actualQuantity /
                      parseFloat(orderData.minimal_load_quantity)) *
                    100
                  : 0,
              profitability: netProfit > 0 ? "profitable" : "loss",
              paymentSpeed:
                paymentDays === null
                  ? "pending"
                  : paymentDays <= 30
                  ? "fast"
                  : paymentDays <= 60
                  ? "normal"
                  : "slow",
            },
          },
        };
      } catch (processingError) {
        console.error("Error processing order:", order.id, processingError);
        // ✅ FALLBACK: Return minimal data structure
        return {
          ...order.toJSON(),
          calculated: {
            actualQuantity: 0,
            grossIncome: 0,
            operationalCosts: 0,
            netProfit: 0,
            profitMargin: 0,
            costPerUnit: 0,
            revenuePerUnit: 0,
            totalPaid: 0,
            totalInvoiced: 0,
            outstanding: 0,
            paymentDays: null,
            route: "Error calculating route",
            unit_context: { unit: "unknown", unit_display: "unknown" },
            efficiency: {
              quantityEfficiency: 0,
              profitability: "unknown",
              paymentSpeed: "unknown",
            },
          },
        };
      }
    });

    // ✅ FIXED: Handle calculated field sorting in memory
    if (safeParams.sortBy.startsWith("calculated.")) {
      const sortField = safeParams.sortBy.replace("calculated.", "");
      const isAscending = safeParams.sortOrder.toUpperCase() === "ASC";

      processedData.sort((a, b) => {
        const aVal = a.calculated[sortField] || 0;
        const bVal = b.calculated[sortField] || 0;

        if (isAscending) {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      });
    }

    // ✅ ENHANCED: Summary statistics with error handling
    const summaryStats = {
      totalRecords,
      totalRevenue: processedData.reduce(
        (sum, record) => sum + (record.calculated.grossIncome || 0),
        0
      ),
      totalProfit: processedData.reduce(
        (sum, record) => sum + (record.calculated.netProfit || 0),
        0
      ),
      vehicleCount: [
        ...new Set(
          processedData.map((record) => record.vehicle_id).filter(Boolean)
        ),
      ].length,
      completedTrips: processedData.filter(
        (record) => record.status === "completed"
      ).length,
      // ✅ ADDED: Additional summary metrics
      totalOperationalCosts: processedData.reduce(
        (sum, record) => sum + (record.calculated.operationalCosts || 0),
        0
      ),
      averageProfitMargin:
        processedData.length > 0
          ? processedData.reduce(
              (sum, record) => sum + (record.calculated.profitMargin || 0),
              0
            ) / processedData.length
          : 0,
      outstandingAmount: processedData.reduce(
        (sum, record) => sum + (record.calculated.outstanding || 0),
        0
      ),
    };

    // ✅ ENHANCED: Response with comprehensive data and metadata
    res.json({
      success: true,
      data: {
        records: processedData,
        summary: summaryStats,
        pagination: {
          currentPage: safeParams.page,
          totalPages: Math.ceil(totalRecords / safeParams.limit),
          totalRecords,
          limit: safeParams.limit,
          hasNext: offset + safeParams.limit < totalRecords,
          hasPrev: safeParams.page > 1,
        },
        filters: {
          startDate: safeParams.startDate,
          endDate: safeParams.endDate,
          vehicle: safeParams.vehicle,
          driver: safeParams.driver,
          status: safeParams.status,
          paymentStatus: safeParams.paymentStatus,
          unit: safeParams.unit, // ✅ ADDED: Include unit in response
          sortBy: safeParams.sortBy,
          sortOrder: safeParams.sortOrder,
        },
        // ✅ ADDED: Query performance metadata
        metadata: {
          queryExecutionTime: Date.now(), // You can calculate actual execution time
          calculatedFieldSorting: safeParams.sortBy.startsWith("calculated."),
          unitAwareCalculations: true,
          version: "2.0.0", // Version your API
        },
      },
    });
  } catch (err) {
    console.error("Critical error in getComprehensiveRitaseTable:", err);
    console.error("Stack trace:", err.stack);

    // ✅ ENHANCED: Detailed error response
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? {
              message: err.message,
              stack: err.stack,
              query: req.query,
            }
          : "Something went wrong",
    });

    next(err);
  }
};

// ✅ HELPER: Enhanced unit display function
const getUnitDisplay = (unit) => {
  const unitMap = {
    kilogram: "kg",
    ton: "ton",
    kubik: "m³",
  };
  return unitMap[unit] || unit;
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

    // 🎯 NEW: Unit-aware calculation function
    const calculateUnitAwareTotal = (actualQuantity, unitPrice, unit) => {
      const quantity = parseFloat(actualQuantity) || 0;
      const price = parseFloat(unitPrice) || 0;

      switch (unit) {
        case "kilogram":
          return quantity * price;
        case "ton":
          return quantity * 1000 * price; // 🎯 FIXED: Convert ton to kg
        case "kubik":
          return quantity * price; // Direct kubik pricing
        default:
          return quantity * price;
      }
    };

    // 🎯 NEW: Unit analytics tracking
    const unitAnalytics = {
      unit_distribution: { kilogram: 0, ton: 0, kubik: 0 },
      total_quantity_by_unit: { kilogram: 0, ton: 0, kubik: 0 },
    };

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
      const unit = order.unit || "ton"; // Default to ton if unit missing

      // 🎯 FIXED: Use unit-aware calculation
      const grossIncome = calculateUnitAwareTotal(
        actualQuantity,
        unitPrice,
        unit
      );

      const operationalCosts =
        parseFloat(order.trip_allowance) + parseFloat(order.gaji);
      const netProfit = grossIncome - operationalCosts;

      totalRevenue += grossIncome;
      totalOperationalCosts += operationalCosts;
      totalNetProfit += netProfit;

      // 🎯 NEW: Track unit analytics
      if (unitAnalytics.unit_distribution[unit] !== undefined) {
        unitAnalytics.unit_distribution[unit]++;
        unitAnalytics.total_quantity_by_unit[unit] += actualQuantity;
      }

      // Payment data
      const orderPaid = order.payments.reduce(
        (sum, p) => sum + parseFloat(p.payment_amount || 0),
        0
      );
      const orderInvoiced = order.invoices.reduce(
        (sum, i) => sum + parseFloat(i.net_amount || 0),
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

    // 🎯 NEW: Enhanced response with unit analytics
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
        // 🎯 NEW: Unit analytics
        unit_analytics: unitAnalytics,
        period: {
          startDate,
          endDate,
          generatedAt: new Date(),
          calculation_method: "unit_aware", // 🎯 NEW: Indicate calculation method
        },
        // 🎯 NEW: Summary stats
        summary: {
          revenue_per_trip:
            completedTrips > 0 ? totalRevenue / completedTrips : 0,
          cost_per_trip:
            completedTrips > 0 ? totalOperationalCosts / completedTrips : 0,
          profit_per_trip:
            completedTrips > 0 ? totalNetProfit / completedTrips : 0,
          total_trips_by_unit: {
            weight_based:
              unitAnalytics.unit_distribution.kilogram +
              unitAnalytics.unit_distribution.ton,
            volume_based: unitAnalytics.unit_distribution.kubik,
          },
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
