const mongoose = require('mongoose');

const ClanSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String },
    region: { type: String, required: true },
    area: { type: String },
    points: { type: Number, default: 0 },
    ranking: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    maxMembers: { type: Number, default: 50, min: 2, max: 500 },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['leader', 'co-leader', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        contributedPoints: { type: Number, default: 0 }
    }],
    joinRequests: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        requestedAt: { type: Date, default: Date.now }
    }],
    invites: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        sentAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
    }],
    activeTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    completedTasks: { type: Number, default: 0 },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    badge: { type: String },
    drives: [{
        title: { type: String },
        type: { type: String, enum: ['cleanup', 'plantation', 'awareness', 'ngo'] },
        date: { type: Date },
        participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        isOpen: { type: Boolean, default: true },
        organizer: { type: String },
        description: { type: String }
    }],
    activities: [{
        title: { type: String, required: true },
        description: { type: String },
        type: { type: String, enum: ['cleanup', 'plantation', 'awareness', 'water', 'recycling', 'energy', 'other'], default: 'other' },
        date: { type: Date },
        location: { type: String },
        proposedBy: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            name: { type: String }
        },
        proposedAt: { type: Date, default: Date.now },
        participants: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            name: { type: String },
            joinedAt: { type: Date, default: Date.now }
        }],
        status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
        completedAt: { type: Date },
        pointsAwarded: { type: Number, default: 0 }
    }],
    impact: {
        treesPlanted: { type: Number, default: 0 },
        garbageCleared: { type: Number, default: 0 },
        waterIssuesResolved: { type: Number, default: 0 },
        co2Reduced: { type: Number, default: 0 }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isNGO: { type: Boolean, default: false },
    ngoLicense: { type: String }
}, { timestamps: true });

ClanSchema.index({ location: '2dsphere' });
ClanSchema.index({ region: 1 });

module.exports = mongoose.model('Clan', ClanSchema);
