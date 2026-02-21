const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

const seedUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const email = 'kunalbavdhane99@gmail.com';
        const password = 'password123';

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            console.log('User already exists, updating password and verifying...');
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(password, salt);
            user.isVerified = true;
            user.isEmailVerified = true;
            await user.save();
        } else {
            console.log('Creating new seed user...');
            user = await User.create({
                name: 'Kunal Bavdhane',
                email: email,
                password: password,
                isVerified: true,
                isEmailVerified: true,
                role: 'admin'
            });
        }

        console.log('-----------------------------------');
        console.log('Login credentials:');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('-----------------------------------');

        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
};

seedUser();
