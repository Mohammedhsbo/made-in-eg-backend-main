require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Error Handling Middlewares
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFound');

// Initialize App
const app = express();

// Connect to Database
connectDB();

// Middlewares
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://made-in-egypt-a3pd.vercel.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // يسمح بالطلبات من السيرفر نفسه أو من origins المسموح بها
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Swagger Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swaggerDef');

// Route files
const authRoutes = require('./modules/auth/auth.routes');
const categoryRoutes = require('./modules/categories/category.routes');
const productRoutes = require('./modules/products/product.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/orders/order.routes');
const reviewRoutes = require('./modules/reviews/review.routes');
const couponRoutes = require('./modules/coupons/coupon.routes');

// Mount Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Basic Route for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend is running correctly',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);

// Handle Unhandled Routes
app.all('*', notFoundHandler);

// Global Error Handling Middleware
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections globally
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
