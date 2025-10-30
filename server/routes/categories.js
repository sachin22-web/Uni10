const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Helper to normalize updates from body
function buildCategoryPayload(body = {}) {
  const payload = {};
  if (typeof body.name !== 'undefined') payload.name = String(body.name).trim();
  if (typeof body.description !== 'undefined') payload.description = String(body.description || '').trim();
  if (typeof body.active !== 'undefined') payload.active = !!body.active;
  if (typeof body.slug !== 'undefined') payload.slug = String(body.slug || '').trim();
  const parentId = body.parentId || body.parent || null;
  if (typeof parentId !== 'undefined') payload.parent = parentId ? String(parentId) : null;
  return payload;
}

// List categories (optionally filter by parent)
router.get('/', async (req, res) => {
  try {
    const { parent } = req.query;
    const filter = { active: true };
    if (typeof parent !== 'undefined') {
      const p = String(parent);
      if (p === '' || p.toLowerCase() === 'null' || p === '0') {
        filter.parent = null;
      } else {
        filter.parent = p;
      }
    }
    const docs = await Category.find(filter).sort({ name: 1 }).lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Create category (admin)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, message: 'Missing name' });
    if (!String(name).trim()) return res.status(400).json({ ok: false, message: 'Name cannot be empty' });

    const trimmedName = String(name).trim();
    const existingCategory = await Category.findOne({ name: { $regex: `^${trimmedName}$`, $options: 'i' } });
    if (existingCategory) {
      return res.status(409).json({ ok: false, message: 'Category with this name already exists' });
    }

    const payload = buildCategoryPayload(req.body || {});
    if (!payload.name) payload.name = trimmedName;

    const doc = await Category.create(payload);
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error('Category create error:', { message: e.message, code: e.code, errorString: String(e) });
    if (e.code === 11000) {
      return res.status(409).json({ ok: false, message: 'Category with this name or slug already exists' });
    }
    return res.status(500).json({ ok: false, message: e.message || 'Failed to create category' });
  }
});

// Update category (admin)
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const updates = buildCategoryPayload(req.body || {});
    const doc = await Category.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
}

router.put('/:id', requireAuth, requireAdmin, updateCategory);
router.patch('/:id', requireAuth, requireAdmin, updateCategory);

// Delete/Deactivate (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Category.findByIdAndUpdate(id, { active: false }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
