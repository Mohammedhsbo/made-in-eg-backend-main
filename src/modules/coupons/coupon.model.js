const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be at least 1'],
    },
    minCartPrice: {
      type: Number,
      default: 0,
      min: [0, 'Minimum cart price cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      // Optional: Used to cap percentage discounts (e.g. 20% off up to $50)
    },
    expireAt: {
      type: Date,
      required: [true, 'Coupon expiration date is required'],
    },
    usageLimit: {
      type: Number,
      required: [true, 'Coupon usage limit is required'],
      min: [1, 'Usage limit must be at least 1'],
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
