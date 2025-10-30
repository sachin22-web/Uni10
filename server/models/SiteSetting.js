const mongoose = require('mongoose');

const PaymentSettingsSchema = new mongoose.Schema(
  {
    upiQrImage: { type: String, default: '' },
    upiId: { type: String, default: '' },
    beneficiaryName: { type: String, default: '' },
    instructions: { type: String, default: 'Scan QR and pay. Enter UTR/Txn ID on next step.' },
  },
  { _id: false },
);

const RazorpaySettingsSchema = new mongoose.Schema(
  {
    keyId: { type: String, default: '' },
    keySecret: { type: String, default: '' },
    webhookSecret: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    isActive: { type: Boolean, default: false },
  },
  { _id: false },
);

const ShiprocketSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    email: { type: String, default: 'logistics@uni10.in' },
    password: { type: String, default: 'Test@1234' },
    apiKey: { type: String, default: 'ship_test_key_123456' },
    secret: { type: String, default: 'ship_test_secret_abcdef' },
    channelId: { type: String, default: 'TEST_CHANNEL_001' },
  },
  { _id: false },
);

const TickerItemSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    text: { type: String, required: true },
    url: { type: String, default: '' },
    startAt: { type: Date },
    endAt: { type: Date },
    priority: { type: Number, default: 0 },
  },
  { _id: false },
);

const FeatureRowSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    link: { type: String, required: true },
    imageAlt: { type: String, default: '' },
  },
  { _id: false },
);

const HomeSettingsSchema = new mongoose.Schema(
  {
    ticker: { type: [TickerItemSchema], default: [] },
    newArrivalsLimit: { type: Number, default: 20 },
    featureRows: { type: [FeatureRowSchema], default: [] },
  },
  { _id: false },
);

const SiteSettingSchema = new mongoose.Schema(
  {
    domain: { type: String, default: 'www.uni10.in' },
    business: {
      name: { type: String, default: 'UNI10' },
      logo: { type: String, default: '' },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      gstIn: { type: String, default: '' },
    },
    payment: { type: PaymentSettingsSchema, default: () => ({}) },
    razorpay: { type: RazorpaySettingsSchema, default: () => ({}) },
    shipping: {
      type: new mongoose.Schema(
        {
          shiprocket: { type: ShiprocketSettingsSchema, default: () => ({}) },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    // Contact settings for public Contact page
    contact: {
      phones: { type: [String], default: [] },
      emails: { type: [String], default: [] },
      address: {
        line1: { type: String, default: '' },
        line2: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
      },
      mapsUrl: { type: String, default: '' },
    },
    home: { type: HomeSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SiteSetting', SiteSettingSchema);
