const authService = require('./auth.service');
const crypto = require('crypto');
const User = require('./../users/user.model');

// Utility to send tokens via response & cookies
const sendTokenResponse = (user, tokens, statusCode, res) => {
  // Config for HTTP-only cookie
  const cookieOptions = {
    expires: new Date(
      Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES) * 24 * 60 * 60 * 1000 // e.g. 7d -> ms
    ),
    httpOnly: true,
    // secure: process.env.NODE_ENV === 'production',
  };

  res.cookie('jwt_refresh', tokens.refreshToken, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    token: tokens.accessToken, // We send access token in JSON body
    refreshToken: tokens.refreshToken, // Include refresh token in response for testing
    data: {
      user,
    },
  });
};

exports.register = async (req, res, next) => {
  try {
    const { user, tokens } = await authService.registerUser(req.body);
    sendTokenResponse(user, tokens, 201, res);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await authService.loginUser(email, password);
    
    sendTokenResponse(user, tokens, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.headers['x-refresh-token'] || req.cookies.jwt_refresh;
    const { user, tokens } = await authService.refreshTokens(refreshToken);
    sendTokenResponse(user, tokens, 200, res);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // 1) Invalidate token in DB
    if (req.user) {
      await authService.logoutUser(req.user._id);
    }

    // 2) Clear cookie
    res.cookie('jwt_refresh', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000), // expires in 10s
      httpOnly: true,
    });

    res.status(200).json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

exports.getMe = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
};

exports.createAdmin = async (req, res, next) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const admin = await authService.createFirstAdmin(req.body, adminKey);
    
    res.status(201).json({
      status: 'success',
      data: {
        admin
      }
    });
  } catch(err) {
    next(err);
  }
};
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    
    res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch(err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ status: 'fail', message: 'Invalid or expired OTP' });
    }

    const hashedToken = crypto.createHash('sha256').update(otp.toString()).digest('hex');
    
    const user = await User.findOne({
      email: email,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired OTP',
      });
    }

    // DO NOT clear OTP here, it must be cleared AFTER reset-password succeeds.
    return res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully',
    });
  } catch (err) {
    // Catch-all to never expose internal errors
    return res.status(500).json({
      status: 'error',
      message: 'Invalid or expired OTP',
    });
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch(err) {
    next(err);
  }
};
exports.updatePassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        status: "fail",
        message: "Password is required",
      });
    }

    const bcrypt = require("bcryptjs");

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // update fields
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};
