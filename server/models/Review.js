const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    text: { type: String, required: true, minlength: 20, maxlength: 1000 },
    images: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending', index: true },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    approved: { type: Boolean, default: true },
    replies: {
      type: [new mongoose.Schema({
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);

ReviewSchema.index({ productId: 1, status: 1 });
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: false });
ReviewSchema.index({ userId: 1 });

module.exports = mongoose.model('Review', ReviewSchema);
