const { sequelize, CashTransaction, TempoDetail } = require('../../models');
const { Op } = require('sequelize');

exports.getAllTempoDetails = async (req, res, next) => {
  try {
    console.log('getAllTempoDetails called with query:', req.query);
    const { page = 1, limit = 10, search, store_name, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { store_name: { [Op.iLike]: `%${search}%` } },
        sequelize.where(sequelize.cast(sequelize.col('TempoDetail.id'), 'text'), {
          [Op.iLike]: `%${search}%`,
        }),
        { '$cashTransaction.description$': { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (store_name) where.store_name = { [Op.iLike]: `%${store_name}%` };
    if (status) where.status = status;

    const { count, rows } = await TempoDetail.findAndCountAll({
      where,
      include: [{
        model: CashTransaction,
        as: 'cashTransaction',
        attributes: ['no_nota', 'date_nota', 'description', 'transaction_date', 'account'],
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['due_date', 'DESC']],
    });

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