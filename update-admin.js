const mongoose = require('mongoose');
const User = require('./models/User.model');
require('dotenv').config();

const updateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('No admin found, creating one...');
      admin = new User({
        name: 'Admin',
        role: 'admin',
        email: 'ashiskumarmohanty739@gmail.com',
        password: 'Akmohanty'
      });
    } else {
      console.log('Admin found, updating...');
      admin.email = 'ashiskumarmohanty739@gmail.com';
      admin.password = 'Akmohanty';
    }

    await admin.save();
    console.log('Admin updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateAdmin();
