const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Report = require('../models/Report');
const Task = require('../models/Task');
const Clan = require('../models/Clan');
const PointTransaction = require('../models/PointTransaction');
const { protect, authorize } = require('../middleware/auth');
const { awardPoints, penalizeUser } = require('../utils/gamification');

// Secure all admin routes
router.use(protect, authorize('admin'));

// @route   GET /api/admin/stats
// @desc    Platform-wide statistics
router.get('/stats', async (req, res) => {
    try {
        const [
            totalUsers, totalReports, totalTasks, totalClans,
            verifiedReports, fraudReports, totalPointsAwarded
        ] = await Promise.all([
            User.countDocuments(),
            Report.countDocuments(),
            Task.countDocuments(),
            Clan.countDocuments(),
            Report.countDocuments({ status: 'verified' }),
            Report.countDocuments({ status: 'fraud' }),
            PointTransaction.aggregate([{ $group: { _id: null, total: { $sum: '$value' } } }])
        ]);

        const reportsByType = await Report.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        const recentUsers = await User.find()
            .select('name email totalPoints level createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalReports,
                totalTasks,
                totalClans,
                verifiedReports,
                fraudReports,
                totalPointsAwarded: totalPointsAwarded[0]?.total || 0,
                reportsByType,
                recentUsers
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (role) query.role = role;
        if (search) query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];

        const users = await User.find(query)
            .select('-password -otp')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/ban
// @desc    Ban/unban a user
router.put('/users/:id/ban', async (req, res) => {
    try {
        const { isBanned } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { isBanned }, { new: true });
        res.json({ success: true, message: `User ${isBanned ? 'banned' : 'unbanned'}`, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Change user role
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/admin/reports
// @desc    Get all reports for review
router.get('/reports', async (req, res) => {
    try {
        const { status, type, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (status) query.status = status;
        if (type) query.type = type;

        const reports = await Report.find(query)
            .populate('userId', 'name email')
            .populate('clanId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Report.countDocuments(query);

        res.json({ success: true, reports, total, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/admin/reports/:id/status
// @desc    Update report status manually
router.put('/reports/:id/status', async (req, res) => {
    try {
        const { status, reason } = req.body;
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status, resolvedAt: new Date(), resolvedBy: req.user._id },
            { new: true }
        );

        if (status === 'fraud') {
            await penalizeUser(report.userId, 50, reason || 'Report manually flagged as fraud');
        } else if (status === 'verified' && report.pointsAwarded === 0) {
            await awardPoints(report.userId, 30, 'Report manually verified', 'report_submitted');
        }

        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/admin/clans
// @desc    Create a default clan seed
router.post('/seed-clans', async (req, res) => {
    try {
        const defaultClans = [
            { name: 'Mumbai Green Warriors', region: 'Mumbai', area: 'Western Mumbai', location: { type: 'Point', coordinates: [72.8777, 19.0760] } },
            { name: 'Delhi Eco Guardians', region: 'Delhi', area: 'Central Delhi', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
            { name: 'Pune Nature Clan', region: 'Pune', area: 'Pune City', location: { type: 'Point', coordinates: [73.8567, 18.5204] } },
            { name: 'Bangalore EcoForce', region: 'Bangalore', area: 'South Bangalore', location: { type: 'Point', coordinates: [77.5946, 12.9716] } },
            { name: 'Chennai Clean Team', region: 'Chennai', area: 'Central Chennai', location: { type: 'Point', coordinates: [80.2707, 13.0827] } },
        ];

        const created = [];
        for (const c of defaultClans) {
            const exists = await Clan.findOne({ name: c.name });
            if (!exists) {
                const clan = await Clan.create(c);
                created.push(clan);
            }
        }

        res.json({ success: true, message: `Seeded ${created.length} clans`, created });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
