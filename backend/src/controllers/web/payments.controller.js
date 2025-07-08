/* eslint-disable camelcase */
const {
  DeliveryOrder,
  DeliveryOrderInvoices,
  DeliveryOrderPayments,
  DeliveryOrderPaymentHistory,
  SystemSettings,
} = require("../../models");

/**
 * Utility – safe numeric conversion + 2-decimal rounding
 */
const toMoney = (val) => Number.parseFloat(val || 0).toFixed(2) * 1;

/**
 * Calculate PPH & net amount in one place
 * @param {number} gross  – invoice_amount before tax
 * @param {number} pct    – PPH percentage (0-100)
 */
const calcTax = (gross, pct) => {
  const pph_amount = toMoney((gross * pct) / 100);
  const net_amount = toMoney(gross - pph_amount);
  return { pph_amount, net_amount };
};

module.exports = {
  /* ──────────────────────────────────────────────────────────────
   * POST /api/web/payments/delivery-orders/:doId/invoices
   * Body: { invoice_number, invoice_amount, due_date?, pph_percentage?, notes? }
   * ──────────────────────────────────────────────────────────── */
  async createInvoice(req, res, next) {
    try {
      const { doId } = req.params;
      const {
        invoice_number,
        invoice_amount,
        due_date,
        pph_percentage,
        notes,
      } = req.body;

      const userId = req.user?.id;

      //-- Validate mandatory payload
      if (!invoice_number || !invoice_amount)
        return res.status(400).json({
          success: false,
          message: "invoice_number & invoice_amount are required",
        });

      //-- Default PPH % from system settings
      let pct = pph_percentage;
      if (pct === undefined || pct === null) {
        const setting = await SystemSettings.findOne({
          where: { setting_key: "default_pph_percentage" },
        });
        pct = setting ? Number(setting.setting_value) : 0.5;
      }

      const gross = toMoney(invoice_amount);
      const { pph_amount, net_amount } = calcTax(gross, pct);

      const invoice = await DeliveryOrderInvoices.create({
        delivery_order_id: doId,
        invoice_number,
        invoice_date: new Date(),
        invoice_amount: gross,
        due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
        pph_percentage: pct,
        pph_amount,
        net_amount,
        notes,
        created_by: userId,
      });

      return res.status(201).json({
        success: true,
        message: "Invoice created successfully",
        data: invoice,
      });
    } catch (err) {
      /* Unique invoice_number guard */
      if (err.name === "SequelizeUniqueConstraintError") {
        return res
          .status(400)
          .json({ success: false, message: "Invoice number already exists" });
      }
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * PUT /api/web/payments/invoices/:invoiceId
   * Body can include invoice_amount, due_date, pph_percentage, notes, status
   * ──────────────────────────────────────────────────────────── */
  async updateInvoice(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const payload = req.body;

      const invoice = await DeliveryOrderInvoices.findByPk(invoiceId);
      if (!invoice)
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });

      /* Recalculate when either amount or pct changes */
      if (
        payload.invoice_amount !== undefined ||
        payload.pph_percentage !== undefined
      ) {
        const gross =
          payload.invoice_amount !== undefined
            ? toMoney(payload.invoice_amount)
            : Number(invoice.invoice_amount);

        const pct =
          payload.pph_percentage !== undefined
            ? Number(payload.pph_percentage)
            : Number(invoice.pph_percentage);

        if (pct < 0 || pct > 100)
          return res
            .status(400)
            .json({ success: false, message: "pph_percentage must be 0-100" });

        const { pph_amount, net_amount } = calcTax(gross, pct);

        Object.assign(payload, {
          invoice_amount: gross,
          pph_amount,
          net_amount,
          pph_percentage: pct,
        });
      }

      await invoice.update(payload);

      return res.json({
        success: true,
        message: "Invoice updated successfully",
        data: invoice,
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * POST /api/web/payments/delivery-orders/:doId
   * Body: { invoice_id?, payment_reference?, payment_type, payment_amount,
   *         payment_date?, bank_account?, notes?, attachment_url? }
   * ──────────────────────────────────────────────────────────── */
  async recordPayment(req, res, next) {
    try {
      const { doId } = req.params;
      const {
        invoice_id,
        payment_reference,
        payment_type,
        payment_amount,
        payment_date,
        bank_account,
        notes,
        attachment_url,
      } = req.body;

      if (
        !payment_type ||
        !["cash", "transfer", "check", "giro"].includes(payment_type)
      )
        return res
          .status(400)
          .json({ success: false, message: "Invalid payment_type value" });

      const amount = toMoney(payment_amount);
      if (amount <= 0)
        return res
          .status(400)
          .json({ success: false, message: "payment_amount must be > 0" });

      const userId = req.user?.id;

      const payment = await DeliveryOrderPayments.create({
        delivery_order_id: doId,
        invoice_id: invoice_id || null,
        payment_reference,
        payment_type,
        payment_amount: amount,
        payment_date: payment_date || new Date(),
        received_by: userId,
        bank_account,
        notes,
        attachment_url,
        created_by: userId,
      });

      /* DB trigger updates payment_status automatically */
      return res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        data: payment,
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * PATCH /api/web/payments/status
   * Body: { delivery_order_id, payment_status, notes? }
   * ──────────────────────────────────────────────────────────── */
  async updatePaymentStatus(req, res, next) {
    try {
      const { delivery_order_id, payment_status, notes } = req.body;

      const allowed = [
        "lunas",
        "deposit",
        "proses_tagihan",
        "awaiting_confirmation",
      ];
      if (!allowed.includes(payment_status))
        return res
          .status(400)
          .json({ success: false, message: "Invalid payment_status value" });

      const doRecord = await DeliveryOrder.findByPk(delivery_order_id);
      if (!doRecord)
        return res
          .status(404)
          .json({ success: false, message: "Delivery Order not found" });

      const oldStatus = doRecord.payment_status;

      await doRecord.update({
        payment_status,
        payment_notes: notes,
      });

      await DeliveryOrderPaymentHistory.create({
        delivery_order_id,
        old_status: oldStatus,
        new_status: payment_status,
        change_reason:
          notes || `Manual update from ${oldStatus} to ${payment_status}`,
        changed_by: req.user?.id,
        changed_at: new Date(),
      });

      return res.json({
        success: true,
        message: "Payment status updated successfully",
        data: {
          delivery_order_id,
          old_status: oldStatus,
          new_status: payment_status,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * PATCH /api/web/payments/delivery-orders/:doId/confirm
   * Body: { final_amount?, notes? }
   * ──────────────────────────────────────────────────────────── */
  async confirmDeliveryOrder(req, res, next) {
    try {
      const { doId } = req.params;
      const { final_amount, notes } = req.body;

      const doRecord = await DeliveryOrder.findByPk(doId);
      if (!doRecord)
        return res
          .status(404)
          .json({ success: false, message: "Delivery Order not found" });

      if (doRecord.status !== "completed")
        return res.status(400).json({
          success: false,
          message: "Only completed DO can be confirmed",
        });

      await doRecord.update({
        payment_confirmation_status: "confirmed",
        payment_status: "proses_tagihan",
        final_amount: final_amount || doRecord.ongkosan,
        payment_notes: notes,
        payment_confirmed_by: req.user?.id,
        payment_confirmation_at: new Date(),
      });

      return res.json({
        success: true,
        message: "Delivery Order confirmed for payment processing",
        data: {
          do_id: doRecord.id,
          final_amount: doRecord.final_amount,
          payment_status: doRecord.payment_status,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * GET /api/web/payments/overview
   * Get payment dashboard statistics
   * ──────────────────────────────────────────────────────────── */
  async getOverviewStats(req, res, next) {
    try {
      const { Op } = require("sequelize");
      const { sequelize } = require("../../models");

      // Total outstanding (proses_tagihan + awaiting_confirmation)
      const outstandingQuery = await DeliveryOrder.sum("final_amount", {
        where: {
          payment_status: {
            [Op.in]: ["proses_tagihan", "awaiting_confirmation"],
          },
          final_amount: { [Op.not]: null },
        },
      });

      // Total paid (lunas)
      const paidQuery = await DeliveryOrderPayments.sum("payment_amount");

      // Pending invoices count
      const pendingInvoices = await DeliveryOrderInvoices.count({
        where: {
          status: { [Op.in]: ["issued", "sent"] },
        },
      });

      // ✅ ADD: Pending deliveries count (NEW)
      const pendingDeliveries = await DeliveryOrder.count({
        where: {
          payment_status: {
            [Op.in]: ["proses_tagihan", "awaiting_confirmation"],
          },
        },
      });

      // Overdue invoices (past due_date and not paid)
      const overdueInvoices = await DeliveryOrderInvoices.count({
        where: {
          due_date: { [Op.lt]: new Date() },
          status: { [Op.ne]: "paid" },
        },
      });

      // Recent payments (last 10)
      const recentPayments = await DeliveryOrderPayments.findAll({
        limit: 10,
        order: [["payment_date", "DESC"]],
        include: [
          {
            model: DeliveryOrder,
            as: "deliveryOrder",
            attributes: ["do_number", "customer_name"],
          },
        ],
      });

      const stats = {
        totalOutstanding: outstandingQuery || 0,
        totalPaid: paidQuery || 0,
        pendingInvoices: pendingInvoices || 0,
        pendingDeliveries: pendingDeliveries || 0,
        overdueInvoices: overdueInvoices || 0,
        recentPayments: recentPayments.map((payment) => ({
          id: payment.id,
          do_number: payment.deliveryOrder?.do_number || "N/A",
          payment_amount: Number(payment.payment_amount),
          payment_date: payment.payment_date,
          customer_name: payment.deliveryOrder?.customer_name || "Unknown",
        })),
      };

      return res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * GET /api/web/payments/delivery-orders
   * Get delivery orders for payment processing
   * Query params: status, customer, page, limit
   * ──────────────────────────────────────────────────────────── */
  async getDeliveryOrders(req, res, next) {
    try {
      const { Op } = require("sequelize");
      const { status = "pending", customer, page = 1, limit = 20 } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = {};

      // Filter by payment status
      if (status === "pending") {
        whereClause.payment_status = {
          [Op.in]: ["proses_tagihan", "awaiting_confirmation"],
        };
      } else if (status !== "all") {
        whereClause.payment_status = status;
      }

      // Filter by customer
      if (customer) {
        whereClause.customer_name = {
          [Op.iLike]: `%${customer}%`,
        };
      }

      const { count, rows } = await DeliveryOrder.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: DeliveryOrderInvoices,
            as: "invoices",
            required: false,
          },
          {
            model: DeliveryOrderPayments,
            as: "payments",
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: offset,
      });

      const deliveryOrders = rows.map((do_) => ({
        id: do_.id,
        do_number: do_.do_number,
        customer_name: do_.customer_name,
        item_name: do_.item_name,
        final_amount: Number(do_.final_amount || do_.ongkosan || 0),
        payment_status: do_.payment_status,
        status: do_.status,
        completed_at: do_.completed_at,
        created_at: do_.created_at,
        invoice_count: do_.invoices?.length || 0,
        payment_count: do_.payments?.length || 0,
        total_paid:
          do_.payments?.reduce((sum, p) => sum + Number(p.payment_amount), 0) ||
          0,
      }));

      return res.json({
        success: true,
        data: {
          delivery_orders: deliveryOrders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / parseInt(limit)),
          },
        },
      });
    } catch (err) {
      return next(err);
    }
  },
};
