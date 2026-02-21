const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cron = require('node-cron');

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.error('💡 Tip: Check if your Atlas cluster is paused at cloud.mongodb.com');
        console.error('💡 Tip: Make sure your IP is whitelisted in Atlas Network Access');
        // Retry after 10 seconds instead of crashing
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Security & Performance Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Store io globally for routes
app.set('socketio', io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/clans', require('./routes/clans'));
app.use('/api/points', require('./routes/points'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/maps', require('./routes/map'));

// Serve Static Files (Uploads)
app.use('/uploads', express.static('uploads'));

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Socket.io Real-time
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join_clan', (clanId) => {
        socket.join(`clan_${clanId}`);
        console.log(`Socket ${socket.id} joined clan_${clanId}`);
    });

    socket.on('join_region', (region) => {
        socket.join(`region_${region}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Daily Streak Cron Job (runs at midnight)
cron.schedule('0 0 * * *', async () => {
    const User = require('./models/User');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset streaks for users who didn't login yesterday
    await User.updateMany(
        { lastLogin: { $lt: yesterday } },
        { $set: { streak: 0 } }
    );
    console.log('🔄 Daily streak reset job completed');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, io };
