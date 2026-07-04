const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const { uploadProfileImage, handleUploadError } = require('../middleware/upload.middleware');

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -refreshToken -resetPasswordToken -resetPasswordExpire');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, department, address, college, age, gender, profileImage } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (department) updateData.department = department;
    if (address) updateData.address = address;
    if (college) updateData.college = college;
    if (age) updateData.age = age;
    if (gender) updateData.gender = gender;
    if (profileImage) updateData.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshToken -resetPasswordToken -resetPasswordExpire');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Upload profile image
router.post('/upload-profile-image', 
  authMiddleware,
  uploadProfileImage,
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image uploaded' });
      }

      // Convert buffer to Base64 string
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

      const user = await User.findByIdAndUpdate(
        req.userId,
        { profileImage: base64Image },
        { new: true }
      ).select('-password -refreshToken -resetPasswordToken -resetPasswordExpire');

      res.json({
        message: 'Profile image uploaded successfully',
        user,
        imageUrl: base64Image
      });
    } catch (error) {
      console.error('Upload profile image error:', error);
      res.status(500).json({ message: 'Failed to upload profile image' });
    }
  }
);

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Get all users (admin only)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const users = await User.find()
      .select('-password -refreshToken -resetPasswordToken -resetPasswordExpire')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// Get user by ID (admin only)
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const user = await User.findById(req.params.userId)
      .select('-password -refreshToken -resetPasswordToken -resetPasswordExpire');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});


module.exports = router;