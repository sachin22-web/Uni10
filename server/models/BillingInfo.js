const mongoose = require('mongoose');

const BillingInfoSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, default: 'UNI10' },
    address: { type: String, required: true, default: '' },
    contactNumber: { type: String, required: true, default: '' },
    email: { type: String, required: true, default: '' },
    gstinNumber: { type: String, required: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BillingInfo', BillingInfoSchema);
