const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('./../users/user.model');
const AppError = require('./../../utils/AppError');

// 1) Generate Tokens (Access & Refresh)
const signTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES }
  );

  const refreshToken = jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES }
  );

  return { accessToken, refreshToken };
};

// 2) Register a new user
const registerUser = async (userData) => {
  const newUser = await User.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
  });

  // Remove password from output
  newUser.password = undefined;

  const tokens = signTokens(newUser);
  return { user: newUser, tokens };
};

// 3) Login user
const loginUser = async (email, password) => {
  // Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    throw new AppError('Incorrect email or password', 401);
  }

  // Remove password from output
  user.password = undefined;

  const tokens = signTokens(user);
  return { user, tokens };
};

// 4) Refresh Token logic
const refreshTokens = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('No refresh token provided. Please log in again.', 401);
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token. Please log in.', 401);
  }

  // Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    throw new AppError('The user belonging to this token does no longer exist.', 401);
  }

  // Check if tokenVersion matches (handles immediate invalidation after logout)
  if (currentUser.tokenVersion !== decoded.tokenVersion) {
    throw new AppError('Token has been invalidated. Please log in again.', 401);
  }

  // Generate new tokens
  const tokens = signTokens(currentUser);
  return { user: currentUser, tokens };
};

// 5) Logout user (Invalidate all tokens by incrementing version)
const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
};

// 6) Create first admin securely
const createFirstAdmin = async (userData,  secretKey) => {
  if (secretKey !== process.env.ADMIN_CREATION_KEY) {
    throw new AppError('Invalid admin creation key', 403);
  }

  const newAdmin = await User.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
    role: 'admin',
  });

  newAdmin.password = undefined;
  return newAdmin;
};

// 7) Forgot Password
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  
  if (!user) {
    // Security: Do not reveal if user exists
    return null; 
  }

  // Generate 6-digit OTP
  const resetToken = crypto.randomInt(100000, 1000000).toString();
  
  // Hash token
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins
  
  await user.save({ validateBeforeSave: false });

  const sendEmail = require('./../../utils/email');
  
  // Safely grab user phone without crashing
  const phoneText = user.phone ? `\nPhone: ${user.phone}` : '';
  const message = `You requested a password reset.\nYour OTP is: ${resetToken}\nThis OTP is valid for 15 minutes.${phoneText}\nIf you didn't request this, please ignore this email.`;
  
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your Password Reset OTP (Valid for 15 min)',
      message,
    });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('There was an error sending the email. Try again later!', 500);
  }
  
  return resetToken;
};

// 8) Reset Password
const resetPassword = async (token, newPassword) => {
  // Hash incoming token to compare with DB
  const hashedToken = crypto.createHash('sha256').update(token.toString()).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  // Hash password using bcrypt BEFORE saving
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  // Use explicit $set to ensure mongo updates strictly, and $inc to invalidate all active JWTs for immediate session shutdown!
  await User.findByIdAndUpdate(
    user._id,
    {
      $set: { password: hashedPassword },
      $inc: { tokenVersion: 1 },
      $unset: {
        resetPasswordToken: 1,
        resetPasswordExpires: 1
      }
    },
    { new: true }
  );

  return user;
};

module.exports = {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  createFirstAdmin,
  signTokens,
  forgotPassword,
  resetPassword
};
