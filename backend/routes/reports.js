const express = require('express');
const router = express.Router();
const axios = require('axios');
const Report = require('../models/Report');
const Task = require('../models/Task');
const Clan = require('../models/Clan');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { awardPoints, penalizeUser, checkStreakBadges, POINTS_CONFIG } = require('../utils/gamification');

// @route   POST /api/reports
// @desc    Submit a new report
router.post('/', protect, async (req, res) => {
    try {
        const {
            type, subType, imageUrl, description,
            helpRequired, location, address, city, region
        } = req.body;

        if (!imageUrl || !type || !location) {
            return res.status(400).json({ success: false, message: 'Image URL, type, and location are required' });
        }

        // Create report (pending ML validation)
        const report = await Report.create({
            userId: req.user._id,
            clanId: req.user.clanId,
            type,
            subType,
            imageUrl,
            description,
            helpRequired,
            location: {
                type: 'Point',
                coordinates: [location.longitude, location.latitude]
            },
            address,
            city,
            region,
            status: 'pending',
            isAnonymous: true
        });

        // Update user contributions
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'contributions.reportsSubmitted': 1 }
        });

        // Call ML service asynchronously
        const io = req.app.get('socketio');
        callMLService(report, req.user, io);

        // Notify clan about new mission
        if (req.user.clanId) {
            io.to(`clan_${req.user.clanId}`).emit('new_report', {
                reportId: report._id,
                type: report.type,
                location: report.location,
                message: 'New mission available in your area!'
            });

            // Create a task from this report
            const task = await Task.create({
                type,
                title: `${type.charAt(0).toUpperCase() + type.slice(1)} Issue - ${address || region || 'Unknown Location'}`,
                description: description || `Report a ${type} related issue`,
                reportId: report._id,
                clanId: req.user.clanId,
                location: report.location,
                address,
                region,
                isClanTask: true,
                pointsReward: POINTS_CONFIG.TASK_COMPLETED,
                createdBy: req.user._id
            });

            await Clan.findByIdAndUpdate(req.user.clanId, {
                $push: { activeTasks: task._id }
            });

            report.task = task._id;
            await report.save();
        }

        // Broadcast globally so all map views update in real-time
        io.emit('new_report_global', {
            _id: report._id,
            type: report.type,
            subType: report.subType,
            status: report.status,
            location: report.location,
            description: report.description,
            address: report.address,
            imageUrl: report.imageUrl,
            region: report.region,
            city: report.city,
            timestamp: report.timestamp || report.createdAt,
            userId: req.user._id,
            userName: req.user.name,
        });

        res.status(201).json({
            success: true,
            message: 'Report submitted! Processing ML validation...',
            report: {
                _id: report._id,
                type: report.type,
                status: report.status,
                location: report.location,
                timestamp: report.timestamp
            }
        });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Async ML validation
// Async ML validation (Simulated)
async function callMLService(report, user, io) {
    console.log(`🔍 [Simulated ML] Processing report ${report._id} (will verify in 6s)...`);

    setTimeout(async () => {
        try {
            // Simulated validation result: always valid
            const mlResult = {
                is_valid: true,
                confidence: 0.95,
                category: report.type,
                is_blank: false,
                is_duplicate: false,
                fraud_flag: false,
                reason: 'Simulated verification'
            };

            const status = 'verified';
            const pointsToAward = POINTS_CONFIG.REPORT_SUBMITTED;

            await Report.findByIdAndUpdate(report._id, {
                status,
                mlValidation: {
                    isValid: mlResult.is_valid,
                    confidence: mlResult.confidence,
                    category: mlResult.category,
                    isBlank: mlResult.is_blank,
                    isDuplicate: mlResult.is_duplicate,
                    fraudFlag: mlResult.fraud_flag,
                    reason: mlResult.reason,
                    processedAt: new Date()
                },
                pointsAwarded: pointsToAward
            });

            // Award points
            await awardPoints(user._id, POINTS_CONFIG.REPORT_SUBMITTED,
                `Report verified: ${report.type} issue`, 'report_submitted', report._id, 'report');
            await checkStreakBadges(user._id);

            // Update clan impact
            if (user.clanId) {
                const impactField = report.type === 'tree' ? 'treesPlanted'
                    : report.type === 'garbage' ? 'garbageCleared'
                        : report.type === 'water' ? 'waterIssuesResolved' : null;

                if (impactField) {
                    await Clan.findByIdAndUpdate(user.clanId, {
                        $inc: { [`impact.${impactField}`]: 1 }
                    });
                }
            }

            // Emit real-time update
            io.emit('report_verified', {
                reportId: report._id,
                userId: user._id,
                type: report.type,
                pointsAwarded: POINTS_CONFIG.REPORT_SUBMITTED,
                message: `Report verified! +${POINTS_CONFIG.REPORT_SUBMITTED} points`
            });

            io.emit('report_status_update', {
                reportId: report._id,
                status,
                confidence: mlResult.confidence
            });

            console.log(`✅ [Simulated ML] Report ${report._id} verified successfully.`);
        } catch (error) {
            console.error('Simulated ML error:', error.message);
        }
    }, 6000);
}

// @route   GET /api/reports
// @desc    Get reports (with filters)
router.get('/', protect, async (req, res) => {
    try {
        const { type, status, lat, lng, radius = 5000, limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};

        if (type) query.type = type;
        if (status) query.status = status;

        // Geo query for nearby reports
        if (lat && lng) {
            query.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            };
        }

        const reports = await Report.find(query)
            .select('-userId') // Keep anonymous
            .populate('clanId', 'name')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Report.countDocuments(query);

        res.json({
            success: true,
            count: reports.length,
            total,
            pages: Math.ceil(total / limit),
            reports
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/reports/my
// @desc    Get current user's reports
router.get('/my', protect, async (req, res) => {
    try {
        const reports = await Report.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/reports/:id
// @desc    Get a single report
router.get('/:id', protect, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate('clanId', 'name region')
            .populate('task');

        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/reports/:id/verify
// @desc    Community verification of a report
router.post('/:id/verify', protect, async (req, res) => {
    try {
        const { vote } = req.body; // 'valid' or 'invalid'
        const report = await Report.findById(req.params.id);

        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
        if (report.userId.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot verify your own report' });
        }

        const alreadyVoted = report.verifications.find(
            v => v.userId.toString() === req.user._id.toString()
        );
        if (alreadyVoted) {
            return res.status(400).json({ success: false, message: 'Already voted on this report' });
        }

        report.verifications.push({ userId: req.user._id, vote });
        report.verificationCount += 1;

        // Auto-resolve based on votes
        const validVotes = report.verifications.filter(v => v.vote === 'valid').length;
        const invalidVotes = report.verifications.filter(v => v.vote === 'invalid').length;

        if (report.verificationCount >= 3) {
            if (validVotes > invalidVotes) {
                report.status = 'verified';
            } else {
                report.status = 'rejected';
            }
        }

        await report.save();

        // Award verification bonus
        await awardPoints(req.user._id, POINTS_CONFIG.VERIFICATION_DONE,
            'Community verification bonus', 'verification_bonus', report._id, 'report');

        res.json({ success: true, message: 'Vote recorded', report });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
