const db = require("../../models");
const {
  CashTransaction,
  CashCategory,
  TempoDetail,
  VehicleService,
  ServiceItem,
  StockTransaction,
  StockBatch,
  StockUsageNote,
  StockUsageNoteItem,
  RecapNoteItem,
  RecapNote,
  sequelize,
} = db;
const { Op } = require("sequelize");

const parseCategoryId = (id) => {
  if (id === "" || id === null || id === undefined) {
    return null;
  }
  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) {
    throw new Error("Invalid category_id");
  }
  return parsed;
};

// Get all cash transactions with summary
exports.getAllCashTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      transaction_type,
      category_id,
      date_from,
      date_to,
      search,
      account,
      supplier,
      item_name,
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = {
      transaction_type: {
        [Op.in]: ["debit", "kredit"],
      },
    };

    if (transaction_type && ["debit", "kredit"].includes(transaction_type)) {
      whereClause.transaction_type = transaction_type;
    }
    if (category_id) {
      whereClause.category_id = parseCategoryId(category_id);
    }
    if (date_from || date_to) {
      whereClause.transaction_date = {};
      if (date_from) whereClause.transaction_date[Op.gte] = date_from;
      if (date_to) whereClause.transaction_date[Op.lte] = date_to;
    }
    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.iLike]: `%${search}%` } },
        { reference_number: { [Op.iLike]: `%${search}%` } },
        { supplier: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (account && account !== "All") {
      whereClause.account = account;
    }
    if (supplier) {
      whereClause.supplier = { [Op.iLike]: `%${supplier}%` };
    }
    if (item_name) {
      const like = { [Op.iLike]: `%${item_name}%` };
      whereClause[Op.or] = [
        ...(whereClause[Op.or] || []),
        { description: like },
        { reference_number: like },
      ];
    }

    const result = await CashTransaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: CashCategory,
          as: "category",
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    // Calculate summary
    const summaryResults = await CashTransaction.findAll({
      where: whereClause,
      attributes: [
        "transaction_type",
        [db.sequelize.fn("SUM", db.sequelize.col("amount")), "total"],
      ],
      group: ["transaction_type"],
      raw: true,
    });

    const totalDebit =
      summaryResults.find((s) => s.transaction_type === "debit")?.total || 0;
    const totalKredit =
      summaryResults.find((s) => s.transaction_type === "kredit")?.total || 0;
    const saldo = parseFloat(totalDebit || 0) - parseFloat(totalKredit || 0);

    console.log("Cash Summary Results:", summaryResults);
    console.log(
      "Total Debit:",
      totalDebit,
      "Total Kredit:",
      totalKredit,
      "Saldo:",
      saldo
    );

    const allFilteredTransactions = await CashTransaction.findAll({
      where: whereClause,
      order: [["created_at", "ASC"]],
      attributes: ["id", "transaction_type", "amount", "created_at"],
    });

    const balanceLookup = {};
    let runningBalance = 0;

    allFilteredTransactions.forEach((transaction) => {
      const amount = parseFloat(transaction.amount) || 0;
      if (transaction.transaction_type === "debit") {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      balanceLookup[transaction.id] = runningBalance;
    });

    const enhancedTransactions = result.rows.map((transaction) => {
      const transactionData = transaction.toJSON();
      return {
        ...transactionData,
        running_balance: balanceLookup[transaction.id] || 0,
        no_nota: transactionData.no_nota || [],
        date_nota: transactionData.date_nota || [],
      };
    });

    // Pagination with summary-row awareness
    const baseTotal = result.count;
    const totalWithSummary = baseTotal + 1; // include grand total row
    const requestedPage = parseInt(page);
    const pageLimit = parseInt(limit);
    const totalPagesWithSummary = Math.ceil(totalWithSummary / pageLimit) || 1;
    const isLastPage = requestedPage >= totalPagesWithSummary;

    // Append a synthetic summary row ONLY on the last page
    const responseRows = [...enhancedTransactions];
    if (isLastPage) {
      responseRows.push({
        id: -1,
        is_summary: true,
        description: "Grand Total",
        transaction_type: null,
        total_debit: parseFloat(totalDebit || 0),
        total_kredit: parseFloat(totalKredit || 0),
        saldo: isNaN(saldo) ? 0 : saldo,
        running_balance: isNaN(saldo) ? 0 : saldo,
      });
    }

    res.json({
      success: true,
      data: responseRows,
      summary: {
        total_debit: parseFloat(totalDebit || 0),
        total_kredit: parseFloat(totalKredit || 0),
        saldo: isNaN(saldo) ? 0 : saldo,
      },
      pagination: {
        total: totalWithSummary,
        page: requestedPage,
        limit: pageLimit,
        totalPages: totalPagesWithSummary,
      },
    });
  } catch (err) {
    console.error("Error in getAllCashTransactions:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all tempo transactions with summary
exports.getAllTempoTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category_id,
      date_from,
      date_to,
      search,
      account,
      supplier,
      item_name,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {
      transaction_type: {
        [Op.in]: ["debit_tempo", "kredit_tempo"],
      },
    };

    if (category_id) whereClause.category_id = parseCategoryId(category_id);
    if (date_from || date_to) {
      whereClause.transaction_date = {};
      if (date_from) whereClause.transaction_date[Op.gte] = date_from;
      if (date_to) whereClause.transaction_date[Op.lte] = date_to;
    }
    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.iLike]: `%${search}%` } },
        { reference_number: { [Op.iLike]: `%${search}%` } },
        { supplier: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (account && account !== "All") {
      whereClause.account = account;
    }
    if (supplier) {
      whereClause.supplier = { [Op.iLike]: `%${supplier}%` };
    }
    if (item_name) {
      const like = { [Op.iLike]: `%${item_name}%` };
      whereClause[Op.or] = [
        ...(whereClause[Op.or] || []),
        { description: like },
        { reference_number: like },
      ];
    }

    const result = await CashTransaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: CashCategory,
          as: "category",
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
    });

    const summaryResults = await CashTransaction.findAll({
      where: whereClause,
      attributes: [
        "transaction_type",
        [
          db.sequelize.fn(
            "SUM",
            db.sequelize.cast(db.sequelize.col("amount"), "DECIMAL(15,2)")
          ),
          "total",
        ],
      ],
      group: ["transaction_type"],
      raw: true,
    });

    const totalDebitTempo =
      summaryResults.find((s) => s.transaction_type === "debit_tempo")?.total ||
      0;
    const totalKreditTempo =
      summaryResults.find((s) => s.transaction_type === "kredit_tempo")
        ?.total || 0;
    const saldo =
      parseFloat(totalDebitTempo || 0) - parseFloat(totalKreditTempo || 0);

    console.log("Tempo Summary Results:", summaryResults);
    console.log(
      "Total Debit Tempo:",
      totalDebitTempo,
      "Total Kredit Tempo:",
      totalKreditTempo,
      "Saldo:",
      saldo
    );

    const allFilteredTransactions = await CashTransaction.findAll({
      where: whereClause,
      order: [["created_at", "ASC"]],
      attributes: ["id", "transaction_type", "amount"],
    });

    const balanceLookup = {};
    let runningBalance = 0;
    allFilteredTransactions.forEach((transaction) => {
      const amount = parseFloat(transaction.amount) || 0;
      if (transaction.transaction_type === "debit_tempo") {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      balanceLookup[transaction.id] = runningBalance;
    });

    const enhancedTransactions = result.rows.map((transaction) => {
      const transactionData = transaction.toJSON();
      return {
        ...transactionData,
        running_balance: balanceLookup[transaction.id] || 0,
        amount: parseFloat(transactionData.amount) || 0,
        no_nota: transactionData.no_nota || [],
        date_nota: transactionData.date_nota || [],
        supplier: transactionData.supplier || null,
        tanggal_jatuh_tempo: transactionData.tanggal_jatuh_tempo || null,
      };
    });

    // Pagination with summary-row awareness
    const baseTotal = result.count;
    const totalWithSummary = baseTotal + 1; // include grand total row
    const requestedPage = parseInt(page);
    const pageLimit = parseInt(limit);
    const totalPagesWithSummary = Math.ceil(totalWithSummary / pageLimit) || 1;
    const isLastPage = requestedPage >= totalPagesWithSummary;

    // Append a synthetic summary row ONLY on the last page
    const responseRows = [...enhancedTransactions];
    if (isLastPage) {
      responseRows.push({
        id: -1,
        is_summary: true,
        description: "Grand Total",
        transaction_type: null,
        total_debit: parseFloat(totalDebitTempo || 0),
        total_kredit: parseFloat(totalKreditTempo || 0),
        saldo: isNaN(saldo) ? 0 : saldo,
        running_balance: isNaN(saldo) ? 0 : saldo,
      });
    }

    res.json({
      success: true,
      data: responseRows,
      summary: {
        total_debit_tempo: parseFloat(totalDebitTempo || 0),
        total_kredit_tempo: parseFloat(totalKreditTempo || 0),
        saldo: isNaN(saldo) ? 0 : saldo,
      },
      pagination: {
        total: totalWithSummary,
        page: requestedPage,
        limit: pageLimit,
        totalPages: totalPagesWithSummary,
      },
    });
  } catch (err) {
    console.error("Error in getAllTempoTransactions:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get unique accounts
exports.getUniqueAccounts = async (req, res, next) => {
  try {
    const accounts = await CashTransaction.findAll({
      attributes: [
        [db.sequelize.fn("DISTINCT", db.sequelize.col("account")), "account"],
      ],
      raw: true,
    });
    res.json({
      success: true,
      data: accounts.map((a) => a.account).filter((account) => account),
    });
  } catch (err) {
    console.error("Error in getUniqueAccounts:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Create new cash transaction
exports.createCashTransaction = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      transaction_type,
      category_id,
      amount,
      description,
      reference_number,
      transaction_date,
      account,
      supplier,
      tanggal_jatuh_tempo,
    } = req.body;

    let attachment_urls = [];
    if (req.body.attachment_urls) {
      try {
        attachment_urls = JSON.parse(req.body.attachment_urls);
      } catch (error) {
        attachment_urls = [];
      }
    }
    if (req.files && req.files.length > 0) {
      const fileUrls = req.files.map(
        (file) => `uploads/receipts/${file.filename}`
      );
      attachment_urls = [...attachment_urls, ...fileUrls];
    }

    let no_nota = [];
    if (typeof req.body.no_nota === "string") {
      try {
        no_nota = JSON.parse(req.body.no_nota);
      } catch (error) {
        no_nota = [];
      }
    } else if (Array.isArray(req.body.no_nota)) {
      no_nota = req.body.no_nota;
    }

    let date_nota = [];
    if (typeof req.body.date_nota === "string") {
      try {
        date_nota = JSON.parse(req.body.date_nota);
      } catch (error) {
        date_nota = [];
      }
    } else if (Array.isArray(req.body.date_nota)) {
      date_nota = req.body.date_nota;
    }

    if (
      !transaction_type ||
      !["debit", "kredit", "debit_tempo", "kredit_tempo"].includes(
        transaction_type
      )
    ) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invalid transaction type" });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({
          success: false,
          message: "Amount must be a valid number greater than 0",
        });
    }
    if (!description || description.trim() === "") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Description is required" });
    }
    if (!account || account.trim() === "") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Account is required" });
    }

    const cashTransaction = await CashTransaction.create(
      {
        transaction_type,
        category_id: parseCategoryId(category_id),
        amount: parsedAmount,
        description: description.trim(),
        reference_number: reference_number || null,
        transaction_date:
          transaction_date || new Date().toISOString().split("T")[0],
        account: account.trim(),
        attachment_urls: attachment_urls.length > 0 ? attachment_urls : null,
        no_nota: no_nota.length > 0 ? no_nota : null,
        date_nota: date_nota.length > 0 ? date_nota : null,
        supplier: supplier || null,
        tanggal_jatuh_tempo: tanggal_jatuh_tempo || null,
        // Audit
        last_edited_by: req.user?.username || null,
        last_edited_at: new Date(),
      },
      { transaction }
    );

    if (["debit_tempo", "kredit_tempo"].includes(transaction_type)) {
      await TempoDetail.create(
        {
          cash_transaction_id: cashTransaction.id,
          // Ensure NOT NULL constraints are respected
          due_date: tanggal_jatuh_tempo || transaction_date || new Date().toISOString().split("T")[0],
          store_name: supplier || "Unknown",
          amount: parsedAmount,
          status: "pending",
          payment_date: null,
          payment_method: null,
          nota_attachment_url:
            attachment_urls.length > 0 ? attachment_urls : [],
        },
        { transaction }
      );
    }

    const createdTransaction = await CashTransaction.findByPk(
      cashTransaction.id,
      {
        include: [{ model: CashCategory, as: "category", required: false }],
        transaction,
      }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Cash transaction created successfully",
      data: {
        ...createdTransaction.toJSON(),
        amount: parseFloat(createdTransaction.amount),
        attachment_urls: createdTransaction.attachment_urls || [],
        no_nota: createdTransaction.no_nota || [],
        date_nota: createdTransaction.date_nota || [],
        supplier: createdTransaction.supplier || null,
        tanggal_jatuh_tempo: createdTransaction.tanggal_jatuh_tempo || null,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error in createCashTransaction:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get cash transaction by ID
exports.getCashTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID. Must be a number.",
      });
    }

    const cashTransaction = await CashTransaction.findByPk(parseInt(id), {
      include: [
        {
          model: CashCategory,
          as: "category",
          required: false,
        },
      ],
    });

    if (!cashTransaction) {
      return res.status(404).json({
        success: false,
        message: "Cash transaction not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...cashTransaction.toJSON(),
        amount: parseFloat(cashTransaction.amount),
        attachment_urls: cashTransaction.attachment_urls || [],
        no_nota: cashTransaction.no_nota || [],
        date_nota: cashTransaction.date_nota || [],
        supplier: cashTransaction.supplier || null,
        tanggal_jatuh_tempo: cashTransaction.tanggal_jatuh_tempo || null,
      },
    });
  } catch (err) {
    console.error("Error in getCashTransactionById:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update cash transaction
exports.updateCashTransaction = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      transaction_type,
      category_id,
      amount,
      description,
      reference_number,
      transaction_date,
      account,
      no_nota,
      date_nota,
      supplier,
      tanggal_jatuh_tempo,
      payment_method,
      payment_date,
    } = req.body;

    if (isNaN(parseInt(id))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID. Must be a number.",
      });
    }

    const cashTransaction = await CashTransaction.findByPk(id, { transaction });
    if (!cashTransaction) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    let updatedNoNota = cashTransaction.no_nota || [];
    if (typeof no_nota === "string") {
      try {
        updatedNoNota = JSON.parse(no_nota);
      } catch (error) {
        updatedNoNota = [];
      }
    } else if (Array.isArray(no_nota)) {
      updatedNoNota = no_nota;
    }

    let updatedDateNota = cashTransaction.date_nota || [];
    if (typeof date_nota === "string") {
      try {
        updatedDateNota = JSON.parse(date_nota);
      } catch (error) {
        updatedDateNota = [];
      }
    } else if (Array.isArray(date_nota)) {
      updatedDateNota = date_nota;
    }

    const existingUrls = cashTransaction.attachment_urls || [];
    const newUrls =
      req.files?.map((file) => `uploads/receipts/${file.filename}`) || [];
    const updatedAttachmentUrls = [...existingUrls, ...newUrls];

    const parsedAmount = amount ? parseFloat(amount) : cashTransaction.amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({
          success: false,
          message: "Amount must be a valid number greater than 0",
        });
    }
    if (description && description.trim() === "") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Description cannot be empty" });
    }
    if (account && account.trim() === "") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Account cannot be empty" });
    }

    // Preserve original type before update to know if this was a tempo transaction
    const wasTempoType = ["debit_tempo", "kredit_tempo"].includes(
      cashTransaction.transaction_type
    );

    // Update CashTransaction
    const newTransactionType =
      transaction_type || cashTransaction.transaction_type;
    await cashTransaction.update(
      {
        transaction_type: newTransactionType,
        category_id:
          category_id !== undefined
            ? parseCategoryId(category_id)
            : cashTransaction.category_id,
        amount: parsedAmount,
        description: description
          ? description.trim()
          : cashTransaction.description,
        reference_number:
          reference_number !== undefined
            ? reference_number
            : cashTransaction.reference_number,
        transaction_date: transaction_date || cashTransaction.transaction_date,
        account: account ? account.trim() : cashTransaction.account,
        no_nota:
          updatedNoNota.length > 0 ? updatedNoNota : cashTransaction.no_nota,
        date_nota:
          updatedDateNota.length > 0
            ? updatedDateNota
            : cashTransaction.date_nota,
        attachment_urls:
          updatedAttachmentUrls.length > 0
            ? updatedAttachmentUrls
            : cashTransaction.attachment_urls,
        supplier: supplier !== undefined ? supplier : cashTransaction.supplier,
        tanggal_jatuh_tempo:
          tanggal_jatuh_tempo !== undefined
            ? tanggal_jatuh_tempo
            : cashTransaction.tanggal_jatuh_tempo,
        // Audit
        last_edited_by: req.user?.username || null,
        last_edited_at: new Date(),
      },
      { transaction }
    );

    // Update or create TempoDetail
    const isSettled =
      newTransactionType === "debit" || newTransactionType === "kredit";
    const tempoDetail = await TempoDetail.findOne({
      where: { cash_transaction_id: id },
      transaction,
    });

    if (tempoDetail) {
      await tempoDetail.update(
        {
          due_date:
            tanggal_jatuh_tempo !== undefined
              ? tanggal_jatuh_tempo
              : tempoDetail.due_date,
          store_name:
            supplier !== undefined ? supplier : tempoDetail.store_name,
          amount: parsedAmount,
          status: isSettled ? "lunas" : "pending",
          payment_date: isSettled
            ? payment_date || new Date().toISOString().split("T")[0]
            : null,
          payment_method: isSettled ? payment_method || "unknown" : null,
          nota_attachment_url:
            updatedAttachmentUrls.length > 0
              ? updatedAttachmentUrls
              : tempoDetail.nota_attachment_url,
        },
        { transaction }
      );
    } else if (
      isSettled &&
      wasTempoType
    ) {
      await TempoDetail.create(
        {
          cash_transaction_id: id,
          due_date: tanggal_jatuh_tempo || null,
          store_name: supplier || null,
          amount: parsedAmount,
          status: "lunas",
          payment_date: payment_date || new Date().toISOString().split("T")[0],
          payment_method: payment_method || "unknown",
          nota_attachment_url:
            updatedAttachmentUrls.length > 0 ? updatedAttachmentUrls : [],
        },
        { transaction }
      );
    }

    const updatedTransaction = await CashTransaction.findByPk(id, {
      include: [{ model: CashCategory, as: "category", required: false }],
      transaction,
    });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: {
        ...updatedTransaction.toJSON(),
        amount: parseFloat(updatedTransaction.amount),
        attachment_urls: updatedTransaction.attachment_urls || [],
        no_nota: updatedTransaction.no_nota || [],
        date_nota: updatedTransaction.date_nota || [],
        supplier: updatedTransaction.supplier || null,
        tanggal_jatuh_tempo: updatedTransaction.tanggal_jatuh_tempo || null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateCashTransaction:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update transaction",
        error: error.message,
      });
  }
};

