require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const run = async () => {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected');

        const phone = '9319329339';
        const user = await User.findOne({ phone });

        if (user) {
            console.log('❌ User already exists:', user.phone, user.role);
            // Reset password just in case
            user.password = 'admin123';
            await user.save();
            console.log('✅ Password reset to admin123');
        } else {
            console.log('⚠️ User not found. Creating...');
            const admin = new User({
                phone: '9319329339',
                password: 'admin123',
                name: 'Super Admin',
                role: 'admin'
            });
            await admin.save();
            console.log('✅ Admin user created successfully');
        }

        const allUsers = await User.find({});
        console.log('All Users:', allUsers.map(u => `${u.phone} (${u.role})`));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
};

run();
