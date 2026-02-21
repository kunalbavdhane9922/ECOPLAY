const express = require('express');
const router = express.Router();
const Clan = require('../models/Clan');
const User = require('../models/User');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

// ─── GET /api/clans ────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
    try {
        const { region, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = region ? { region } : {};
        const clans = await Clan.find(query)
            .select('-members.userId -joinRequests -invites')
            .sort({ points: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        const rankedClans = clans.map((clan, index) => ({ ...clan.toObject(), ranking: skip + index + 1 }));
        const total = await Clan.countDocuments(query);
        res.json({ success: true, count: clans.length, total, clans: rankedClans });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/clans/my-invites ────────────────────────────────────────────────
router.get('/my-invites', protect, async (req, res) => {
    try {
        const clans = await Clan.find({
            'invites.userId': req.user._id,
            'invites.status': 'pending'
        }).select('name badge region description invites');

        const invites = clans.map(c => {
            const inv = c.invites.find(i => i.userId.toString() === req.user._id.toString() && i.status === 'pending');
            return { clanId: c._id, clanName: c.name, badge: c.badge, region: c.region, description: c.description, inviteId: inv?._id, sentAt: inv?.sentAt };
        });
        res.json({ success: true, invites });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/clans/nearby ────────────────────────────────────────────────────
router.get('/nearby', protect, async (req, res) => {
    try {
        const { lat, lng, radius = 50000 } = req.query;
        if (!lat || !lng) return res.status(400).json({ success: false, message: 'Location required' });
        const clans = await Clan.find({
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseInt(radius)
                }
            }
        }).select('-joinRequests -invites').limit(20);
        res.json({ success: true, clans });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/clans/my ────────────────────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
    try {
        if (!req.user.clanId) return res.status(404).json({ success: false, message: 'You are not part of any clan' });
        const clan = await Clan.findById(req.user.clanId)
            .populate('members.userId', 'name profileImage totalPoints level')
            .populate('joinRequests.userId', 'name profileImage totalPoints level')
            .populate('activeTasks');
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });
        const clansAbove = await Clan.countDocuments({ points: { $gt: clan.points } });
        res.json({ success: true, clan: { ...clan.toObject(), ranking: clansAbove + 1 } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/clans/leaderboard/global ───────────────────────────────────────
router.get('/leaderboard/global', protect, async (req, res) => {
    try {
        const clans = await Clan.find()
            .select('name region points impact members badge')
            .sort({ points: -1 })
            .limit(50);
        const ranked = clans.map((c, i) => ({
            rank: i + 1, name: c.name, badge: c.badge, region: c.region,
            points: c.points, memberCount: c.members.length, impact: c.impact
        }));
        res.json({ success: true, leaderboard: ranked });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── GET /api/clans/:id ───────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id)
            .populate('members.userId', 'name profileImage totalPoints level badges')
            .populate('activeTasks');
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });
        const clansAbove = await Clan.countDocuments({ points: { $gt: clan.points } });
        res.json({ success: true, clan: { ...clan.toObject(), ranking: clansAbove + 1 } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans ──────────────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
    try {
        const { name, description, region, area, location, isPrivate, maxMembers, inviteUsernames } = req.body;

        if (req.user.clanId) {
            return res.status(400).json({ success: false, message: 'Leave your current clan before creating a new one' });
        }
        const existing = await Clan.findOne({ name });
        if (existing) return res.status(400).json({ success: false, message: 'Clan name already taken' });

        const clan = await Clan.create({
            name, description, region, area,
            isPrivate: !!isPrivate,
            maxMembers: Math.min(Math.max(parseInt(maxMembers) || 50, 2), 500),
            location: location || { type: 'Point', coordinates: [0, 0] },
            members: [{ userId: req.user._id, role: 'leader' }],
            createdBy: req.user._id
        });

        await User.findByIdAndUpdate(req.user._id, { clanId: clan._id, clanName: clan.name });

        // Send invites by username
        if (inviteUsernames && inviteUsernames.length > 0) {
            for (const uname of inviteUsernames) {
                const invitedUser = await User.findOne({ name: { $regex: new RegExp(`^${uname.trim()}$`, 'i') } });
                if (invitedUser && invitedUser._id.toString() !== req.user._id.toString()) {
                    clan.invites.push({ userId: invitedUser._id, username: invitedUser.name, status: 'pending' });
                }
            }
            await clan.save();
        }

        res.status(201).json({ success: true, clan });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// ─── POST /api/clans/:id/join ─────────────────────────────────────────────────
router.post('/:id/join', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        // Already a member?
        const alreadyMember = clan.members.find(m => m.userId.toString() === req.user._id.toString());
        if (alreadyMember) return res.status(400).json({ success: false, message: 'Already a member' });

        // Already requested?
        const alreadyRequested = clan.joinRequests.find(r => r.userId.toString() === req.user._id.toString());
        if (alreadyRequested) return res.status(400).json({ success: false, message: 'Join request already sent' });

        // Capacity check
        if (clan.members.length >= clan.maxMembers) {
            return res.status(400).json({ success: false, message: `Clan is full (${clan.maxMembers} members max)` });
        }

        // Leave current clan if any
        if (req.user.clanId) {
            await Clan.findByIdAndUpdate(req.user.clanId, { $pull: { members: { userId: req.user._id } } });
        }

        if (clan.isPrivate) {
            clan.joinRequests.push({ userId: req.user._id, name: req.user.name });
            await clan.save();
            return res.json({ success: true, message: 'Join request sent! Waiting for leader approval.', requested: true });
        }

        clan.members.push({ userId: req.user._id, role: 'member' });
        await clan.save();
        await User.findByIdAndUpdate(req.user._id, { clanId: clan._id, clanName: clan.name });

        const io = req.app.get('socketio');
        io.to(`clan_${clan._id}`).emit('member_joined', { clanId: clan._id, userName: req.user.name, message: `${req.user.name} joined the clan!` });

        res.json({ success: true, message: `Welcome to ${clan.name}!`, clan });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/requests/:userId/approve ─────────────────────────────
router.post('/:id/requests/:userId/approve', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const isLeader = clan.members.find(m => m.userId.toString() === req.user._id.toString() && ['leader', 'co-leader'].includes(m.role));
        if (!isLeader) return res.status(403).json({ success: false, message: 'Only the clan leader can approve requests' });

        const reqIndex = clan.joinRequests.findIndex(r => r.userId.toString() === req.params.userId);
        if (reqIndex === -1) return res.status(404).json({ success: false, message: 'Join request not found' });

        if (clan.members.length >= clan.maxMembers) {
            return res.status(400).json({ success: false, message: 'Clan is now full, cannot approve' });
        }

        clan.joinRequests.splice(reqIndex, 1);
        clan.members.push({ userId: req.params.userId, role: 'member' });
        await clan.save();

        await User.findByIdAndUpdate(req.params.userId, { clanId: clan._id, clanName: clan.name });

        res.json({ success: true, message: 'Member approved and added to clan!', clan });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/requests/:userId/reject ──────────────────────────────
router.post('/:id/requests/:userId/reject', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const isLeader = clan.members.find(m => m.userId.toString() === req.user._id.toString() && ['leader', 'co-leader'].includes(m.role));
        if (!isLeader) return res.status(403).json({ success: false, message: 'Only the clan leader can reject requests' });

        clan.joinRequests = clan.joinRequests.filter(r => r.userId.toString() !== req.params.userId);
        await clan.save();

        res.json({ success: true, message: 'Join request rejected' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/invite ───────────────────────────────────────────────
router.post('/:id/invite', protect, async (req, res) => {
    try {
        const { username } = req.body;
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const isLeader = clan.members.find(m => m.userId.toString() === req.user._id.toString() && ['leader', 'co-leader'].includes(m.role));
        if (!isLeader) return res.status(403).json({ success: false, message: 'Only leaders can invite members' });

        const invitedUser = await User.findOne({ name: { $regex: new RegExp(`^${username.trim()}$`, 'i') } });
        if (!invitedUser) return res.status(404).json({ success: false, message: `User "${username}" not found` });

        const alreadyMember = clan.members.find(m => m.userId.toString() === invitedUser._id.toString());
        if (alreadyMember) return res.status(400).json({ success: false, message: 'User is already a member' });

        const alreadyInvited = clan.invites.find(i => i.userId.toString() === invitedUser._id.toString() && i.status === 'pending');
        if (alreadyInvited) return res.status(400).json({ success: false, message: 'User already has a pending invite' });

        clan.invites.push({ userId: invitedUser._id, username: invitedUser.name, status: 'pending' });
        await clan.save();

        res.json({ success: true, message: `Invite sent to ${invitedUser.name}!` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/invites/:clanId/respond ──────────────────────────────────
router.post('/invites/:clanId/respond', protect, async (req, res) => {
    try {
        const { accept } = req.body;
        const clan = await Clan.findById(req.params.clanId);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const invite = clan.invites.find(i => i.userId.toString() === req.user._id.toString() && i.status === 'pending');
        if (!invite) return res.status(404).json({ success: false, message: 'Invite not found or already responded' });

        if (accept) {
            if (clan.members.length >= clan.maxMembers) {
                invite.status = 'declined';
                await clan.save();
                return res.status(400).json({ success: false, message: 'Clan is full, cannot join' });
            }
            // Leave current clan if any
            if (req.user.clanId) {
                await Clan.findByIdAndUpdate(req.user.clanId, { $pull: { members: { userId: req.user._id } } });
            }
            invite.status = 'accepted';
            clan.members.push({ userId: req.user._id, role: 'member' });
            await clan.save();
            await User.findByIdAndUpdate(req.user._id, { clanId: clan._id, clanName: clan.name });
            res.json({ success: true, message: `You joined ${clan.name}!`, clan });
        } else {
            invite.status = 'declined';
            await clan.save();
            res.json({ success: true, message: 'Invite declined' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/leave ────────────────────────────────────────────────
router.post('/:id/leave', protect, async (req, res) => {
    try {
        await Clan.findByIdAndUpdate(req.params.id, { $pull: { members: { userId: req.user._id } } });
        await User.findByIdAndUpdate(req.user._id, { $unset: { clanId: 1, clanName: 1 } });
        res.json({ success: true, message: 'Left clan successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/drives ───────────────────────────────────────────────
router.post('/:id/drives', protect, async (req, res) => {
    try {
        const { title, type, date, description, organizer } = req.body;
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });
        clan.drives.push({ title, type, date, description, organizer, isOpen: true });
        await clan.save();
        res.json({ success: true, message: 'Drive added!', clan });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:clanId/drives/:driveId/join ─────────────────────────────
router.post('/:clanId/drives/:driveId/join', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.clanId);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });
        const drive = clan.drives.id(req.params.driveId);
        if (!drive) return res.status(404).json({ success: false, message: 'Drive not found' });
        if (!drive.participants.includes(req.user._id)) {
            drive.participants.push(req.user._id);
            await clan.save();
        }
        res.json({ success: true, message: 'Joined drive!', drive });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ─── GET /api/clans/:id/activities ───────────────────────────────────────────
router.get('/:id/activities', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id).select('activities members name');
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });
        const isMember = clan.members.find(m => m.userId.toString() === req.user._id.toString());
        if (!isMember) return res.status(403).json({ success: false, message: 'You must be a member to view activities' });
        res.json({ success: true, activities: clan.activities });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/activities — propose ────────────────────────────────
router.post('/:id/activities', protect, async (req, res) => {
    try {
        const { title, description, type, date, location } = req.body;
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const isMember = clan.members.find(m => m.userId.toString() === req.user._id.toString());
        if (!isMember) return res.status(403).json({ success: false, message: 'Only clan members can propose activities' });
        if (!title) return res.status(400).json({ success: false, message: 'Activity title is required' });

        const activity = {
            title, description, type: type || 'other', date, location,
            proposedBy: { userId: req.user._id, name: req.user.name },
            participants: [{ userId: req.user._id, name: req.user.name }],
            status: 'active'
        };

        clan.activities.push(activity);
        await clan.save();

        // Notify clan via socket
        const io = req.app.get('socketio');
        io.to(`clan_${clan._id}`).emit('activity_proposed', {
            clanId: clan._id, proposerName: req.user.name,
            message: `${req.user.name} proposed a new activity: "${title}"`
        });

        const newActivity = clan.activities[clan.activities.length - 1];
        res.status(201).json({ success: true, message: 'Activity proposed!', activity: newActivity });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// ─── POST /api/clans/:id/activities/:actId/join ───────────────────────────────
router.post('/:id/activities/:actId/join', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const isMember = clan.members.find(m => m.userId.toString() === req.user._id.toString());
        if (!isMember) return res.status(403).json({ success: false, message: 'Only clan members can join activities' });

        const activity = clan.activities.id(req.params.actId);
        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
        if (activity.status !== 'active') return res.status(400).json({ success: false, message: 'This activity is no longer active' });

        const alreadyJoined = activity.participants.find(p => p.userId.toString() === req.user._id.toString());
        if (alreadyJoined) return res.status(400).json({ success: false, message: 'Already joined this activity' });

        activity.participants.push({ userId: req.user._id, name: req.user.name });
        await clan.save();

        res.json({ success: true, message: `You joined "${activity.title}"!`, activity });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/activities/:actId/unjoin ─────────────────────────────
router.post('/:id/activities/:actId/unjoin', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });
        const activity = clan.activities.id(req.params.actId);
        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
        activity.participants = activity.participants.filter(p => p.userId.toString() !== req.user._id.toString());
        await clan.save();
        res.json({ success: true, message: 'You left the activity', activity });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/:id/activities/:actId/complete ──────────────────────────
router.post('/:id/activities/:actId/complete', protect, async (req, res) => {
    try {
        const clan = await Clan.findById(req.params.id);
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        const activity = clan.activities.id(req.params.actId);
        if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
        if (activity.status === 'completed') return res.status(400).json({ success: false, message: 'Already completed' });

        // Only proposer or leader can complete
        const isLeader = clan.members.find(m => m.userId.toString() === req.user._id.toString() && ['leader', 'co-leader'].includes(m.role));
        const isProposer = activity.proposedBy?.userId?.toString() === req.user._id.toString();
        if (!isLeader && !isProposer) return res.status(403).json({ success: false, message: 'Only the proposer or leader can mark this complete' });

        const participantCount = activity.participants.length;
        const clanPointsEarned = 150 + (participantCount * 10);
        const personalPoints = 75;

        activity.status = 'completed';
        activity.completedAt = new Date();
        activity.pointsAwarded = clanPointsEarned;

        // Award clan points
        clan.points += clanPointsEarned;
        clan.completedTasks += 1;

        // Update impact based on activity type
        if (activity.type === 'plantation') clan.impact.treesPlanted += participantCount;
        else if (activity.type === 'cleanup') clan.impact.garbageCleared += participantCount * 2;
        else if (activity.type === 'water') clan.impact.waterIssuesResolved += 1;

        await clan.save();

        // Award personal points to all participants
        const User = require('../models/User');
        for (const p of activity.participants) {
            await User.findByIdAndUpdate(p.userId, { $inc: { totalPoints: personalPoints } });
            // Update member's contributedPoints
            const member = clan.members.find(m => m.userId.toString() === p.userId.toString());
            if (member) {
                member.contributedPoints = (member.contributedPoints || 0) + personalPoints;
            }
        }
        await clan.save();

        // Notify clan
        const io = req.app.get('socketio');
        io.to(`clan_${clan._id}`).emit('activity_completed', {
            clanId: clan._id, activityTitle: activity.title,
            message: `🎉 "${activity.title}" completed! Clan earned ${clanPointsEarned} XP!`
        });

        res.json({
            success: true,
            message: `Activity completed! Clan earned ${clanPointsEarned} XP, each participant earned ${personalPoints} XP!`,
            pointsAwarded: clanPointsEarned,
            activity
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// ─── POST /api/clans/:id/tasks — leader creates clan task ─────────────────────
router.post('/:id/tasks', protect, async (req, res) => {
    try {
        const { title, description, type, date, location, pointsReward } = req.body;
        const clan = await Clan.findById(req.params.id).populate('members.userId', 'name');
        if (!clan) return res.status(404).json({ success: false, message: 'Clan not found' });

        // Only leader / co-leader can create tasks
        const isLeader = clan.members.find(
            m => m.userId?._id?.toString() === req.user._id.toString() &&
                ['leader', 'co-leader'].includes(m.role)
        );
        if (!isLeader) {
            return res.status(403).json({ success: false, message: 'Only the clan leader can create tasks' });
        }

        if (!title || !type) {
            return res.status(400).json({ success: false, message: 'Title and type are required' });
        }

        // Build assignedUsers list with pending_approval for all clan members
        const assignedUsers = clan.members.map(m => ({
            userId: m.userId?._id || m.userId,
            status: 'pending_approval',
            acceptedAt: new Date()
        }));

        const task = await Task.create({
            title,
            description,
            type: type || 'other',
            clanId: clan._id,
            isClanTask: true,
            status: 'open',
            pointsReward: pointsReward || 50,
            assignedUsers,
            createdBy: req.user._id,
            location: location || { type: 'Point', coordinates: [0, 0] }
        });

        // Notify all clan members in real-time
        const io = req.app.get('socketio');
        if (io) {
            io.to(`clan_${clan._id}`).emit('clan_task_created', {
                taskId: task._id,
                title: task.title,
                createdBy: req.user.name,
                message: `New clan task: "${title}" — click Approve to join!`
            });
        }

        res.status(201).json({ success: true, message: 'Clan task created and assigned to all members!', task });
    } catch (error) {
        console.error('Clan task creation error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// ─── GET /api/clans/my-tasks — fetch clan tasks for current user ───────────────
router.get('/my-tasks/clan', protect, async (req, res) => {
    try {
        const tasks = await Task.find({
            isClanTask: true,
            'assignedUsers.userId': req.user._id
        }).sort({ createdAt: -1 });
        res.json({ success: true, tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─── POST /api/clans/tasks/:taskId/approve — member approves/joins clan task ──
router.post('/tasks/:taskId/approve', protect, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
        if (!task.isClanTask) return res.status(400).json({ success: false, message: 'This is not a clan task' });

        const assignedEntry = task.assignedUsers.find(
            a => a.userId.toString() === req.user._id.toString()
        );

        if (!assignedEntry) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
        }
        if (assignedEntry.status !== 'pending_approval') {
            return res.status(400).json({ success: false, message: 'Already approved or completed' });
        }

        // Approve: move to assigned
        assignedEntry.status = 'assigned';
        assignedEntry.acceptedAt = new Date();
        task.status = 'in_progress';
        await task.save();

        // Notify clan room
        const io = req.app.get('socketio');
        if (io) {
            io.to(`clan_${task.clanId}`).emit('task_approved', {
                taskId: task._id,
                userId: req.user._id,
                userName: req.user.name,
                message: `${req.user.name} joined the clan task!`
            });
        }

        res.json({ success: true, message: 'Task approved! You are now active on this mission.', task });
    } catch (error) {
        console.error('Clan task approve error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
