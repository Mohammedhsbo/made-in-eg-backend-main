const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true,
  },
  title_ar: {
    type: String,
    required: true,
  },
  title_en: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true, // e.g., ORD-20260405-1234
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null, // Allow guest checkout
    },
    shippingAddress: {
      fullName: { type: String, required: [true, 'Full name is required'] },
      phone: { type: String, required: [true, 'Phone number is required'] },
      email: { type: String, required: [true, 'Email is required'] },
      address: { type: String, required: [true, 'Address is required'] },
      city: { type: String, required: [true, 'City is required'] },
      postalCode: { type: String, required: [true, 'Postal code is required'] },
    },
    items: [orderItemSchema],
    total: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate orderId
orderSchema.pre('validate', function (next) {
  if (!this.orderId) {
    const now = new Date();
    const dateStr =
      now.getFullYear() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    this.orderId = `ORD-${dateStr}-${random}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
