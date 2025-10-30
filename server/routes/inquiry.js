const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

router.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, subject, message, contact_method, source, submitted_at, hp } = req.body || {};

    if (hp) {
      return res.status(400).json({ ok: false, message: 'Spam detected' });
    }

    if (!name || !email || !phone || !subject || !message || !contact_method) {
      return res.status(400).json({ ok: false, message: 'All fields are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, message: 'Invalid email address' });
    }

    const phoneRegex = /^[\d\s+\-]{7,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ ok: false, message: 'Invalid phone number' });
    }

    const inquiryData = {
      name,
      email,
      phone,
      subject,
      message,
      contact_method,
      source: source || 'website-contact',
      submitted_at: submitted_at || new Date().toISOString(),
    };

    const adminEmail = process.env.GMAIL_USER;
    const htmlContent = `
      <h2>New Inquiry Received</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Preferred Contact Method:</strong> ${contact_method}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p><small>Submitted at: ${submitted_at}</small></p>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: adminEmail,
      replyTo: email,
      subject: `New Inquiry: ${subject}`,
      text: `New Inquiry\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nSubject: ${subject}\nPreferred Contact: ${contact_method}\n\nMessage:\n${message}`,
      html: htmlContent,
    });

    return res.json({ ok: true, data: inquiryData, message: 'Inquiry submitted successfully' });
  } catch (e) {
    console.error('Inquiry submission error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to submit inquiry' });
  }
});

module.exports = router;
