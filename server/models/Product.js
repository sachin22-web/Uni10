const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    price: { type: Number, required: true },
    images: { type: [String], default: [] },
    image_url: { type: String },
    description: { type: String },
    longDescription: { type: String },
    highlights: { type: [String], default: [] },
    specs: { type: [{ key: String, value: String }], default: [] },
    category: { type: String },
    stock: { type: Number, default: 0 },
    attributes: { type: Object, default: {} },
    sizes: { type: [String], default: [] },
    trackInventoryBySize: { type: Boolean, default: true },
    sizeInventory: {
      type: [
        {
          code: { type: String },
          label: { type: String },
          qty: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    sizeChartUrl: { type: String },
    sizeChartTitle: { type: String },
    sizeChart: {
      type: {
        title: { type: String },
        rows: [
          {
            sizeLabel: { type: String },
            chest: { type: String },
            brandSize: { type: String }
          }
        ],
        guidelines: { type: String },
        diagramUrl: { type: String }
      },
      default: null
    },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ProductSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  if (!this.image_url && this.images && this.images.length) {
    this.image_url = this.images[0];
  }
  next();
});

// Helpful indexes for search/filter
ProductSchema.index({ title: 'text' });
ProductSchema.index({ category: 1, active: 1 });

module.exports = mongoose.model('Product', ProductSchema);
