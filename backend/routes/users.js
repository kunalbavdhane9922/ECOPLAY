const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { LEVELS } = require('../utils/gamification');

// @route   GET /api/users/profile
// @desc    Get current user profile
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -otp -otpExpiry')
            .populate('clanId', 'name region points badge');

        const currentLevel = LEVELS.find(l => l.level === user.level) || LEVELS[0];
        const nextLevel = LEVELS.find(l => l.level === user.level + 1);
        const progressToNext = nextLevel
            ? Math.round(((user.totalPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100)
            : 100;

        res.json({
            success: true,
            user: {
                ...user.toObject(),
                currentLevelName: currentLevel.name,
                nextLevelName: nextLevel?.name,
                nextLevelPoints: nextLevel?.minPoints,
                progressToNext
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, bio, profileImage, pushToken } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (bio) updateData.bio = bio;
        if (profileImage) updateData.profileImage = profileImage;
        if (pushToken) updateData.pushToken = pushToken;

        const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true })
            .select('-password -otp -otpExpiry');

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/users/leaderboard
// @desc    Global user leaderboard
router.get('/leaderboard', protect, async (req, res) => {
    try {
        const { region, clanId, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (region) query.region = region;
        if (clanId) query.clanId = clanId;

        const users = await User.find(query)
            .select('name profileImage totalPoints level streak badges clanName region')
            .sort({ totalPoints: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const ranked = users.map((u, i) => ({
            rank: skip + i + 1,
            ...u.toObject()
        }));

        res.json({ success: true, leaderboard: ranked });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/users/impact-overview
// @desc    Get user's environmental impact summary
router.get('/impact-overview', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { contributions, totalPoints, level, streak, badges } = user;

        // Estimate CO2 reduction (trees = 21kg/year, garbage = 2kg CO2 saved per kg diverted)
        const co2Reduced = (contributions.treesPlanted * 21) + (contributions.garbageCleared * 5);

        res.json({
            success: true,
            impact: {
                treesPlanted: contributions.treesPlanted,
                garbageCleared: contributions.garbageCleared,
                waterIssuesResolved: contributions.waterIssuesResolved,
                reportsSubmitted: contributions.reportsSubmitted,
                tasksCompleted: contributions.tasksCompleted,
                verificationsCompleted: contributions.verificationsCompleted,
                co2Reduced,
                totalPoints,
                level,
                streak,
                badgeCount: badges.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (public profile)
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('name profileImage totalPoints level streak badges clanName contributions')
            .populate('clanId', 'name');

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
