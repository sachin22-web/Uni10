const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    invoiceNo: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: () => new Date() },
    dueAt: { type: Date },
    status: { type: String, enum: ['draft', 'issued', 'paid', 'cancelled'], default: 'issued' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Invoice', InvoiceSchema);
