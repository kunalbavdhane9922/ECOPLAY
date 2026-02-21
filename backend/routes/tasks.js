const express = require('express');
const router = express.Router();
const axios = require('axios');
const Task = require('../models/Task');
const User = require('../models/User');
const Clan = require('../models/Clan');
const MapModel = require('../models/Map');
const { protect, authorize } = require('../middleware/auth');
const { awardPoints, checkStreakBadges, POINTS_CONFIG } = require('../utils/gamification');

// @route   GET /api/tasks/nearby
// @desc    Get tasks near user's location
router.get('/nearby', protect, async (req, res) => {
    try {
        const { lat, lng, radius = 10000 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Location required' });
        }

        const tasks = await Task.find({
            status: 'open',
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        })
            .populate('clanId', 'name')
            .populate('reportId', 'type imageUrl')
            .limit(20);

        res.json({ success: true, count: tasks.length, tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/tasks/clan
// @desc    Get clan-specific tasks
router.get('/clan', protect, async (req, res) => {
    try {
        if (!req.user.clanId) {
            return res.status(400).json({ success: false, message: 'You are not part of a clan' });
        }

        const tasks = await Task.find({
            clanId: req.user.clanId,
            status: { $in: ['open', 'in_progress'] }
        })
            .populate('reportId', 'type imageUrl description')
            .sort({ priority: -1, createdAt: -1 });

        res.json({ success: true, count: tasks.length, tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/tasks/join
// @desc    Join a mission from a map pin
router.post('/join', protect, async (req, res) => {
    try {
        const { mapPinId } = req.body;
        if (!mapPinId) return res.status(400).json({ success: false, message: 'Map Pin ID required' });

        // Check if map pin exists
        const mapPin = await MapModel.findById(mapPinId);
        if (!mapPin) return res.status(404).json({ success: false, message: 'Map pin not found' });

        // Find or create task for this map pin
        let task = await Task.findOne({ mapPinId });

        if (!task) {
            task = await Task.create({
                type: mapPin.category || 'other',
                title: mapPin.title,
                description: mapPin.description,
                location: {
                    type: 'Point',
                    coordinates: [mapPin.longitude, mapPin.latitude]
                },
                mapPinId: mapPin._id,
                status: 'in_progress',
                createdBy: mapPin.userId // Original reporter
            });
        }

        // Prevent duplicate joins
        const alreadyAssigned = task.assignedUsers.find(
            a => a.userId.toString() === req.user._id.toString()
        );
        if (alreadyAssigned) {
            return res.status(400).json({ success: false, message: 'Already joined this mission' });
        }

        task.assignedUsers.push({ userId: req.user._id });
        task.status = 'in_progress';
        await task.save();

        res.json({ success: true, message: 'Joined mission!', task });
    } catch (error) {
        console.error('Join mission error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   DELETE /api/tasks/:id/verify
// @desc    Verify and complete mission — awards points, deletes task and map pin
router.delete('/:id/verify', protect, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        const io = req.app.get('socketio');

        // Award points to all assigned users (atomic, dedup via rewardPaid flag)
        if (!task.rewardPaid) {
            const pointsToAward = task.pointsReward || 50;
            const assignedUserIds = task.assignedUsers.map(a => a.userId);

            for (const uid of assignedUserIds) {
                try {
                    await User.findByIdAndUpdate(uid, {
                        $inc: {
                            totalPoints: pointsToAward,
                            'contributions.tasksCompleted': 1
                        }
                    });
                    // Recalculate level inline
                    const updatedUser = await User.findById(uid);
                    if (updatedUser) {
                        updatedUser.level = updatedUser.calculateLevel();
                        await updatedUser.save();
                    }
                } catch (pointErr) {
                    console.error('Points award error for', uid, pointErr.message);
                }
            }

            // Mark reward as paid to prevent duplicate payouts
            task.rewardPaid = true;
            await task.save();

            // Emit points notification
            if (io) {
                io.emit('mission_completed', {
                    taskId: task._id,
                    title: task.title,
                    pointsAwarded: pointsToAward,
                    message: `Mission verified! +${pointsToAward} pts awarded`
                });
            }
        }

        // Delete the map pin for real-time removal
        if (task.mapPinId) {
            await MapModel.findByIdAndDelete(task.mapPinId);
            if (io) io.emit('remove_map_pin', task.mapPinId);
        }

        // Delete the task
        await Task.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Mission verified! Points awarded.', pointsAwarded: task.pointsReward || 50 });
    } catch (error) {
        console.error('Verify mission error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/tasks/my
// @desc    Get tasks assigned to current user
router.get('/my', protect, async (req, res) => {
    try {
        const tasks = await Task.find({
            'assignedUsers.userId': req.user._id
        }).sort({ createdAt: -1 });

        res.json({ success: true, tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/tasks
// @desc    Get all open tasks
router.get('/', protect, async (req, res) => {
    try {
        const { type, status = 'open', clanId, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (type) query.type = type;
        if (status) query.status = status;
        if (clanId) query.clanId = clanId;

        const tasks = await Task.find(query)
            .populate('clanId', 'name region')
            .sort({ priority: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Task.countDocuments(query);

        res.json({ success: true, count: tasks.length, total, tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/tasks/:id/accept
// @desc    Accept a task
router.post('/:id/accept', protect, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        if (task.status !== 'open') {
            return res.status(400).json({ success: false, message: 'Task is not available' });
        }

        const alreadyAssigned = task.assignedUsers.find(
            a => a.userId.toString() === req.user._id.toString()
        );
        if (alreadyAssigned) {
            return res.status(400).json({ success: false, message: 'Already assigned to this task' });
        }

        if (task.assignedUsers.length >= task.maxParticipants) {
            return res.status(400).json({ success: false, message: 'Task is full' });
        }

        task.assignedUsers.push({ userId: req.user._id });
        task.status = 'in_progress';
        await task.save();

        const io = req.app.get('socketio');
        if (task.clanId) {
            io.to(`clan_${task.clanId}`).emit('task_accepted', {
                taskId: task._id,
                userId: req.user._id,
                userName: req.user.name
            });
        }

        res.json({ success: true, message: 'Task accepted!', task });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/tasks/:id/complete
// @desc    Submit completion proof for a task
router.post('/:id/complete', protect, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        const assignedUser = task.assignedUsers.find(
            a => a.userId.toString() === req.user._id.toString()
        );
        if (!assignedUser) {
            return res.status(403).json({ success: false, message: 'Not assigned to this task' });
        }

        // Update proof
        task.completionProof.push({
            userId: req.user._id,
            imageUrl,
            timestamp: new Date()
        });

        assignedUser.status = 'completed';

        // Check if all assigned users completed
        const allCompleted = task.assignedUsers.every(u => u.status === 'completed');
        if (allCompleted) {
            task.status = 'completed';
            task.completedAt = new Date();
        }

        await task.save();

        // Kick off simulated 6s ML verification (passes IDs, not stale objects)
        const io = req.app.get('socketio');
        verifyCompletionProof(task._id, req.user._id, io);

        res.json({ success: true, message: 'Proof submitted! Auto-verifying in 6 seconds...', task });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Async task proof verification (Simulated — 6s auto-verify)
async function verifyCompletionProof(taskId, userId, io) {
    console.log(`🔍 [Simulated ML] Verifying task proof for user ${userId} on task ${taskId} (6s)...`);

    setTimeout(async () => {
        try {
            // Fetch fresh data from DB to avoid stale closure issues
            const task = await Task.findById(taskId);
            const user = await User.findById(userId);
            if (!task || !user) {
                console.log(`[Simulated ML] Task or user no longer exists, skipping.`);
                return;
            }

            const pointsToAward = task.pointsReward || 50;

            // Mark the proof as ML verified
            const proof = task.completionProof.find(p => p.userId.toString() === userId.toString());
            if (proof && !proof.mlVerified) {
                proof.mlVerified = true;
                proof.mlScore = 0.95;
            }

            // Update user stats atomically
            await User.findByIdAndUpdate(userId, {
                $inc: { totalPoints: pointsToAward, 'contributions.tasksCompleted': 1 }
            });
            const freshUser = await User.findById(userId);
            if (freshUser) {
                freshUser.level = freshUser.calculateLevel();
                await freshUser.save();
                await checkStreakBadges(userId);
            }

            await task.save();

            // Update clan impact
            if (user.clanId) {
                const clanField = task.type === 'tree' ? 'treesPlanted'
                    : task.type === 'garbage' ? 'garbageCleared'
                        : task.type === 'water' ? 'waterIssuesResolved' : null;
                if (clanField) {
                    await Clan.findByIdAndUpdate(user.clanId, { $inc: { [`impact.${clanField}`]: 1 } });
                }
            }

            // Emit real-time completion event
            io.emit('task_completed', {
                taskId: task._id,
                userId: userId,
                pointsAwarded: pointsToAward,
                message: `Proof verified! +${pointsToAward} points awarded 🎉`
            });

            console.log(`✅ [Simulated ML] Task ${taskId} proof verified for user ${userId}.`);
        } catch (error) {
            console.error('Simulated ML task verification error:', error.message);
        }
    }, 6000);
}

// @route   POST /api/tasks
// @desc    Create a new task (admin/ngo)
router.post('/', protect, authorize('admin', 'ngo'), async (req, res) => {
    try {
        const task = await Task.create({ ...req.body, createdBy: req.user._id });
        res.status(201).json({ success: true, task });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
