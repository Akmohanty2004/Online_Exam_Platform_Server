const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const Notification = require('../models/Notification.model');

// Get user notifications
router.get('/',
  authMiddleware,
  async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const notifications = await Notification.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Notification.countDocuments({ userId: req.userId });
      const unreadCount = await Notification.countDocuments({ 
        userId: req.userId, 
        isRead: false 
      });

      res.json({
        notifications,
        total,
        unreadCount,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ message: 'Failed to get notifications' });
    }
  }
);

// Mark notification as read
router.put('/:notificationId/read',
  authMiddleware,
  async (req, res) => {
    try {
      const notification = await Notification.findOne({
        _id: req.params.notificationId,
        userId: req.userId
      });

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ message: 'Failed to update notification' });
    }
  }
);

// Mark all notifications as read
router.put('/mark-all-read',
  authMiddleware,
  async (req, res) => {
    try {
      await Notification.updateMany(
        { userId: req.userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ message: 'Failed to update notifications' });
    }
  }
);

// Delete notification
router.delete('/:notificationId',
  authMiddleware,
  async (req, res) => {
    try {
      const notification = await Notification.findOne({
        _id: req.params.notificationId,
        userId: req.userId
      });

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      await notification.deleteOne();
      res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ message: 'Failed to delete notification' });
    }
  }
);

module.exports = router;