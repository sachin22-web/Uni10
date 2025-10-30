const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const { requireAuth } = require('../middleware/auth');

// List current user's wishlist
router.get('/', requireAuth, async (req, res) => {
  try {
    const docs = await Wishlist.find({ userId: req.user._id }).lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Add
router.post('/', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ ok: false, message: 'Missing productId' });
    const doc = await Wishlist.findOneAndUpdate(
      { userId: req.user._id, productId },
      { userId: req.user._id, productId },
      { upsert: true, new: true },
    ).lean();
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Remove
router.delete('/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    await Wishlist.findOneAndDelete({ userId: req.user._id, productId });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
