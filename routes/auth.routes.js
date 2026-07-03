const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate, commonValidations } = require('../middleware/validation.middleware');
const { authMiddleware } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Register
router.post('/register',
  validate([
    commonValidations.name,
    commonValidations.email,
    commonValidations.password,
    body('role')
      .isIn(['student', 'teacher'])
      .withMessage('Invalid role'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match')
  ]),
  async (req, res) => {
    try {
      const { name, email, password, role, phone, department, college, gender, age, address } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Create user
      const user = new User({
        name,
        email,
        password,
        role,
        phone,
        department,
        college,
        gender,
        age,
        address
      });

      await user.save();

      // Generate token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

// Login
router.post('/login',
  validate([
    commonValidations.email,
    body('password').notEmpty().withMessage('Password is required'),
    body('role').isIn(['student', 'teacher', 'admin']).withMessage('Invalid role')
  ]),
  async (req, res) => {
    try {
      const { email, password, role } = req.body;

      // Check if admin
      if (role === 'admin') {
        if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
          return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        // Check if admin exists in database
        let admin = await User.findOne({ email, role: 'admin' });
        
        if (!admin) {
          // Create admin if doesn't exist
          admin = new User({
            name: process.env.ADMIN_USERNAME || 'Admin',
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            role: 'admin',
            isActive: true
          });
          await admin.save();
        }

        const token = jwt.sign(
          { id: admin._id, role: 'admin' },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        return res.json({
          message: 'Admin login successful',
          token,
          user: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: 'admin',
            profileImage: admin.profileImage
          }
        });
      }

      // Check user
      const user = await User.findOne({ email, role });
      if (!user) {
        return res.status(401).json({ message: `No ${role} found with this email` });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      // Generate token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage,
          department: user.department,
          college: user.college,
          phone: user.phone,
          age: user.age,
          gender: user.gender,
          address: user.address
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -refreshToken');
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user data' });
  }
});

// Forgot password
router.post('/forgot-password',
  validate([commonValidations.email]),
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
      await user.save();

      // Send email with reset link
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
      // TODO: Send email using nodemailer
      // For now, just return the token
      res.json({
        message: 'Password reset email sent',
        resetToken // In production, don't send this in response
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Failed to process request' });
    }
  }
);

// Reset password
router.post('/reset-password',
  validate([
    body('token').notEmpty().withMessage('Token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ]),
  async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // Update password
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  }
);

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Clear any session/token data if needed
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

module.exports = router;