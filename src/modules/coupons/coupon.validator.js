const z = require('zod');
const { validate } = require('../auth/auth.validator');

const createCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Coupon code is required'),
    discountType: z.enum(['percentage', 'fixed'], {
      errorMap: () => ({ message: 'Discount type must be percentage or fixed' })
    }),
    discountValue: z.number().min(1, 'Discount value must be greater than 0'),
    minCartPrice: z.number().min(0).optional().default(0),
    maxDiscountAmount: z.number().min(1).optional(),
    expireAt: z.string().datetime({ message: 'expireAt must be a valid ISO datetime string (e.g. 2026-12-31T23:59:59Z)' }),
    usageLimit: z.number().min(1, 'Usage limit must be greater than 0'),
  }).refine((data) => {
    if (data.discountType === 'percentage' && data.discountValue > 100) {
        return false;
    }
    return true;
  }, {
     message: 'Percentage discount cannot exceed 100',
     path: ['discountValue']
  })
});

const updateCouponSchema = z.object({
  body: z.object({
    discountType: z.enum(['percentage', 'fixed']).optional(),
    discountValue: z.number().min(1).optional(),
    minCartPrice: z.number().min(0).optional(),
    maxDiscountAmount: z.number().min(1).optional(),
    expireAt: z.string().datetime().optional(),
    usageLimit: z.number().min(1).optional(),
  })
});

module.exports = {
  validate,
  createCouponSchema,
  updateCouponSchema
};
