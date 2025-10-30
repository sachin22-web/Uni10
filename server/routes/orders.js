const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { authOptional, requireAuth, requireAdmin } = require('../middleware/auth');
const { sendOrderConfirmationEmail, sendStatusUpdateEmail, sendReturnApprovalEmail, sendCustomEmail } = require('../utils/emailService');

const ALLOWED_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'returned', 'cancelled'];

// ========== POST ROUTES (must come before GET /:id) ==========

// Create order
router.post('/', authOptional, async (req, res) => {
  try {
    const body = req.body || {};

    const name = body.name || body.customer?.name || '';
    const phone = body.phone || body.customer?.phone || '';
    const address = body.address || body.customer?.address || '';
    const city = body.city || body.customer?.city || '';
    const state = body.state || body.customer?.state || '';
    const pincode = body.pincode || body.customer?.pincode || '';
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, message: 'No items' });

    if (!city || !state || !pincode) return res.status(400).json({ ok: false, message: 'City, state and pincode are required' });
    const pinOk = /^\d{4,8}$/.test(String(pincode));
    if (!pinOk) return res.status(400).json({ ok: false, message: 'Invalid pincode' });

    // compute total server-side if not supplied or invalid
    const computed = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0);
    const total = typeof body.total === 'number' && body.total > 0 ? body.total : computed;

    const paymentMethod = (body.paymentMethod || body.payment || 'COD').toString();

    let status = 'pending';
    if (typeof body.status === 'string' && ALLOWED_STATUSES.includes(body.status)) {
      status = body.status;
    }

    const upi = (paymentMethod === 'UPI' && body.upi && typeof body.upi === 'object')
      ? { payerName: body.upi.payerName || '', txnId: body.upi.txnId || '' }
      : undefined;

    // Decrement inventory for each item with per-size tracking
    const Product = require('../models/Product');
    for (const item of items) {
      if (item.id || item.productId) {
        const productId = item.id || item.productId;
        const product = await Product.findById(productId);
        if (product) {
          // If the product has per-size inventory and the item has a size
          if (product.trackInventoryBySize && item.size && Array.isArray(product.sizeInventory)) {
            const sizeIdx = product.sizeInventory.findIndex(s => s.code === item.size);
            if (sizeIdx !== -1) {
              const currentQty = product.sizeInventory[sizeIdx].qty;
              const requestedQty = Number(item.qty || 1);

              // Check if enough stock
              if (currentQty < requestedQty) {
                return res.status(409).json({
                  ok: false,
                  message: `Insufficient stock for ${product.title} size ${item.size}`,
                  itemId: item.id || item.productId,
                  availableQty: currentQty
                });
              }

              // Decrement the size inventory
              product.sizeInventory[sizeIdx].qty -= requestedQty;
              await product.save();
            }
          } else if (!product.trackInventoryBySize) {
            // Decrement general stock
            const currentStock = product.stock || 0;
            const requestedQty = Number(item.qty || 1);
            if (currentStock < requestedQty) {
              return res.status(409).json({
                ok: false,
                message: `Insufficient stock for ${product.title}`,
                itemId: item.id || item.productId,
                availableQty: currentStock
              });
            }
            product.stock -= requestedQty;
            await product.save();
          }
        }
      }
    }

    const doc = new Order({
      userId: req.user ? req.user._id : undefined,
      name,
      phone,
      address,
      paymentMethod,
      address,
      city,
      state,
      pincode,
      items,
      total,
      status,
      upi,
    });

    await doc.save();
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Send custom email
router.post('/send-mail', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({ ok: false, message: 'Missing required fields: to, subject, html' });
    }

    const result = await sendCustomEmail(to, subject, html);

    if (result.ok) {
      return res.json({ ok: true, message: 'Email sent', messageId: result.messageId });
    } else {
      return res.status(500).json({ ok: false, message: result.error });
    }
  } catch (e) {
    console.error('Send mail error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to send email' });
  }
});

// Request return (by body)
router.post('/request-return', requireAuth, async (req, res) => {
  try {
    const { orderId, reason, upiId, photoUrl } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, message: 'Missing orderId' });
    if (!reason || !reason.trim()) return res.status(400).json({ ok: false, message: 'Return reason is required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ ok: false, message: 'Forbidden' });

    const deliveredAt = order.deliveredAt || (order.status === 'delivered' ? order.updatedAt : null);
    if (!deliveredAt || order.status !== 'delivered') {
      return res.status(400).json({ ok: false, message: 'Return can only be requested for delivered orders' });
    }
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(deliveredAt).getTime() > ms7d) {
      return res.status(400).json({ ok: false, message: 'Return period expired.' });
    }

    order.returnReason = reason.trim();
    order.refundUpiId = typeof upiId === 'string' ? upiId.trim() : '';
    order.returnPhoto = typeof photoUrl === 'string' ? photoUrl.trim() : '';
    order.returnRequestedAt = new Date();
    order.returnStatus = 'Pending';
    await order.save();

    return res.json({ ok: true, data: order, message: 'Return request submitted' });
  } catch (e) {
    console.error('Request return (body) error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to submit return request' });
  }
});

// ========== GET ROUTES WITH SPECIFIC PATHS (must come before GET /:id) ==========

