const z = require('zod');
const { validate } = require('../auth/auth.validator');

const addItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be positive').optional(),
  }),
});

const updateQuantitySchema = z.object({
  body: z.object({
    quantity: z.number().int('Quantity must be an integer'),
  }),
});

const applyCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Coupon code must be provided').toUpperCase()
  })
});

module.exports = {
  validate,
  addItemSchema,
  updateQuantitySchema,
  applyCouponSchema
};
