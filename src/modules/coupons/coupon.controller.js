const Coupon = require('./coupon.model');
const AppError = require('../../utils/AppError');

// Create a new coupon (Admin)
exports.createCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    // Ensure code uniqueness and uppercase check
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
       return next(new AppError('A coupon with this code already exists', 400));
    }

    const payload = { ...req.body, code: code.toUpperCase() };
    const coupon = await Coupon.create(payload);

    res.status(201).json({
      status: 'success',
      data: {
        coupon,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get all coupons (Admin)
exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: coupons.length,
      data: {
        coupons,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get single coupon (Admin)
exports.getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return next(new AppError('Coupon not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        coupon,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Update coupon (Admin)
exports.updateCoupon = async (req, res, next) => {
  try {
    // Prevent updating the code itself to avoid confusing users
    if (req.body.code) {
        delete req.body.code;
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      return next(new AppError('Coupon not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        coupon,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Delete coupon (Admin)
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
      return next(new AppError('Coupon not found', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
