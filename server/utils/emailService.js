const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'a60196141@gmail.com',
    pass: process.env.GMAIL_PASSWORD || 'zgfm yfvq ahpe yujo',
  },
});

const logoUrl = 'https://cdn.builder.io/api/v1/image/assets%2F7b2b767a4d3c468b89c4e8bf7b4d65b2%2Fac8037fa93774a7ca523e332fb8612d3?format=webp&width=800';

function generateOrderConfirmationEmail(order, user) {
  const itemsList = order.items
    .map(
      (item) =>
        `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">${item.title}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">×${item.qty}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">₹${(item.price * item.qty).toLocaleString('en-IN')}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { width: 150px; margin-bottom: 10px; }
        .order-info { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .order-id { font-size: 18px; font-weight: bold; color: #d32f2f; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f0f0f0; padding: 12px; text-align: left; font-weight: bold; }
        .summary { margin: 20px 0; padding: 15px; background: #fff5f5; border-left: 4px solid #d32f2f; }
        .summary-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total { font-size: 20px; font-weight: bold; color: #d32f2f; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; }
        .btn { display: inline-block; background: #d32f2f; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="UNI10" class="logo" />
          <h1 style="color: #333; margin: 10px 0;">Order Confirmation</h1>
        </div>

        <p>Hi <strong>${user.name || user.fullName || 'Valued Customer'}</strong>,</p>
        <p>Thank you for placing your order with UNI10! We're thrilled to have you as a customer.</p>

        <div class="order-info">
          <div class="order-id">Order #${order._id.toString().substring(0, 8).toUpperCase()}</div>
          <p style="margin: 8px 0; font-size: 14px;">Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
          <p style="margin: 8px 0; font-size: 14px;">Status: <strong style="color: #d32f2f;">PLACED</strong></p>
        </div>

        <h3 style="margin-top: 20px;">Order Items:</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>₹${(order.subtotal || 0).toLocaleString('en-IN')}</span>
          </div>
          ${order.discount > 0 ? `<div class="summary-row"><span>Discount:</span><span>-₹${order.discount.toLocaleString('en-IN')}</span></div>` : ''}
          <div class="summary-row">
            <span>Shipping:</span>
            <span>₹${(order.shipping || 0).toLocaleString('en-IN')}</span>
          </div>
          <div class="summary-row total">
            <span>Total Amount:</span>
            <span>₹${(order.total || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <h3>Shipping Address:</h3>
        <p style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
          ${order.name}<br />
          ${order.address}${order.address ? '<br />' : ''}
          ${order.city}${order.city ? ', ' : ''}${order.state} ${order.pincode}<br />
          <strong>Phone:</strong> ${order.phone}
        </p>

        <h3>What's Next?</h3>
        <p>We'll send you an email update as soon as your order ships. You can track your delivery in the "My Orders" section on our website.</p>

        <center>
          <a href="https://www.uni10.in/my-orders" class="btn">Track Your Order</a>
        </center>

        <div class="footer">
          <p>UNI10 | CREATE YOUR IDENTITY</p>
          <p>Questions? Email us at support@uni10.in</p>
          <p>&copy; 2025 UNI10. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateStatusUpdateEmail(order, user, newStatus) {
  const statusMessages = {
    shipped: 'Your order is on the way! 🚚',
    delivered: 'Your order has been delivered! 📦',
  };

  const statusMessage = statusMessages[newStatus] || `Your order status has been updated to ${newStatus}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { width: 150px; margin-bottom: 10px; }
        .status-box { background: #f0f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #1976d2; margin: 20px 0; }
        .status-box h2 { color: #1976d2; margin: 0; }
        .order-detail { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="UNI10" class="logo" />
          <h1 style="color: #333; margin: 10px 0;">Order Update</h1>
        </div>

        <p>Hi <strong>${user.name || user.fullName || 'Valued Customer'}</strong>,</p>

        <div class="status-box">
          <h2>${statusMessage}</h2>
          <p style="margin: 10px 0;">Order #${order._id.toString().substring(0, 8).toUpperCase()}</p>
        </div>

        <div class="order-detail">
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
          <p><strong>Status:</strong> ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}</p>
          ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
        </div>

        <p>We'll notify you once your order reaches its final destination. Thank you for shopping with UNI10!</p>

        <div class="footer">
          <p>UNI10 | CREATE YOUR IDENTITY</p>
          <p>Questions? Email us at support@uni10.in</p>
          <p>&copy; 2025 UNI10. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateReturnApprovalEmail(order, user) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { width: 150px; margin-bottom: 10px; }
        .approval-box { background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0; }
        .approval-box h2 { color: #22c55e; margin: 0; }
        .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="UNI10" class="logo" />
          <h1 style="color: #333; margin: 10px 0;">Return Request Approved</h1>
        </div>

        <p>Hi <strong>${user.name || user.fullName || 'Valued Customer'}</strong>,</p>

        <div class="approval-box">
          <h2>✓ Your return request has been approved!</h2>
          <p style="margin: 10px 0;">Order #${order._id.toString().substring(0, 8).toUpperCase()}</p>
        </div>

        <div class="details">
          <p><strong>Return Reason:</strong> ${order.returnReason}</p>
          <p><strong>What's Next:</strong> We'll arrange a pickup from your address within 2-3 business days. Please keep your items ready for collection.</p>
        </div>

        <p>Once we receive and verify your return, we'll process a full refund to your original payment method within 5-7 business days.</p>

        <div class="footer">
          <p>UNI10 | CREATE YOUR IDENTITY</p>
          <p>Questions? Email us at support@uni10.in</p>
          <p>&copy; 2025 UNI10. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendOrderConfirmationEmail(order, user) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER || 'a60196141@gmail.com',
      to: user.email,
      subject: 'Order Placed Successfully - UNI10',
      html: generateOrderConfirmationEmail(order, user),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    return { ok: false, error: error.message };
  }
}

async function sendStatusUpdateEmail(order, user, newStatus) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER || 'a60196141@gmail.com',
      to: user.email,
      subject: `Order Status Update - UNI10 Order #${order._id.toString().substring(0, 8).toUpperCase()}`,
      html: generateStatusUpdateEmail(order, user, newStatus),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Status update email sent:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send status update email:', error);
    return { ok: false, error: error.message };
  }
}

async function sendReturnApprovalEmail(order, user) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER || 'a60196141@gmail.com',
      to: user.email,
      subject: `Return Approved - UNI10 Order #${order._id.toString().substring(0, 8).toUpperCase()}`,
      html: generateReturnApprovalEmail(order, user),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Return approval email sent:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send return approval email:', error);
    return { ok: false, error: error.message };
  }
}

async function sendCustomEmail(to, subject, html) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER || 'a60196141@gmail.com',
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Custom email sent:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send custom email:', error);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendOrderConfirmationEmail,
  sendStatusUpdateEmail,
  sendReturnApprovalEmail,
  sendCustomEmail,
};
