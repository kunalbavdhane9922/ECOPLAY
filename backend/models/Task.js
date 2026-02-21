const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['tree', 'garbage', 'water', 'plantation', 'cleanup', 'awareness', 'other'],
        required: true
    },
    title: { type: String, required: true },
    description: { type: String },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    address: { type: String },
    region: { type: String },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'completed', 'cancelled'],
        default: 'open'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    assignedUsers: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        acceptedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending_approval', 'assigned', 'completed', 'dropped'], default: 'assigned' }
    }],
    maxParticipants: { type: Number, default: 10 },
    isClanTask: { type: Boolean, default: false },
    isGroupDrive: { type: Boolean, default: false },
    pointsReward: { type: Number, default: 50 },
    bonusPoints: { type: Number, default: 0 },
    completionProof: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        imageUrl: { type: String },
        timestamp: { type: Date, default: Date.now },
        mlVerified: { type: Boolean, default: false },
        mlScore: { type: Number }
    }],
    completedAt: { type: Date },
    expiresAt: { type: Date },
    tags: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mapPinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Map' },
    rewardPaid: { type: Boolean, default: false }
}, { timestamps: true });

TaskSchema.index({ location: '2dsphere' });
TaskSchema.index({ status: 1 });
TaskSchema.index({ clanId: 1 });
TaskSchema.index({ type: 1 });

module.exports = mongoose.model('Task', TaskSchema);
