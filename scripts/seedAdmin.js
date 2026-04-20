require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/modules/users/user.model');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const adminData = {
      name: 'Admin User',
      email: 'admin@madeinegypt.com',
      password: 'adminPassword123',
      role: 'admin',
      isVerified: true
    };

    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('Admin already exists.');
      process.exit(0);
    }

    await User.create(adminData);
    console.log('Admin account seeded successfully!');
    console.log('Email: admin@madeinegypt.com');
    console.log('Password: adminPassword123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err);
    process.exit(1);
  }
};

seedAdmin();
