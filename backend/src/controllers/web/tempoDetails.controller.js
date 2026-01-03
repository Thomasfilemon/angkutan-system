const { sequelize, CashTransaction, TempoDetail } = require('../../models');
const { Op } = require('sequelize');

exports.getAllTempoDetails = async (req, res, next) => {
  try {
    console.log('getAllTempoDetails called with query:', req.query);
    const { page = 1, limit = 10, search, store_name, status, date_from, date_to, account } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { store_name: { [Op.iLike]: `%${search}%` } },
        sequelize.where(
          sequelize.cast(sequelize.col('TempoDetail.id'), 'text'),
          Op.iLike,
          `%${search}%`
        ),
        // Search in CashTransaction description - will work with LEFT JOIN (required: false)
        { '$cashTransaction.description$': { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (store_name) where.store_name = { [Op.iLike]: `%${store_name}%` };
    if (status) where.status = status;
    
    // Add account filter
    const includeOptions = [{
      model: CashTransaction,
      as: 'cashTransaction',
      attributes: ['id', 'no_nota', 'date_nota', 'description', 'transaction_date', 'account', 'reference_number', 'transaction_type', 'supplier'],
      required: false, // LEFT JOIN - include TempoDetail even if CashTransaction is missing
    }];
    
    if (account) {
      includeOptions[0].where = { account: account };
      includeOptions[0].required = true; // INNER JOIN when filtering by account
    }
    
    // Add date filters for due_date
    if (date_from || date_to) {
      where.due_date = {};
      if (date_from) where.due_date[Op.gte] = date_from;
      if (date_to) where.due_date[Op.lte] = date_to;
    }

    const { count, rows } = await TempoDetail.findAndCountAll({
      where,
      include: includeOptions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      // Sort so that pending entries appear first, newest created at the top
      order: [
        [sequelize.literal(`CASE WHEN "TempoDetail"."status" = 'pending' THEN 0 ELSE 1 END`), 'ASC'],
        ['created_at', 'DESC'],
      ],
      distinct: true, // Important for correct count when using JOINs
    });

    // Build base where clause for summary queries (without cashTransaction references and status)
    const baseSummaryWhere = {};
    if (store_name) baseSummaryWhere.store_name = { [Op.iLike]: `%${store_name}%` };
    if (date_from || date_to) {
      baseSummaryWhere.due_date = {};
      if (date_from) baseSummaryWhere.due_date[Op.gte] = date_from;
      if (date_to) baseSummaryWhere.due_date[Op.lte] = date_to;
    }
    
    // Handle search filter for summary (only on TempoDetail fields, not cashTransaction)
    if (search) {
      baseSummaryWhere[Op.or] = [
        { store_name: { [Op.iLike]: `%${search}%` } },
        sequelize.where(
          sequelize.cast(sequelize.col('TempoDetail.id'), 'text'),
          Op.iLike,
          `%${search}%`
        ),
      ];
    }

    // For summary queries, if account filter is applied, we need to join with CashTransaction
    const summaryInclude = account ? [{
      model: CashTransaction,
      as: 'cashTransaction',
      where: { account: account },
      required: true,
      attributes: [],
    }] : [];

    // Calculate total amount for all filtered records (with status filter if applied)
    const totalAmountWhere = { ...baseSummaryWhere };
    if (status) totalAmountWhere.status = status;
    
    // Calculate total for pending (belum lunas) - always calculate regardless of status filter
    const totalPendingWhere = { ...baseSummaryWhere, status: 'pending' };
    
    // Calculate total for lunas (paid) - always calculate regardless of status filter
    const totalLunasWhere = { ...baseSummaryWhere, status: 'lunas' };

    console.log('Summary Where Clauses:', {
      baseSummaryWhere,
      totalAmountWhere,
      totalPendingWhere,
      totalLunasWhere,
    });

    // Use findAll with attributes to calculate sums when JOINs are involved
    // This avoids the column ambiguity issue with sum() method
    // When account filter is applied, use raw query to avoid ambiguity
    let totalAmountRaw, totalPendingRaw, totalLunasRaw;
    
    if (account) {
      // Build WHERE conditions for raw queries
      const buildWhereClause = (whereClause) => {
        const conditions = ['ct.account = :account'];
        const replacements = { account };
        
        if (whereClause.store_name) {
          conditions.push(`td.store_name ILIKE :store_name`);
          replacements.store_name = `%${whereClause.store_name}%`;
        }
        
        if (whereClause.due_date) {
          if (whereClause.due_date[Op.gte]) {
            conditions.push(`td.due_date >= :date_from`);
            replacements.date_from = whereClause.due_date[Op.gte];
          }
          if (whereClause.due_date[Op.lte]) {
            conditions.push(`td.due_date <= :date_to`);
            replacements.date_to = whereClause.due_date[Op.lte];
          }
        }
        
        if (whereClause.status) {
          conditions.push(`td.status = :status`);
          replacements.status = whereClause.status;
        }
        
        if (whereClause[Op.or]) {
          // Handle search filter - Op.or is an array of conditions
          // We'll handle store_name search, skip sequelize.where() conditions as they're complex
          const orConditions = [];
          whereClause[Op.or].forEach((orCond, idx) => {
            if (orCond && typeof orCond === 'object' && orCond.store_name) {
              if (orCond.store_name[Op.iLike]) {
                const searchTerm = orCond.store_name[Op.iLike].replace(/%/g, '');
                orConditions.push(`td.store_name ILIKE :search_store${idx}`);
                replacements[`search_store${idx}`] = `%${searchTerm}%`;
              } else {
                // Direct store_name value
                orConditions.push(`td.store_name ILIKE :search_direct${idx}`);
                replacements[`search_direct${idx}`] = `%${orCond.store_name}%`;
              }
            }
            // Note: sequelize.where() conditions are skipped as they require complex SQL generation
          });
          if (orConditions.length > 0) {
            conditions.push(`(${orConditions.join(' OR ')})`);
          }
        }
        
        return { conditions: conditions.join(' AND '), replacements };
      };
      
      // Calculate totals using raw queries
      const totalAmountWhereClause = buildWhereClause(totalAmountWhere);
      const [totalAmountRows] = await sequelize.query(
        `SELECT COALESCE(SUM(td.amount), 0) as total 
         FROM tempo_details td 
         INNER JOIN cash_transactions ct ON td.cash_transaction_id = ct.id 
         WHERE ${totalAmountWhereClause.conditions}`,
        {
          replacements: totalAmountWhereClause.replacements,
          type: sequelize.QueryTypes.SELECT,
        }
      );
      totalAmountRaw = totalAmountRows?.[0]?.total || 0;
      
      const totalPendingWhereClause = buildWhereClause(totalPendingWhere);
      const [totalPendingRows] = await sequelize.query(
        `SELECT COALESCE(SUM(td.amount), 0) as total 
         FROM tempo_details td 
         INNER JOIN cash_transactions ct ON td.cash_transaction_id = ct.id 
         WHERE ${totalPendingWhereClause.conditions}`,
        {
          replacements: totalPendingWhereClause.replacements,
          type: sequelize.QueryTypes.SELECT,
        }
      );
      totalPendingRaw = totalPendingRows?.[0]?.total || 0;
      
      const totalLunasWhereClause = buildWhereClause(totalLunasWhere);
      const [totalLunasRows] = await sequelize.query(
        `SELECT COALESCE(SUM(td.amount), 0) as total 
         FROM tempo_details td 
         INNER JOIN cash_transactions ct ON td.cash_transaction_id = ct.id 
         WHERE ${totalLunasWhereClause.conditions}`,
        {
          replacements: totalLunasWhereClause.replacements,
          type: sequelize.QueryTypes.SELECT,
        }
      );
      totalLunasRaw = totalLunasRows?.[0]?.total || 0;
    } else {
      // No JOIN needed, use regular sum() method
      totalAmountRaw = await TempoDetail.sum('amount', {
        where: totalAmountWhere,
      });
      totalPendingRaw = await TempoDetail.sum('amount', {
        where: totalPendingWhere,
      });
      totalLunasRaw = await TempoDetail.sum('amount', {
        where: totalLunasWhere,
      });
    }

    console.log('Raw Sum Results:', {
      totalAmountRaw,
      totalPendingRaw,
      totalLunasRaw,
    });

    // Parse and handle null/undefined - sum() returns null when no rows match
    const totalAmount = totalAmountRaw != null ? parseFloat(totalAmountRaw) : 0;
    const totalPending = totalPendingRaw != null ? parseFloat(totalPendingRaw) : 0;
    const totalLunas = totalLunasRaw != null ? parseFloat(totalLunasRaw) : 0;

    console.log('Final Parsed totals:', { totalAmount, totalPending, totalLunas });

    res.json({
      success: true,
      data: rows.map(detail => ({
        ...detail.toJSON(),
        amount: parseFloat(detail.amount),
        nota_attachment_url: detail.nota_attachment_url || [],
      })),
      pagination: {
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
      totalAmount: totalAmount,
      totalPending: totalPending,
      totalLunas: totalLunas,
    });
  } catch (error) {
    console.error('Error in getAllTempoDetails:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getUniqueSuppliers = async (req, res, next) => {
  try {
    console.log('getUniqueSuppliers called');
    const suppliers = await TempoDetail.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('store_name')), 'store_name']],
      where: { store_name: { [Op.ne]: null } },
      order: [['store_name', 'ASC']],
    });

    const supplierNames = suppliers.map((s) => s.store_name).filter(Boolean);

    res.json({
      success: true,
      data: supplierNames,
    });
  } catch (error) {
    console.error('Error in getUniqueSuppliers:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.deleteTempoDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tempoDetail = await TempoDetail.findByPk(id);
    if (!tempoDetail) {
      return res.status(404).json({ success: false, message: 'Tempo detail not found' });
    }
    await tempoDetail.destroy();
    res.json({ success: true, message: 'Tempo detail deleted successfully' });
  } catch (error) {
    console.error('Error in deleteTempoDetail:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.bulkSettleTempoDetails = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    console.log('bulkSettleTempoDetails called with body:', req.body);
    const { tempo_detail_ids, payment_date, payment_account, payment_method } = req.body;

    // Validate tempo_detail_ids
    if (!tempo_detail_ids) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'tempo_detail_ids is required',
      });
    }

    if (!Array.isArray(tempo_detail_ids)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'tempo_detail_ids must be an array',
      });
    }

    if (tempo_detail_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'At least one tempo_detail_id is required',
      });
    }

    if (!payment_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'payment_date is required',
      });
    }

    console.log('Processing settlement for IDs:', tempo_detail_ids);

    // Find all selected tempo details
    const tempoDetails = await TempoDetail.findAll({
      where: {
        id: { [Op.in]: tempo_detail_ids },
        status: 'pending', // Only settle pending ones
      },
      include: [{
        model: CashTransaction,
        as: 'cashTransaction',
        required: false,
      }],
      transaction,
    });

    if (tempoDetails.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'No pending tempo details found for the selected IDs',
      });
    }

    // Update all tempo details to lunas
    const updatedIds = [];
    for (const tempoDetail of tempoDetails) {
      await tempoDetail.update(
        {
          status: 'lunas',
          payment_date: payment_date,
          payment_method: payment_method || 'bulk_settlement',
        },
        { transaction }
      );
      updatedIds.push(tempoDetail.id);

      // If there's a linked cash transaction, update it to regular cash transaction
      if (tempoDetail.cashTransaction) {
        const cashTx = tempoDetail.cashTransaction;
        const newTransactionType = cashTx.transaction_type === 'debit_tempo' ? 'debit' : 'kredit';
        
        await cashTx.update(
          {
            transaction_type: newTransactionType,
            account: payment_account || cashTx.account,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `Successfully settled ${updatedIds.length} tempo details`,
      data: {
        settled_count: updatedIds.length,
        settled_ids: updatedIds,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error in bulkSettleTempoDetails:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};