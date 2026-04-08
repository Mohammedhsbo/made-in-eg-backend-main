const Review = require('./review.model');
const Order = require('../orders/order.model');
const AppError = require('./../../utils/AppError');

// Create Review
exports.createReview = async (req, res, next) => {
  try {
    const { product, rating, comment_ar, comment_en } = req.body;

    // Check if user has purchased the product
    // We look for an order belonging to the user that contains the product
    const order = await Order.findOne({
        user: req.user._id,
        status: 'delivered',
        'items.product': product
    });

    if (!order) {
        return next(new AppError('You can only review products from orders that have been successfully delivered.', 403));
    }

    const review = await Review.create({
      user: req.user._id,
      product,
      order: order._id,
      rating,
      comment_ar,
      comment_en
    });

    res.status(201).json({
      status: 'success',
      data: {
        review,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get reviews for a product (Public)
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const query = Review.find({ product: productId }).sort('-createdAt').populate({
        path: 'user',
        select: 'name'
    });

    // Basic pagination
    const page = req.query.page * 1 || 1;
    let limit = Math.max(1, req.query.limit * 1 || 10);
    limit = Math.min(limit, 100); // Clamp to 100 items max
    const skip = (page - 1) * limit;
    
    query.skip(skip).limit(limit);

    const reviews = await query;
    const totalCount = await Review.countDocuments({ product: productId });

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
      data: {
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Delete Review (Admin or Owner)
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    if (req.user.role !== 'admin' && review.user.toString() !== req.user._id.toString()) {
       return next(new AppError('You do not have permission to delete this review', 403));
    }

    await Review.findByIdAndDelete(req.params.id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
