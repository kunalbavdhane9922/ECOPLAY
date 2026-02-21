const mongoose = require('mongoose');

const PointTransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
    type: {
        type: String,
        enum: ['earn', 'deduct', 'bonus'],
        required: true
    },
    value: { type: Number, required: true },
    reason: { type: String, required: true },
    reasonCode: {
        type: String,
        enum: [
            'report_submitted',
            'task_completed',
            'daily_streak',
            'verification_bonus',
            'group_drive_bonus',
            'badge_earned',
            'clan_bonus',
            'fraud_penalty',
            'admin_adjustment',
            'signup_bonus',
            'streak_milestone'
        ]
    },
    referenceId: { type: String },
    referenceType: { type: String, enum: ['report', 'task', 'badge', 'streak', 'admin'] },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number }
}, { timestamps: true });

PointTransactionSchema.index({ userId: 1, createdAt: -1 });
PointTransactionSchema.index({ clanId: 1 });

module.exports = mongoose.model('PointTransaction', PointTransactionSchema);
