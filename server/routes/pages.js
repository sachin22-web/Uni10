const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const slugify = require('slugify');

// Admin: GET /api/admin/pages/list - List all pages
router.get('/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pages = await Page.find().sort({ updatedAt: -1 }).lean();
    const normalized = (pages || []).map((p) => ({
      id: String(p._id),
      _id: String(p._id),
      name: String(p.name || ''),
      slug: String(p.slug || ''),
      content: String(p.content || ''),
      status: String(p.status || 'active'),
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : '',
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
    }));
    return res.json({ ok: true, data: normalized });
  } catch (e) {
    console.error('Failed to list pages:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: POST /api/admin/pages/create - Create a new page
router.post('/create', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, slug, content, status } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, message: 'Page name is required' });
    }

    if (!slug || !String(slug).trim()) {
      return res.status(400).json({ ok: false, message: 'Slug is required' });
    }

    const slugStr = String(slug).toLowerCase().trim();
    const existing = await Page.findOne({ slug: slugStr });
    if (existing) {
      return res.status(400).json({ ok: false, message: 'Slug already exists' });
    }

    const page = new Page({
      name: String(name).trim(),
      slug: slugStr,
      content: String(content || ''),
      status: ['active', 'inactive'].includes(String(status)) ? String(status) : 'active',
    });

    await page.save();

    return res.json({
      ok: true,
      data: {
        id: String(page._id),
        _id: String(page._id),
        name: page.name,
        slug: page.slug,
        content: page.content,
        status: page.status,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to create page:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: PATCH /api/admin/pages/:id - Update a page
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, content, status } = req.body || {};

    const updates = {};

    if (name && typeof name === 'string') {
      updates.name = String(name).trim();
    }

    if (slug && typeof slug === 'string') {
      const slugStr = String(slug).toLowerCase().trim();
      const existing = await Page.findOne({ slug: slugStr, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ ok: false, message: 'Slug already exists' });
      }
      updates.slug = slugStr;
    }

    if (content !== undefined) {
      updates.content = String(content || '');
    }

    if (status && ['active', 'inactive'].includes(String(status))) {
      updates.status = String(status);
    }

    const page = await Page.findByIdAndUpdate(id, updates, { new: true });
    if (!page) {
      return res.status(404).json({ ok: false, message: 'Page not found' });
    }

    return res.json({
      ok: true,
      data: {
        id: String(page._id),
        _id: String(page._id),
        name: page.name,
        slug: page.slug,
        content: page.content,
        status: page.status,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to update page:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: DELETE /api/admin/pages/:id - Delete a page
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const page = await Page.findByIdAndDelete(id);
    if (!page) {
      return res.status(404).json({ ok: false, message: 'Page not found' });
    }
    return res.json({ ok: true, message: 'Page deleted' });
  } catch (e) {
    console.error('Failed to delete page:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
