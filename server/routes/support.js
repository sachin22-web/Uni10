const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// User: Create a new support ticket
router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const { subject, message, orderId, productId, purchaseDate } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ ok: false, message: 'Subject and message are required' });
    }

    const ticket = await SupportTicket.create({
      userId: req.user._id,
      subject,
      message,
      orderId: orderId || undefined,
      productId: productId || undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
    });

    return res.json({ ok: true, data: ticket });
  } catch (e) {
    console.error('Support ticket creation error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to create ticket' });
  }
});

// User: Get my support tickets
router.get('/tickets/mine', requireAuth, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .populate('userId', 'name email phone')
      .populate('orderId')
      .populate('productId', 'title price image')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, data: tickets });
  } catch (e) {
    console.error('Get user tickets error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to fetch tickets' });
  }
});

// User: Get a specific ticket (owner only)
router.get('/tickets/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id)
      .populate('userId', 'name email phone')
      .populate('orderId')
      .populate('productId', 'title price image')
      .populate('replies.authorId', 'name email');

    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    if (String(ticket.userId._id) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    return res.json({ ok: true, data: ticket });
  } catch (e) {
    console.error('Get ticket error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to fetch ticket' });
  }
});

// User: Add reply to their ticket
router.post('/tickets/:id/reply', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ ok: false, message: 'Message is required' });
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    if (String(ticket.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    ticket.replies.push({
      authorId: req.user._id,
      message,
      createdAt: new Date(),
    });

    await ticket.save();
    const updated = await ticket.populate([
      { path: 'userId', select: 'name email phone' },
      { path: 'replies.authorId', select: 'name email' },
    ]);

    return res.json({ ok: true, data: updated });
  } catch (e) {
    console.error('Add reply error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to add reply' });
  }
});

// Admin: Get all support tickets with optional filters
router.get('/admin/tickets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let filter = {};

    if (status && ['open', 'pending', 'accepted', 'rejected', 'closed'].includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email phone')
      .populate('orderId', 'id status paymentMethod total')
      .populate('productId', 'title price image')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, data: tickets });
  } catch (e) {
    console.error('Get admin tickets error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to fetch tickets' });
  }
});

// Admin: Get a specific ticket with full details
router.get('/admin/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id)
      .populate('userId', 'name email phone address1 address2 city state pincode')
      .populate('orderId', 'id status paymentMethod total items')
      .populate('productId', 'title image price')
      .populate('replies.authorId', 'name email role')
      .lean();

    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    return res.json({ ok: true, data: ticket });
  } catch (e) {
    console.error('Get admin ticket error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to fetch ticket' });
  }
});

// Admin: Update ticket status
router.patch('/admin/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message } = req.body || {};

    if (status && !['open', 'pending', 'accepted', 'rejected', 'closed'].includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status' });
    }

    const updates = {};
    if (status) updates.status = status;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    if (message) {
      ticket.replies.push({
        authorId: req.user._id,
        message,
        createdAt: new Date(),
      });
    }

    if (status) {
      ticket.status = status;
    }

    await ticket.save();
    const updated = await ticket.populate([
      { path: 'userId', select: 'name email phone' },
      { path: 'orderId' },
      { path: 'productId', select: 'title image price' },
      { path: 'replies.authorId', select: 'name email role' },
    ]);

    return res.json({ ok: true, data: updated });
  } catch (e) {
    console.error('Update ticket error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to update ticket' });
  }
});

module.exports = router;
