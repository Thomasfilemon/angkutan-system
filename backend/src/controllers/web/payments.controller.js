/* eslint-disable camelcase */
const {
  DeliveryOrder,
  Vehicle,
  DriverProfile,
  User,
  DeliveryOrderInvoices,
  DeliveryOrderPayments,
  DeliveryOrderPaymentHistory,
  SystemSettings,
  DepositGroup,
  DepositGroupMember,
  DepositGroupInvoice,
  DepositGroupPayment,
  sequelize,
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
        status: "issued",
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

      if (invoice.status === "paid") {
        return res.status(403).json({
          success: false,
          message: "Cannot update a paid invoice. It's locked, dummy.",
        });
      }

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

      const invoice = await DeliveryOrderInvoices.findByPk(invoiceId);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found",
        });
      }

      if (invoice.status !== "issued") {
        return res.status(403).json({
          success: false,
          message: "Can only change status from 'issued'.",
        });
      }
      if (!["sent", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "From 'issued', can only set to 'sent' or 'cancelled'.",
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
            status: "issued",
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
              "minimal_load_quantity", // ✅ ADDED: Quantity fields
              "actual_load_quantity", // ✅ ADDED
              "unit", // ✅ ADDED: Unit for quantity
              "unit_price", // ✅ ADDED: Unit price
              "load_location",
              "unload_location",
              "vehicle_id", // If you have vehicle/driver associations, populate them below
              "driver_id",
              "final_amount",
            ],
            include: [
              // ✅ FIXED: Populate vehicle and driver associations
              {
                model: Vehicle, // Assuming Vehicle model exists and is associated
                as: "vehicle",
                attributes: ["license_plate", "type"],
              },
              {
                model: User, // Assuming User is the Driver model
                as: "driver",
                attributes: ["username"],
                include: [
                  {
                    model: DriverProfile, // Assuming DriverProfile association
                    as: "driverProfile",
                    attributes: ["full_name"],
                  },
                ],
              },
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
              "attachment_urls", // If you have attachments
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
              minimal_load_quantity: Number(
                invoice.deliveryOrder.minimal_load_quantity
              ), // ✅ ADDED
              actual_load_quantity: Number(
                invoice.deliveryOrder.actual_load_quantity
              ), // ✅ ADDED
              unit: invoice.deliveryOrder.unit, // ✅ ADDED
              unit_price: Number(invoice.deliveryOrder.unit_price), // ✅ ADDED
              load_location: invoice.deliveryOrder.load_location,
              unload_location: invoice.deliveryOrder.unload_location,
              // ✅ FIXED: Vehicle and driver populated
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
                      full_name:
                        invoice.deliveryOrder.driver.driverProfile?.full_name ||
                        "N/A",
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

  async getInvoiceById(req, res, next) {
    try {
      const { invoiceId } = req.params;

      // Fetch the invoice with payments (same as before)
      const invoice = await DeliveryOrderInvoices.findByPk(invoiceId, {
        include: [
          {
            model: DeliveryOrderPayments,
            as: "payments",
            attributes: [
              "id",
              "payment_amount",
              "payment_date",
              "payment_type",
              "payment_reference",
              "notes",
              "attachment_urls",
            ],
            order: [["payment_date", "DESC"]],
          },
        ],
      });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: "Invoice not found. Check if it exists, you donut.",
        });
      }

      // Fetch ALL related DeliveryOrders with proper join on invoices association
      const deliveryOrders = await DeliveryOrder.findAll({
        where: {}, // No direct where; filter via include
        include: [
          {
            model: DeliveryOrderInvoices, // Your invoice model
            as: "invoices", // Assuming this alias in your associations
            where: { id: invoiceId }, // Filter to this specific invoice
            required: true, // Inner join to ensure only matching DOs
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
        ],
        attributes: [
          "id",
          "do_number",
          "customer_name",
          "item_name",
          "minimal_load_quantity",
          "actual_load_quantity",
          "unit",
          "unit_price",
          "load_location",
          "unload_location",
          "vehicle_id",
          "driver_id",
          "final_amount",
        ],
      });

      // Derived calcs (unchanged)
      const totalPaid = (invoice.payments || []).reduce(
        (sum, p) => sum + Number(p.payment_amount),
        0
      );
      const remaining = Number(invoice.net_amount) - totalPaid;
      const isOverdue =
        invoice.due_date &&
        new Date() > new Date(invoice.due_date) &&
        invoice.status !== "paid";

      // Response shaping: delivery_orders as array
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
        delivery_orders: deliveryOrders.map((do_) => ({
          id: do_.id,
          do_number: do_.do_number,
          customer_name: do_.customer_name,
          item_name: do_.item_name,
          minimal_load_quantity: Number(do_.minimal_load_quantity),
          actual_load_quantity: Number(do_.actual_load_quantity),
          unit: do_.unit,
          unit_price: Number(do_.unit_price),
          load_location: do_.load_location,
          unload_location: do_.unload_location,
          vehicle: do_.vehicle
            ? {
                license_plate: do_.vehicle.license_plate,
                type: do_.vehicle.type,
              }
            : null,
          driver: do_.driver
            ? {
                username: do_.driver.username,
                driverProfile: {
                  full_name: do_.driver.driverProfile?.full_name || "N/A",
                },
              }
            : null,
        })),
        payments: (invoice.payments || []).map((p) => ({
          id: p.id,
          payment_amount: Number(p.payment_amount),
          payment_date: p.payment_date,
          payment_type: p.payment_type,
          payment_reference: p.payment_reference || null,
          notes: p.notes || null,
        })),
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
      console.error("Generic invoice fetch error:", err);
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
   *         payment_date?, bank_account?, notes?, attachment_urls? }
   * ──────────────────────────────────────────────────────────── */
  async recordPayment(req, res, next) {
    const transaction = await sequelize.transaction();
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
        attachment_urls,
      } = req.body;

      // Validate payment_type
      if (
        !payment_type ||
        !["cash", "transfer", "check", "giro"].includes(payment_type)
      ) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Invalid payment_type value" });
      }

      // Check if the DO is part of a deposit group first.
      const isDepositMember = await DepositGroupMember.findOne({
        where: { delivery_order_id: doId },
        transaction,
      });

      if (isDepositMember) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "This DO is managed by a deposit group and cannot be paid manually. Payment is handled upon completion.",
        });
      }

      // Fetch the DeliveryOrder inside the transaction
      const doRecord = await DeliveryOrder.findByPk(doId, { transaction });
      if (!doRecord) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Delivery Order not found" });
      }

      // Check payment status inside the transaction
      if (doRecord.payment_status === "lunas") {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "DO already paid" });
      }

      // Validate payment_amount
      const amount = toMoney(payment_amount);
      if (amount <= 0) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "payment_amount must be > 0" });
      }

      const userId = req.user?.id;

      let targetInvoice = null;
      if (invoice_id) {
        targetInvoice = await DeliveryOrderInvoices.findOne({
          where: { id: invoice_id, delivery_order_id: doId },
          transaction,
        });
        if (!targetInvoice) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "Selected invoice doesn't belong to this DO.",
          });
        }
      }

      // Handle multiple file uploads
      let final_attachment_urls = [];
      if (req.files && req.files.length > 0) {
        final_attachment_urls = req.files.map(
          (file) => `uploads/payments/${file.filename}`
        );
      } else if (attachment_urls) {
        final_attachment_urls = Array.isArray(attachment_urls)
          ? attachment_urls
          : JSON.parse(attachment_urls || "[]");
      }

      // Create payment record
      const payment = await DeliveryOrderPayments.create(
        {
          delivery_order_id: doId,
          invoice_id: invoice_id || null,
          payment_reference,
          payment_type,
          payment_amount: amount,
          payment_date: payment_date || new Date(),
          received_by: userId,
          bank_account,
          notes,
          attachment_urls: final_attachment_urls,
          created_by: userId,
        },
        { transaction }
      );

      // Auto-check and set 'paid' for related invoice(s)
      let invoicesToCheck = [];
      if (targetInvoice) {
        invoicesToCheck = [targetInvoice];
      } else {
        invoicesToCheck = await DeliveryOrderInvoices.findAll({
          where: { delivery_order_id: doId, status: { [Op.ne]: "paid" } },
          transaction,
        });
      }

      for (const invoice of invoicesToCheck) {
        const totalPaid = await DeliveryOrderPayments.sum("payment_amount", {
          where: {
            delivery_order_id: doId,
            ...(invoice_id ? { invoice_id: invoice.id } : {}),
          },
          transaction,
        });

        // Optional: Prevent overpayment
        if (totalPaid > Number(invoice.net_amount)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "Payment would exceed invoice net amount.",
          });
        }

        if (
          totalPaid >= Number(invoice.net_amount) &&
          invoice.status !== "paid"
        ) {
          await invoice.update({ status: "paid" }, { transaction });
        }
      }

      await transaction.commit();

      return res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        data: payment,
      });
    } catch (err) {
      // Ensure rollback on any error
      await transaction.rollback();
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

      // Block confirmation for DOs managed by a deposit group
      const dgMember = await require("../../models").DepositGroupMember.findOne({
        where: { delivery_order_id: doId },
      });
      if (dgMember) {
        return res.status(400).json({
          success: false,
          message:
            "This Delivery Order is managed by a deposit group and cannot be confirmed for billing.",
        });
      }

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

      // Total outstanding (proses_tagihan + awaiting_confirmation) for DOs
      const outstandingQuery = await DeliveryOrder.sum("final_amount", {
        where: {
          payment_status: {
            [Op.in]: ["proses_tagihan", "awaiting_confirmation"],
          },
          final_amount: { [Op.not]: null },
        },
      });

      // Total paid (lunas) for DOs
      const paidQuery = await DeliveryOrderPayments.sum("payment_amount");

      // ───── Deposit Group additions
      // Sum of deposit-group payments (all time)
      const dgPaid = await DepositGroupPayment.sum("payment_amount");

      // Outstanding for deposit-group invoices (issued/sent)
      const [dgNetIssuedResult] = await sequelize.query(
        `SELECT COALESCE(SUM(net_amount),0) AS total FROM deposit_group_invoices WHERE status IN ('issued','sent')`
      );
      const dgNetIssued = Number(dgNetIssuedResult?.total || 0);
      const [dgTotalPaidResult] = await sequelize.query(
        `SELECT COALESCE(SUM(payment_amount),0) AS total FROM deposit_group_payments`
      );
      const dgTotalPaidAll = Number(dgTotalPaidResult?.total || 0);
      const dgOutstanding = Math.max(0, dgNetIssued - dgTotalPaidAll);

      // Pending invoices count (DO invoices only)
      const pendingInvoices = await DeliveryOrderInvoices.count({
        where: {
          status: { [Op.in]: ["issued", "sent"] },
        },
      });

      // Pending deposit-group invoices count
      const [dgPendingCountResult] = await sequelize.query(
        `SELECT COUNT(*)::int AS count FROM deposit_group_invoices WHERE status IN ('issued','sent')`
      );
      const dgPendingInvoices = Number(dgPendingCountResult?.count || 0);

      // ✅ ADD: Pending deliveries count (NEW)
      const pendingDeliveries = await DeliveryOrder.count({
        where: {
          payment_status: {
            [Op.in]: ["proses_tagihan", "awaiting_confirmation"],
          },
        },
      });

      // Overdue invoices (past due_date and not paid) for DOs
      const overdueInvoices = await DeliveryOrderInvoices.count({
        where: {
          due_date: { [Op.lt]: new Date() },
          status: { [Op.ne]: "paid" },
        },
      });

      // Overdue deposit-group invoices
      const [dgOverdueResult] = await sequelize.query(
        `SELECT COUNT(*)::int AS count FROM deposit_group_invoices WHERE due_date < NOW() AND status <> 'paid'`
      );
      const dgOverdueInvoices = Number(dgOverdueResult?.count || 0);

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
        totalOutstanding: (outstandingQuery || 0) + dgOutstanding,
        totalPaid: (paidQuery || 0) + (dgPaid || 0),
        pendingInvoices: (pendingInvoices || 0) + dgPendingInvoices,
        pendingDeliveries: pendingDeliveries || 0,
        overdueInvoices: (overdueInvoices || 0) + dgOverdueInvoices,
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
          {
            model: DepositGroupMember,
            as: "groupMemberships",
            required: false,
            attributes: ["id", "group_id"],
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
        is_deposit_member: Array.isArray(do_.groupMemberships) && do_.groupMemberships.length > 0,
        deposit_group_id:
          Array.isArray(do_.groupMemberships) && do_.groupMemberships.length > 0
            ? do_.groupMemberships[0].group_id
            : null,
        invoices: (do_.invoices || []).map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          net_amount: Number(inv.net_amount),
          status: inv.status,
        })),
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

  // ──────────────────────────────────────────────────────────────
  // GET /api/web/payments/deposit-groups/invoices
  // List deposit-group invoices
  // ────────────────────────────────────────────────────────────
  async getDepositGroupInvoices(req, res, next) {
    try {
      const { status, page = 1, limit = 20, order = 'DESC' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const where = {};
      if (status && status !== 'all') where.status = status;

      const { count, rows } = await DepositGroupInvoice.findAndCountAll({
        where,
        include: [
          { 
            model: DepositGroup, 
            as: 'depositGroup', 
            attributes: ['id', 'group_name'],
            include: [{ model: require('../../models').DepositGroupTopup, as: 'topups', attributes: ['id','amount','description','created_at'], required: false }]
          },
          { model: DepositGroupPayment, as: 'payments', required: false },
        ],
        order: [['created_at', order.toUpperCase()]],
        limit: parseInt(limit),
        offset,
      });

      const invoices = rows.map((inv) => {
        const totalPaid = (inv.payments || []).reduce((s, p) => s + parseFloat(p.payment_amount || 0), 0);
        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          group: inv.depositGroup ? { id: inv.depositGroup.id, name: inv.depositGroup.group_name } : null,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          gross_amount: Number(inv.gross_amount),
          deposit_deducted: Number(inv.deposit_deducted),
          net_amount: Number(inv.net_amount),
          status: inv.status,
          notes: inv.notes,
          total_paid: totalPaid,
          remaining_amount: Number(inv.net_amount) - totalPaid,
          topups: inv.depositGroup && inv.depositGroup.topups ? inv.depositGroup.topups.map(t => ({ id: t.id, amount: Number(t.amount), description: t.description, created_at: t.created_at })) : [],
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

  // GET /api/web/payments/deposit-groups/invoices/:invoiceId
  async getDepositGroupInvoiceById(req, res, next) {
    try {
      const { invoiceId } = req.params;
      const invoice = await DepositGroupInvoice.findByPk(invoiceId, {
        include: [
          {
            model: DepositGroup,
            as: 'depositGroup',
            attributes: ['id', 'group_name'],
            include: [
              { model: require('../../models').DepositGroupTopup, as: 'topups', attributes: ['id','amount','description','created_at'], required: false }
            ]
          },
          { model: DepositGroupPayment, as: 'payments', required: false },
        ],
      });
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Deposit group invoice not found' });
      }
      const totalPaid = (invoice.payments || []).reduce((s, p) => s + Number(p.payment_amount || 0), 0);
      return res.json({
        success: true,
        data: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          gross_amount: Number(invoice.gross_amount),
          deposit_deducted: Number(invoice.deposit_deducted),
          net_amount: Number(invoice.net_amount),
          status: invoice.status,
          notes: invoice.notes,
          group: invoice.depositGroup ? { id: invoice.depositGroup.id, name: invoice.depositGroup.group_name } : null,
          topups: invoice.depositGroup && invoice.depositGroup.topups ? invoice.depositGroup.topups.map(t => ({ id: t.id, amount: Number(t.amount), description: t.description, created_at: t.created_at })) : [],
          payments: (invoice.payments || []).map(p => ({ id: p.id, amount: Number(p.payment_amount), date: p.payment_date, method: p.method, reference_number: p.reference_number, notes: p.notes })),
          total_paid: totalPaid,
          remaining_amount: Number(invoice.net_amount) - totalPaid,
        }
      });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/web/payments/deposit-groups/invoices/:invoiceId/payments
  async recordDepositGroupPayment(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { invoiceId } = req.params;
      const { payment_amount, payment_date, method, reference_number, notes } = req.body;
      const amount = Number.parseFloat(payment_amount);
      if (isNaN(amount) || amount <= 0) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Invalid payment_amount' });
      }

      const invoice = await DepositGroupInvoice.findByPk(invoiceId, { include: [{ model: DepositGroupPayment, as: 'payments' }], transaction });
      if (!invoice) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }

      // Prevent overpay
      const totalPaid = (invoice.payments || []).reduce((s, p) => s + parseFloat(p.payment_amount || 0), 0);
      if (totalPaid + amount > Number(invoice.net_amount) + 0.01) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Payment would exceed invoice net amount' });
      }

      const payment = await DepositGroupPayment.create(
        {
          invoice_id: invoice.id,
          payment_amount: amount,
          payment_date: payment_date || new Date(),
          method,
          reference_number,
          notes,
          created_by: req.user?.id,
        },
        { transaction }
      );

      // Mark invoice paid if fully settled
      const newTotalPaid = totalPaid + amount;
      if (newTotalPaid + 0.01 >= Number(invoice.net_amount) && invoice.status !== 'paid') {
        await invoice.update({ status: 'paid', updated_at: new Date() }, { transaction });
      }

      await transaction.commit();
      return res.status(201).json({ success: true, data: payment });
    } catch (err) {
      await transaction.rollback();
      return next(err);
    }
  },
};
