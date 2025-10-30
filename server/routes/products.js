const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const slugify = require('slugify');
const { authOptional, requireAuth, requireAdmin } = require('../middleware/auth');

// List products: supports active, featured, category, aliases (collection, categorySlug), q, sort, page, limit
router.get('/', authOptional, async (req, res) => {
  try {
    const { active, featured, category, collection, categorySlug, q } = req.query;
    const limit = Number(req.query.limit || 50);
    const page = Number(req.query.page || 1);
    const sortParam = String(req.query.sort || ''); // e.g., createdAt:desc

    const filter = {};
    // By default, only return active products. Allow overriding with active=false or active=all
    if (typeof active === 'undefined') {
      filter.active = true;
    } else if (String(active).toLowerCase() === 'false' || String(active) === '0') {
      filter.active = false;
    }

    if (typeof featured !== 'undefined') {
      filter.featured = String(featured).toLowerCase() === 'true' || featured === '1';
    }

    const escapeRegExp = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Category matching: accept slug or name (case-insensitive), resolve via Category model if possible
    const catParam = category || collection || categorySlug;
    if (catParam) {
      const raw = String(catParam);
      try {
        const catDoc = await Category.findOne({ $or: [
          { slug: raw },
          { name: new RegExp(`^${escapeRegExp(raw)}$`, 'i') },
        ] }).lean();
        if (catDoc && catDoc.name) {
          filter.$or = [
            { category: new RegExp(`^${escapeRegExp(catDoc.name)}$`, 'i') },
            { category: new RegExp(`^${escapeRegExp(raw)}$`, 'i') },
          ];
        } else {
          filter.category = new RegExp(`^${escapeRegExp(raw)}$`, 'i');
        }
      } catch {
        filter.category = new RegExp(`^${escapeRegExp(raw)}$`, 'i');
      }
    }

    if (q) {
      const qReg = new RegExp(String(q), 'i');
      filter.$or = Array.isArray(filter.$or)
        ? [...filter.$or, { title: qReg }, { category: qReg }]
        : [{ title: qReg }, { category: qReg }];
    }

    const l = Math.min(200, isNaN(limit) ? 50 : limit);
    const p = Math.max(1, isNaN(page) ? 1 : page);

    // Build sort
    let sort = undefined;
    if (sortParam) {
      const [field, dir] = String(sortParam).split(':');
      if (field) {
        const direction = String(dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
        sort = { [field]: direction };
      }
    }

    let query = Product.find(filter);
    if (sort) query = query.sort(sort);
    const docs = await query.skip((p - 1) * l).limit(l).lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get by id or slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let doc = null;
    if (/^[0-9a-fA-F]{24}$/.test(idOrSlug)) doc = await Product.findById(idOrSlug).lean();
    if (!doc) doc = await Product.findOne({ slug: idOrSlug }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Create product (admin) — supports Admin UI payload mapping
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const title = body.title || body.name;
    const price = typeof body.price !== 'undefined' ? Number(body.price) : undefined;
    if (!title || typeof price === 'undefined') return res.status(400).json({ ok: false, message: 'Missing fields' });

    // Generate a unique slug to avoid duplicate key errors
    const baseSlug = slugify(title, { lower: true, strict: true }) || `prod-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (await Product.exists({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const payload = {
      title,
      slug,
      price,
      category: body.category || undefined,
      stock: typeof body.stock !== 'undefined' ? Number(body.stock) : 0,
      description: body.description || undefined,
      longDescription: body.longDescription || undefined,
      images: Array.isArray(body.images)
        ? body.images
        : body.image_url
        ? [body.image_url]
        : [],
      attributes: body.attributes || {},
      sizes: Array.isArray(body.sizes) ? body.sizes : (Array.isArray(body.attributes?.sizes) ? body.attributes.sizes : []),
      trackInventoryBySize: typeof body.trackInventoryBySize === 'boolean' ? body.trackInventoryBySize : true,
      sizeInventory: Array.isArray(body.sizeInventory)
        ? body.sizeInventory.map(s => ({
            code: String(s.code || '').trim(),
            label: String(s.label || '').trim(),
            qty: Number(s.qty || 0)
          })).filter(s => s.code)
        : [],
      sizeChartUrl: body.sizeChartUrl || undefined,
      sizeChartTitle: body.sizeChartTitle || undefined,
      highlights: Array.isArray(body.highlights)
        ? body.highlights.filter(h => String(h || '').trim()).slice(0, 8)
        : [],
      specs: Array.isArray(body.specs)
        ? body.specs.map(spec => ({
            key: String(spec.key || '').trim(),
            value: String(spec.value || '').trim()
          })).filter(spec => spec.key && spec.value)
        : [],
      sizeChart: body.sizeChart || undefined,
      active: typeof body.active === 'boolean' ? body.active : true,
    };

    // If categoryId/subcategoryId is provided by Admin UI, resolve to category name/slug
    try {
      const refId = body.subcategoryId || body.categoryId;
      if (refId) {
        const catDoc = await Category.findById(refId).lean();
        if (catDoc) payload.category = catDoc.name || catDoc.slug;
      }
    } catch (catErr) {}

    const doc = await Product.create(payload);
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    // If duplicate key still occurs, return a 409 with helpful message
    if (e && e.code === 11000 && e.keyValue && e.keyValue.slug) {
      return res.status(409).json({ ok: false, message: 'Duplicate slug', slug: e.keyValue.slug });
    }
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Update product (admin)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updates = {};
    if (typeof body.name !== 'undefined') updates.title = body.name;
    if (typeof body.title !== 'undefined') updates.title = body.title;
    if (typeof body.description !== 'undefined') updates.description = body.description;
    if (typeof body.longDescription !== 'undefined') updates.longDescription = body.longDescription;
    if (typeof body.price !== 'undefined') updates.price = Number(body.price);
    if (typeof body.category !== 'undefined') updates.category = body.category;
    if (typeof body.stock !== 'undefined') updates.stock = Number(body.stock);
    if (typeof body.active !== 'undefined') updates.active = !!body.active;
    if (typeof body.featured !== 'undefined') updates.featured = !!body.featured;
    if (typeof body.image_url !== 'undefined') updates.images = [body.image_url];
    if (Array.isArray(body.images)) updates.images = body.images;
    if (Array.isArray(body.sizes)) updates.sizes = body.sizes;
    if (Array.isArray(body.highlights)) updates.highlights = body.highlights.slice(0, 8);
    if (Array.isArray(body.specs)) {
      updates.specs = body.specs.map(spec => ({
        key: String(spec.key || '').trim(),
        value: String(spec.value || '').trim()
      })).filter(spec => spec.key && spec.value);
    }
    if (typeof body.trackInventoryBySize === 'boolean') updates.trackInventoryBySize = body.trackInventoryBySize;
    if (Array.isArray(body.sizeInventory)) {
      updates.sizeInventory = body.sizeInventory.map(s => ({
        code: String(s.code || '').trim(),
        label: String(s.label || '').trim(),
        qty: Number(s.qty || 0)
      })).filter(s => s.code);
    }
    if (typeof body.sizeChartUrl !== 'undefined') updates.sizeChartUrl = body.sizeChartUrl || undefined;
    if (typeof body.sizeChartTitle !== 'undefined') updates.sizeChartTitle = body.sizeChartTitle || undefined;
    if (body.sizeChart !== undefined) updates.sizeChart = body.sizeChart || undefined;

    // If Admin UI sent categoryId/subcategoryId, resolve to category name/slug
    try {
      const refId = body.subcategoryId || body.categoryId;
      if (refId) {
        const catDoc = await Category.findById(refId).lean();
        if (catDoc) updates.category = catDoc.name || catDoc.slug;
      }
    } catch (catErr) {}

    const doc = await Product.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// PATCH endpoint for partial updates (e.g., just details)
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updates = {};

    // Only update fields that are explicitly provided
    if (typeof body.longDescription !== 'undefined') updates.longDescription = body.longDescription;
    if (Array.isArray(body.highlights)) updates.highlights = body.highlights.slice(0, 8);
    if (Array.isArray(body.specs)) {
      updates.specs = body.specs.map(spec => ({
        key: String(spec.key || '').trim(),
        value: String(spec.value || '').trim()
      })).filter(spec => spec.key && spec.value);
    }
    if (typeof body.trackInventoryBySize === 'boolean') updates.trackInventoryBySize = body.trackInventoryBySize;
    if (Array.isArray(body.sizeInventory)) {
      updates.sizeInventory = body.sizeInventory.map(s => ({
        code: String(s.code || '').trim(),
        label: String(s.label || '').trim(),
        qty: Number(s.qty || 0)
      })).filter(s => s.code);
    }
    if (typeof body.sizeChartUrl !== 'undefined') updates.sizeChartUrl = body.sizeChartUrl || undefined;
    if (typeof body.sizeChartTitle !== 'undefined') updates.sizeChartTitle = body.sizeChartTitle || undefined;
    if (body.sizeChart !== undefined) updates.sizeChart = body.sizeChart || undefined;

    const doc = await Product.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Soft delete
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Product.findByIdAndUpdate(id, { active: false }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
