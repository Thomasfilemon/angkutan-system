// src/controllers/web/ritase.controller.js
const {
  DeliveryOrder,
  PurchaseOrder,
  Vehicle,
  User,
  DriverProfile,
  DeliveryOrderPayments,
  DeliveryOrderInvoices,
  DeliveryOrderAdjustments,
  SystemSettings,
  DeliveryOrderPaymentHistory,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const { sequelize } = require('../../models');

// ✅ 1. Get PO List with Aggregated Payment Status (Main Ritase Dashboard)
exports.getPurchaseOrdersWithPaymentStatus = async (req, res, next) => {
  try {
    const {
      period = "month",
      start_date,
      end_date,
      payment_status,
    } = req.query;

    console.log("=== Starting getPurchaseOrdersWithPaymentStatus ===");

    // Build date filter
    let dateFilter = {};
    if (start_date && end_date) {
      dateFilter = {
        created_at: {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        },
      };
    } else {
      const now = new Date();
      if (period === "month") {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { created_at: { [Op.gte]: monthAgo } };
      } else if (period === "year") {
        const yearAgo = new Date(now.getFullYear(), 0, 1);
        dateFilter = { created_at: { [Op.gte]: yearAgo } };
      }
    }

    // Get all POs with their DOs
    const purchaseOrders = await PurchaseOrder.findAll({
      where: dateFilter,
      include: [
        {
          model: DeliveryOrder,
          as: "poDeliveryOrders",
          required: false, // LEFT JOIN to include POs without DOs
          include: [
            {
              model: Vehicle,
              as: "vehicle",
              attributes: ["license_plate", "type"],
              required: false,
            },
            {
              model: User,
              as: "driver",
              attributes: ["username"],
              required: false,
              include: [
                {
                  model: DriverProfile,
                  as: "driverProfile",
                  attributes: ["full_name"],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    console.log(`Found ${purchaseOrders.length} purchase orders`);

    // ✅ ENHANCED CALCULATION with proper financial logic
    // ✅ ENHANCED CALCULATION with ACTUAL PAYMENTS from delivery_order_payments table
    const enrichedPOs = await Promise.all(
      purchaseOrders.map(async (po) => {
        const deliveryOrders = po.poDeliveryOrders || [];
        const completedDOs = deliveryOrders.filter(
          (do_item) => do_item.status === "completed"
        );

        console.log(
          `Processing PO ${po.po_number} with ${completedDOs.length} completed DOs`
        );

        // ✅ QUANTITY PROGRESS (unchanged)
        const totalQuantity = parseFloat(po.total_quantity) || 0;
        const deliveredQuantity = completedDOs.reduce((sum, do_item) => {
          const quantity = do_item.actual_load_quantity
            ? parseFloat(do_item.actual_load_quantity)
            : parseFloat(do_item.minimal_load_quantity) || 0;
          return sum + quantity;
        }, 0);

        const remainingQuantity = Math.max(
          totalQuantity - deliveredQuantity,
          0
        );
        const deliveryPercentage =
          totalQuantity > 0 ? (deliveredQuantity / totalQuantity) * 100 : 0;

        // ✅ FIXED: PROPER FINANCIAL CALCULATION with ACTUAL PAYMENTS
        let totalCalculatedAmount = 0;
        let totalActualPaidAmount = 0;
        let totalPaymentVariance = 0;

        const enrichedDOs = await Promise.all(
          completedDOs.map(async (do_item) => {
            // ✅ Calculate CORRECT billable amount
            const actualQuantity =
              parseFloat(do_item.actual_load_quantity) ||
              parseFloat(do_item.minimal_load_quantity) ||
              0;
            const unitPrice = parseFloat(po.unit_price) || 0;
            const calculatedBillableAmount = actualQuantity * unitPrice;

            // ✅ FIXED: Get ACTUAL payment amount from delivery_order_payments table
            const actualPaidAmount =
              (await DeliveryOrderPayments.sum("payment_amount", {
                where: { delivery_order_id: do_item.id },
              })) || 0;

            // Calculate payment variance
            const paymentVariance = actualPaidAmount - calculatedBillableAmount;

            // Add to totals
            totalCalculatedAmount += calculatedBillableAmount;
            totalActualPaidAmount += actualPaidAmount;
            totalPaymentVariance += paymentVariance;

            console.log(`✅ DO ${do_item.do_number}:`, {
              actualQuantity,
              unitPrice,
              calculatedBillableAmount,
              actualPaidAmount, // This should now be 6,114,600
              paymentVariance,
              ongkosan_field: parseFloat(do_item.ongkosan), // For comparison
            });

            return {
              ...do_item.toJSON(),
              calculated_billable_amount: calculatedBillableAmount || "",
              actual_paid_amount: actualPaidAmount || "", // ✅ Now from payments table
              payment_variance: paymentVariance || "",
              is_overpaid: paymentVariance > 0,
              is_underpaid: paymentVariance < 0,
              payment_status_calculated:
                actualPaidAmount >= calculatedBillableAmount
                  ? "lunas"
                  : actualPaidAmount > 0
                  ? "deposit"
                  : "proses_tagihan",
            };
          })
        );

        // ✅ PAYMENT SUMMARY with CORRECT logic (unchanged logic, but correct data)
        let aggregatedStatus = "no_completed_do";

        if (completedDOs.length > 0) {
          const fullyPaidCount = enrichedDOs.filter(
            (do_item) =>
              do_item.actual_paid_amount >= do_item.calculated_billable_amount
          ).length;
          const partialPaidCount = enrichedDOs.filter(
            (do_item) =>
              do_item.actual_paid_amount > 0 &&
              do_item.actual_paid_amount < do_item.calculated_billable_amount
          ).length;

          if (fullyPaidCount === completedDOs.length) {
            aggregatedStatus = "lunas";
          } else if (partialPaidCount > 0 || fullyPaidCount > 0) {
            aggregatedStatus = "deposit";
          } else {
            aggregatedStatus = "proses_tagihan";
          }
        }

        const effectivePaidAmount = Math.min(
          totalActualPaidAmount,
          totalCalculatedAmount
        );
        const paymentPercentage =
          totalCalculatedAmount > 0
            ? (effectivePaidAmount / totalCalculatedAmount) * 100
            : 0;

        const paymentSummary = {
          total_dos: deliveryOrders.length,
          completed_dos: completedDOs.length,
          aggregated_status: aggregatedStatus,
          total_amount: totalCalculatedAmount,
          paid_amount: totalActualPaidAmount,
          remaining_amount: Math.max(
            totalCalculatedAmount - totalActualPaidAmount,
            0
          ),
          payment_variance: totalPaymentVariance,
          payment_percentage: paymentPercentage,
          lunas_count: enrichedDOs.filter(
            (do_item) => do_item.payment_status_calculated === "lunas"
          ).length,
          deposit_count: enrichedDOs.filter(
            (do_item) => do_item.payment_status_calculated === "deposit"
          ).length,
          awaiting_count: completedDOs.filter(
            (do_item) => do_item.payment_status === "awaiting_confirmation"
          ).length,
          proses_count: enrichedDOs.filter(
            (do_item) => do_item.payment_status_calculated === "proses_tagihan"
          ).length,
        };

        console.log(`✅ PO ${po.po_number} Summary:`, {
          totalCalculatedAmount,
          totalActualPaidAmount, // Should now be 6,114,600
          totalPaymentVariance, // Should now be negative (underpaid)
          paymentPercentage: paymentPercentage.toFixed(2),
          aggregatedStatus,
        });

        return {
          ...po.toJSON(),
          payment_summary: paymentSummary || "",
          quantity_progress: {
            total_quantity: totalQuantity || "",
            delivered_quantity: deliveredQuantity || "",
            remaining_quantity: remainingQuantity || "",
            delivery_percentage: deliveryPercentage || "",
          },
          enriched_dos: enrichedDOs || "",
        };
      })
    );

    // Filter by payment status (unchanged)
    let filteredPOs = enrichedPOs;
    if (payment_status && payment_status !== "all") {
      filteredPOs = enrichedPOs.filter(
        (po) => po.payment_summary.aggregated_status === payment_status
      );
    }

    // ✅ DASHBOARD STATISTICS with corrected totals
    const dashboardStats = {
      total_pos: enrichedPOs.length,
      lunas_pos: enrichedPOs.filter(
        (po) => po.payment_summary.aggregated_status === "lunas"
      ).length,
      deposit_pos: enrichedPOs.filter(
        (po) => po.payment_summary.aggregated_status === "deposit"
      ).length,
      awaiting_pos: enrichedPOs.filter(
        (po) => po.payment_summary.aggregated_status === "awaiting_confirmation"
      ).length,
      proses_pos: enrichedPOs.filter(
        (po) => po.payment_summary.aggregated_status === "proses_tagihan"
      ).length,
      total_revenue: enrichedPOs.reduce(
        (sum, po) => sum + po.payment_summary.total_amount,
        0
      ),
      total_paid: enrichedPOs.reduce(
        (sum, po) => sum + po.payment_summary.paid_amount, // ✅ Now from actual payments
        0
      ),
      total_remaining: enrichedPOs.reduce(
        (sum, po) => sum + po.payment_summary.remaining_amount,
        0
      ),
      total_variance: enrichedPOs.reduce(
        (sum, po) => sum + po.payment_summary.payment_variance,
        0
      ),
    };

    console.log("✅ Dashboard Stats:", dashboardStats);

    res.json({
      success: true,
      data: {
        purchase_orders: filteredPOs,
        dashboard_stats: dashboardStats,
        period,
        date_range: { start_date, end_date },
        filters: { payment_status },
      },
    });
  } catch (err) {
    console.error("=== ERROR in getPurchaseOrdersWithPaymentStatus ===");
    console.error("Error details:", err);
    next(err);
  }
};

// ✅ 2. Get PO Detail with Payment Summary and DO List
exports.getPurchaseOrderPaymentDetail = async (req, res, next) => {
  try {
    const { po_id } = req.params;

    // Get PO with all related DOs
    const purchaseOrder = await PurchaseOrder.findByPk(po_id, {
      include: [
        {
          model: DeliveryOrder,
          as: "poDeliveryOrders",
          include: [
            {
              model: Vehicle,
              as: "vehicle",
              attributes: ["id", "license_plate", "type"],
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
              required: false,
            },
            {
              model: DeliveryOrderInvoices,
              as: "invoices",
              required: false,
            },
            {
              model: DeliveryOrderAdjustments,
              as: "adjustments",
              required: false,
            },
          ],
        },
      ],
    });

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Separate completed and non-completed DOs
    const completedDOs = purchaseOrder.poDeliveryOrders.filter(
      (do_item) => do_item.status === "completed"
    );
    const nonCompletedDOs = purchaseOrder.poDeliveryOrders.filter(
      (do_item) => do_item.status !== "completed"
    );

    // Calculate PO financial summary
    const poFinancialSummary = {
      total_quantity: parseFloat(purchaseOrder.total_quantity),
      delivered_quantity: completedDOs.reduce(
        (sum, do_item) =>
          sum +
          (parseFloat(do_item.actual_load_quantity) ||
            parseFloat(do_item.minimal_load_quantity)),
        0
      ),
      remaining_quantity:
        parseFloat(purchaseOrder.total_quantity) -
        completedDOs.reduce(
          (sum, do_item) =>
            sum +
            (parseFloat(do_item.actual_load_quantity) ||
              parseFloat(do_item.minimal_load_quantity)),
          0
        ),

      total_contract_value: parseFloat(purchaseOrder.total_amount) || 0,
      total_billable_amount: completedDOs.reduce((sum, do_item) => {
        // 1. Ambil quantity (kg)
        let quantityKg = 0;
        if (do_item.actual_load_quantity) {
          quantityKg = parseFloat(do_item.actual_load_quantity);
        } else if (do_item.minimal_load_quantity) {
          quantityKg = parseFloat(do_item.minimal_load_quantity);
        }

        // 2. Ambil unit price dari PO
        const unitPrice = parseFloat(purchaseOrder.unit_price) || 0;

        // 3. Hitung billable dasar
        let billable = unitPrice * quantityKg;

        // 4. Tambahkan pajak jika ada (misal dari invoices atau field lain)
        let tax = 0;
        if (do_item.invoices && do_item.invoices.length > 0) {
          tax = do_item.invoices.reduce(
            (taxSum, inv) =>
              taxSum +
              (parseFloat(inv.ppn_amount) || 0) +
              (parseFloat(inv.pph_amount) || 0),
            0
          );
        }

        // 5. Tambahkan biaya tambahan/adjustment jika ada
        let adjustment = 0;
        if (do_item.adjustments && do_item.adjustments.length > 0) {
          adjustment = do_item.adjustments.reduce(
            (adjSum, adj) => adjSum + (parseFloat(adj.adjustment_amount) || 0),
            0
          );
        }

        // 6. Total billable untuk DO ini
        return sum + billable + tax + adjustment;
      }, 0),
      total_paid_amount: 0, // Will be calculated below
      total_remaining_amount: 0, // Will be calculated below
    };

    // Calculate payment totals
    const totalPaid =
      (await DeliveryOrderPayments.sum("payment_amount", {
        where: {
          delivery_order_id: {
            [Op.in]: completedDOs.map((do_item) => do_item.id),
          },
        },
      })) || 0;

    poFinancialSummary.total_paid_amount = totalPaid;
    poFinancialSummary.total_remaining_amount =
      poFinancialSummary.total_billable_amount - totalPaid;
    poFinancialSummary.payment_percentage =
      poFinancialSummary.total_billable_amount > 0
        ? (totalPaid / poFinancialSummary.total_billable_amount) * 100
        : 0;

    // Enrich DOs with individual payment details
    const enrichedCompletedDOs = await Promise.all(
      completedDOs.map(async (do_item) => {
        const doPayments = await DeliveryOrderPayments.findAll({
          where: { delivery_order_id: do_item.id },
          order: [["payment_date", "DESC"]],
        });

        const doInvoices = await DeliveryOrderInvoices.findAll({
          where: { delivery_order_id: do_item.id },
          order: [["invoice_date", "DESC"]],
        });

        const totalPaid = doPayments.reduce(
          (sum, payment) => sum + parseFloat(payment.payment_amount),
          0
        );
        const totalInvoiced = doInvoices.reduce(
          (sum, invoice) => sum + parseFloat(invoice.net_amount),
          0
        );
        const finalAmount =
          parseFloat(do_item.final_amount) || parseFloat(do_item.ongkosan) || 0;

        return {
          ...do_item.toJSON(),
          payment_details: {
            total_invoiced: totalInvoiced || "",
            total_paid: totalPaid || "",
            remaining_amount: finalAmount - totalPaid || "",
            payment_percentage:
              finalAmount > 0 ? (totalPaid / finalAmount) * 100 : 0 || "",
            payment_count: doPayments.length || "",
            invoice_count: doInvoices.length || "",
            last_payment_date:
              doPayments.length > 0 ? doPayments[0].payment_date : null || "",
          },
          payments: doPayments || "",
          invoices: doInvoices || "",
        };
      })
    );

    res.json({
      success: true,
      data: {
        purchase_order: purchaseOrder,
        financial_summary: poFinancialSummary,
        completed_delivery_orders: enrichedCompletedDOs,
        non_completed_delivery_orders: nonCompletedDOs,
        summary: {
          total_dos: purchaseOrder.poDeliveryOrders.length,
          completed_dos: completedDOs.length,
          payment_ready_dos: completedDOs.filter(
            (do_item) =>
              do_item.payment_confirmation_status === "awaiting_confirmation" ||
              do_item.payment_status !== "lunas"
          ).length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ✅ 3. Get DO Payment Management Detail
// ritase.controller.js
exports.getDeliveryOrderPaymentDetail = async (req, res, next) => {
  try {
    const { do_id } = req.params;

    // Validate do_id
    if (!do_id || isNaN(do_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery order ID",
      });
    }

    const deliveryOrder = await DeliveryOrder.findByPk(do_id, {
      include: [
        {
          model: PurchaseOrder,
          as: "purchaseOrder",
          attributes: ["id", "po_number", "customer_name", "item_name"],
        },
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
        {
          model: DeliveryOrderPayments,
          as: "payments",
          attributes: [
            "id",
            "delivery_order_id",
            "invoice_id",
            "payment_reference",
            "payment_type",
            "payment_amount",
            "payment_date",
            "received_by",
            "bank_account",
            "notes",
            "attachment_urls", // ✅ Ensure this is plural
            "created_by",
            "created_at",
          ],
          order: [["payment_date", "DESC"]],
        },
        {
          model: DeliveryOrderPaymentHistory,
          as: "paymentHistory",
          order: [["changed_at", "DESC"]],
          limit: 1,
        },
        {
          model: DeliveryOrderInvoices,
          as: "invoices",
          order: [["invoice_date", "DESC"]],
        },
        {
          model: DeliveryOrderAdjustments,
          as: "adjustments",
          order: [["created_at", "DESC"]],
        },
      ],
    });

    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    if (deliveryOrder.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Delivery Order must be completed before payment management",
      });
    }

    const payments = deliveryOrder.payments || [];
    const invoices = deliveryOrder.invoices || [];
    const adjustments = deliveryOrder.adjustments || [];
    const latestPaymentStatus =
      deliveryOrder.paymentHistory?.[0]?.new_status ||
      deliveryOrder.payment_status;
    const actualQuantity =
      parseFloat(deliveryOrder.actual_load_quantity) ||
      parseFloat(deliveryOrder.minimal_load_quantity) ||
      0;
    const unitPrice = parseFloat(deliveryOrder.unit_price) || 0;
    const unit = deliveryOrder.unit || "kilogram";

    const calculateUnitAwareAmount = (quantity, unit, unitPrice) => {
      switch (unit) {
        case "kilogram":
          return quantity * unitPrice;
        case "ton":
          return quantity * unitPrice;
        case "kubik":
          return quantity * unitPrice;
        default:
          console.warn(`Unknown unit: ${unit}, defaulting to zero`);
          return 0;
      }
    };

    const correctTotalAmount = calculateUnitAwareAmount(
      actualQuantity,
      unit,
      unitPrice
    );

    const totalAdjustments = adjustments.reduce(
      (sum, adj) => sum + (parseFloat(adj.adjustment_amount) || 0),
      0
    );
    const taxAmount = invoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.pph_amount) || 0),
      0
    );

    const paymentSummary = {
      original_amount: correctTotalAmount,
      final_amount:
        parseFloat(deliveryOrder.final_amount) ||
        parseFloat(deliveryOrder.ongkosan) ||
        correctTotalAmount,
      calculated_bill: correctTotalAmount - taxAmount + totalAdjustments,
      total_invoiced: invoices.reduce(
        (sum, inv) => sum + (parseFloat(inv.net_amount) || 0),
        0
      ),
      total_paid: payments.reduce(
        (sum, pay) => sum + (parseFloat(pay.payment_amount) || 0),
        0
      ),
      total_pph: taxAmount,
      remaining_amount: 0,
      payment_percentage: 0,
      payment_status: latestPaymentStatus,
      confirmation_status: deliveryOrder.payment_confirmation_status,
    };

    paymentSummary.remaining_amount =
      paymentSummary.calculated_bill - paymentSummary.total_paid;

    paymentSummary.payment_percentage =
      paymentSummary.calculated_bill > 0
        ? (paymentSummary.total_paid / paymentSummary.calculated_bill) * 100
        : 0;

    const pphSetting = await SystemSettings.findOne({
      where: { setting_key: "default_pph_percentage" },
    });
    const defaultPphPercentage = pphSetting
      ? parseFloat(pphSetting.setting_value)
      : 0.5;

    res.json({
      success: true,
      data: {
        delivery_order: deliveryOrder,
        payment_summary: paymentSummary,
        payments,
        invoices,
        adjustments,
        system_settings: {
          default_pph_percentage: defaultPphPercentage,
        },
      },
    });
  } catch (err) {
    console.error("Error in getDeliveryOrderPaymentDetail:", {
      message: err.message,
      stack: err.stack,
      do_id: req.params.do_id,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// ✅ 4. Confirm DO for Payment Processing
exports.confirmDeliveryOrderForPayment = async (req, res, next) => {
  try {
    const { do_id } = req.params;
    const { final_amount, notes } = req.body;
    const userId = req.user.id; // From auth middleware

    const deliveryOrder = await DeliveryOrder.findByPk(do_id);
    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    if (deliveryOrder.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot confirm DO that is not completed",
      });
    }

    // Update DO for payment processing
    await deliveryOrder.update({
      payment_confirmation_status: "confirmed",
      payment_status: "proses_tagihan",
      final_amount: final_amount || deliveryOrder.ongkosan,
      payment_notes: notes,
      payment_confirmed_by: userId,
      payment_confirmation_at: new Date(),
    });

    res.json({
      success: true,
      message: "Delivery Order confirmed for payment processing",
      data: {
        do_id: deliveryOrder.id,
        final_amount: deliveryOrder.final_amount,
        payment_status: deliveryOrder.payment_status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ✅ 5. Create Invoice for DO
exports.createDeliveryOrderInvoice = async (req, res, next) => {
  try {
    const { do_id } = req.params;
    const { invoice_number, invoice_amount, due_date, pph_percentage, notes } =
      req.body;
    const userId = req.user.id;

    // Get default PPH if not provided
    let finalPphPercentage = pph_percentage;
    if (!finalPphPercentage) {
      const pphSetting = await SystemSettings.findOne({
        where: { setting_key: "default_pph_percentage" },
      });
      finalPphPercentage = pphSetting
        ? parseFloat(pphSetting.setting_value)
        : 0.5;
    }

    const pphAmount = (parseFloat(invoice_amount) * finalPphPercentage) / 100;
    const netAmount = parseFloat(invoice_amount) - pphAmount;

    const invoice = await DeliveryOrderInvoices.create({
      delivery_order_id: do_id,
      invoice_number,
      invoice_amount: parseFloat(invoice_amount),
      due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      pph_percentage: finalPphPercentage,
      pph_amount: pphAmount,
      net_amount: netAmount,
      notes,
      created_by: userId,
    });

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Invoice number already exists",
      });
    }
    next(err);
  }
};

// ✅ 6. Record Payment for DO
// ✅ 6. Record Payment for DO
exports.recordDeliveryOrderPayment = async (req, res, next) => {
  try {
    const { do_id } = req.params;
    const {
      invoice_id,
      payment_reference,
      payment_type,
      payment_amount,
      payment_date,
      bank_account,
      notes,
      attachment_urls,
    } = req.body;
    const userId = req.user.id;

    // Validate payment_type
    if (
      !payment_type ||
      !["cash", "transfer", "check", "giro"].includes(payment_type)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment_type value" });
    }

    // Validate payment_amount
    const amount = parseFloat(payment_amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "payment_amount must be a positive number",
      });
    }

    // Validate invoice_id if provided
    if (invoice_id) {
      const invoice = await DeliveryOrderInvoices.findOne({
        where: { id: invoice_id, delivery_order_id: do_id },
      });
      if (!invoice) {
        return res.status(400).json({
          success: false,
          message: "Selected invoice doesn't belong to this DO",
        });
      }
    }

    // ✅ UPDATED: Handle multiple file uploads
    let final_attachment_urls = [];
    if (req.files && req.files.length > 0) {
      final_attachment_urls = req.files.map(
        (file) => `uploads/payments/${file.filename}`
      );
    } else if (attachment_urls) {
      // Fallback to attachment_urls from request body (if provided)
      final_attachment_urls = Array.isArray(attachment_urls)
        ? attachment_urls
        : JSON.parse(attachment_urls || "[]");
    }

    // Create payment record
    const payment = await DeliveryOrderPayments.create({
      delivery_order_id: do_id,
      invoice_id: invoice_id || null,
      payment_reference,
      payment_type,
      payment_amount: amount,
      payment_date: payment_date || new Date(),
      received_by: userId,
      bank_account,
      notes,
      attachment_urls: final_attachment_urls, // Store array of URLs
      created_by: userId,
    });

    // The trigger will automatically update DO payment status

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: payment,
    });
  } catch (err) {
    console.error("Error in recordDeliveryOrderPayment:", err);
    next(err);
  }
};

// ✅ 7. Create Price Adjustment (for special cases like accidents)
exports.createPriceAdjustment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { do_id } = req.params;
    const { adjustment_type, adjustment_amount, reason } = req.body;
    const userId = req.user.id;

    const existing = await DeliveryOrderAdjustments.findOne({
      where: { delivery_order_id: do_id },
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Adjustment already exists for this DO. Please edit instead.",
      });
    }

    const deliveryOrder = await DeliveryOrder.findByPk(do_id);
    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    // Prevent adjustment if already billed/confirmed
    if (deliveryOrder.payment_status === "lunas") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Cannot adjust price after lunas",
      });
    }

    const originalAmount =
      parseFloat(deliveryOrder.final_amount) ||
      parseFloat(deliveryOrder.ongkosan) ||
      0;
    const delta = parseFloat(adjustment_amount);
    if (isNaN(delta)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid adjustment_amount - must be numeric",
      });
    }

    // Validate delta sign based on type (flex your schema types)
    if (["penalty", "incident"].includes(adjustment_type) && delta >= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Penalty/incident adjustments must be negative",
      });
    }
    if (["bonus", "uj_tambahan"].includes(adjustment_type) && delta <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Bonus/uj_tambahan adjustments must be positive",
      });
    }

    const finalAmount = originalAmount + delta;

    const adjustment = await DeliveryOrderAdjustments.create(
      {
        delivery_order_id: do_id,
        adjustment_type,
        original_amount: originalAmount,
        adjustment_amount: delta,
        final_amount: finalAmount,
        reason,
        approved_by: userId,
        created_by: userId,
      },
      { transaction }
    );

    // Update DO final_amount
    await deliveryOrder.update({ final_amount: finalAmount }, { transaction });

    // Recalc existing invoices (assumes one per DO; loop if multiple)
    const invoices = await DeliveryOrderInvoices.findAll({
      where: { delivery_order_id: do_id },
    });
    for (const invoice of invoices) {
      await invoice.update({ invoice_amount: finalAmount }, { transaction }); // Triggers trg_recalc_pph
    }

    await transaction.commit();
    res.status(201).json({
      success: true,
      message: "Price adjustment created successfully - amounts recalculated",
      data: { adjustment, old_amount: originalAmount, new_amount: finalAmount },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// Update Price Adjustment
exports.updatePriceAdjustment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { do_id, adjustment_id } = req.params;
    const { adjustment_type, adjustment_amount, reason } = req.body;
    const userId = req.user.id;

    const adjustment = await DeliveryOrderAdjustments.findOne({
      where: { id: adjustment_id, delivery_order_id: do_id },
    });
    if (!adjustment) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Adjustment not found" });
    }

    const deliveryOrder = await DeliveryOrder.findByPk(do_id);
    if (!deliveryOrder) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Delivery Order not found" });
    }

    if (deliveryOrder.payment_status === "lunas") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Cannot adjust price after Lunas",
      });
    }

    const originalAmount =
      parseFloat(deliveryOrder.final_amount) ||
      parseFloat(deliveryOrder.ongkosan) ||
      0; // Use current final as base
    const delta = parseFloat(adjustment_amount);
    if (isNaN(delta)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid adjustment_amount - must be numeric",
      });
    }

    // Same type validation as create...

    const finalAmount = originalAmount + delta;

    await adjustment.update(
      {
        adjustment_type,
        adjustment_amount: delta,
        final_amount: finalAmount,
        reason,
        original_amount: originalAmount,
        approved_by: userId,
      },
      { transaction }
    );

    await deliveryOrder.update({ final_amount: finalAmount }, { transaction });

    // Recalc invoices (same as create)
    const invoices = await DeliveryOrderInvoices.findAll({
      where: { delivery_order_id: do_id },
    });
    for (const invoice of invoices) {
      await invoice.update({ invoice_amount: finalAmount }, { transaction });
    }

    await transaction.commit();
    res.json({
      success: true,
      message: "Adjustment updated successfully - amounts recalculated",
      data: adjustment,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// Delete Price Adjustment
exports.deletePriceAdjustment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { do_id, adjustment_id } = req.params;

    const adjustment = await DeliveryOrderAdjustments.findOne({
      where: { id: adjustment_id, delivery_order_id: do_id },
    });
    if (!adjustment) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Adjustment not found" });
    }

    await adjustment.destroy({ transaction });

    const deliveryOrder = await DeliveryOrder.findByPk(do_id);
    if (deliveryOrder) {
      const resetAmount = deliveryOrder.ongkosan; // Reset to original ongkosan
      await deliveryOrder.update(
        { final_amount: resetAmount },
        { transaction }
      );

      // Recalc invoices to resetAmount
      const invoices = await DeliveryOrderInvoices.findAll({
        where: { delivery_order_id: do_id },
      });
      for (const invoice of invoices) {
        await invoice.update({ invoice_amount: resetAmount }, { transaction });
      }
    }

    await transaction.commit();
    res.json({
      success: true,
      message:
        "Adjustment deleted successfully - amounts reset and recalculated",
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

// ✅ 1. Get ritase dashboard overview (Vehicle-focused)
exports.getRitaseDashboard = async (req, res, next) => {
  try {
    const { period = "month", vehicle_id, start_date, end_date } = req.query;

    // Build date filter
    let dateFilter = {};
    if (start_date && end_date) {
      dateFilter = {
        created_at: {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        },
      };
    } else {
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
    }

    // Build where clause
    let whereClause = { ...dateFilter };
    if (vehicle_id) {
      whereClause.vehicle_id = vehicle_id;
    }

    // Get all delivery orders with comprehensive data
    const deliveryOrders = await DeliveryOrder.findAll({
      where: whereClause,
      include: [
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
              required: false,
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Calculate comprehensive statistics
    const stats = await Promise.all([
      // Total trips
      DeliveryOrder.count({ where: whereClause }),

      // Completed trips
      DeliveryOrder.count({
        where: { ...whereClause, status: "completed" },
      }),

      // Active trips
      DeliveryOrder.count({
        where: {
          ...whereClause,
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
      }),

      // Financial totals
      DeliveryOrder.sum("ongkosan", {
        where: { ...whereClause, payment_status: "lunas" },
      }) || 0,

      DeliveryOrder.sum("ongkosan", {
        where: { ...whereClause, payment_status: "deposit" },
      }) || 0,

      DeliveryOrder.sum("trip_allowance", { where: whereClause }) || 0,
      DeliveryOrder.sum("gaji", { where: whereClause }) || 0,
    ]);

    const [
      totalTrips,
      completedTrips,
      activeTrips,
      lunasAmount,
      depositAmount,
      totalTripAllowance,
      totalGaji,
    ] = stats;

    // Group by vehicle for performance analysis
    const vehiclePerformance = {};
    deliveryOrders.forEach((order) => {
      const vehicleId = order.vehicle_id;
      if (!vehiclePerformance[vehicleId]) {
        vehiclePerformance[vehicleId] = {
          vehicle: order.vehicle,
          trips: 0,
          completed_trips: 0,
          gross_income: 0,
          lunas_income: 0,
          deposit_income: 0,
          trip_allowance: 0,
          gaji: 0,
          net_profit: 0,
          orders: [],
        };
      }

      const vehicle = vehiclePerformance[vehicleId];
      vehicle.trips++;
      vehicle.orders.push(order);

      if (order.status === "completed") {
        vehicle.completed_trips++;
      }

      const ongkosan =
        parseFloat(order.final_amount) || parseFloat(order.ongkosan) || 0;
      const tripAllowance = parseFloat(order.trip_allowance) || 0;
      const gaji = parseFloat(order.gaji) || 0;

      vehicle.gross_income += ongkosan;
      vehicle.trip_allowance += tripAllowance;
      vehicle.gaji += gaji;

      if (order.payment_status === "lunas") {
        vehicle.lunas_income += ongkosan;
      } else if (order.payment_status === "deposit") {
        vehicle.deposit_income += ongkosan;
      }

      vehicle.net_profit =
        vehicle.gross_income - (vehicle.trip_allowance + vehicle.gaji);
    });

    // Convert to array and sort by gross income
    const vehicleArray = Object.values(vehiclePerformance).sort(
      (a, b) => b.gross_income - a.gross_income
    );

    // Calculate payment status summary
    const paymentSummary = {
      lunas: lunasAmount,
      deposit: depositAmount,
      total: lunasAmount + depositAmount,
      percentage_lunas:
        lunasAmount + depositAmount > 0
          ? (lunasAmount / (lunasAmount + depositAmount)) * 100
          : 0,
      percentage_deposit:
        lunasAmount + depositAmount > 0
          ? (depositAmount / (lunasAmount + depositAmount)) * 100
          : 0,
    };

    res.json({
      success: true,
      data: {
        overview: {
          total_trips: totalTrips,
          completed_trips: completedTrips,
          active_trips: activeTrips,
          completion_rate:
            totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0,
          total_vehicles: Object.keys(vehiclePerformance).length,
        },
        financial_summary: {
          gross_income: lunasAmount + depositAmount,
          total_expenses: totalTripAllowance + totalGaji,
          net_profit:
            lunasAmount + depositAmount - (totalTripAllowance + totalGaji),
          payment_summary: paymentSummary,
        },
        vehicle_performance: vehicleArray,
        period: period,
        date_range: { start_date, end_date },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ✅ 2. Get detailed vehicle performance
exports.getVehiclePerformance = async (req, res, next) => {
  try {
    const { vehicle_id } = req.params;
    const { period = "month", start_date, end_date } = req.query;

    // Build date filter
    let dateFilter = {};
    if (start_date && end_date) {
      dateFilter = {
        created_at: {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        },
      };
    } else {
      const now = new Date();
      if (period === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { created_at: { [Op.gte]: weekAgo } };
      } else if (period === "month") {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { created_at: { [Op.gte]: monthAgo } };
      }
    }

    // Get vehicle details
    const vehicle = await Vehicle.findByPk(vehicle_id, {
      include: [
        {
          model: User,
          as: "driver",
          attributes: ["username"],
          include: [
            {
              model: DriverProfile,
              as: "driverProfile",
              attributes: ["full_name", "phone"],
              required: false,
            },
          ],
        },
      ],
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Get all delivery orders for this vehicle
    const deliveryOrders = await DeliveryOrder.findAll({
      where: {
        vehicle_id,
        ...dateFilter,
      },
      include: [
        {
          model: User,
          as: "driver",
          attributes: ["username"],
          include: [
            {
              model: DriverProfile,
              as: "driverProfile",
              attributes: ["full_name"],
              required: false,
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Calculate detailed performance metrics
    const performance = {
      total_trips: deliveryOrders.length,
      completed_trips: deliveryOrders.filter(
        (order) => order.status === "completed"
      ).length,
      gross_income: deliveryOrders.reduce(
        (sum, order) =>
          sum +
          (parseFloat(order.final_amount) || parseFloat(order.ongkosan) || 0),
        0
      ),
      trip_allowance: deliveryOrders.reduce(
        (sum, order) => sum + (parseFloat(order.trip_allowance) || 0),
        0
      ),
      gaji: deliveryOrders.reduce(
        (sum, order) => sum + (parseFloat(order.gaji) || 0),
        0
      ),
      lunas_income: deliveryOrders
        .filter((order) => order.payment_status === "lunas")
        .reduce(
          (sum, order) =>
            sum +
            (parseFloat(order.final_amount) || parseFloat(order.ongkosan) || 0),
          0
        ),
      deposit_income: deliveryOrders
        .filter((order) => order.payment_status === "deposit")
        .reduce(
          (sum, order) =>
            sum +
            (parseFloat(order.final_amount) || parseFloat(order.ongkosan) || 0),
          0
        ),
    };

    performance.net_profit =
      performance.gross_income -
      (performance.trip_allowance + performance.gaji);
    performance.efficiency =
      performance.total_trips > 0
        ? (performance.completed_trips / performance.total_trips) * 100
        : 0;

    // Format orders for response
    const formattedOrders = deliveryOrders.map((order) => ({
      id: order.id,
      do_number: order.do_number,
      customer_name: order.customer_name,
      item_name: order.item_name,
      load_location: order.load_location,
      unload_location: order.unload_location,
      minimal_load_quantity: parseFloat(order.minimal_load_quantity),
      actual_load_quantity: order.actual_load_quantity
        ? parseFloat(order.actual_load_quantity)
        : null,
      ongkosan: parseFloat(order.ongkosan) || 0,
      final_amount:
        parseFloat(order.final_amount) || parseFloat(order.ongkosan) || 0,
      trip_allowance: parseFloat(order.trip_allowance) || 0,
      gaji: parseFloat(order.gaji) || 0,
      payment_status: order.payment_status,
      status: order.status,
      created_at: order.created_at,
      completed_at: order.completed_at,
      driver: order.driver,
    }));

    res.json({
      success: true,
      data: {
        vehicle: {
          id: vehicle.id,
          license_plate: vehicle.license_plate,
          type: vehicle.type,
          capacity: vehicle.capacity,
          assigned_driver: vehicle.driver,
        },
        performance,
        orders: formattedOrders,
        period,
        date_range: { start_date, end_date },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ✅ 3. Update payment status (legacy function for backward compatibility)
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { delivery_order_id, payment_status, notes } = req.body;

    if (
      !["lunas", "deposit", "proses_tagihan", "awaiting_confirmation"].includes(
        payment_status
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const deliveryOrder = await DeliveryOrder.findByPk(delivery_order_id);
    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    const oldStatus = deliveryOrder.payment_status;

    await deliveryOrder.update({
      payment_status,
      payment_notes: notes,
    });

    // Insert payment history for audit trail
    if (DeliveryOrderPaymentHistory) {
      await DeliveryOrderPaymentHistory.create({
        delivery_order_id,
        old_status: oldStatus,
        new_status: payment_status,
        change_reason:
          notes || `Manual update from ${oldStatus} to ${payment_status}`,
        changed_by: req.user?.id,
        changed_at: new Date(),
      });
    }

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: {
        delivery_order_id,
        old_status: oldStatus,
        new_status: payment_status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ✅ 4. Export Excel report (enhanced version)
exports.exportRitaseExcel = async (req, res, next) => {
  try {
    const { period = "month", vehicle_id, start_date, end_date } = req.query;

    // Build date filter
    let dateFilter = {};
    if (start_date && end_date) {
      dateFilter = {
        created_at: {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        },
      };
    } else {
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
    }

    // Build where clause
    let whereClause = { ...dateFilter };
    if (vehicle_id) {
      whereClause.vehicle_id = vehicle_id;
    }

    // Get financial totals
    const [lunasAmount, depositAmount, totalUangJalan, totalGaji] =
      await Promise.all([
        DeliveryOrder.sum("ongkosan", {
          where: { ...whereClause, payment_status: "lunas" },
        }) || 0,

        DeliveryOrder.sum("ongkosan", {
          where: { ...whereClause, payment_status: "deposit" },
        }) || 0,

        DeliveryOrder.sum("trip_allowance", { where: whereClause }) || 0,
        DeliveryOrder.sum("gaji", { where: whereClause }) || 0,
      ]);

    const totalAmount = lunasAmount + depositAmount;

    // Get all delivery orders for detailed sheets
    const deliveryOrders = await DeliveryOrder.findAll({
      where: whereClause,
      include: [
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
              attributes: ["full_name"],
              required: false,
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();

    // Create summary sheet (TOTAL)
    const summarySheet = workbook.addWorksheet("TOTAL");

    summarySheet.columns = [
      { header: "DESCRIPTION", key: "label", width: 20 },
      { header: "AMOUNT", key: "amount", width: 25 },
    ];

    // Add summary data
    summarySheet.addRow({
      label: "LUNAS",
      amount: `Rp ${lunasAmount.toLocaleString("id-ID")}`,
    });
    summarySheet.addRow({
      label: "DEPOSIT",
      amount: `Rp ${depositAmount.toLocaleString("id-ID")}`,
    });
    summarySheet.addRow({
      label: "TOTAL",
      amount: `Rp ${totalAmount.toLocaleString("id-ID")}`,
    });
    summarySheet.addRow({ label: "", amount: "" }); // Empty row
    summarySheet.addRow({
      label: "TOTAL UANG JALAN",
      amount: `Rp ${totalUangJalan.toLocaleString("id-ID")}`,
    });
    summarySheet.addRow({
      label: "TOTAL GAJI",
      amount: `Rp ${totalGaji.toLocaleString("id-ID")}`,
    });

    // Style the summary sheet
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(3).font = { bold: true }; // TOTAL row

    // Create main report sheet
    const mainSheet = workbook.addWorksheet("Laporan Ritase");

    mainSheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "DO Number", key: "do_number", width: 20 },
      { header: "Tanggal", key: "date", width: 12 },
      { header: "Customer", key: "customer", width: 20 },
      { header: "Barang", key: "item", width: 15 },
      { header: "Lokasi Muat", key: "load_location", width: 25 },
      { header: "Lokasi Bongkar", key: "unload_location", width: 25 },
      { header: "Kendaraan", key: "vehicle", width: 15 },
      { header: "Driver", key: "driver", width: 15 },
      { header: "Quantity (Ton)", key: "quantity", width: 12 },
      { header: "Ongkosan", key: "ongkosan", width: 15 },
      { header: "Uang Jalan", key: "uang_jalan", width: 15 },
      { header: "Gaji", key: "gaji", width: 15 },
      { header: "Status Bayar", key: "payment_status", width: 12 },
      { header: "Status Trip", key: "trip_status", width: 15 },
    ];

    // Add data rows
    deliveryOrders.forEach((order, index) => {
      mainSheet.addRow({
        no: index + 1,
        do_number: order.do_number,
        date: new Date(order.created_at).toLocaleDateString("id-ID"),
        customer: order.customer_name,
        item: order.item_name,
        load_location: order.load_location,
        unload_location: order.unload_location,
        vehicle: order.vehicle?.license_plate || "-",
        driver:
          order.driver?.driverProfile?.full_name ||
          order.driver?.username ||
          "-",
        quantity: order.actual_load_quantity || order.minimal_load_quantity,
        ongkosan: `Rp ${(
          parseFloat(order.final_amount) ||
          parseFloat(order.ongkosan) ||
          0
        ).toLocaleString("id-ID")}`,
        uang_jalan: `Rp ${(
          parseFloat(order.trip_allowance) || 0
        ).toLocaleString("id-ID")}`,
        gaji: `Rp ${(parseFloat(order.gaji) || 0).toLocaleString("id-ID")}`,
        payment_status: order.payment_status.toUpperCase(),
        trip_status: order.status,
      });
    });

    // Style the main sheet header
    mainSheet.getRow(1).font = { bold: true };
    mainSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Create vehicle-specific sheets
    const vehicleGroups = {};
    deliveryOrders.forEach((order) => {
      const licensePlate = order.vehicle?.license_plate || "UNKNOWN";
      if (!vehicleGroups[licensePlate]) {
        vehicleGroups[licensePlate] = [];
      }
      vehicleGroups[licensePlate].push(order);
    });

    // Create a sheet for each vehicle
    Object.entries(vehicleGroups).forEach(([licensePlate, orders]) => {
      const vehicleSheet = workbook.addWorksheet(licensePlate);

      // Calculate vehicle totals
      const vehicleGrossIncome = orders.reduce(
        (sum, order) =>
          sum +
          (parseFloat(order.final_amount) || parseFloat(order.ongkosan) || 0),
        0
      );
      const vehicleUangJalan = orders.reduce(
        (sum, order) => sum + (parseFloat(order.trip_allowance) || 0),
        0
      );
      const vehicleGaji = orders.reduce(
        (sum, order) => sum + (parseFloat(order.gaji) || 0),
        0
      );
      const vehicleProfit =
        vehicleGrossIncome - (vehicleUangJalan + vehicleGaji);

      // Add vehicle summary
      vehicleSheet.addRow(["RINGKASAN KENDARAAN", licensePlate]);
      vehicleSheet.addRow([
        "Gross Income",
        `Rp ${vehicleGrossIncome.toLocaleString("id-ID")}`,
      ]);
      vehicleSheet.addRow([
        "Uang Jalan",
        `Rp ${vehicleUangJalan.toLocaleString("id-ID")}`,
      ]);
      vehicleSheet.addRow([
        "Gaji",
        `Rp ${vehicleGaji.toLocaleString("id-ID")}`,
      ]);
      vehicleSheet.addRow([
        "Profit/Loss",
        `Rp ${vehicleProfit.toLocaleString("id-ID")}`,
      ]);
      vehicleSheet.addRow([]); // Empty row

      // Add headers for trip details
      vehicleSheet.addRow([
        "No",
        "DO Number",
        "Tanggal",
        "Customer",
        "Rute",
        "Quantity",
        "Ongkosan",
        "Uang Jalan",
        "Gaji",
        "Status Bayar",
      ]);

      // Add trip data
      orders.forEach((order, index) => {
        vehicleSheet.addRow([
          index + 1,
          order.do_number,
          new Date(order.created_at).toLocaleDateString("id-ID"),
          order.customer_name,
          `${order.load_location} → ${order.unload_location}`,
          order.actual_load_quantity || order.minimal_load_quantity,
          `Rp ${(
            parseFloat(order.final_amount) ||
            parseFloat(order.ongkosan) ||
            0
          ).toLocaleString("id-ID")}`,
          `Rp ${(parseFloat(order.trip_allowance) || 0).toLocaleString(
            "id-ID"
          )}`,
          `Rp ${(parseFloat(order.gaji) || 0).toLocaleString("id-ID")}`,
          order.payment_status.toUpperCase(),
        ]);
      });

      // Style vehicle sheet
      vehicleSheet.getRow(1).font = { bold: true, size: 14 };
      vehicleSheet.getRow(7).font = { bold: true }; // Headers
    });

    // Set response headers for Excel download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=ritase-report-${period}-${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );

    // Write and send the workbook
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

// List all POs (simple, for dropdown)
exports.getPurchaseOrderListSimple = async (req, res, next) => {
  try {
    const pos = await PurchaseOrder.findAll({
      attributes: ["id", "po_number", "customer_name"],
      order: [["created_at", "DESC"]],
    });
    res.json({
      success: true,
      data: pos,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  // Existing exports
  getRitaseDashboard: exports.getRitaseDashboard,
  getVehiclePerformance: exports.getVehiclePerformance,
  updatePaymentStatus: exports.updatePaymentStatus,
  exportRitaseExcel: exports.exportRitaseExcel,

  // New PO-focused exports
  getPurchaseOrdersWithPaymentStatus:
    exports.getPurchaseOrdersWithPaymentStatus,
  getPurchaseOrderPaymentDetail: exports.getPurchaseOrderPaymentDetail,
  getPurchaseOrderListSimple: exports.getPurchaseOrderListSimple,
  getDeliveryOrderPaymentDetail: exports.getDeliveryOrderPaymentDetail,
  confirmDeliveryOrderForPayment: exports.confirmDeliveryOrderForPayment,
  createDeliveryOrderInvoice: exports.createDeliveryOrderInvoice,
  recordDeliveryOrderPayment: exports.recordDeliveryOrderPayment,
  createPriceAdjustment: exports.createPriceAdjustment,
  updatePriceAdjustment: exports.updatePriceAdjustment,
  deletePriceAdjustment: exports.deletePriceAdjustment,
};
