const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authOptional, requireAuth } = require('../middleware/auth');
const { sendOrderConfirmationEmail } = require('../utils/emailService');

// Helper function to get Razorpay instance
const getRazorpayInstance = async () => {
  const SiteSetting = require('../models/SiteSetting');
  const settings = await SiteSetting.findOne();
  const razorpayConfig = settings?.razorpay || {};

  // Use environment variables as primary source, database as fallback
  const keyId = process.env.RAZORPAY_KEY_ID || razorpayConfig.keyId;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || razorpayConfig.keySecret;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Please contact support.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// Create Razorpay order
router.post('/create-order', authOptional, async (req, res) => {
  try {
    const { amount, currency, items, appliedCoupon } = req.body || {};

    // Validate amount (expect amount in rupees from frontend)
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ ok: false, message: 'Invalid amount provided' });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'No items in order' });
    }

    // Get Razorpay instance and credentials upfront
    let rzp;
    try {
      rzp = await getRazorpayInstance();
    } catch (credError) {
      console.error('Razorpay configuration error:', credError.message);
      return res.status(500).json({
        ok: false,
        message: 'Razorpay keys not configured.',
      });
    }

    // Convert rupees to paise as required by Razorpay
    const amountInPaise = Math.round(parsedAmount * 100);
    if (amountInPaise <= 0) {
      return res.status(400).json({ ok: false, message: 'Amount must be greater than zero' });
    }

    // Create Razorpay order (provider expects amount in paise)
    let razorpayOrder;
    try {
      razorpayOrder = await rzp.orders.create({
        amount: amountInPaise,
        currency: currency || 'INR',
        receipt: `order_${Date.now()}`,
        notes: {
          items: Array.isArray(items) ? items.map(i => `${i.title} x${i.qty}`).join(', ') : '',
          appliedCoupon: appliedCoupon?.code || 'none',
        },
      });
    } catch (orderError) {
      console.error('Failed to create Razorpay order:', orderError?.message || orderError);
      return res.status(502).json({
        ok: false,
        message: 'Failed to create order with payment provider',
      });
    }

    // Validate Razorpay order response
    if (!razorpayOrder || !razorpayOrder.id) {
      console.error('Invalid Razorpay order response:', razorpayOrder);
      return res.status(502).json({
        ok: false,
        message: 'Invalid response from payment provider',
      });
    }

    // Get keyId for frontend (we already verified it exists via getRazorpayInstance)
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      console.error('Razorpay Key ID not available');
      return res.status(500).json({
        ok: false,
        message: 'Razorpay keys not configured.',
      });
    }

    // Return full order object details expected by frontend
    return res.json({
      ok: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || 'INR',
        keyId: keyId,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Failed to create order',
    });
  }
});

// Verify Razorpay payment and create order
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, items, appliedCoupon, total, name, phone, address, city, state, pincode } = req.body || {};

    // Validate required payment details
    if (!razorpayOrderId || typeof razorpayOrderId !== 'string' || !razorpayOrderId.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'Missing or invalid Razorpay order ID',
      });
    }

    if (!razorpayPaymentId || typeof razorpayPaymentId !== 'string' || !razorpayPaymentId.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'Missing or invalid Razorpay payment ID',
      });
    }

    if (!razorpaySignature || typeof razorpaySignature !== 'string' || !razorpaySignature.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'Missing or invalid payment signature',
      });
    }

    // Get Razorpay credentials
    let keySecret;
    try {
      await getRazorpayInstance(); // Verify credentials are configured
      keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error('Key secret not found');
      }
    } catch (credError) {
      console.error('Razorpay configuration error:', credError.message);
      return res.status(500).json({
        ok: false,
        message: 'Payment verification system not configured',
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid payment signature',
      });
    }

    // If order details provided, create the order
    if (items && Array.isArray(items) && items.length > 0) {
      // Validate delivery details
      if (!city || typeof city !== 'string' || !city.trim()) {
        return res.status(400).json({
          ok: false,
          message: 'City is required',
        });
      }

      if (!state || typeof state !== 'string' || !state.trim()) {
        return res.status(400).json({
          ok: false,
          message: 'State is required',
        });
      }

      if (!pincode || typeof pincode !== 'string') {
        return res.status(400).json({
          ok: false,
          message: 'Pincode is required',
        });
      }

      const pinOk = /^\d{4,8}$/.test(String(pincode).trim());
      if (!pinOk) {
        return res.status(400).json({
          ok: false,
          message: 'Pincode must be between 4-8 digits',
        });
      }

      // Decrement inventory for each item
      for (const item of items) {
        if (item.id || item.productId) {
          const productId = item.id || item.productId;
          const product = await Product.findById(productId);
          if (product) {
            if (product.trackInventoryBySize && item.size && Array.isArray(product.sizeInventory)) {
              const sizeIdx = product.sizeInventory.findIndex(s => s.code === item.size);
              if (sizeIdx !== -1) {
                const currentQty = product.sizeInventory[sizeIdx].qty;
                const requestedQty = Number(item.qty || 1);

                if (currentQty < requestedQty) {
                  return res.status(409).json({
                    ok: false,
                    message: `Insufficient stock for ${product.title} size ${item.size}`,
                    itemId: item.id || item.productId,
                    availableQty: currentQty,
                  });
                }

                product.sizeInventory[sizeIdx].qty -= requestedQty;
                await product.save();
              }
            } else if (!product.trackInventoryBySize) {
              const currentStock = product.stock || 0;
              const requestedQty = Number(item.qty || 1);
              if (currentStock < requestedQty) {
                return res.status(409).json({
                  ok: false,
                  message: `Insufficient stock for ${product.title}`,
                  itemId: item.id || item.productId,
                  availableQty: currentStock,
                });
              }
              product.stock -= requestedQty;
              await product.save();
            }
          }
        }
      }

      // Create order with paid status
      const order = new Order({
        userId: req.user._id,
        name: name || req.user.name,
        phone: phone || req.user.phone,
        address: address || req.user.address1,
        city: city || req.user.city,
        state: state || req.user.state,
        pincode: pincode || req.user.pincode,
        paymentMethod: 'Razorpay',
        items,
        total: total || 0,
        status: 'paid',
      });

      await order.save();

      // Send confirmation email
      const User = require('../models/User');
      const user = await User.findById(req.user._id);
      if (user && user.email) {
        await sendOrderConfirmationEmail(order, user).catch(err => {
          console.error('Failed to send confirmation email:', err);
        });
      }

      return res.json({
        ok: true,
        message: 'Payment verified successfully',
        data: {
          order,
          razorpayPaymentId,
          razorpayOrderId,
        },
      });
    }

    // If no order details, just verify the payment
    return res.json({
      ok: true,
      message: 'Payment verified successfully',
      data: {
        razorpayPaymentId,
        razorpayOrderId,
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Payment verification failed',
    });
  }
});

