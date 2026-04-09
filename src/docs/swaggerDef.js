const swaggerJson = {
  openapi: '3.0.0',
  info: {
    title: 'Made In Egypt API',
    version: '1.0.0',
    description: 'API documentation for the Made In Egypt e-commerce platform',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Error message description' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'passwordConfirm'],
                properties: {
                  name: { type: 'string', example: 'Zeyad' },
                  email: { type: 'string', format: 'email', example: 'zeyad@example.com' },
                  password: { type: 'string', format: 'password', example: 'securePassword123' },
                  passwordConfirm: { type: 'string', format: 'password', example: 'securePassword123' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created successfully',
            content: { 'application/json': { schema: { properties: { status: { type: 'string', example: 'success' }, token: { type: 'string' }, refreshToken: { type: 'string' }, data: { properties: { user: { $ref: '#/components/schemas/User' } } } } } } },
            headers: {
              'Set-Cookie': {
                description: 'Sets the jwt_refresh cookie with the refresh token',
                schema: { type: 'string' },
              },
            },
          },
          400: { description: 'Validation Error' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in to an account',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged in successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    token: { type: 'string', description: 'Access token' },
                    refreshToken: { type: 'string', description: 'Refresh token' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
            headers: {
              'Set-Cookie': {
                description: 'Sets the jwt_refresh cookie with the refresh token',
                schema: { type: 'string' },
              },
            },
          },
          401: { description: 'Incorrect email or password' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Refresh JWT token',
        tags: ['Authentication'],
        security: [],
        parameters: [
          {
            name: 'X-Refresh-Token',
            in: 'header',
            required: false,
            schema: { type: 'string' },
            description: 'Refresh token for issuing a new access token (provide either this header or the jwt_refresh cookie)',
          },
          {
            name: 'jwt_refresh',
            in: 'cookie',
            required: false,
            schema: { type: 'string' },
            description: 'Refresh token cookie (alternative to header)',
          },
        ],
        responses: {
          200: {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    token: { type: 'string', description: 'New access token' },
                    refreshToken: { type: 'string', description: 'New refresh token' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
            headers: {
              'Set-Cookie': {
                description: 'Sets the jwt_refresh cookie with the new refresh token',
                schema: { type: 'string' },
              },
            },
          },
          401: { description: 'Not logged in / Invalid refresh token' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Authentication'],
        responses: {
          200: { description: 'Current user object' },
        },
      },
    },
    '/api/auth/admin/bootstrap': {
      post: {
        summary: 'Bootstrap first admin user',
        tags: ['Authentication'],
        security: [],
        parameters: [
          {
            name: 'X-Admin-Key',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'Secret admin bootstrap key',
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password', 'passwordConfirm'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, passwordConfirm: { type: 'string' }, adminSecret: { type: 'string' } } } } },
        },
        responses: {
          201: { description: 'Admin bootstrapped' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Log out natively (increments tokenVersion)',
        tags: ['Authentication'],
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/api/products': {
      get: {
        summary: 'Get all products',
        tags: ['Products'],
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search keyword' },
        ],
        responses: {
          200: { description: 'List of products' },
        },
      },
      post: {
        summary: 'Create a new product (Admin)',
        tags: ['Products'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title_en', 'title_ar', 'basePrice', 'quantity', 'category', 'imageCover'],
                properties: {
                  title_en: { type: 'string' },
                  title_ar: { type: 'string' },
                  description_en: { type: 'string' },
                  description_ar: { type: 'string' },
                  quantity: { type: 'integer' },
                  basePrice: { type: 'number' },
                  priceAfterDiscount: { type: 'number' },
                  category: { type: 'string', description: 'Category ID' },
                  imageCover: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Product created' },
          403: { description: 'Forbidden (Admin only)' },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        summary: 'Get single product by ID',
        tags: ['Products'],
        security: [],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Product object' },
          404: { description: 'Product not found' },
        },
      },
      patch: {
        summary: 'Update product (Admin)',
        tags: ['Products'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Product updated' } },
      },
      delete: {
        summary: 'Delete or soft-delete product (Admin)',
        tags: ['Products'],
         parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
         responses: { 204: { description: 'Product deleted' } }
      }
    },
    '/api/products/related/{id}': {
      get: {
        summary: 'Get related products',
        tags: ['Products'],
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'List of related products' } },
      },
    },
    '/api/categories': {
      get: {
        summary: 'Get all categories',
        tags: ['Categories'],
        security: [],
        responses: { 200: { description: 'List of categories' } },
      },
      post: {
        summary: 'Create a category (Admin)',
        tags: ['Categories'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name_en', 'name_ar'],
                properties: { name_en: { type: 'string' }, name_ar: { type: 'string' }, icon: { type: 'string' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Category created' } },
      },
    },
    '/api/categories/{id}': {
      get: {
        summary: 'Get category by ID or slug',
        tags: ['Categories'],
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Category object' } },
      },
      patch: {
        summary: 'Update category (Admin)',
        tags: ['Categories'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Category updated' } },
      },
      delete: {
        summary: 'Delete category (Admin)',
        tags: ['Categories'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Category deleted' } },
      },
    },
    '/api/cart': {
      get: {
        summary: 'Get current user cart',
        tags: ['Cart'],
        responses: { 200: { description: 'Cart object' } },
      },
      post: {
        summary: 'Add item to front of cart',
        tags: ['Cart'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['productId'], properties: { productId: { type: 'string' }, quantity: { type: 'integer', default: 1 } } },
            },
          },
        },
        responses: { 200: { description: 'Item added' } },
      },
    },
    '/api/cart/{itemId}': {
      patch: {
        summary: 'Update item quantity in cart',
        tags: ['Cart'],
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { quantity: { type: 'integer' } } } } } },
        responses: { 200: { description: 'Quantity updated' }, 404: { description: 'Item not found' } },
      },
    },
    '/api/cart/apply-coupon': {
      patch: {
        summary: 'Apply a discount coupon to the cart',
        tags: ['Cart'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', example: 'SAVE20' } } },
            },
          },
        },
        responses: { 200: { description: 'Coupon applied successfully' }, 400: { description: 'Coupon invalid, expired, or min purchase not met' } },
      },
    },
    '/api/orders': {
      get: {
        summary: 'Get all orders for the current user',
        tags: ['Orders'],
        responses: { 200: { description: 'List of orders' } },
      },
      post: {
        summary: 'Create (checkout) an order',
        tags: ['Orders'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['shippingAddress'],
                properties: {
                  shippingAddress: {
                    type: 'object',
                    required: ['fullName', 'email', 'phone', 'address', 'city', 'postalCode'],
                    properties: {
                      fullName: { type: 'string' },
                      email: { type: 'string' },
                      phone: { type: 'string' },
                      address: { type: 'string' },
                      city: { type: 'string' },
                      postalCode: { type: 'string' },
                    },
                  },
                  paymentMethod: { type: 'string', enum: ['cash', 'card'], default: 'cash' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Order checked out & placed successfully' }, 400: { description: 'Cart empty or out of stock' } },
      },
    },
    '/api/orders/all': {
      get: {
        summary: 'Get all orders globally (Admin only)',
        tags: ['Orders'],
        responses: { 200: { description: 'List of all platform orders' } },
      },
    },
    '/api/orders/my': {
      get: {
        summary: 'Get currently logged in user orders',
        tags: ['Orders'],
        responses: { 200: { description: 'List of my orders' } },
      },
    },
    '/api/orders/{id}': {
      get: {
        summary: 'Get specific order by ID',
        tags: ['Orders'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Order details' } },
      },
    },
    '/api/orders/{id}/status': {
      patch: {
        summary: 'Update order status (Admin)',
        tags: ['Orders'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] } } } } } },
        responses: { 200: { description: 'Order status updated' }, 400: { description: 'Invalid transition' } },
      },
    },
    '/api/reviews/{productId}': {
      get: {
        summary: 'Get all reviews for a product',
        tags: ['Reviews'],
        security: [],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'List of reviews' } },
      },
    },
    '/api/reviews': {
      post: {
        summary: 'Submit a product review',
        tags: ['Reviews'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product', 'rating'],
                properties: {
                  product: { type: 'string', description: 'Product ID' },
                  rating: { type: 'number', min: 1, max: 5 },
                  comment_ar: { type: 'string' },
                  comment_en: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Review accepted' }, 403: { description: 'Not a verified purchase or not delivered' } },
      },
    },
    '/api/reviews/{id}': {
      delete: {
        summary: 'Delete a review',
        tags: ['Reviews'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Review successfully deleted' } },
      },
    },
    '/api/coupons': {
      get: {
        summary: 'Get all coupons (Admin)',
        tags: ['Coupons'],
        responses: { 200: { description: 'List of coupons' } },
      },
      post: {
        summary: 'Create a coupon (Admin)',
        tags: ['Coupons'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'discountType', 'discountValue', 'expireAt', 'usageLimit'],
                properties: {
                  code: { type: 'string', example: 'SUMMER50' },
                  discountType: { type: 'string', enum: ['percentage', 'fixed'], example: 'fixed' },
                  discountValue: { type: 'number', example: 50 },
                  minCartPrice: { type: 'number', example: 100 },
                  maxDiscountAmount: { type: 'number', example: 50 },
                  expireAt: { type: 'string', format: 'date-time' },
                  usageLimit: { type: 'number', example: 100 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Coupon created' } },
      },
    },
    '/api/coupons/{id}': {
      get: {
        summary: 'Get single coupon (Admin)',
        tags: ['Coupons'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Coupon object' } },
      },
      patch: {
        summary: 'Update coupon (Admin)',
        tags: ['Coupons'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Coupon updated' } },
      },
      delete: {
        summary: 'Delete coupon (Admin)',
        tags: ['Coupons'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Coupon deleted' } },
      },
    },
  },
};

module.exports = swaggerJson;
