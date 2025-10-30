const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const SiteSetting = require('../models/SiteSetting');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Generate invoice for an order (idempotent, admin only)
router.post('/generate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, message: 'Missing orderId' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // Check if invoice already exists (idempotent)
    let invoice = await Invoice.findOne({ orderId });
    if (invoice) {
      return res.json({ ok: true, data: { invoiceId: invoice._id.toString(), invoiceNo: invoice.invoiceNo } });
    }

    // Generate invoice number: INV-YYYYMMDD-0001 (or next available)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await Invoice.countDocuments({
      createdAt: {
        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      },
    });
    const invoiceNo = `INV-${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

    // Create invoice
    invoice = new Invoice({
      orderId,
      invoiceNo,
      issuedAt: new Date(),
      status: 'issued',
    });
    await invoice.save();

    // Link invoice to order
    order.invoiceId = invoice._id;
    await order.save();

    return res.json({ ok: true, data: { invoiceId: invoice._id.toString(), invoiceNo: invoice.invoiceNo } });
  } catch (e) {
    console.error('Generate invoice error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get invoice by order ID (user or admin)
router.get('/by-order/:orderId', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // Check authorization
    if (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const invoice = await Invoice.findOne({ orderId }).lean();
    if (!invoice) return res.status(404).json({ ok: false, message: 'Invoice not found' });

    return res.json({ ok: true, data: invoice });
  } catch (e) {
    console.error('Get invoice by order error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get invoice detail (user or admin)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) return res.status(404).json({ ok: false, message: 'Invoice not found' });

    const order = await Order.findById(invoice.orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // Check authorization
    if (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    return res.json({ ok: true, data: invoice });
  } catch (e) {
    console.error('Get invoice error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
