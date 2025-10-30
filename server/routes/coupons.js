const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Admin: GET /api/coupons/admin/list - List all coupons
router.get('/admin/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    const normalized = (coupons || []).map((c) => ({
      id: String(c._id),
      _id: String(c._id),
      code: String(c.code || ''),
      discount: Number(c.discount || 0),
      expiryDate: c.expiryDate ? new Date(c.expiryDate).toISOString().split('T')[0] : '',
      usedCount: Array.isArray(c.usedBy) ? c.usedBy.length : 0,
      isActive: Boolean(c.isActive),
    }));
    return res.json({ ok: true, data: normalized });
  } catch (e) {
    console.error('Failed to list coupons:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: POST /api/coupons/admin/create - Create a new coupon
router.post('/admin/create', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { code, discount, expiryDate } = req.body || {};

    if (!code || !code.trim()) {
      return res.status(400).json({ ok: false, message: 'Coupon code is required' });
    }
    if (typeof discount !== 'number' || discount < 1 || discount > 100) {
      return res.status(400).json({ ok: false, message: 'Discount must be between 1 and 100' });
    }
    if (!expiryDate) {
      return res.status(400).json({ ok: false, message: 'Expiry date is required' });
    }

    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) {
      return res.status(400).json({ ok: false, message: 'Invalid expiry date' });
    }

    const existing = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({ ok: false, message: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code: String(code).toUpperCase().trim(),
      discount: Number(discount),
      expiryDate: expiry,
      usedBy: [],
      isActive: true,
    });

    await coupon.save();

    return res.json({
      ok: true,
      data: {
        id: String(coupon._id),
        code: coupon.code,
        discount: coupon.discount,
        expiryDate: coupon.expiryDate.toISOString().split('T')[0],
        usedCount: 0,
        isActive: coupon.isActive,
      },
    });
  } catch (e) {
    console.error('Failed to create coupon:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: DELETE /api/coupons/admin/:id - Delete a coupon
router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({ ok: false, message: 'Coupon not found' });
    }
    return res.json({ ok: true, message: 'Coupon deleted' });
  } catch (e) {
    console.error('Failed to delete coupon:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: PATCH /api/coupons/admin/:id - Update a coupon
router.patch('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discount, expiryDate } = req.body || {};

    const updates = {};

    if (code && typeof code === 'string') {
      updates.code = String(code).toUpperCase().trim();
    }
    if (typeof discount === 'number' && discount >= 1 && discount <= 100) {
      updates.discount = discount;
    }
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      if (!isNaN(expiry.getTime())) {
        updates.expiryDate = expiry;
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    if (!coupon) {
      return res.status(404).json({ ok: false, message: 'Coupon not found' });
    }

    return res.json({
      ok: true,
      data: {
        id: String(coupon._id),
        code: coupon.code,
        discount: coupon.discount,
        expiryDate: coupon.expiryDate.toISOString().split('T')[0],
        usedCount: Array.isArray(coupon.usedBy) ? coupon.usedBy.length : 0,
        isActive: coupon.isActive,
      },
    });
  } catch (e) {
    console.error('Failed to update coupon:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Public: GET /api/coupons/active - Get all active, non-expired coupons
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: now },
    }).select('code discount expiryDate').lean();

    const normalized = (coupons || []).map((c) => ({
      code: String(c.code || ''),
      discount: Number(c.discount || 0),
      expiryDate: c.expiryDate ? new Date(c.expiryDate).toISOString().split('T')[0] : '',
    }));

    return res.json({ ok: true, data: normalized });
  } catch (e) {
    console.error('Failed to fetch active coupons:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// User: POST /api/coupons/validate - Validate and apply coupon
router.post('/validate', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code || !code.trim()) {
      return res.status(400).json({ ok: false, message: 'Coupon code is required' });
    }

    const userId = String(req.user._id);
    const coupon = await Coupon.findOne({
      code: String(code).toUpperCase().trim(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({ ok: false, message: 'Coupon not found or expired' });
    }

    // Check if already used by this user
    const alreadyUsed = Array.isArray(coupon.usedBy) && coupon.usedBy.some((u) => String(u.userId) === userId);
    if (alreadyUsed) {
      return res.status(400).json({ ok: false, message: 'You have already used this coupon' });
    }

    // Check if coupon has expired
    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ ok: false, message: 'Coupon has expired' });
    }

    return res.json({
      ok: true,
      data: {
        code: coupon.code,
        discount: coupon.discount,
      },
    });
  } catch (e) {
    console.error('Failed to validate coupon:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Apply coupon and mark as used
// Called during checkout
router.post('/apply', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code || !code.trim()) {
      return res.status(400).json({ ok: false, message: 'Coupon code is required' });
    }

    const userId = String(req.user._id);
    const coupon = await Coupon.findOne({
      code: String(code).toUpperCase().trim(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({ ok: false, message: 'Coupon not found' });
    }

    // Check if already used by this user
    const alreadyUsed = Array.isArray(coupon.usedBy) && coupon.usedBy.some((u) => String(u.userId) === userId);
    if (alreadyUsed) {
      return res.status(400).json({ ok: false, message: 'Coupon already used' });
    }

    // Check expiry
    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ ok: false, message: 'Coupon has expired' });
    }

    // Mark as used
    coupon.usedBy.push({ userId, usedAt: new Date() });
    await coupon.save();

    return res.json({ ok: true, message: 'Coupon applied successfully' });
  } catch (e) {
    console.error('Failed to apply coupon:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
