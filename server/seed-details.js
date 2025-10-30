const mongoose = require('mongoose');
require('dotenv').config();

const ProductSchema = new mongoose.Schema({
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
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

async function seedDetails() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb+srv://UNI10:SACHIN123@uni10.kqsmgmt.mongodb.net/UNI10';
    await mongoose.connect(uri, { dbName: 'UNI10' });
    console.log('Connected to MongoDB');
    
    const result = await Product.updateMany(
      { highlights: { $exists: false } },
      {
        $set: {
          longDescription: 'Premium quality product crafted with attention to detail. This item features high-quality materials and expert craftsmanship. Perfect for everyday wear or special occasions. Comfortable fit and excellent durability. Machine washable and easy to maintain. Designed for style and comfort combined.',
          highlights: [
            'Premium cotton blend fabric',
            'Comfortable fit for all-day wear',
            'Easy to care and machine washable',
            'Available in multiple sizes',
            'Perfect for casual or formal occasions'
          ],
          specs: [
            { key: 'Material', value: '100% Premium Cotton' },
            { key: 'Fit Type', value: 'Regular Fit' },
            { key: 'Sizes Available', value: 'S, M, L, XL, XXL' },
            { key: 'Care Instructions', value: 'Machine wash cold, tumble dry low' },
            { key: 'Pockets', value: 'Yes, 2 front pockets' }
          ]
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} product(s) with details`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedDetails();
