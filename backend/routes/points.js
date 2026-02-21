const express = require('express');
const router = express.Router();
const PointTransaction = require('../models/PointTransaction');
const { protect } = require('../middleware/auth');

// @route   GET /api/points/history
// @desc    Get user's point transaction history
router.get('/history', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const transactions = await PointTransaction.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await PointTransaction.countDocuments({ userId: req.user._id });

        // Aggregate summary
        const summary = await PointTransaction.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$value' }
                }
            }
        ]);

        res.json({
            success: true,
            count: transactions.length,
            total,
            pages: Math.ceil(total / limit),
            transactions,
            summary
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/points/clan/:clanId
// @desc    Get clan's point transactions
router.get('/clan/:clanId', protect, async (req, res) => {
    try {
        const transactions = await PointTransaction.find({ clanId: req.params.clanId })
            .populate('userId', 'name profileImage')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
