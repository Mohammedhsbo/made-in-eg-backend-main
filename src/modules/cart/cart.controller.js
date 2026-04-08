const Cart = require('./cart.model');
const Product = require('../products/product.model');
const Coupon = require('../coupons/coupon.model');
const AppError = require('./../../utils/AppError');

// Get current user's cart
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: 'items.product',
      select: 'title_ar title_en imageCover basePrice priceAfterDiscount quantity isDeleted',
    });

    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = await Cart.create({ user: req.user._id, items: [] });
    } else {
      let isChanged = false;
      // Filter out deleted items and sync prices
      cart.items = cart.items.filter(item => {
          if (!item.product || item.product.isDeleted) {
              isChanged = true;
              return false;
          }
          const currentPrice = item.product.priceAfterDiscount !== undefined ? item.product.priceAfterDiscount : item.product.basePrice;
          if (item.price !== currentPrice) {
              item.price = currentPrice;
              isChanged = true;
          }
          return true;
      });

      if (isChanged) {
          await cart.save();
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        cart,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Add item to cart
exports.addItemToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // 1. Get product to check price and validity
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      return next(new AppError('Product not found or has been deleted', 404));
    }

    // 2. Find user's cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // 3. Check if product already in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex > -1) {
      // Product exists in cart, update quantity
      let newQty = cart.items[itemIndex].quantity + (quantity || 1);
      if (newQty > product.quantity) newQty = product.quantity;
      cart.items[itemIndex].quantity = newQty;
      // Also update the price snapshot in case it changed
      cart.items[itemIndex].price = product.priceAfterDiscount !== undefined ? product.priceAfterDiscount : product.basePrice;
    } else {
      // Product not in cart, add new item
      let newQty = quantity || 1;
      if (newQty > product.quantity) newQty = product.quantity;
      cart.items.push({
        product: productId,
        quantity: newQty,
        price: product.priceAfterDiscount !== undefined ? product.priceAfterDiscount : product.basePrice,
      });
    }

    await cart.save();

    // Populate for response
    await cart.populate({
        path: 'items.product',
        select: 'title_ar title_en imageCover price',
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Update item quantity
exports.updateItemQuantity = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id }).populate({
        path: 'items.product',
        select: 'basePrice priceAfterDiscount quantity'
    });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return next(new AppError('Item not found in cart', 404));
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      cart.items.splice(itemIndex, 1);
    } else {
      const product = cart.items[itemIndex].product;
      if (!product || product.isDeleted) {
          cart.items.splice(itemIndex, 1);
          await cart.save();
          return next(new AppError('Product is no longer available and has been removed from your cart.', 400));
      }

      let newQty = quantity;
      if (newQty > product.quantity) newQty = product.quantity;

      cart.items[itemIndex].quantity = newQty;
      cart.items[itemIndex].price = product.priceAfterDiscount !== undefined ? product.priceAfterDiscount : product.basePrice;
    }

    await cart.save();
    
    await cart.populate({
        path: 'items.product',
        select: 'title_ar title_en imageCover basePrice priceAfterDiscount price',
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Remove item from cart
exports.removeItemFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    cart.items = cart.items.filter(
      (item) => item._id.toString() !== itemId
    );

    await cart.save();

    await cart.populate({
        path: 'items.product',
        select: 'title_ar title_en imageCover price',
    });

    res.status(200).json({
      status: 'success',
      data: {
        cart,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.status(200).json({
      status: 'success',
      data: {
        cart,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Apply coupon to cart
exports.applyCouponToCart = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    // 1. Get coupon
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    
    if (!coupon) {
      return next(new AppError('Coupon is invalid or expired', 400));
    }
    
    // Check expiration and usage
    if (new Date() > new Date(coupon.expireAt)) {
      return next(new AppError('Coupon has expired', 400));
    }
    
    if (coupon.usageCount >= coupon.usageLimit) {
      return next(new AppError('Coupon usage limit has been reached', 400));
    }

    // 2. Get Cart
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return next(new AppError('Your cart is empty', 400));
    }
    
    let cartTotal = cart.items.reduce((total, item) => total + item.quantity * item.price, 0);

    // 3. Check min purchase amount
    if (cartTotal < coupon.minCartPrice) {
       return next(new AppError(`You must spend at least $${coupon.minCartPrice} to use this coupon`, 400));
    }
    
    // 4. Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'fixed') {
        discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
        discountAmount = cartTotal * (coupon.discountValue / 100);
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
            discountAmount = coupon.maxDiscountAmount;
        }
    }
    
    let finalPrice = cartTotal - discountAmount;
    if (finalPrice < 0) finalPrice = 0;
    
    // 5. Update cart
    cart.totalPriceAfterDiscount = finalPrice;
    cart.coupon = coupon._id;
    await cart.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Coupon applied successfully',
      data: {
        cart
      }
    });

  } catch (err) {
    next(err);
  }
};
