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
    case "all":
      // For "all time", set start date to a very early date (e.g., 10 years ago)
      startDate = now.clone().subtract(10, "years").startOf("day");
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

// Get vehicle expenditure analytics (pengeluaran per mobil)
const getVehicleExpenditureAnalytics = async (req, res) => {
  try {
    console.log("[VehicleExpenditure] Request query:", req.query);
    
    const {
      timeRange = "all",
      startDate: customStartDate,
      endDate: customEndDate,
      vehicleId,
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

    const vehicleIdInt = vehicleId ? parseInt(vehicleId, 10) : null;
    
    console.log("[VehicleExpenditure] Date range:", { startDate, endDate, vehicleIdInt });

    // First, let's get all vehicles to make sure we have data
    const allVehicles = await sequelize.query(
      `SELECT id, license_plate, type FROM vehicles ORDER BY id`,
      { type: QueryTypes.SELECT }
    );
    console.log("[VehicleExpenditure] All vehicles:", allVehicles);

    // Get stock usage from services per vehicle
    console.log("[VehicleExpenditure] Executing services query...");
    const stockUsageFromServices = await sequelize.query(
      `
      SELECT 
        v.id as vehicle_id,
        v.license_plate,
        v.type as vehicle_type,
        COALESCE(SUM(st.total_amount), 0) as total_stock_usage_cost,
        COUNT(DISTINCT vs.id) as service_count,
        COUNT(DISTINCT st.item_id) as unique_items_used,
        COALESCE(SUM(st.quantity), 0) as total_quantity_used
      FROM vehicles v
      LEFT JOIN vehicle_services vs ON v.id = vs.vehicle_id 
        AND vs.service_date BETWEEN :startDate AND :endDate
        AND (vs.status IS NULL OR vs.status <> 'cancelled')
      LEFT JOIN stock_transactions st ON vs.id = st.reference_id 
        AND st.reference_type = 'service'
        AND st.transaction_type = 'out'
      WHERE (:vehicleId IS NULL OR v.id = :vehicleId)
      GROUP BY v.id, v.license_plate, v.type
      ORDER BY total_stock_usage_cost DESC
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
      }
    );
    console.log("[VehicleExpenditure] Services query result:", stockUsageFromServices);

    // Get stock usage from direct usage notes per vehicle
    console.log("[VehicleExpenditure] Executing usage notes query...");
    const stockUsageFromNotes = await sequelize.query(
      `
      SELECT 
        v.id as vehicle_id,
        v.license_plate,
        v.type as vehicle_type,
        COALESCE(SUM(suni.total_price), 0) as total_direct_usage_cost,
        COUNT(DISTINCT sun.id) as usage_note_count,
        COUNT(DISTINCT suni.item_id) as unique_items_used
      FROM vehicles v
      LEFT JOIN stock_usage_notes sun ON v.id = sun.vehicle_id 
        AND sun.usage_date BETWEEN :startDate AND :endDate
      LEFT JOIN stock_usage_note_items suni ON sun.id = suni.note_id
      WHERE (:vehicleId IS NULL OR v.id = :vehicleId)
      GROUP BY v.id, v.license_plate, v.type
      ORDER BY total_direct_usage_cost DESC
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
      }
    );
    console.log("[VehicleExpenditure] Usage notes query result:", stockUsageFromNotes);

    // Get delivery orders with deposits per vehicle (count per quantity in DO when deposit exists)
    console.log("[VehicleExpenditure] Executing delivery orders with deposits query...");
    const deliveryOrdersWithDeposits = await sequelize.query(
      `
      SELECT 
        v.id as vehicle_id,
        v.license_plate,
        v.type as vehicle_type,
        COALESCE(SUM(
          CASE 
            WHEN dgm.id IS NOT NULL THEN 
              -- When deposit exists, count per actual_load_quantity (or minimal if actual is null)
              COALESCE(d.actual_load_quantity, d.minimal_load_quantity, 0)
            ELSE 
              0
          END
        ), 0) as total_do_quantity,
        COUNT(DISTINCT CASE WHEN dgm.id IS NOT NULL THEN d.id END) as do_count_with_deposit,
        COALESCE(SUM(
          CASE 
            WHEN dgm.id IS NOT NULL THEN 
              -- When deposit exists, calculate value based on actual quantity
              COALESCE(d.actual_load_quantity, d.minimal_load_quantity, 0) * COALESCE(d.unit_price, 0)
            ELSE 
              0
          END
        ), 0) as total_do_value
      FROM vehicles v
      LEFT JOIN delivery_orders d ON v.id = d.vehicle_id 
        AND d.completed_at BETWEEN :startDate AND :endDate
        AND d.status = 'completed'
      LEFT JOIN deposit_group_members dgm ON d.id = dgm.delivery_order_id
      WHERE (:vehicleId IS NULL OR v.id = :vehicleId)
      GROUP BY v.id, v.license_plate, v.type
      ORDER BY total_do_quantity DESC
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
      }
    );
    console.log("[VehicleExpenditure] Delivery orders with deposits query result:", deliveryOrdersWithDeposits);

    // Combine the data
    const vehicleMap = new Map();
    
    // Add service-based stock usage
    stockUsageFromServices.forEach(vehicle => {
      vehicleMap.set(vehicle.vehicle_id, {
        vehicle_id: vehicle.vehicle_id,
        license_plate: vehicle.license_plate,
        vehicle_type: vehicle.vehicle_type,
        service_stock_cost: parseFloat(vehicle.total_stock_usage_cost),
        service_count: parseInt(vehicle.service_count),
        service_unique_items: parseInt(vehicle.unique_items_used),
        service_quantity_used: parseFloat(vehicle.total_quantity_used),
        direct_usage_cost: 0,
        usage_note_count: 0,
        direct_unique_items: 0,
        do_count_with_deposit: 0,
        total_do_quantity: 0,
        total_do_value: 0,
        total_stock_expenditure: parseFloat(vehicle.total_stock_usage_cost)
      });
    });

    // Add direct usage data
    stockUsageFromNotes.forEach(vehicle => {
      const existing = vehicleMap.get(vehicle.vehicle_id);
      if (existing) {
        existing.direct_usage_cost = parseFloat(vehicle.total_direct_usage_cost);
        existing.usage_note_count = parseInt(vehicle.usage_note_count);
        existing.direct_unique_items = parseInt(vehicle.unique_items_used);
        existing.total_stock_expenditure = existing.service_stock_cost + existing.direct_usage_cost;
      } else {
        vehicleMap.set(vehicle.vehicle_id, {
          vehicle_id: vehicle.vehicle_id,
          license_plate: vehicle.license_plate,
          vehicle_type: vehicle.vehicle_type,
          service_stock_cost: 0,
          service_count: 0,
          service_unique_items: 0,
          service_quantity_used: 0,
          direct_usage_cost: parseFloat(vehicle.total_direct_usage_cost),
          usage_note_count: parseInt(vehicle.usage_note_count),
          direct_unique_items: parseInt(vehicle.unique_items_used),
          do_count_with_deposit: 0,
          total_do_quantity: 0,
          total_do_value: 0,
          total_stock_expenditure: parseFloat(vehicle.total_direct_usage_cost)
        });
      }
    });

    // Add delivery orders with deposits data (count per quantity when deposit exists)
    deliveryOrdersWithDeposits.forEach(vehicle => {
      const existing = vehicleMap.get(vehicle.vehicle_id);
      if (existing) {
        // Add delivery order metrics to existing vehicle data
        existing.do_count_with_deposit = parseInt(vehicle.do_count_with_deposit) || 0;
        existing.total_do_quantity = parseFloat(vehicle.total_do_quantity) || 0;
        existing.total_do_value = parseFloat(vehicle.total_do_value) || 0;
      } else {
        vehicleMap.set(vehicle.vehicle_id, {
          vehicle_id: vehicle.vehicle_id,
          license_plate: vehicle.license_plate,
          vehicle_type: vehicle.vehicle_type,
          service_stock_cost: 0,
          service_count: 0,
          service_unique_items: 0,
          service_quantity_used: 0,
          direct_usage_cost: 0,
          usage_note_count: 0,
          direct_unique_items: 0,
          do_count_with_deposit: parseInt(vehicle.do_count_with_deposit) || 0,
          total_do_quantity: parseFloat(vehicle.total_do_quantity) || 0,
          total_do_value: parseFloat(vehicle.total_do_value) || 0,
          total_stock_expenditure: 0
        });
      }
    });

    const vehicleExpenditureData = Array.from(vehicleMap.values());
    console.log("[VehicleExpenditure] Combined vehicle data:", vehicleExpenditureData);

    // Ensure all vehicles are in the map, even if they have no data
    allVehicles.forEach(vehicle => {
      if (!vehicleMap.has(vehicle.id)) {
        vehicleMap.set(vehicle.id, {
          vehicle_id: vehicle.id,
          license_plate: vehicle.license_plate,
          vehicle_type: vehicle.type,
          service_stock_cost: 0,
          service_count: 0,
          service_unique_items: 0,
          service_quantity_used: 0,
          direct_usage_cost: 0,
          usage_note_count: 0,
          direct_unique_items: 0,
          do_count_with_deposit: 0,
          total_do_quantity: 0,
          total_do_value: 0,
          total_stock_expenditure: 0
        });
      } else {
        // Ensure existing entries have DO fields
        const existing = vehicleMap.get(vehicle.id);
        if (existing.do_count_with_deposit === undefined) {
          existing.do_count_with_deposit = 0;
          existing.total_do_quantity = 0;
          existing.total_do_value = 0;
        }
      }
    });

    // Get the final vehicle data (updated after fallback)
    const finalVehicleData = Array.from(vehicleMap.values());
    console.log("[VehicleExpenditure] Final vehicle data:", finalVehicleData);

    // Calculate summary metrics
    const totalStockExpenditure = finalVehicleData.reduce((sum, v) => sum + v.total_stock_expenditure, 0);
    const totalVehicles = finalVehicleData.length;
    const vehiclesWithStockUsage = finalVehicleData.filter(v => v.total_stock_expenditure > 0).length;

    const responseData = {
      summary: {
        total_stock_expenditure: totalStockExpenditure,
        total_vehicles: totalVehicles,
        vehicles_with_stock_usage: vehiclesWithStockUsage,
        average_expenditure_per_vehicle: totalVehicles > 0 ? totalStockExpenditure / totalVehicles : 0
      },
      vehicles: finalVehicleData,
      timeRange: {
        startDate,
        endDate
      }
    };

    console.log("[VehicleExpenditure] Final response data:", responseData);

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("Error in getVehicleExpenditureAnalytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch vehicle expenditure analytics",
      details: error.message,
    });
  }
};

const getDashboardMetrics = async (req, res) => {
  try {
    const {
      timeRange = "month",
      startDate: customStartDate,
      endDate: customEndDate,
      vehicleId,
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

    const vehicleIdInt = vehicleId ? parseInt(vehicleId, 10) : null;

    console.log(
      `[Analytics] Fetching data for time range: ${startDate} to ${endDate}`
    );
    if (vehicleIdInt) {
      console.log(`[Analytics] Vehicle filter enabled for vehicleId=${vehicleIdInt}`);
    }

    // 1. Metrik Finansial dari Delivery Orders
    const doFinancials = await sequelize.query(
      `
      SELECT 
        COALESCE(SUM(
          CASE WHEN payment_status = 'lunas' THEN 
            COALESCE(
              final_amount,
              (COALESCE(actual_load_quantity, minimal_load_quantity) * COALESCE(unit_price, 0)),
              total_amount,
              0
            )
          ELSE 0 END
        ), 0) as gross_income,
        COALESCE(SUM(trip_allowance), 0) as total_uang_jalan,
        COALESCE(SUM(gaji), 0) as total_gaji_driver
      FROM delivery_orders
      WHERE 
        status = 'completed' AND 
        completed_at BETWEEN :startDate AND :endDate
        AND (:vehicleId IS NULL OR vehicle_id = :vehicleId)
    `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    console.log("[Debug] doFinancials:", doFinancials);

    // 1b. Payments actually received in period (cash-in)
    const paymentsInPeriod = await sequelize.query(
      `
      SELECT COALESCE(SUM(dop.payment_amount), 0) AS total_paid
      FROM delivery_order_payments dop
      JOIN delivery_orders dord ON dord.id = dop.delivery_order_id
      WHERE dop.payment_date BETWEEN :startDate AND :endDate
        AND (:vehicleId IS NULL OR dord.vehicle_id = :vehicleId)
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );

    // 1c. Invoices issued in period by status (for partial vs paid view)
    const invoiceBuckets = await sequelize.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN doi.status = 'paid' THEN doi.net_amount ELSE 0 END), 0) AS inv_paid,
        COALESCE(SUM(CASE WHEN doi.status <> 'paid' THEN doi.net_amount ELSE 0 END), 0) AS inv_unpaid
      FROM delivery_order_invoices doi
      JOIN delivery_orders dord ON dord.id = doi.delivery_order_id
      WHERE doi.invoice_date BETWEEN :startDate AND :endDate
        AND (:vehicleId IS NULL OR dord.vehicle_id = :vehicleId)
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );

    // 2. Biaya Operasional Lainnya
    const otherExpenses = await sequelize.query(
      `
      SELECT 
        (
          SELECT COALESCE(SUM(de.amount), 0)
          FROM driver_expenses de
          JOIN delivery_orders dord ON dord.id = de.delivery_order_id
          WHERE de.created_at BETWEEN :startDate AND :endDate
            AND de.jenis NOT IN ('uang_jalan', 'gaji')
            AND (:vehicleId IS NULL OR dord.vehicle_id = :vehicleId)
        ) as other_driver_expenses,
        (
          SELECT COALESCE(SUM(vs.total_cost), 0)
          FROM vehicle_services vs
          WHERE vs.service_date BETWEEN :startDate AND :endDate
            AND (vs.status IS NULL OR vs.status <> 'cancelled')
            AND (:vehicleId IS NULL OR vs.vehicle_id = :vehicleId)
        ) as total_service_cost,
        (
          SELECT COALESCE(SUM(oe.amount), 0)
          FROM office_expenses oe
          WHERE oe.expense_date BETWEEN :startDate AND :endDate
        ) as total_office_expenses
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
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

    // 3a. Stock Usage Metrics (Stok Skali Lwat)
  const stockUsageMetrics = await sequelize.query(
      `
      SELECT 
        COALESCE(SUM(st.total_amount), 0) as total_stock_usage_cost,
        COALESCE(SUM(CASE WHEN st.reference_type = 'service' THEN st.total_amount ELSE 0 END), 0) as service_stock_usage_cost,
        COALESCE(SUM(CASE WHEN st.reference_type = 'usage_note' THEN st.total_amount ELSE 0 END), 0) as direct_usage_cost,
        COUNT(DISTINCT st.item_id) as unique_items_used,
        COALESCE(SUM(st.quantity), 0) as total_quantity_used,
        COUNT(DISTINCT CASE WHEN st.reference_type = 'service' THEN st.reference_id END) as services_with_stock,
        COUNT(DISTINCT CASE WHEN st.reference_type = 'usage_note' THEN st.reference_id END) as usage_notes_count
      FROM stock_transactions st
      WHERE st.transaction_type = 'out' 
        AND st.transaction_date BETWEEN :startDate AND :endDate
        AND st.reference_type IN ('service', 'usage_note')
        AND NOT EXISTS (
          SELECT 1 FROM vehicle_services vs
          WHERE vs.id = st.reference_id
            AND st.reference_type = 'service'
            AND vs.status = 'cancelled'
        )
        AND (:vehicleId IS NULL OR st.reference_id IN (
          SELECT vs.id FROM vehicle_services vs WHERE vs.vehicle_id = :vehicleId
          UNION
          SELECT sun.id FROM stock_usage_notes sun WHERE sun.vehicle_id = :vehicleId
        ))
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    console.log("[Debug] stockUsageMetrics:", stockUsageMetrics);

    // 3b. Metrik Inventaris BAN
    const tireInventoryMetrics = await sequelize.query(
      `
      SELECT 
        COALESCE(SUM(purchase_price), 0) as total_tire_value
      FROM tire_instances
      WHERE status IN ('in_stock', 'removed')
    `,
      {
        type: QueryTypes.SELECT,
        plain: true,
      }
    );

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

    // 3b. Deposit revenue breakdown within period
    const depositRevenue = await sequelize.query(
      `
      -- Top-ups that occurred in period (cash-in)
      -- Filter by vehicle: only count topups for groups that have at least one delivery order from the filtered vehicle
      SELECT 
        COALESCE(SUM(dgt.amount), 0) AS topup_amount
      FROM deposit_group_topups dgt
      JOIN deposit_groups dg ON dg.id = dgt.group_id
      WHERE dgt.created_at BETWEEN :startDate AND :endDate
        AND (:vehicleId IS NULL OR EXISTS (
          SELECT 1 
          FROM deposit_group_members dgm
          JOIN delivery_orders dord ON dord.id = dgm.delivery_order_id
          WHERE dgm.group_id = dg.id
            AND dord.vehicle_id = :vehicleId
        ))
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );

    const depositSisaPaid = await sequelize.query(
      `
      -- Sisa pembayaran deposit (net invoice after deposit) actually paid in period,
      -- but only count if the invoice is fully paid (status = 'paid')
      -- Filter by vehicle: only count payments for invoices belonging to groups with at least one delivery order from the filtered vehicle
      SELECT 
        COALESCE(SUM(dgp.payment_amount), 0) AS sisa_paid_amount
      FROM deposit_group_payments dgp
      JOIN deposit_group_invoices dgi ON dgi.id = dgp.invoice_id
      JOIN deposit_groups dg ON dg.id = dgi.group_id
      WHERE dgp.payment_date BETWEEN :startDate AND :endDate
        AND dgi.status = 'paid'
        AND (:vehicleId IS NULL OR EXISTS (
          SELECT 1 
          FROM deposit_group_members dgm
          JOIN delivery_orders dord ON dord.id = dgm.delivery_order_id
          WHERE dgm.group_id = dg.id
            AND dord.vehicle_id = :vehicleId
        ))
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
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
        AND (:vehicleId IS NULL OR vehicle_id = :vehicleId)
    `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
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
        AND (:vehicleId IS NULL OR vehicle_id = :vehicleId)
      GROUP BY DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Jakarta')
      ORDER BY date ASC
    `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
      }
    );

    // --- KALKULASI METRIK FINAL ---
    // Prefer actual cash-in; fall back to DO-based calc if no payments at all
    const paidCashIn = parseFloat(paymentsInPeriod.total_paid || 0);
    const depositTopup = parseFloat(depositRevenue.topup_amount || 0);
    const depositSisa = parseFloat(depositSisaPaid.sisa_paid_amount || 0);
    const grossIncomeBase = paidCashIn > 0
      ? paidCashIn
      : parseFloat(doFinancials.gross_income || 0);
    // Include deposit revenue into gross income
    const grossIncome = grossIncomeBase + depositTopup + depositSisa;

    // NEW: Partial vs Paid vs Completed (revenue buckets)
    const buckets = await sequelize.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'lunas' THEN COALESCE(final_amount, (COALESCE(actual_load_quantity, minimal_load_quantity) * COALESCE(unit_price,0)), total_amount, 0) ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'proses_tagihan' THEN COALESCE(final_amount, (COALESCE(actual_load_quantity, minimal_load_quantity) * COALESCE(unit_price,0)), total_amount, 0) ELSE 0 END), 0) AS partial_revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_amount, (COALESCE(actual_load_quantity, minimal_load_quantity) * COALESCE(unit_price,0)), total_amount, 0) ELSE 0 END), 0) AS completed_revenue
      FROM delivery_orders
      WHERE completed_at BETWEEN :startDate AND :endDate
        AND (:vehicleId IS NULL OR vehicle_id = :vehicleId)
      `,
      {
        replacements: { startDate, endDate, vehicleId: vehicleIdInt },
        type: QueryTypes.SELECT,
        plain: true,
      }
    );
    const totalUangJalan = parseFloat(doFinancials.total_uang_jalan || 0);
    const totalGajiDriver = parseFloat(doFinancials.total_gaji_driver || 0);
    const totalOtherDriverExpenses = parseFloat(
      otherExpenses.other_driver_expenses || 0
    );
    const totalServiceCost = parseFloat(otherExpenses.total_service_cost || 0);
    const totalOfficeExpenses = parseFloat(
      otherExpenses.total_office_expenses || 0
    );
    const directStockUsageCost = parseFloat(stockUsageMetrics.direct_usage_cost || 0);

    const totalExpenses =
      totalUangJalan +
      totalGajiDriver +
      totalOtherDriverExpenses +
      totalServiceCost +
      // add direct stock usage (stok sekali lewat) as an explicit operating expense
      directStockUsageCost +
      totalOfficeExpenses;
    const netIncome = grossIncome - totalExpenses;

    // Gabungkan semua metrik untuk respons akhir
    const metrics = {
      grossIncome,
      netIncome,
      totalExpenses,
      revenueBuckets: {
        // Add deposit cash-ins into the paid bucket as well
        paid: paidCashIn + depositTopup + depositSisa,
        partial: parseFloat(invoiceBuckets.inv_unpaid || 0),
        completed: parseFloat(buckets.completed_revenue || 0),
      },
      depositRevenue: {
        topup: parseFloat(depositRevenue.topup_amount || 0),
        sisa_paid: parseFloat(depositSisaPaid.sisa_paid_amount || 0),
      },
      driverExpenses: {
        totalUangJalan,
        totalGajiDriver,
        totalOtherDriverExpenses,
      },
      vehicleExpenses: {
        totalServiceCost,
      },
      // explicit stock usage metrics for dashboard consumption
      stockUsage: {
        totalStockUsageCost: parseFloat(stockUsageMetrics.total_stock_usage_cost || 0),
        serviceStockUsageCost: parseFloat(stockUsageMetrics.service_stock_usage_cost || 0),
        directUsageCost: directStockUsageCost,
      },
      officeExpenses: {
        totalOfficeExpenses,
      },
      inventoryMetrics: {
        totalInventoryValue: parseFloat(
          inventoryMetrics.total_inventory_value || 0
        ) + parseFloat(tireInventoryMetrics.total_tire_value || 0),
        totalPurchases: parseFloat(inventoryMetrics.total_purchases || 0),
        lowStockItems: parseInt(inventoryMetrics.low_stock_items || 0),
        categoryBreakdown: [
          ...categoryBreakdown.map((cat) => ({
            category: cat.category || "Unknown",
            value: parseFloat(cat.value || 0),
            lowStock: parseInt(cat.low_stock || 0),
          })),
          {
            category: "Ban",
            value: parseFloat(tireInventoryMetrics.total_tire_value || 0),
            lowStock: 0, // Placeholder
          },
        ],
      },
      stockUsageMetrics: {
        totalStockUsageCost: parseFloat(stockUsageMetrics.total_stock_usage_cost || 0),
        uniqueItemsUsed: parseInt(stockUsageMetrics.unique_items_used || 0),
        totalQuantityUsed: parseFloat(stockUsageMetrics.total_quantity_used || 0),
        servicesWithStock: parseInt(stockUsageMetrics.services_with_stock || 0),
        usageNotesCount: parseInt(stockUsageMetrics.usage_notes_count || 0),
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

    // Disable caching so filters are always respected
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({
      success: true,
      data: metrics,
      meta: {
        startDate,
        endDate,
        vehicleId: vehicleIdInt,
      },
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
  getVehicleExpenditureAnalytics,
};