// Confirm Lunasi for multiple tempo transactions
exports.confirmLunasi = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const {
      transactionIds,
      payment_method,
      payment_date,
      no_nota,
      date_nota,
      description,
      account,
    } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "No transactions selected" });
    }

    const transactions = await CashTransaction.findAll({
      where: {
        id: { [Op.in]: transactionIds },
        transaction_type: { [Op.in]: ["debit_tempo", "kredit_tempo"] },
      },
      transaction,
    });

    if (transactions.length !== transactionIds.length) {
      await transaction.rollback();
      return res
        .status(400)
        .json({
          success: false,
          message: "Some transactions not found or not tempo type",
        });
    }

    const totalAmount = transactions.reduce(
      (sum, t) => sum + parseFloat(t.amount),
      0
    );
    const suppliers = [
      ...new Set(transactions.map((t) => t.supplier).filter((s) => s)),
    ];
    const combinedNoNota = Array.isArray(no_nota)
      ? no_nota
      : transactions.flatMap((t) => t.no_nota || []);
    const combinedDateNota = Array.isArray(date_nota)
      ? date_nota
      : transactions.flatMap((t) => t.date_nota || []);
    const attachment_urls =
      req.files?.map((file) => `uploads/receipts/${file.filename}`) ||
      transactions.flatMap((t) => t.attachment_urls || []);

    // Update each transaction and its TempoDetail
    for (const t of transactions) {
      const newTransactionType =
        t.transaction_type === "debit_tempo" ? "debit" : "kredit";
      await t.update(
        {
          transaction_type: newTransactionType,
          description: description || t.description,
          no_nota: combinedNoNota.length > 0 ? combinedNoNota : t.no_nota,
          date_nota:
            combinedDateNota.length > 0 ? combinedDateNota : t.date_nota,
          attachment_urls:
            attachment_urls.length > 0 ? attachment_urls : t.attachment_urls,
          account: account || t.account,
          // Audit
          last_edited_by: req.user?.username || null,
          last_edited_at: new Date(),
        },
        { transaction }
      );

      const tempoDetail = await TempoDetail.findOne({
        where: { cash_transaction_id: t.id },
        transaction,
      });

      if (tempoDetail) {
        await tempoDetail.update(
          {
            status: "lunas",
            payment_date:
              payment_date || new Date().toISOString().split("T")[0],
            payment_method: payment_method || "unknown",
            nota_attachment_url:
              attachment_urls.length > 0
                ? attachment_urls
                : tempoDetail.nota_attachment_url,
          },
          { transaction }
        );
      } else {
        await TempoDetail.create(
          {
            cash_transaction_id: t.id,
            due_date: t.tanggal_jatuh_tempo || null,
            store_name: t.supplier || null,
            amount: parseFloat(t.amount),
            status: "lunas",
            payment_date:
              payment_date || new Date().toISOString().split("T")[0],
            payment_method: payment_method || "unknown",
            nota_attachment_url:
              attachment_urls.length > 0 ? attachment_urls : [],
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Transactions settled successfully",
      data: {
        total_amount: totalAmount,
        supplier: suppliers.join(", "),
        transaction_ids: transactionIds,
        no_nota: combinedNoNota,
        date_nota: combinedDateNota,
        attachment_urls,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in confirmLunasi:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to settle transactions",
        error: error.message,
      });
  }
};

// Delete cash transaction
exports.deleteCashTransaction = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    if (isNaN(parseInt(id))) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID. Must be a number.",
      });
    }

    const cashTransaction = await CashTransaction.findByPk(parseInt(id), { transaction });

    if (!cashTransaction) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Cash transaction not found",
      });
    }

    // Preserve linked tempo detail if this was a tempo transaction
    if (["debit_tempo", "kredit_tempo"].includes(cashTransaction.transaction_type)) {
      const existingTempo = await TempoDetail.findOne({ where: { cash_transaction_id: id }, transaction });
      if (existingTempo) {
        // Mark as settled and detach from cash transaction to preserve history
        await existingTempo.update({
          status: existingTempo.status === "lunas" ? "lunas" : "lunas",
          payment_date: existingTempo.payment_date || new Date(),
          payment_method: existingTempo.payment_method || "settlement",
          cash_transaction_id: null,
        }, { transaction });
      }
    } else {
      // If not a tempo transaction, remove any accidental link records
      await TempoDetail.destroy({ where: { cash_transaction_id: id }, transaction });
    }

    // Best-effort: unlink from recap cash items and update recap paid_amount
    const recapCashItems = await RecapNoteItem.findAll({ where: { type: "cash", reference_id: id }, transaction });
    for (const item of recapCashItems) {
      const recap = await RecapNote.findByPk(item.recap_id, { transaction });
      if (recap) {
        const newPaid = Math.max(0, parseFloat(recap.paid_amount || 0) - parseFloat(item.amount || 0));
        const newStatus = newPaid >= parseFloat(recap.total_amount || 0) ? "paid" : (newPaid > 0 ? "partial" : "open");
        await recap.update({ paid_amount: newPaid, status: newStatus }, { transaction });
      }
      await item.destroy({ transaction });
    }

    // Cascade by reference_number
    const ref = cashTransaction.reference_number || "";
    if (typeof ref === "string" && ref.length > 0) {
      // If this cash originated from a Service
      if (/^SRV-/.test(ref)) {
        const service = await VehicleService.findOne({ where: { service_number: ref }, transaction });
        if (service) {
          // Restore stock used by this service (reverse service stock transactions)
          const serviceTxns = await StockTransaction.findAll({ where: { reference_type: "service", reference_id: service.id }, transaction });
          for (const st of serviceTxns) {
            if (st.batch_id && st.transaction_type === "out") {
              const batch = await StockBatch.findByPk(st.batch_id, { transaction });
              if (batch) {
                await batch.update({ quantity: parseFloat(batch.quantity) + parseFloat(st.quantity) }, { transaction });
              }
            }
            await st.destroy({ transaction });
          }
          // Clean up service items then service itself
          await ServiceItem.destroy({ where: { service_id: service.id }, transaction });
          await service.destroy({ transaction });
        }
      }

      // If this cash originated from direct stock usage note
      if (/^USG-/.test(ref)) {
        const note = await StockUsageNote.findOne({ where: { note_number: ref }, transaction });
        if (note) {
          // Reverse stock transactions associated to this usage note
          const usageTxns = await StockTransaction.findAll({ where: { reference_type: "usage_note", reference_id: note.id }, transaction });
          for (const st of usageTxns) {
            if (st.batch_id && st.transaction_type === "out") {
              const batch = await StockBatch.findByPk(st.batch_id, { transaction });
              if (batch) {
                await batch.update({ quantity: parseFloat(batch.quantity) + parseFloat(st.quantity) }, { transaction });
              }
            }
            await st.destroy({ transaction });
          }
          // Remove recap link items for this usage note and update recap totals
          const recapItems = await RecapNoteItem.findAll({ where: { type: "stock_usage", reference_id: note.id }, transaction });
          for (const item of recapItems) {
            const recap = await RecapNote.findByPk(item.recap_id, { transaction });
            if (recap) {
              const newTotal = Math.max(0, parseFloat(recap.total_amount || 0) - parseFloat(item.amount || 0));
              await recap.update({ total_amount: newTotal, status: parseFloat(recap.paid_amount || 0) >= newTotal ? "paid" : (parseFloat(recap.paid_amount || 0) > 0 ? "partial" : "open") }, { transaction });
            }
            await item.destroy({ transaction });
          }
          // Delete usage note items and the note itself
          await StockUsageNoteItem.destroy({ where: { note_id: note.id }, transaction });
          await note.destroy({ transaction });
        }
      }
    }

    // Finally delete the cash transaction
    await cashTransaction.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: "Cash transaction deleted successfully",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Error in deleteCashTransaction:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get cash categories
exports.getCashCategories = async (req, res, next) => {
  try {
    const { type } = req.query;

    let whereClause = {};
    if (type && ["income", "expense"].includes(type)) {
      whereClause.category_type = type;
    }

    const categories = await CashCategory.findAll({
      where: whereClause,
      order: [["category_name", "ASC"]],
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error("Error in getCashCategories:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
