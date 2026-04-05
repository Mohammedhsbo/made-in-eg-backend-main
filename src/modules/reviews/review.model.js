const mongoose = require('mongoose');
const Product = require('../products/product.model');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: [true, 'Review must belong to a product'],
    },
    order: {
      type: mongoose.Schema.ObjectId,
      ref: 'Order',
      required: [true, 'Review requires a verified purchase (order)'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1.0'],
      max: [5, 'Rating must be at most 5.0'],
    },
    comment_ar: {
      type: String,
      trim: true,
    },
    comment_en: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only review a product once
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Calculate average ratings for a product
reviewSchema.statics.calcAverageRatings = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId },
    },
    {
      $group: {
        _id: '$product',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: 0,
      ratingsAverage: 0,
    });
  }
};

// Call calcAverageRatings after saving a review
reviewSchema.post('save', function () {
  this.constructor.calcAverageRatings(this.product);
});

// Call calcAverageRatings when review is updated or deleted
// Needs a trick to pass the product ID from query middleware to post document middleware
reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.model.findOne(this.getQuery());
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); does NOT work here, query has already executed
  if (this.r) {
    await this.r.constructor.calcAverageRatings(this.r.product);
  }
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
