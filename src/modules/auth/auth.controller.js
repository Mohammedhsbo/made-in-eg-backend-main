const authService = require('./auth.service');

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
