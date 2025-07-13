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
   * GET /api/web/payments/invoices
   * Get all invoices with filtering, pagination, and sorting
   * Query params: status, customer, page, limit, sort, order
   * ──────────────────────────────────────────────────────────── */
  async getInvoices(req, res, next) {
    try {
      const { Op } = require("sequelize");
      const {
        status,
        customer,
        page = 1,
        limit = 20,
        sort = "created_at",
        order = "DESC",
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = {};
      let doWhereClause = {};

      // Filter by invoice status
      if (status && status !== "all") {
        whereClause.status = status;
      }

      // Filter by customer (search in delivery order)
      if (customer) {
        doWhereClause.customer_name = {
          [Op.iLike]: `%${customer}%`,
        };
      }

      const { count, rows } = await DeliveryOrderInvoices.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: DeliveryOrder,
            as: "deliveryOrder",
            where:
              Object.keys(doWhereClause).length > 0 ? doWhereClause : undefined,
            attributes: [
              "id",
              "do_number",
              "customer_name",
              "item_name",
              "final_amount",
            ],
          },
          {
            model: DeliveryOrderPayments,
            as: "payments",
            required: false,
            attributes: [
              "id",
              "payment_amount",
              "payment_date",
              "payment_type",
            ],
          },
        ],
        order: [[sort, order.toUpperCase()]],
        limit: parseInt(limit),
        offset: offset,
      });

      const invoices = rows.map((invoice) => {
        const totalPaid =
          invoice.payments?.reduce(
            (sum, payment) => sum + Number(payment.payment_amount),
            0
          ) || 0;

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          invoice_amount: Number(invoice.invoice_amount),
          pph_percentage: Number(invoice.pph_percentage),
          pph_amount: Number(invoice.pph_amount),
          net_amount: Number(invoice.net_amount),
          status: invoice.status,
          notes: invoice.notes,
          created_at: invoice.created_at,
          delivery_order: invoice.deliveryOrder
            ? {
                id: invoice.deliveryOrder.id,
                do_number: invoice.deliveryOrder.do_number,
                customer_name: invoice.deliveryOrder.customer_name,
                item_name: invoice.deliveryOrder.item_name,
                final_amount: Number(invoice.deliveryOrder.final_amount),
              }
            : null,
          payment_summary: {
            total_paid: totalPaid,
            remaining_amount: Number(invoice.net_amount) - totalPaid,
            payment_count: invoice.payments?.length || 0,
            is_fully_paid: totalPaid >= Number(invoice.net_amount),
            is_overdue:
              invoice.due_date &&
              new Date() > new Date(invoice.due_date) &&
              invoice.status !== "paid",
          },
        };
      });

      return res.json({
        success: true,
        data: {
          invoices,
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

  /* ──────────────────────────────────────────────────────────────
   * PATCH /api/web/payments/invoices/:invoiceId/status
   * Update invoice status (sent, paid, cancelled, etc.)
   * ──────────────────────────────────────────────────────────── */
  async updateInvoiceStatus(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const { status, notes } = req.body;

      const allowedStatuses = [
        "issued",
        "sent",
        "paid",
        "overdue",
        "cancelled",
      ];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${allowedStatuses.join(
            ", "
          )}`,
        });
      }

      const invoice = await DeliveryOrderInvoices.findByPk(invoiceId);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found",
        });
      }

      await invoice.update({
        status,
        notes: notes || invoice.notes,
        updated_at: new Date(),
      });

      return res.json({
        success: true,
        message: "Invoice status updated successfully",
        data: invoice,
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * POST /api/web/payments/bulk-invoices
   * Create bulk invoice for multiple delivery orders
   * Body: { do_ids: [], invoice_number?, pph_percentage?, due_date?, notes? }
   * ──────────────────────────────────────────────────────────── */
  async createBulkInvoice(req, res, next) {
    const transaction = await require("../../models").sequelize.transaction();

    try {
      const { do_ids, invoice_number, pph_percentage, due_date, notes } =
        req.body;

      const userId = req.user?.id;

      // Validation
      if (!do_ids || !Array.isArray(do_ids) || do_ids.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 delivery orders required for bulk invoice",
        });
      }

      if (do_ids.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Maximum 50 delivery orders per bulk invoice",
        });
      }

      // Get delivery orders with validation
      const deliveryOrders = await DeliveryOrder.findAll({
        where: { id: do_ids },
        transaction,
      });

      if (deliveryOrders.length !== do_ids.length) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Some delivery orders not found",
        });
      }

      // Business rule: All DOs must have same customer
      const customers = [
        ...new Set(deliveryOrders.map((do_) => do_.customer_name)),
      ];
      if (customers.length > 1) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Bulk invoice must have same customer. Found: ${customers.join(
            ", "
          )}`,
        });
      }

      // Business rule: All DOs must be ready for billing
      const invalidStatuses = deliveryOrders.filter(
        (do_) =>
          !["proses_tagihan", "awaiting_confirmation"].includes(
            do_.payment_status
          )
      );

      if (invalidStatuses.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Some DOs not ready for billing: ${invalidStatuses
            .map((do_) => do_.do_number)
            .join(", ")}`,
        });
      }

      // Check for existing invoices
      const existingInvoices = await DeliveryOrderInvoices.findAll({
        where: { delivery_order_id: do_ids },
        transaction,
      });

      if (existingInvoices.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Some DOs already have invoices: ${existingInvoices
            .map((inv) => inv.invoice_number)
            .join(", ")}`,
        });
      }

      // Calculate totals
      const totalGrossAmount = deliveryOrders.reduce(
        (sum, do_) => sum + parseFloat(do_.final_amount || do_.ongkosan || 0),
        0
      );

      // Get PPH percentage
      let finalPphPercentage = pph_percentage;
      if (finalPphPercentage === undefined || finalPphPercentage === null) {
        const setting = await SystemSettings.findOne({
          where: { setting_key: "default_pph_percentage" },
          transaction,
        });
        finalPphPercentage = setting ? Number(setting.setting_value) : 0.5;
      }

      const { pph_amount, net_amount } = calcTax(
        totalGrossAmount,
        finalPphPercentage
      );

      // Generate invoice number if not provided
      let finalInvoiceNumber = invoice_number;
      if (!finalInvoiceNumber) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");

        // Find next sequence number for this month
        const lastBulkInvoice = await DeliveryOrderInvoices.findOne({
          where: {
            invoice_number: {
              [require("sequelize").Op.like]: `BULK/${year}/${month}/%`,
            },
          },
          order: [["created_at", "DESC"]],
          transaction,
        });

        let sequence = 1;
        if (lastBulkInvoice) {
          const match = lastBulkInvoice.invoice_number.match(
            /BULK\/\d{4}\/\d{2}\/(\d+)/
          );
          if (match) {
            sequence = parseInt(match[1]) + 1;
          }
        }

        finalInvoiceNumber = `BULK/${year}/${month}/${String(sequence).padStart(
          3,
          "0"
        )}`;
      }

      // Create individual invoices for each DO
      const createdInvoices = [];
      for (const do_ of deliveryOrders) {
        const doGrossAmount = parseFloat(do_.final_amount || do_.ongkosan || 0);
        const doShare = doGrossAmount / totalGrossAmount; // Proportional share
        const doPphAmount = toMoney(pph_amount * doShare);
        const doNetAmount = toMoney(doGrossAmount - doPphAmount);

        const invoice = await DeliveryOrderInvoices.create(
          {
            delivery_order_id: do_.id,
            invoice_number: `${finalInvoiceNumber}-DO${do_.id}`, // Unique per DO
            invoice_date: new Date(),
            invoice_amount: doGrossAmount,
            due_date:
              due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            pph_percentage: finalPphPercentage,
            pph_amount: doPphAmount,
            net_amount: doNetAmount,
            notes:
              notes ||
              `Bulk invoice for ${customers[0]} - ${do_ids.length} deliveries`,
            created_by: userId,
          },
          { transaction }
        );

        createdInvoices.push(invoice);
      }

      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: `Bulk invoice created successfully for ${do_ids.length} delivery orders`,
        data: {
          bulk_invoice_number: finalInvoiceNumber,
          customer_name: customers[0],
          total_dos: do_ids.length,
          total_gross_amount: totalGrossAmount,
          total_pph_amount: pph_amount,
          total_net_amount: net_amount,
          pph_percentage: finalPphPercentage,
          invoices: createdInvoices,
          delivery_orders: deliveryOrders.map((do_) => ({
            id: do_.id,
            do_number: do_.do_number,
            amount: parseFloat(do_.final_amount || do_.ongkosan || 0),
          })),
        },
      });
    } catch (err) {
      await transaction.rollback();
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * GET /api/web/payments/delivery-orders/:doId/invoices/:invoiceId
   * Fetches detailed invoice data including linked DO and payments
   * ──────────────────────────────────────────────────────────── */
  async getInvoiceDetail(req, res, next) {
    try {
      const { doId, invoiceId } = req.params;

      // Fetch the invoice, ensuring it belongs to the specified DO
      const invoice = await DeliveryOrderInvoices.findOne({
        where: {
          id: invoiceId,
          delivery_order_id: doId, // Security: prevent fetching unrelated invoices
        },
        include: [
          {
            model: DeliveryOrder,
            as: "deliveryOrder", // Assuming alias in your model associations
            attributes: [
              "id",
              "do_number",
              "customer_name",
              "item_name",
              "load_location",
              "unload_location",
              "vehicle_id", // If you have vehicle/driver associations, populate them below
              "driver_id",
              "final_amount",
            ],
            include: [
              // If you have Vehicle and Driver models associated, add them here
              // Example:
              // { model: Vehicle, as: "vehicle", attributes: ["license_plate", "type"] },
              // { model: Driver, as: "driver", attributes: ["username", "full_name"] },
            ],
          },
          {
            model: DeliveryOrderPayments,
            as: "payments", // Assuming association: DeliveryOrderInvoices.hasMany(DeliveryOrderPayments)
            attributes: [
              "id",
              "payment_amount",
              "payment_date",
              "payment_type",
              "payment_reference",
              "notes",
              "attachment_url", // If you have attachments
            ],
            order: [["payment_date", "DESC"]], // Newest payments first
          },
        ],
      });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found or doesn't belong to this Delivery Order",
        });
      }

      // Calculate some derived fields for your frontend (e.g., overdue status, totals)
      const totalPaid = invoice.payments.reduce(
        (sum, p) => sum + Number(p.payment_amount),
        0
      );
      const remaining = Number(invoice.net_amount) - totalPaid;
      const isOverdue =
        invoice.due_date &&
        new Date() > new Date(invoice.due_date) &&
        invoice.status !== "paid";

      // Shape response to match your frontend's InvoiceDetailData interface
      const responseData = {
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_amount: Number(invoice.invoice_amount),
          net_amount: Number(invoice.net_amount),
          pph_amount: Number(invoice.pph_amount),
          pph_percentage: Number(invoice.pph_percentage),
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          status: invoice.status,
          notes: invoice.notes,
          created_at: invoice.created_at,
          updated_at: invoice.updated_at,
        },
        delivery_order: invoice.deliveryOrder
          ? {
              id: invoice.deliveryOrder.id,
              do_number: invoice.deliveryOrder.do_number,
              customer_name: invoice.deliveryOrder.customer_name,
              item_name: invoice.deliveryOrder.item_name,
              load_location: invoice.deliveryOrder.load_location,
              unload_location: invoice.deliveryOrder.unload_location,
              // Vehicle and driver if populated
              vehicle: invoice.deliveryOrder.vehicle
                ? {
                    license_plate: invoice.deliveryOrder.vehicle.license_plate,
                    type: invoice.deliveryOrder.vehicle.type,
                  }
                : null,
              driver: invoice.deliveryOrder.driver
                ? {
                    username: invoice.deliveryOrder.driver.username,
                    driverProfile: {
                      full_name: invoice.deliveryOrder.driver.full_name,
                    },
                  }
                : null,
            }
          : null,
        payments: invoice.payments.map((p) => ({
          id: p.id,
          payment_amount: Number(p.payment_amount),
          payment_date: p.payment_date,
          payment_type: p.payment_type,
          payment_reference: p.payment_reference || null,
          notes: p.notes || null,
        })),
        // Bonus summary for your frontend to use directly
        summary: {
          total_paid: totalPaid,
          remaining_amount: remaining,
          is_fully_paid: totalPaid >= Number(invoice.net_amount),
          is_overdue: isOverdue,
        },
      };

      return res.json({
        success: true,
        data: responseData,
      });
    } catch (err) {
      console.error("Invoice detail fetch error:", err); // Log it, you slacker
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * GET /api/web/payments/delivery-orders/bulk-eligible
   * Get delivery orders eligible for bulk invoicing
   * Query params: customer?, po_id?, limit?
   * ──────────────────────────────────────────────────────────── */
  async getBulkEligibleDOs(req, res, next) {
    try {
      const { Op } = require("sequelize");
      const { customer, po_id, limit = 100 } = req.query;

      let whereClause = {
        status: "completed",

        payment_status: {
          [Op.in]: ["proses_tagihan", "awaiting_confirmation"],
        },

        // ✅ FIXED: Pastikan ada actual quantity
        actual_load_quantity: {
          [Op.not]: null,
        },

        // ✅ FIXED: Pastikan ada completed timestamp
        completed_at: {
          [Op.not]: null,
        },
      };

      // Filter by customer
      if (customer) {
        whereClause.customer_name = {
          [Op.iLike]: `%${customer}%`,
        };
      }

      // Filter by PO
      if (po_id) {
        whereClause.purchase_order_id = po_id;
      }

      const deliveryOrders = await DeliveryOrder.findAll({
        where: whereClause,
        include: [
          {
            model: DeliveryOrderInvoices,
            as: "invoices",
            required: false,
          },
        ],
        order: [
          ["customer_name", "ASC"],
          ["created_at", "DESC"],
        ],
        limit: parseInt(limit),
      });

      // Filter out DOs that already have invoices
      const eligibleDOs = deliveryOrders.filter(
        (do_) => !do_.invoices || do_.invoices.length === 0
      );

      // Group by customer for easy selection
      const groupedByCustomer = eligibleDOs.reduce((acc, do_) => {
        const customer = do_.customer_name;
        if (!acc[customer]) {
          acc[customer] = [];
        }
        acc[customer].push({
          id: do_.id,
          do_number: do_.do_number,
          customer_name: do_.customer_name,
          item_name: do_.item_name,
          amount: parseFloat(do_.final_amount || do_.ongkosan || 0),
          payment_status: do_.payment_status,
          created_at: do_.created_at,
        });
        return acc;
      }, {});

      return res.json({
        success: true,
        data: {
          eligible_dos: eligibleDOs.map((do_) => ({
            id: do_.id,
            do_number: do_.do_number,
            customer_name: do_.customer_name,
            item_name: do_.item_name,
            amount: parseFloat(do_.final_amount || do_.ongkosan || 0),
            payment_status: do_.payment_status,
            created_at: do_.created_at,
          })),
          grouped_by_customer: groupedByCustomer,
          total_eligible: eligibleDOs.length,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  /* ──────────────────────────────────────────────────────────────
   * GET /api/web/payments/invoices/export
   * Export invoices to Excel/CSV
   * ──────────────────────────────────────────────────────────── */
  async exportInvoices(req, res, next) {
    try {
      const { format = "excel", ...filters } = req.query;

      // Get all invoices without pagination for export
      const invoices = await DeliveryOrderInvoices.findAll({
        include: [
          {
            model: DeliveryOrder,
            as: "deliveryOrder",
            attributes: ["do_number", "customer_name", "item_name"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      const exportData = invoices.map((invoice) => ({
        "Invoice Number": invoice.invoice_number,
        "DO Number": invoice.deliveryOrder?.do_number || "N/A",
        Customer: invoice.deliveryOrder?.customer_name || "N/A",
        Item: invoice.deliveryOrder?.item_name || "N/A",
        "Invoice Date": invoice.invoice_date,
        "Due Date": invoice.due_date,
        "Gross Amount": Number(invoice.invoice_amount),
        "PPH %": Number(invoice.pph_percentage),
        "PPH Amount": Number(invoice.pph_amount),
        "Net Amount": Number(invoice.net_amount),
        Status: invoice.status,
        Notes: invoice.notes || "",
      }));

      if (format === "csv") {
        // Simple CSV implementation
        const csv = [
          Object.keys(exportData[0]).join(","),
          ...exportData.map((row) => Object.values(row).join(",")),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=invoices.csv"
        );
        return res.send(csv);
      }

      // For Excel, return JSON data for frontend to handle with a library
      return res.json({
        success: true,
        data: exportData,
        filename: `invoices_${new Date().toISOString().split("T")[0]}.xlsx`,
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
