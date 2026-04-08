const express = require('express');
const couponController = require('./coupon.controller');
const authMiddleware = require('../auth/auth.middleware');
const couponValidator = require('./coupon.validator');

const router = express.Router();

// Apply auth middleware for all routes (admin only)
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

router
  .route('/')
  .get(couponController.getAllCoupons)
  .post(
    couponValidator.validate(couponValidator.createCouponSchema),
    couponController.createCoupon
  );

router
  .route('/:id')
  .get(couponController.getCoupon)
  .patch(
    couponValidator.validate(couponValidator.updateCouponSchema),
    couponController.updateCoupon
  )
  .delete(couponController.deleteCoupon);

module.exports = router;
