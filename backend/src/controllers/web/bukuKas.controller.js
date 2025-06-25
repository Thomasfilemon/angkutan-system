// src/controllers/web/bukuKas.controller.js
const {
  DeliveryOrder,
  OfficeExpense,
  PaymentTransaction,
  Vehicle,
  User,
} = require("../../models");
const { Op } = require("sequelize");

// Get buku kas dashboard
exports.getBukuKasDashboard = async (req, res, next) => {
  try {
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
      if (period === "month") {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { created_at: { [Op.gte]: monthAgo } };
      }
    }

    // Calculate cash inflow (from payments)
    const [customerPayments, driverCosts, operationalExpenses, tripStatistics] =
      await Promise.all([
        // Customer payments (cash in)
        PaymentTransaction.sum("amount", {
          where: {
            payment_date: {
              [Op.between]: [
                start_date ||
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                end_date || new Date(),
              ],
            },
          },
        }) || 0,

        // Driver costs (cash out)
        DeliveryOrder.findAll({
          where: dateFilter,
          attributes: [
            [
              sequelize.fn("SUM", sequelize.col("trip_allowance")),
              "total_trip_allowance",
            ],
            [sequelize.fn("SUM", sequelize.col("gaji")), "total_gaji"],
          ],
          raw: true,
        }),

        // Operational expenses (cash out)
        OfficeExpense.sum("amount", {
          where: {
            expense_date: {
              [Op.between]: [
                start_date ||
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                end_date || new Date(),
              ],
            },
          },
        }) || 0,

        // Trip statistics
        DeliveryOrder.findAll({
          where: dateFilter,
          attributes: [
            [sequelize.fn("COUNT", sequelize.col("id")), "total_trips"],
            [sequelize.fn("SUM", sequelize.col("ongkosan")), "total_revenue"],
          ],
          raw: true,
        }),
      ]);

    const totalDriverCosts =
      (parseFloat(driverCosts[0]?.total_trip_allowance) || 0) +
      (parseFloat(driverCosts[0]?.total_gaji) || 0);

    // Calculate cash flow
    const cashFlow = {
      cash_in: {
        customer_payments: customerPayments,
        total: customerPayments,
      },
      cash_out: {
        driver_costs: totalDriverCosts,
        operational_expenses: operationalExpenses,
        total: totalDriverCosts + operationalExpenses,
      },
      net_cash_flow:
        customerPayments - (totalDriverCosts + operationalExpenses),
    };

    // Get recent transactions for activity feed
    const recentTransactions = await PaymentTransaction.findAll({
      limit: 10,
      order: [["payment_date", "DESC"]],
      include: [
        {
          model: DeliveryOrder,
          as: "deliveryOrder",
          attributes: ["do_number", "customer_name"],
          required: false,
        },
      ],
    });

    // Get outstanding payments
    const outstandingPayments = await DeliveryOrder.findAll({
      where: {
        payment_status: ["proses_tagihan", "deposit"],
        status: "completed",
      },
      attributes: [
        "id",
        "do_number",
        "customer_name",
        "ongkosan",
        "payment_status",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    res.json({
      success: true,
      data: {
        cash_flow: cashFlow,
        trip_statistics: {
          total_trips: parseInt(tripStatistics[0]?.total_trips) || 0,
          total_revenue: parseFloat(tripStatistics[0]?.total_revenue) || 0,
        },
        recent_transactions: recentTransactions,
        outstanding_payments: outstandingPayments,
        period,
        date_range: { start_date, end_date },
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get detailed cash flow analysis
exports.getCashFlowAnalysis = async (req, res, next) => {
  try {
    const { period = "month" } = req.query;

    // Get monthly cash flow for the last 12 months
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const [payments, expenses, driverCosts] = await Promise.all([
        PaymentTransaction.sum("amount", {
          where: {
            payment_date: {
              [Op.between]: [startOfMonth, endOfMonth],
            },
          },
        }) || 0,

        OfficeExpense.sum("amount", {
          where: {
            expense_date: {
              [Op.between]: [startOfMonth, endOfMonth],
            },
          },
        }) || 0,

        DeliveryOrder.findAll({
          where: {
            created_at: {
              [Op.between]: [startOfMonth, endOfMonth],
            },
          },
          attributes: [
            [
              sequelize.fn("SUM", sequelize.col("trip_allowance")),
              "trip_allowance",
            ],
            [sequelize.fn("SUM", sequelize.col("gaji")), "gaji"],
          ],
          raw: true,
        }),
      ]);

      const totalDriverCosts =
        (parseFloat(driverCosts[0]?.trip_allowance) || 0) +
        (parseFloat(driverCosts[0]?.gaji) || 0);

      monthlyData.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        cash_in: payments,
        cash_out: expenses + totalDriverCosts,
        net_flow: payments - (expenses + totalDriverCosts),
      });
    }

    res.json({
      success: true,
      data: {
        monthly_cash_flow: monthlyData,
        summary: {
          total_cash_in: monthlyData.reduce(
            (sum, month) => sum + month.cash_in,
            0
          ),
          total_cash_out: monthlyData.reduce(
            (sum, month) => sum + month.cash_out,
            0
          ),
          net_flow: monthlyData.reduce((sum, month) => sum + month.net_flow, 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// Add company expense
exports.addCompanyExpense = async (req, res, next) => {
  try {
    const {
      kategori,
      description,
      amount,
      expense_date,
      vehicle_id,
      receipt_url,
    } = req.body;

    const expense = await OfficeExpense.create({
      kategori,
      description,
      amount,
      expense_date: expense_date || new Date(),
      vehicle_id, // Optional, for vehicle-specific expenses
      receipt_url,
    });

    res.status(201).json({
      success: true,
      message: "Company expense added successfully",
      data: expense,
    });
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      const messages = err.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    next(err);
  }
};

// Record payment transaction
exports.recordPaymentTransaction = async (req, res, next) => {
  try {
    const {
      do_id,
      payment_type,
      amount,
      payment_date,
      invoice_number,
      pph_amount,
    } = req.body;

    // Validate DO exists
    const deliveryOrder = await DeliveryOrder.findByPk(do_id);
    if (!deliveryOrder) {
      return res.status(404).json({
        success: false,
        message: "Delivery Order not found",
      });
    }

    // Create payment transaction
    const transaction = await PaymentTransaction.create({
      do_id,
      payment_type,
      amount,
      payment_date: payment_date || new Date(),
      invoice_number,
      pph_amount: pph_amount || 0,
    });

    // Update DO payment status if fully paid
    const totalPaid = await PaymentTransaction.sum("amount", {
      where: { do_id },
    });

    const orderTotal = parseFloat(deliveryOrder.ongkosan) || 0;
    if (totalPaid >= orderTotal) {
      await deliveryOrder.update({ payment_status: "lunas" });
    } else if (totalPaid > 0) {
      await deliveryOrder.update({ payment_status: "deposit" });
    }

    res.status(201).json({
      success: true,
      message: "Payment transaction recorded successfully",
      data: {
        transaction,
        updated_payment_status: totalPaid >= orderTotal ? "lunas" : "deposit",
      },
    });
  } catch (err) {
    next(err);
  }
};
