const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title_ar: {
      type: String,
      required: [true, 'Product Arabic title is required'],
      trim: true,
    },
    title_en: {
      type: String,
      required: [true, 'Product English title is required'],
      trim: true,
    },
    description_ar: {
      type: String,
      required: [true, 'Product Arabic description is required'],
      trim: true,
    },
    description_en: {
      type: String,
      required: [true, 'Product English description is required'],
      trim: true,
    },
    basePrice: {
      type: Number,
      required: [true, 'Product base price is required'],
    },
    priceAfterDiscount: {
      type: Number,
    },
    quantity: {
      type: Number,
      required: [true, 'Product quantity is required'],
      min: [0, 'Quantity cannot be less than 0'],
    },
    sold: {
      type: Number,
      default: 0,
      min: [0, 'Sold count cannot be negative'],
    },
    imageCover: {
      type: String,
      required: [true, 'Product cover image is required'],
    },
    images: [String],
    category: {
      // Typically references the leaf node (e.g., Tops)
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'Product must belong to a category'],
    },
    ratingsAverage: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be above or equal 0'],
      max: [5, 'Rating must be below or equal 5'],
      set: (val) => Math.round(val * 10) / 10, // 4.666666 -> 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Query Middleware to hide deleted products
productSchema.pre(/^find/, function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

productSchema.pre('countDocuments', function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
