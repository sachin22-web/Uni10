const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Sanitize review text
function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Get reviews for a product with pagination
router.get('/', async (req, res) => {
  try {
    const { productId, status = 'published', page = 1, limit = 10 } = req.query;
    if (!productId) return res.status(400).json({ ok: false, message: 'Missing productId' });

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const query = { productId, status };
    const total = await Review.countDocuments(query);
    const docs = await Review.find(query)
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.json({
      ok: true,
      data: docs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Create or update review (idempotent)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { productId, orderId, text, images = [] } = req.body || {};

    if (!productId || !text) {
      return res.status(400).json({ ok: false, message: 'Missing productId or text' });
    }

    if (text.length < 20 || text.length > 1000) {
      return res.status(400).json({ ok: false, message: 'Review text must be 20-1000 characters' });
    }

    if (!Array.isArray(images) || images.length > 3) {
      return res.status(400).json({ ok: false, message: 'Maximum 3 images allowed' });
    }

    const existingReview = await Review.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      userId: req.user._id,
    });

    const sanitized = sanitizeText(text);
    const reviewData = {
      productId,
      userId: req.user._id,
      text: sanitized,
      images: images.filter(img => typeof img === 'string' && img.trim().length > 0),
      status: 'published',
    };

    if (orderId) {
      reviewData.orderId = orderId;
    }

    let doc;
    if (existingReview) {
      doc = await Review.findByIdAndUpdate(existingReview._id, reviewData, { new: true }).populate('userId', 'name').lean();
    } else {
      doc = await Review.create(reviewData);
      await Review.populate(doc, { path: 'userId', select: 'name' });
    }

    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Update review (PATCH for idempotent updates)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, images } = req.body || {};

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ ok: false, message: 'Review not found' });

    if (String(review.userId) !== String(req.user._id)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (text) {
      if (text.length < 20 || text.length > 1000) {
        return res.status(400).json({ ok: false, message: 'Review text must be 20-1000 characters' });
      }
      review.text = sanitizeText(text);
    }

    if (Array.isArray(images)) {
      if (images.length > 3) {
        return res.status(400).json({ ok: false, message: 'Maximum 3 images allowed' });
      }
      review.images = images.filter(img => typeof img === 'string' && img.trim().length > 0);
    }

    await review.save();
    await review.populate('userId', 'name');

    return res.json({ ok: true, data: review.toObject() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: list reviews with filtering
router.get('/admin/reviews', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (status && ['pending', 'published', 'rejected'].includes(status)) {
      query.status = status;
    }

    const total = await Review.countDocuments(query);
    const docs = await Review.find(query)
      .populate('userId', 'name email')
      .populate('productId', 'title')
      .populate('replies.authorId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.json({
      ok: true,
      data: docs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: update review status
router.patch('/admin/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !['pending', 'published', 'rejected'].includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status' });
    }

    const doc = await Review.findByIdAndUpdate(id, { status }, { new: true })
      .populate('userId', 'name email')
      .populate('productId', 'title')
      .lean();

    if (!doc) return res.status(404).json({ ok: false, message: 'Review not found' });

    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: approve/unapprove (legacy support)
router.put('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body || {};
    const doc = await Review.findByIdAndUpdate(id, { approved: !!approved }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: delete review
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Review.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: reply to a review
router.post('/admin/reviews/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reviewId, text } = req.body || {};
    if (!reviewId || !text || !String(text).trim()) {
      return res.status(400).json({ ok: false, message: 'reviewId and text are required' });
    }

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ ok: false, message: 'Review not found' });

    const reply = { authorId: req.user._id, text: sanitizeText(String(text).slice(0, 2000)), createdAt: new Date() };
    review.replies = Array.isArray(review.replies) ? review.replies : [];
    review.replies.push(reply);
    await review.save();

    const updated = await Review.findById(review._id)
      .populate('userId', 'name email')
      .populate('replies.authorId', 'name email role')
      .lean();

    return res.json({ ok: true, data: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
