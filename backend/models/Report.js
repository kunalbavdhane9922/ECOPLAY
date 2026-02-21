const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
    type: {
        type: String,
        enum: ['tree', 'garbage', 'water', 'other'],
        required: true
    },
    subType: { type: String },
    imageUrl: { type: String, required: true },
    imageHash: { type: String },
    description: { type: String },
    helpRequired: { type: Boolean, default: false },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }
    },
    address: { type: String },
    city: { type: String },
    region: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'under_review', 'verified', 'rejected', 'resolved', 'fraud'],
        default: 'pending'
    },
    mlValidation: {
        isValid: Boolean,
        confidence: Number,
        category: String,
        isBlank: Boolean,
        isDuplicate: Boolean,
        fraudFlag: Boolean,
        reason: String,
        processedAt: Date
    },
    pointsAwarded: { type: Number, default: 0 },
    verifications: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        vote: { type: String, enum: ['valid', 'invalid'] },
        timestamp: { type: Date, default: Date.now }
    }],
    verificationCount: { type: Number, default: 0 },
    isAnonymous: { type: Boolean, default: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }
}, { timestamps: true });

ReportSchema.index({ location: '2dsphere' });
ReportSchema.index({ type: 1, status: 1 });
ReportSchema.index({ userId: 1 });
ReportSchema.index({ clanId: 1 });

module.exports = mongoose.model('Report', ReportSchema);
