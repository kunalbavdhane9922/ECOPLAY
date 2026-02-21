const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const Clan = require('../models/Clan');

/**
 * Award points to a user and log the transaction
 */
const awardPoints = async (userId, value, reason, reasonCode, referenceId = null, referenceType = null) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const balanceBefore = user.totalPoints;
    user.totalPoints += value;
    user.level = user.calculateLevel();

    // Update streak on action
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastAction = user.lastActionDate ? new Date(user.lastActionDate) : null;
    if (lastAction) lastAction.setHours(0, 0, 0, 0);

    if (!lastAction || lastAction < today) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastAction && lastAction.getTime() === yesterday.getTime()) {
            user.streak += 1;
        } else if (!lastAction) {
            user.streak = 1;
        } else {
            user.streak = 1; // Reset streak
        }
        user.lastActionDate = new Date();
    }

    await user.save();

    // Log transaction
    const transaction = await PointTransaction.create({
        userId,
        clanId: user.clanId,
        type: value > 0 ? 'earn' : 'deduct',
        value,
        reason,
        reasonCode,
        referenceId: referenceId?.toString(),
        referenceType,
        balanceBefore,
        balanceAfter: user.totalPoints
    });

    // Update clan points if user is in a clan
    if (user.clanId && value > 0) {
        await Clan.findByIdAndUpdate(user.clanId, {
            $inc: { points: value },
            $set: { [`members.$[elem].contributedPoints`]: value }
        }, {
            arrayFilters: [{ 'elem.userId': userId }]
        });
    }

    return { user, transaction };
};

/**
 * Deduct points as penalty for fraud
 */
const penalizeUser = async (userId, value, reason) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const balanceBefore = user.totalPoints;
    user.totalPoints = Math.max(0, user.totalPoints - value);
    user.fraudFlags += 1;

    // Ban user if too many fraud flags
    if (user.fraudFlags >= 5) {
        user.isBanned = true;
    }

    await user.save();

    await PointTransaction.create({
        userId,
        type: 'deduct',
        value: -value,
        reason,
        reasonCode: 'fraud_penalty',
        balanceBefore,
        balanceAfter: user.totalPoints
    });

    return user;
};

/**
 * Award a badge to a user
 */
const awardBadge = async (userId, badgeName, badgeIcon, description) => {
    const user = await User.findById(userId);
    if (!user) return;

    const alreadyHas = user.badges.some(b => b.name === badgeName);
    if (alreadyHas) return;

    user.badges.push({ name: badgeName, icon: badgeIcon, description });
    await user.save();

    return user;
};

/**
 * Check and award streak badges
 */
const checkStreakBadges = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return;

    if (user.streak >= 7) await awardBadge(userId, '7-Day Streak', '🔥', 'Logged in for 7 consecutive days');
    if (user.streak >= 30) await awardBadge(userId, '30-Day Streak', '⚡', 'Logged in for 30 consecutive days');
    if (user.streak >= 100) await awardBadge(userId, 'Centurion', '💯', 'Logged in for 100 consecutive days');

    if (user.contributions.tasksCompleted >= 10) await awardBadge(userId, 'Task Master', '🎯', 'Completed 10 tasks');
    if (user.contributions.tasksCompleted >= 50) await awardBadge(userId, 'Eco Warrior', '🛡️', 'Completed 50 tasks');
    if (user.contributions.reportsSubmitted >= 5) await awardBadge(userId, 'Watchdog', '👁️', 'Submitted 5 reports');
    if (user.totalPoints >= 1000) await awardBadge(userId, 'Points Master', '⭐', 'Earned 1000 points');
};

/**
 * Get gamification levels config
 */
const LEVELS = [
    { level: 1, name: 'Seedling', minPoints: 0, maxPoints: 99 },
    { level: 2, name: 'Sprout', minPoints: 100, maxPoints: 299 },
    { level: 3, name: 'Sapling', minPoints: 300, maxPoints: 599 },
    { level: 4, name: 'Tree', minPoints: 600, maxPoints: 999 },
    { level: 5, name: 'Guardian', minPoints: 1000, maxPoints: 1499 },
    { level: 6, name: 'Protector', minPoints: 1500, maxPoints: 2499 },
    { level: 7, name: 'Champion', minPoints: 2500, maxPoints: 3999 },
    { level: 8, name: 'Eco Hero', minPoints: 4000, maxPoints: 5999 },
    { level: 9, name: 'Earth Guardian', minPoints: 6000, maxPoints: 9999 },
    { level: 10, name: 'Planet Savior', minPoints: 10000, maxPoints: Infinity }
];

const POINTS_CONFIG = {
    REPORT_SUBMITTED: 30,
    TASK_COMPLETED: 50,
    DAILY_STREAK: 10,
    VERIFICATION_DONE: 5,
    GROUP_DRIVE_BONUS: 25,
    SIGNUP_BONUS: 50,
    STREAK_7_DAYS: 70,
    STREAK_30_DAYS: 300,
    FRAUD_PENALTY: 100
};

module.exports = { awardPoints, penalizeUser, awardBadge, checkStreakBadges, LEVELS, POINTS_CONFIG };
