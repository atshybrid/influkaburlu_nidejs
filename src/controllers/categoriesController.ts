const { Category } = require('../models');

exports.list = async (req, res) => {
  try {
    const rows = await Category.findAll({
      attributes: ['id', 'name', 'type', 'purpose', 'description'],
      order: [['name', 'ASC']]
    });
    res.json({ items: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};