// Manual UPI payment submission
router.post('/manual', requireAuth, async (req, res) => {
  try {
    const { transactionId, amount, paymentMethod, items, appliedCoupon, name, phone, address, city, state, pincode } = req.body || {};

    // Validate transaction ID
    if (!transactionId || typeof transactionId !== 'string' || !transactionId.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'Valid transaction ID is required',
      });
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'Valid amount is required',
      });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'No items in order',
      });
    }

    // Validate delivery details
    if (!city || typeof city !== 'string' || !city.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'City is required',
      });
    }

    if (!state || typeof state !== 'string' || !state.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'State is required',
      });
    }

    if (!pincode || typeof pincode !== 'string') {
      return res.status(400).json({
        ok: false,
        message: 'Pincode is required',
      });
    }

    const pinOk = /^\d{4,8}$/.test(String(pincode).trim());
    if (!pinOk) {
      return res.status(400).json({
        ok: false,
        message: 'Pincode must be between 4-8 digits',
      });
    }

    // Decrement inventory for each item
    for (const item of items) {
      if (item.id || item.productId) {
        const productId = item.id || item.productId;
        const product = await Product.findById(productId);
        if (product) {
          if (product.trackInventoryBySize && item.size && Array.isArray(product.sizeInventory)) {
            const sizeIdx = product.sizeInventory.findIndex(s => s.code === item.size);
            if (sizeIdx !== -1) {
              const currentQty = product.sizeInventory[sizeIdx].qty;
              const requestedQty = Number(item.qty || 1);

              if (currentQty < requestedQty) {
                return res.status(409).json({
                  ok: false,
                  message: `Insufficient stock for ${product.title} size ${item.size}`,
                  itemId: item.id || item.productId,
                  availableQty: currentQty,
                });
              }

              product.sizeInventory[sizeIdx].qty -= requestedQty;
              await product.save();
            }
          } else if (!product.trackInventoryBySize) {
            const currentStock = product.stock || 0;
            const requestedQty = Number(item.qty || 1);
            if (currentStock < requestedQty) {
              return res.status(409).json({
                ok: false,
                message: `Insufficient stock for ${product.title}`,
                itemId: item.id || item.productId,
                availableQty: currentStock,
              });
            }
            product.stock -= requestedQty;
            await product.save();
          }
        }
      }
    }

    // Create order with pending status
    const order = new Order({
      userId: req.user._id,
      name: name || req.user.name,
      phone: phone || req.user.phone,
      address: address || req.user.address1,
      city: city || req.user.city,
      state: state || req.user.state,
      pincode: pincode || req.user.pincode,
      paymentMethod: paymentMethod || 'UPI',
      items,
      total: amount,
      status: 'pending',
      upi: {
        txnId: transactionId.trim(),
        payerName: req.user.name || '',
      },
    });

    await order.save();

    // Send confirmation email
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (user && user.email) {
      await sendOrderConfirmationEmail(order, user).catch(err => {
        console.error('Failed to send confirmation email:', err);
      });
    }

    return res.json({
      ok: true,
      data: order,
      message: 'Order created successfully. Your payment is pending verification.',
    });
  } catch (error) {
    console.error('Manual payment error:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Failed to process payment',
    });
  }
});

module.exports = router;
