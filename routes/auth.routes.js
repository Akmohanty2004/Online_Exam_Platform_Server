const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate, commonValidations } = require('../middleware/validation.middleware');
const { authMiddleware } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const OTP = require('../models/OTP.model');
const sendEmail = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Email Template Generator
const getEmailTemplate = (otp, type) => `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fb; padding: 40px 0; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">ExamHub</h1>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #1e293b; margin-top: 0; font-size: 24px; font-weight: 600;">Your ${type} OTP</h2>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
        Hello!<br>
        You've requested an OTP for ${type.toLowerCase()}. Please use the verification code below to proceed.
      </p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
        <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #3b82f6;">${otp}</span>
      </div>
      
      <p style="color: #64748b; font-size: 15px; margin-bottom: 20px;">
        <strong style="color: #ef4444;">Note:</strong> This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
      </p>
      <p style="color: #64748b; font-size: 15px; margin-bottom: 0;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
    <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">
        &copy; ${new Date().getFullYear()} ExamHub. All rights reserved.
      </p>
    </div>
  </div>
</div>
`;

// Register Request (Sends OTP)
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
      const { email } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Generate OTP
      const otp = generateOTP();

      // Save OTP to database (upsert to prevent multiple valid OTPs)
      await OTP.findOneAndUpdate(
        { email },
        { otp, createdAt: Date.now() },
        { upsert: true, new: true }
      );

      // Send Email
      try {
        await sendEmail({
          email,
          subject: 'ExamHub - Registration OTP',
          message: getEmailTemplate(otp, 'Registration')
        });
        res.status(200).json({ message: 'OTP sent to your email successfully', isOtpSent: true });
      } catch (emailError) {
        console.error('Email error:', emailError);
        return res.status(500).json({ message: 'Failed to send OTP email. Please ensure EMAIL_USER and EMAIL_PASSWORD are set.' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

// Register Verify (Verifies OTP and Creates User)
router.post('/verify-register',
  async (req, res) => {
    try {
      const { name, email, password, role, phone, department, college, gender, age, address, otp } = req.body;

      // Check OTP
      const otpRecord = await OTP.findOne({ email, otp });
      if (!otpRecord) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      // Check if user exists again just in case
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
      await OTP.deleteOne({ email }); // Delete OTP after successful use

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
      console.error('Verify registration error:', error);
      res.status(500).json({ message: 'Verification failed' });
    }
  }
);

// Login Request (Validates Credentials and Sends OTP)
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
      } else {
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
      }

      // Generate OTP
      const otp = generateOTP();

      // Save OTP to database
      await OTP.findOneAndUpdate(
        { email },
        { otp, createdAt: Date.now() },
        { upsert: true, new: true }
      );

      // Send Email
      try {
        await sendEmail({
          email,
          subject: 'ExamHub - Login OTP',
          message: getEmailTemplate(otp, 'Login')
        });
        res.status(200).json({ message: 'OTP sent to your email successfully', isOtpSent: true });
      } catch (emailError) {
        console.error('Email error:', emailError);
        return res.status(500).json({ message: 'Failed to send OTP email. Please ensure EMAIL_USER and EMAIL_PASSWORD are set.' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

// Login Verify (Verifies OTP and returns JWT)
router.post('/verify-login',
  async (req, res) => {
    try {
      const { email, password, role, otp } = req.body;

      // Check OTP
      const otpRecord = await OTP.findOne({ email, otp });
      if (!otpRecord) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      let userToReturn;
      let token;

      if (role === 'admin') {
        if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
          return res.status(401).json({ message: 'Invalid admin credentials' });
        }
        let admin = await User.findOne({ email, role: 'admin' });
        if (!admin) {
          admin = new User({
            name: process.env.ADMIN_USERNAME || 'Admin',
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            role: 'admin',
            isActive: true
          });
          await admin.save();
        }
        token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
        admin.lastLogin = new Date();
        await admin.save();
        userToReturn = { id: admin._id, name: admin.name, email: admin.email, role: 'admin', profileImage: admin.profileImage };
      } else {
        const user = await User.findOne({ email, role });
        if (!user || !user.isActive || !(await user.comparePassword(password))) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
        user.lastLogin = new Date();
        await user.save();
        userToReturn = {
          id: user._id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage,
          department: user.department, college: user.college, phone: user.phone, age: user.age, gender: user.gender, address: user.address
        };
      }

      await OTP.deleteOne({ email }); // Delete OTP after successful use

      res.json({
        message: 'Login successful',
        token,
        user: userToReturn
      });
    } catch (error) {
      console.error('Verify login error:', error);
      res.status(500).json({ message: 'Login verification failed' });
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
      
      try {
        await sendEmail({
          email,
          subject: 'ExamHub - Password Reset',
          message: `<h1>Password Reset</h1><p>You requested a password reset. Please click the link below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a><p>This link expires in 15 minutes.</p>`
        });
        res.json({ message: 'Password reset email sent' });
      } catch (emailError) {
        console.error('Email error:', emailError);
        return res.status(500).json({ message: 'Failed to send password reset email. Please ensure EMAIL_USER and EMAIL_PASSWORD are set.' });
      }
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