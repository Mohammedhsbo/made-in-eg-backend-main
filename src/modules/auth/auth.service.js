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

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashedToken = crypto.createHash('sha256').update(otp).digest('hex');

  newUser.verifyEmailToken = hashedToken;
  newUser.verifyEmailExpires = Date.now() + 15 * 60 * 1000; // 15 mins
  await newUser.save({ validateBeforeSave: false });

  // Send OTP via email
  const sendEmail = require('./../../utils/email');
  const message = `Welcome to Made in Egypt! Your email verification code is: ${otp}\nThis code is valid for 15 minutes.`;

  try {
    await sendEmail({
      email: newUser.email,
      subject: 'Verify your email address',
      message,
    });
  } catch (err) {
    // If email fails, we still created the user, but they'll need to resend.
    // Or we could delete user? Usually better to keep and let them resend.
    console.error('Email sending failed during registration:', err);
  }

  // Remove sensitive info
  newUser.password = undefined;
  newUser.verifyEmailToken = undefined;

  // We do NOT return tokens here because user is not verified yet
  return { user: newUser, tokens: null };
};

// 3) Login user
const loginUser = async (email, password) => {
  // Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    throw new AppError('Incorrect email or password', 401);
  }

  // Check if email is verified
  if (!user.isVerified) {
    throw new AppError('Your email address is not verified. Please verify your email to log in.', 403);
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

// 9) Verify Email
const verifyEmail = async (email, otp) => {
  const hashedToken = crypto.createHash('sha256').update(otp.toString()).digest('hex');

  const user = await User.findOne({
    email,
    verifyEmailToken: hashedToken,
    verifyEmailExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new AppError('Invalid or expired verification code', 400);
  }

  user.isVerified = true;
  user.verifyEmailToken = undefined;
  user.verifyEmailExpires = undefined;
  await user.save({ validateBeforeSave: false });

  const tokens = signTokens(user);
  return { user, tokens };
};

// 10) Resend Verification Email
const resendVerificationEmail = async (email) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError('No user found with that email address', 404);
  }

  if (user.isVerified) {
    throw new AppError('This account is already verified', 400);
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashedToken = crypto.createHash('sha256').update(otp).digest('hex');

  user.verifyEmailToken = hashedToken;
  user.verifyEmailExpires = Date.now() + 15 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const sendEmail = require('./../../utils/email');
  const message = `Your new email verification code is: ${otp}\nThis code is valid for 15 minutes.`;

  await sendEmail({
    email: user.email,
    subject: 'Resend: Verify your email address',
    message,
  });
};

module.exports = {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  createFirstAdmin,
  signTokens,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
};
