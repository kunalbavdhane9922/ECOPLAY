const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BadgeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    icon: { type: String },
    earnedAt: { type: Date, default: Date.now },
    description: { type: String }
});

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: function () { return !this.phone; },
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
        type: String,
        enum: ['user', 'admin', 'ngo', 'verifier'],
        default: 'user'
    },
    clanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
    clanName: { type: String },
    region: { type: String },
    streak: { type: Number, default: 0 },
    lastLogin: { type: Date },
    lastActionDate: { type: Date },
    totalPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    badges: [BadgeSchema],
    profileImage: { type: String },
    bio: { type: String },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpiry: { type: Date },
    pushToken: { type: String },
    contributions: {
        treesPlanted: { type: Number, default: 0 },
        garbageCleared: { type: Number, default: 0 },
        waterIssuesResolved: { type: Number, default: 0 },
        reportsSubmitted: { type: Number, default: 0 },
        tasksCompleted: { type: Number, default: 0 },
        verificationsCompleted: { type: Number, default: 0 }
    },
    fraudFlags: { type: Number, default: 0 },
    isBanned: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes (email and phone indexes are already created via unique:true + sparse:true in schema)
UserSchema.index({ location: '2dsphere' });

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Calculate level based on points
UserSchema.methods.calculateLevel = function () {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (this.totalPoints >= thresholds[i]) {
            return i + 1;
        }
    }
    return 1;
};

module.exports = mongoose.model('User', UserSchema);
