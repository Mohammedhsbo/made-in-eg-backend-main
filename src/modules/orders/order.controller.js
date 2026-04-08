const Order = require('./order.model');
const Cart = require('../cart/cart.model');
const Product = require('../products/product.model');
const mongoose = require('mongoose');
const AppError = require('./../../utils/AppError');
const { sendOrderEmails } = require('./order.mailer');

// Place new order
exports.createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let cartItems = [];
    let cartTotal = 0;

    if (req.user) {
        const cart = await Cart.findOne({ user: req.user._id }).populate({
            path: 'items.product',
            select: 'title_ar title_en basePrice priceAfterDiscount quantity isDeleted',
        }).session(session);

        if (!cart || cart.items.length === 0) {
            throw new AppError('Your cart is empty', 400);
        }

        // Validate products still exist and prepare order items
        for (const item of cart.items) {
           if (!item.product || item.product.isDeleted) {
                throw new AppError(`A product in your cart is no longer available.`, 400);
           }

           if (item.product.quantity < item.quantity) {
                throw new AppError(`Not enough stock for product: ${item.product.title_en}`, 400);
           }
           
           const currentPrice = item.product.priceAfterDiscount !== undefined ? item.product.priceAfterDiscount : item.product.basePrice;

           cartItems.push({
               product: item.product._id,
               title_ar: item.product.title_ar,
               title_en: item.product.title_en,
               price: currentPrice,
               quantity: item.quantity
           });
           
           cartTotal += currentPrice * item.quantity;

           // Deduct stock safely to prevent race conditions
           const updatedProduct = await Product.findOneAndUpdate(
               { _id: item.product._id, quantity: { $gte: item.quantity }, isDeleted: { $ne: true } },
               { $inc: { quantity: -item.quantity, sold: item.quantity } },
               { session, new: true }
           );

           if (!updatedProduct) {
               throw new AppError(`Concurrent checkout failed. Not enough stock for product: ${item.product.title_en}`, 400);
           }
        }

    } else {
        throw new AppError('Guest checkout not implemented yet.', 401);
    }

    const { shippingAddress, paymentMethod } = req.body;

    if (!shippingAddress) {
        throw new AppError('Shipping address is required', 400);
    }

    let finalTotal = cartTotal;

    // Fast-fail coupon validation and atomically increment usage if coupon is active on cart
    if (req.user && cart && cart.coupon && cart.totalPriceAfterDiscount !== undefined) {
        finalTotal = cart.totalPriceAfterDiscount;
        const Coupon = require('../coupons/coupon.model');
        
        const updatedCoupon = await Coupon.findOneAndUpdate(
            { _id: cart.coupon, $expr: { $lt: ["$usageCount", "$usageLimit"] }, expireAt: { $gt: new Date() } },
            { $inc: { usageCount: 1 } },
            { session, new: true }
        );

        if (!updatedCoupon) {
             throw new AppError('The applied coupon sold out or expired right before your checkout attempt. Please review your cart.', 400);
        }
    }

    // 2. Create the order
    const orderData = {
        user: req.user ? req.user._id : null,
        shippingAddress,
        items: cartItems,
        total: finalTotal,
        paymentMethod: paymentMethod || 'cash'
    };

    const order = await Order.create([orderData], { session });

    // 3. Clear user's cart if logged in
    if (req.user) {
        await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], totalPrice: 0 }, { session });
    }

    await session.commitTransaction();

    // 4. Send emails (non-blocking) - wait, Order.create with session returns an array!
    sendOrderEmails(order[0]);

    res.status(201).json({
      status: 'success',
      data: {
        order: order[0],
      },
    });
  } catch (err) {
    try { await session.abortTransaction(); } catch(e) {}
    next(err);
  } finally {
    session.endSession();
  }
};

// Get current user's orders
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: {
        orders,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get all orders (Admin only)
exports.getAllOrders = async (req, res, next) => {
  try {
    // Basic filtering and pagination
    const page = req.query.page * 1 || 1;
    let limit = req.query.limit * 1 || 20;
    limit = Math.min(limit, 100); // Clamp to max 100
    const skip = (page - 1) * limit;

    const queryObj = {};
    if (req.query.status) queryObj.status = req.query.status;

    let query = Order.find(queryObj).sort('-createdAt');
    query = query.skip(skip).limit(limit);

    const orders = await query;
    const totalCount = await Order.countDocuments(queryObj);

    res.status(200).json({
      status: 'success',
      results: orders.length,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
      data: {
        orders,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get single order (Admin or Owner)
exports.getOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return next(new AppError('No order found with that ID', 404));
        }

        // Check ownership if not admin
        if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
            return next(new AppError('You do not have permission to view this order', 403));
        }

        res.status(200).json({
            status: 'success',
            data: {
                order,
            },
        });
    } catch (err) {
        next(err);
    }
}

// Update order status (Admin only)
exports.updateOrderStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if(!validStatuses.includes(status)){
         throw new AppError('Invalid status value', 400);
    }

    const order = await Order.findById(req.params.id).session(session);

    if (!order) {
      throw new AppError('No order found with that ID', 404);
    }

    if (order.status === status) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ status: 'success', data: { order } });
    }

    if (order.status === 'cancelled') {
        throw new AppError('A cancelled order cannot be reopened or have its status changed', 400);
    }

    // Handle cancel & restock
    if (status === 'cancelled') {
        if (order.status !== 'pending' && order.status !== 'confirmed') {
            throw new AppError('Order cannot be cancelled from its current status', 400);
        }

        // Restock items using updateOne to safely bypass the pre('find') soft-delete hook 
        // in case the product was soft-deleted while in an active order
        for (const item of order.items) {
           await Product.updateOne(
               { _id: item.product },
               { $inc: { quantity: item.quantity, sold: -item.quantity } },
               { session }
           );
        }
    } else {
        // Enforce forward-only flow
        const currentIndex = validStatuses.indexOf(order.status);
        const newIndex = validStatuses.indexOf(status);
        if (newIndex <= currentIndex) {
            throw new AppError(`Cannot move order status backwards from ${order.status} to ${status}`, 400);
        }
    }

    order.status = status;
    await order.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (err) {
    try { await session.abortTransaction(); } catch(e) {}
    next(err);
  } finally {
    session.endSession();
  }
};
