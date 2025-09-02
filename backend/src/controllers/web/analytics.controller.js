const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");
const { Op } = require("sequelize");
const db = require("../../models");
const moment = require("moment-timezone");

// Helper untuk mendapatkan rentang tanggal di zona waktu WIB
const getDateRange = (timeRange) => {
  const now = moment.tz("Asia/Jakarta");
  let startDate;

  switch (timeRange) {
    case "week":
      startDate = now.clone().subtract(7, "days").startOf("day");
      break;
    case "month":
      startDate = now.clone().subtract(1, "month").startOf("day");
      break;
    case "year":
      startDate = now.clone().subtract(1, "year").startOf("day");
      break;
    default:
      startDate = now.clone().subtract(1, "month").startOf("day");
  }
  const endDate = now.endOf("day");
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

const getDashboardMetrics = async (req, res) => {
  try {
    const {
      timeRange = "month",
      startDate: customStartDate,
      endDate: customEndDate,
    } = req.query;

    let startDate, endDate;

    if (customStartDate && customEndDate) {
      startDate = moment
        .tz(customStartDate, "Asia/Jakarta")
        .startOf("day")
        .toISOString();
      endDate = moment
        .tz(customEndDate, "Asia/Jakarta")
        .endOf("day")
        .toISOString();
    } else {
      const range = getDateRange(timeRange);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    console.log(
      `[Analytics] Fetching data for time range: ${startDate} to ${endDate}`
    );

    // 1. Metrik Finansial dari Delivery Orders
    const doFinancials = await sequelize.query(
      `
      SELECT 
        COALESCE(SUM(CASE WHEN payment_status = 'lunas' THEN final_amount ELSE 0 END), 0) as gross_income,
        COALESCE(SUM(trip_allowance), 0) as total_uang_jalan,
        COALESCE(SUM(gaji), 0) as total_gaji_driver
      FROM delivery_orders
      WHERE 
        status = 'completed' AND 
        completed_at BETWEEN :startDate AND :endDate
    `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    console.log("[Debug] doFinancials:", doFinancials);

    // 2. Biaya Operasional Lainnya
    const otherExpenses = await sequelize.query(
      `
      SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM driver_expenses WHERE created_at BETWEEN :startDate AND :endDate AND jenis NOT IN ('uang_jalan', 'gaji')) as other_driver_expenses,
        (SELECT COALESCE(SUM(total_cost), 0) FROM vehicle_services WHERE service_date BETWEEN :startDate AND :endDate) as total_service_cost,
        (SELECT COALESCE(SUM(amount), 0) FROM office_expenses WHERE expense_date BETWEEN :startDate AND :endDate) as total_office_expenses
      `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    console.log("[Debug] otherExpenses:", otherExpenses);

    // 3. Metrik Inventaris (fix low_stock_items ke per batch)
    const inventoryMetrics = await sequelize.query(
      `
      SELECT 
        COALESCE(SUM(sb.quantity * sb.unit_price), 0) as total_inventory_value,
        (SELECT COALESCE(SUM(st.total_amount), 0) FROM stock_transactions st WHERE st.transaction_type = 'in' AND st.transaction_date BETWEEN :startDate AND :endDate) as total_purchases,
        (SELECT COUNT(*) FROM stock_items si LEFT JOIN stock_batches sb ON si.id = sb.item_id WHERE sb.quantity <= si.min_stock) as low_stock_items
      FROM stock_items si
      LEFT JOIN stock_batches sb ON si.id = sb.item_id
    `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    console.log("[Debug] inventoryMetrics:", inventoryMetrics);

    // Tambah Category Breakdown
    const categoryBreakdown = await sequelize.query(
      `
      SELECT 
        sc.category_name as category,
        COALESCE(SUM(sb.quantity * sb.unit_price), 0) as value,
        COUNT(CASE WHEN sb.quantity <= si.min_stock THEN 1 END) as low_stock
      FROM stock_items si
      LEFT JOIN stock_categories sc ON si.category_id = sc.id
      LEFT JOIN stock_batches sb ON si.id = sb.item_id
      -- WHERE clause removed to calculate total current inventory value regardless of purchase date
      GROUP BY sc.category_name
      HAVING COALESCE(SUM(sb.quantity * sb.unit_price), 0) > 0 -- Only show categories with stock
    `,
      {
        type: QueryTypes.SELECT,
      }
    );

    // 4. Metrik Operasional (tambah dailyTrend)
    const operationalMetrics = await sequelize.query(
      `
      SELECT 
        COUNT(CASE WHEN status NOT IN ('completed', 'cancelled') THEN 1 END) as active_deliveries,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_deliveries,
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'maintenance') as vehicles_in_maintenance
      FROM delivery_orders
      WHERE created_at BETWEEN :startDate AND :endDate
    `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    console.log("[Debug] operationalMetrics:", operationalMetrics);

    // Tambah Daily Trend
    const dailyTrend = await sequelize.query(
      `
      SELECT 
        DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Jakarta') as date,
        COUNT(CASE WHEN status NOT IN ('completed', 'cancelled') THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM delivery_orders
      WHERE created_at BETWEEN :startDate AND :endDate
      GROUP BY DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Jakarta')
      ORDER BY date ASC
    `,
      {
        replacements: { startDate, endDate },
        type: QueryTypes.SELECT,
      }
    );

    // --- KALKULASI METRIK FINAL ---
    const grossIncome = parseFloat(doFinancials.gross_income || 0);
    const totalUangJalan = parseFloat(doFinancials.total_uang_jalan || 0);
    const totalGajiDriver = parseFloat(doFinancials.total_gaji_driver || 0);
    const totalOtherDriverExpenses = parseFloat(
      otherExpenses.other_driver_expenses || 0
    );
    const totalServiceCost = parseFloat(otherExpenses.total_service_cost || 0);
    const totalOfficeExpenses = parseFloat(
      otherExpenses.total_office_expenses || 0
    );

    const totalExpenses =
      totalUangJalan +
      totalGajiDriver +
      totalOtherDriverExpenses +
      totalServiceCost +
      totalOfficeExpenses;
    const netIncome = grossIncome - totalExpenses;

    // Gabungkan semua metrik untuk respons akhir
    const metrics = {
      grossIncome,
      netIncome,
      totalExpenses,
      driverExpenses: {
        totalUangJalan,
        totalGajiDriver,
        totalOtherDriverExpenses,
      },
      vehicleExpenses: {
        totalServiceCost,
      },
      officeExpenses: {
        totalOfficeExpenses,
      },
      inventoryMetrics: {
        totalInventoryValue: parseFloat(
          inventoryMetrics.total_inventory_value || 0
        ),
        totalPurchases: parseFloat(inventoryMetrics.total_purchases || 0),
        lowStockItems: parseInt(inventoryMetrics.low_stock_items || 0),
        categoryBreakdown: categoryBreakdown.map((cat) => ({
          category: cat.category || "Unknown",
          value: parseFloat(cat.value || 0),
          lowStock: parseInt(cat.low_stock || 0),
        })),
      },
      operationalMetrics: {
        activeDeliveries: parseInt(operationalMetrics.active_deliveries || 0),
        completedDeliveries: parseInt(
          operationalMetrics.completed_deliveries || 0
        ),
        totalVehicles: parseInt(operationalMetrics.total_vehicles || 0),
        vehiclesInMaintenance: parseInt(
          operationalMetrics.vehicles_in_maintenance || 0
        ),
        dailyTrend: dailyTrend.map((trend) => ({
          date: trend.date,
          active: parseInt(trend.active || 0),
          completed: parseInt(trend.completed || 0),
        })),
      },
    };

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error in getDashboardMetrics:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard metrics",
      details: error.message,
    });
  }
};

const getExpenseAnalytics = async (req, res, next) => {
  try {
    const { timeRange, jenis } = req.query;
    if (!timeRange) {
      return res.status(400).json({
        success: false,
        error: "timeRange parameter is required",
      });
    }
    const { startDate, endDate } = getDateRange(timeRange);
    let whereClause = {
      created_at: {
        [Op.between]: [startDate, endDate],
      },
    };
    if (jenis) {
      whereClause.jenis = jenis;
    }

    // Daily trend by jenis
    const dailyTrends = await db.DriverExpense.findAll({
      attributes: [
        [
          db.sequelize.fn("DATE_TRUNC", "day", db.sequelize.col("created_at")),
          "date",
        ],
        "jenis",
        [db.sequelize.fn("SUM", db.sequelize.col("amount")), "total_amount"],
      ],
      where: whereClause,
      group: [
        db.sequelize.fn("DATE_TRUNC", "day", db.sequelize.col("created_at")),
        "jenis",
      ],
      order: [
        [
          db.sequelize.fn("DATE_TRUNC", "day", db.sequelize.col("created_at")),
          "ASC",
        ],
        ["jenis", "ASC"],
      ],
      raw: true,
    });

    // Summary by jenis
    const summaryByType = await db.DriverExpense.findAll({
      attributes: [
        "jenis",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
        [db.sequelize.fn("SUM", db.sequelize.col("amount")), "total_amount"],
      ],
      where: whereClause,
      group: ["jenis"],
      order: [[db.sequelize.fn("SUM", db.sequelize.col("amount")), "DESC"]],
      raw: true,
    });

    // Calculate total
    const total = summaryByType.reduce(
      (acc, curr) => acc + parseFloat(curr.total_amount || 0),
      0
    );

    res.json({
      success: true,
      data: {
        daily_trends: dailyTrends.map((r) => ({
          date: r.date,
          jenis: r.jenis,
          total_amount: parseFloat(r.total_amount),
        })),
        summary_by_type: summaryByType.map((s) => ({
          jenis: s.jenis,
          count: parseInt(s.count),
          total_amount: parseFloat(s.total_amount),
          percentage: total
            ? ((parseFloat(s.total_amount) / total) * 100).toFixed(2)
            : "0.00",
        })),
        total_expenses: total,
      },
      timeRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error("Error in getExpenseAnalytics:", error);
    next(error);
  }
};

module.exports = {
  getDashboardMetrics,
  getExpenseAnalytics,
};