// List orders for current user (mine=1) or admin all
router.get('/', authOptional, async (req, res) => {
  try {
    const { mine } = req.query;
    if (mine && String(mine) === '1') {
      if (!req.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
      const docs = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, data: docs });
    }

    // admin list
    if (!req.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Forbidden' });
    const docs = await Order.find().sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get user's orders
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const docs = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin: list return requests
router.get('/returns', requireAuth, requireAdmin, async (req, res) => {
  try {
    const docs = await Order.find({ returnStatus: { $in: ['Pending', 'Approved', 'Rejected'] } })
      .populate('userId')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error('List returns error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// User: list my return requests
router.get('/mine-returns', requireAuth, async (req, res) => {
  try {
    const docs = await Order.find({ userId: req.user._id, returnStatus: { $in: ['Pending', 'Approved', 'Rejected'] } })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ ok: true, data: docs });
  } catch (e) {
    console.error('List my returns error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// ========== GET/PUT/POST ROUTES WITH /:id (can come before generic GET /:id) ==========

// Get one order (owner or admin)
router.get('/:id', authOptional, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Order.findById(id).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    if (req.user && (String(req.user._id) === String(doc.userId) || req.user.role === 'admin')) {
      return res.json({ ok: true, data: doc });
    }
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Update status (admin only)
router.put('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ ok: false, message: 'Missing status' });
    if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'Invalid status' });
    const doc = await Order.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Alternate update route to support Admin UI (PUT /api/orders/:id { status })
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body || {};
    if (!status) return res.status(400).json({ ok: false, message: 'Missing status' });
    // Map common aliases from UI
    const map = { processing: 'paid', completed: 'delivered' };
    status = map[status] || status;
    if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ ok: false, message: 'Invalid status' });
    const doc = await Order.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    return res.json({ ok: true, data: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Cancel order (user or admin)
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    // Check authorization: user can cancel their own order, admin can cancel any
    if (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Can only cancel if status is pending, cod_pending, or pending_verification
    const cancellableStatuses = ['pending', 'cod_pending', 'pending_verification'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ ok: false, message: 'Order cannot be cancelled in current status' });
    }

    order.status = 'cancelled';
    if (reason) order.cancellationReason = reason;
    await order.save();

    return res.json({ ok: true, data: order });
  } catch (e) {
    console.error('Cancel order error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to cancel order' });
  }
});

// Send order confirmation email
router.post('/:id/email', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('userId');

    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    // Check authorization
    if (String(order.userId._id) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const user = order.userId;
    const result = await sendOrderConfirmationEmail(order, user);

    if (result.ok) {
      return res.json({ ok: true, message: 'Confirmation email sent', messageId: result.messageId });
    } else {
      return res.status(500).json({ ok: false, message: result.error });
    }
  } catch (e) {
    console.error('Send email error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to send email' });
  }
});

// Request return (by URL)
router.post('/:id/request-return', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, upiId, photoUrl } = req.body || {};

    if (!reason || !reason.trim()) {
      return res.status(400).json({ ok: false, message: 'Return reason is required' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    // Check authorization
    if (String(order.userId) !== String(req.user._id)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Must be delivered and within 7 days of delivery
    const deliveredAt = order.deliveredAt || (order.status === 'delivered' ? order.updatedAt : null);
    if (!deliveredAt || order.status !== 'delivered') {
      return res.status(400).json({ ok: false, message: 'Return can only be requested for delivered orders' });
    }
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(deliveredAt).getTime() > ms7d) {
      return res.status(400).json({ ok: false, message: 'Return period expired.' });
    }

    order.returnReason = reason.trim();
    order.refundUpiId = typeof upiId === 'string' ? upiId.trim() : '';
    order.returnPhoto = typeof photoUrl === 'string' ? photoUrl.trim() : '';
    order.returnRequestedAt = new Date();
    order.returnStatus = 'Pending';
    await order.save();

    return res.json({ ok: true, data: order, message: 'Return request submitted' });
  } catch (e) {
    console.error('Request return error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to submit return request' });
  }
});

// Admin: Update order (status, tracking number, return approval)
router.put('/:id/admin-update', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, returnStatus } = req.body || {};

    const order = await Order.findById(id).populate('userId');
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    const previousStatus = order.status;

    // Update status if provided
    if (status && ALLOWED_STATUSES.includes(status)) {
      order.status = status;
      if (status === 'delivered') {
        order.deliveredAt = new Date();
      }
    }

    // Update tracking number if provided
    if (trackingNumber) {
      order.trackingNumber = trackingNumber.trim();
    }

    // Update return status if provided
    if (returnStatus && ['None', 'Pending', 'Approved', 'Rejected'].includes(returnStatus)) {
      order.returnStatus = returnStatus;
      if (returnStatus === 'Approved') {
        order.status = 'returned';
      }
    }

    await order.save();

    // Send email on status change
    if (status && status !== previousStatus && order.userId && order.userId.email) {
      const user = order.userId;
      if (status === 'shipped' || status === 'delivered') {
        await sendStatusUpdateEmail(order, user, status);
      }
    }

    // Send email on return approval
    if (returnStatus === 'Approved' && order.returnStatus === 'Approved' && order.userId && order.userId.email) {
      const user = order.userId;
      await sendReturnApprovalEmail(order, user);
    }

    return res.json({ ok: true, data: order, message: 'Order updated successfully' });
  } catch (e) {
    console.error('Admin update order error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to update order' });
  }
});

module.exports = router;
