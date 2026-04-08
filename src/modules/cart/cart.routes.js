const express = require('express');
const cartController = require('./cart.controller');
const authMiddleware = require('../auth/auth.middleware');
const { validate, addItemSchema, updateQuantitySchema, applyCouponSchema } = require('./cart.validator');

const router = express.Router();

// ALL cart operations require logged-in user
router.use(authMiddleware.protect);

router.patch('/apply-coupon', validate(applyCouponSchema), cartController.applyCouponToCart);

router
  .route('/')
  .get(cartController.getCart)
  .post(validate(addItemSchema), cartController.addItemToCart)
  .delete(cartController.clearCart);

router
  .route('/:itemId')
  .put(validate(updateQuantitySchema), cartController.updateItemQuantity)
  .delete(cartController.removeItemFromCart);

module.exports = router;
