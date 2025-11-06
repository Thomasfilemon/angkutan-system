const { sequelize, CashTransaction, TempoDetail } = require('../../models');
const { Op } = require('sequelize');

exports.getAllTempoDetails = async (req, res, next) => {
  try {
    console.log('getAllTempoDetails called with query:', req.query);
    const { page = 1, limit = 10, search, store_name, status, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { store_name: { [Op.iLike]: `%${search}%` } },
        sequelize.where(sequelize.cast(sequelize.col('TempoDetail.id'), 'text'), {
          [Op.iLike]: `%${search}%`,
        }),
        // Search in CashTransaction description - will work with LEFT JOIN (required: false)
        { '$cashTransaction.description$': { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (store_name) where.store_name = { [Op.iLike]: `%${store_name}%` };
    if (status) where.status = status;
    
    // Add date filters for due_date
    if (date_from || date_to) {
      where.due_date = {};
      if (date_from) where.due_date[Op.gte] = date_from;
      if (date_to) where.due_date[Op.lte] = date_to;
    }

    const { count, rows } = await TempoDetail.findAndCountAll({
      where,
      include: [{
        model: CashTransaction,
        as: 'cashTransaction',
        attributes: ['no_nota', 'date_nota', 'description', 'transaction_date', 'account'],
        required: false, // LEFT JOIN - include TempoDetail even if CashTransaction is missing
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['due_date', 'DESC']],
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
        sequelize.where(sequelize.cast(sequelize.col('TempoDetail.id'), 'text'), {
          [Op.iLike]: `%${search}%`,
        }),
      ];
    }

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

    // Use sum() method which handles null/undefined better
    const totalAmountRaw = await TempoDetail.sum('amount', {
      where: totalAmountWhere,
    });
    const totalPendingRaw = await TempoDetail.sum('amount', {
      where: totalPendingWhere,
    });
    const totalLunasRaw = await TempoDetail.sum('amount', {
      where: totalLunasWhere,
    });

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