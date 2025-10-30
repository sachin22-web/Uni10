const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const SiteSetting = require('../models/SiteSetting');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const Page = require('../models/Page');
const slugify = require('slugify');

// GET /api/admin/stats/overview?range=7d|30d|90d
router.get('/stats/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const range = String(req.query.range || '30d').toLowerCase();
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    // Totals
    const [totalRevenueAgg, totalOrders, totalUsers] = await Promise.all([
      Order.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } }]),
      Order.countDocuments(),
      User.countDocuments(),
    ]);
    const totals = {
      revenue: (totalRevenueAgg[0]?.total || 0),
      orders: totalOrders || 0,
      users: totalUsers || 0,
    };

    // Last month and previous month comparisons (calendar months)
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 1);
    const prevMonthEnd = new Date(firstOfLastMonth.getTime() - 1);

    const [lastMonthAgg, prevMonthAgg, lastMonthOrdersCount, prevMonthOrdersCount] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: firstOfLastMonth, $lte: lastMonthEnd } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: firstOfPrevMonth, $lte: prevMonthEnd } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$total', 0] } } } },
      ]),
      Order.countDocuments({ createdAt: { $gte: firstOfLastMonth, $lte: lastMonthEnd } }),
      Order.countDocuments({ createdAt: { $gte: firstOfPrevMonth, $lte: prevMonthEnd } }),
    ]);

    const lastMonth = { revenue: lastMonthAgg[0]?.total || 0, orders: lastMonthOrdersCount || 0 };
    const prevMonth = { revenue: prevMonthAgg[0]?.total || 0, orders: prevMonthOrdersCount || 0 };

    // Series for selected range (daily revenue and orders)
    const seriesAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: { $ifNull: ['$total', 0] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing dates with zeros
    const fillSeries = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      const found = seriesAgg.find((d) => d._id === key);
      fillSeries.push({ date: key, revenue: found?.revenue || 0, orders: found?.orders || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return res.json({ ok: true, data: { totals, lastMonth, prevMonth, series: fillSeries } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// GET /api/admin/orders/:id -> enriched order detail
router.get('/orders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Order.findById(id).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });

    const address = String(doc.address || '');

    function deriveFromAddress(addr) {
      try {
        const a = String(addr || '');
        const pinMatch = a.match(/(\d{6})(?!.*\d)/);
        const pincode = pinMatch ? pinMatch[1] : '';
        const cleaned = pinMatch ? a.replace(pinMatch[1], '') : a;
        const parts = cleaned.split(/,|\n/).map((s) => s.trim()).filter(Boolean);
        const city = parts.length ? parts[parts.length - 1].replace(/[^A-Za-z\s]/g, '').trim() : '';
        return { city, pincode };
      } catch {
        return { city: '', pincode: '' };
      }
    }

    const derived = deriveFromAddress(address);

    const detail = {
      id: String(doc._id),
      createdAt: doc.createdAt,
      status: doc.status,
      paymentMethod: doc.paymentMethod,
      totals: { total: Number(doc.total || 0) },
      shipping: {
        name: doc.name || '',
        phone: doc.phone || '',
        address1: address,
        address2: '',
        city: doc.city || derived.city || '',
        state: (doc.state && String(doc.state).trim()) ? doc.state : '',
        pincode: (doc.pincode && String(doc.pincode).trim()) ? doc.pincode : derived.pincode || '',
      },
      items: Array.isArray(doc.items)
        ? doc.items.map((it) => ({
            productId: it.id || it.productId || '',
            title: it.title || it.name || 'Item',
            image: it.image || '',
            price: Number(it.price || 0),
            qty: Number(it.qty || 0),
            variant: it.variant || null,
          }))
        : [],
    };

    return res.json({ ok: true, data: detail });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// POST /api/admin/invoices/generate - Generate invoice for an order
router.post('/invoices/generate', requireAuth, requireAdmin, async (req, res) => {
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

// PATCH /api/admin/settings/home - replace the ticker array
router.patch('/settings/home', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.ticker) ? body.ticker : [];

    const sanitized = incoming
      .filter((x) => x && typeof x.text === 'string' && x.text.trim().length > 0)
      .map((x, idx) => {
        const out = {
          id: String(x.id || `t_${Date.now()}_${idx}`),
          text: String(x.text).trim(),
          url: typeof x.url === 'string' ? x.url.trim() : '',
          startAt: undefined,
          endAt: undefined,
          priority: Number(x.priority || 0),
        };
        if (x.startAt) {
          const d = new Date(x.startAt);
          if (!isNaN(d.getTime())) out.startAt = d;
        }
        if (x.endAt) {
          const d2 = new Date(x.endAt);
          if (!isNaN(d2.getTime())) out.endAt = d2;
        }
        return out;
      });

    const set = { 'home.ticker': sanitized };

    const nLimit = Number(body.newArrivalsLimit);
    if (!Number.isNaN(nLimit) && nLimit > 0) {
      set['home.newArrivalsLimit'] = Math.min(100, Math.floor(nLimit));
    }

    const doc = await SiteSetting.findOneAndUpdate({}, { $set: set }, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    const home = (doc.home || {});
    const items = Array.isArray(home.ticker) ? home.ticker.map((it) => ({
      id: String(it.id || ''),
      text: String(it.text || ''),
      url: it.url ? String(it.url) : '',
      startAt: it.startAt || null,
      endAt: it.endAt || null,
      priority: Number(it.priority || 0),
    })) : [];

    return res.json({ ok: true, data: { ticker: items, updatedAt: doc.updatedAt } });
  } catch (e) {
    console.error('Failed to update home ticker', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// PATCH /api/admin/settings/contact - replace contact settings
router.patch('/settings/contact', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const set = {};

    if (body.phones && Array.isArray(body.phones)) {
      set['contact.phones'] = body.phones.map(String);
    }
    if (body.emails && Array.isArray(body.emails)) {
      set['contact.emails'] = body.emails.map(String);
    }
    if (body.address && typeof body.address === 'object') {
      const a = body.address;
      if (typeof a.line1 === 'string') set['contact.address.line1'] = a.line1.trim();
      if (typeof a.line2 === 'string') set['contact.address.line2'] = a.line2.trim();
      if (typeof a.city === 'string') set['contact.address.city'] = a.city.trim();
      if (typeof a.state === 'string') set['contact.address.state'] = a.state.trim();
      if (typeof a.pincode === 'string') set['contact.address.pincode'] = a.pincode.trim();
    }
    if (typeof body.mapsUrl === 'string') set['contact.mapsUrl'] = body.mapsUrl.trim();

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ ok: false, message: 'No valid fields supplied' });
    }

    const doc = await SiteSetting.findOneAndUpdate({}, { $set: set }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const out = doc.contact || {};
    return res.json({ ok: true, data: out });
  } catch (e) {
    console.error('Failed to update contact settings', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// POST /api/admin/notify - send admin notifications to selected users
router.post('/notify', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userIds, message, subject } = req.body || {};

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'userIds is required' });
    }
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ ok: false, message: 'message is required' });
    }

    const ids = userIds.map(String);
    const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
    const emails = Array.isArray(users) ? users.map((u) => u.email).filter(Boolean) : [];

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASSWORD;

    if (gmailUser && gmailPass && emails.length > 0) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: gmailUser,
        to: gmailUser,
        bcc: emails.join(', '),
        subject: (typeof subject === 'string' && subject.trim()) ? subject.trim() : 'Admin Notification',
        text: String(message),
        html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${String(message).replace(/\n/g, '<br>')}</div>`,
      });

      return res.json({ ok: true, data: { sent: emails.length, recipients: emails } });
    }

    console.log('Email not configured or no recipients. Simulating notification send.', {
      ids,
      emails,
      subject: (typeof subject === 'string' && subject.trim()) ? subject.trim() : 'Admin Notification',
      preview: String(message).slice(0, 200),
    });
    return res.json({ ok: true, data: { sent: 0, recipients: emails }, message: 'Simulated send (email not configured)' });
  } catch (e) {
    console.error('Notify error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to send notifications' });
  }
});

const Review = require('../models/Review');

// Admin: reply to user review (mirror endpoint for /api/admin)
router.post('/reviews/reply', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reviewId, text } = req.body || {};
    if (!reviewId || !text || !String(text).trim()) {
      return res.status(400).json({ ok: false, message: 'reviewId and text are required' });
    }
    const sanitize = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ ok: false, message: 'Review not found' });
    review.replies = Array.isArray(review.replies) ? review.replies : [];
    review.replies.push({ authorId: req.user._id, text: sanitize(String(text).slice(0,2000)), createdAt: new Date() });
    await review.save();
    const updated = await Review.findById(review._id).populate('userId','name email').populate('replies.authorId','name email role').lean();
    return res.json({ ok: true, data: updated });
  } catch (e) {
    console.error('Admin reply error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// ===== PAGES ROUTES =====

// Admin: GET /api/admin/pages/list - List all pages
router.get('/pages/list', requireAuth, requireAdmin, async (req, res) => {
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
router.post('/pages/create', requireAuth, requireAdmin, async (req, res) => {
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
router.patch('/pages/:id', requireAuth, requireAdmin, async (req, res) => {
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
router.delete('/pages/:id', requireAuth, requireAdmin, async (req, res) => {
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

// Billing Info endpoints
const BillingInfo = require('../models/BillingInfo');

// GET /api/admin/billing-info - Get company billing info
router.get('/billing-info', async (req, res) => {
  try {
    let billingInfo = await BillingInfo.findOne();
    if (!billingInfo) {
      billingInfo = await BillingInfo.create({
        companyName: 'UNI10',
        address: '',
        contactNumber: '',
        email: '',
        gstinNumber: '',
      });
    }
    return res.json({ ok: true, data: billingInfo });
  } catch (e) {
    console.error('Failed to fetch billing info:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// POST /api/admin/billing-info - Create or update company billing info
router.post('/billing-info', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { companyName, address, contactNumber, email, gstinNumber } = req.body || {};

    if (!companyName || !address || !contactNumber || !email || !gstinNumber) {
      return res.status(400).json({ ok: false, message: 'All fields are required' });
    }

    let billingInfo = await BillingInfo.findOne();
    if (!billingInfo) {
      billingInfo = await BillingInfo.create({
        companyName: String(companyName).trim(),
        address: String(address).trim(),
        contactNumber: String(contactNumber).trim(),
        email: String(email).trim(),
        gstinNumber: String(gstinNumber).trim(),
      });
    } else {
      billingInfo.companyName = String(companyName).trim();
      billingInfo.address = String(address).trim();
      billingInfo.contactNumber = String(contactNumber).trim();
      billingInfo.email = String(email).trim();
      billingInfo.gstinNumber = String(gstinNumber).trim();
      await billingInfo.save();
    }

    return res.json({ ok: true, data: billingInfo });
  } catch (e) {
    console.error('Failed to save billing info:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// PATCH /api/admin/billing-info - Update company billing info
router.patch('/billing-info', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { companyName, address, contactNumber, email, gstinNumber } = req.body || {};

    let billingInfo = await BillingInfo.findOne();
    if (!billingInfo) {
      billingInfo = await BillingInfo.create({
        companyName: companyName || 'UNI10',
        address: address || '',
        contactNumber: contactNumber || '',
        email: email || '',
        gstinNumber: gstinNumber || '',
      });
    } else {
      if (companyName !== undefined) billingInfo.companyName = String(companyName).trim();
      if (address !== undefined) billingInfo.address = String(address).trim();
      if (contactNumber !== undefined) billingInfo.contactNumber = String(contactNumber).trim();
      if (email !== undefined) billingInfo.email = String(email).trim();
      if (gstinNumber !== undefined) billingInfo.gstinNumber = String(gstinNumber).trim();
      await billingInfo.save();
    }

    return res.json({ ok: true, data: billingInfo });
  } catch (e) {
    console.error('Failed to update billing info:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
