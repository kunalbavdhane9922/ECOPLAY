const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Clan = require('../models/Clan');
const { generateOTP, sendOTPEmail } = require('../utils/email');
const { awardPoints, checkStreakBadges, POINTS_CONFIG } = require('../utils/gamification');
const { protect } = require('../middleware/auth');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { name, email, phone, password } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone is required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : [])
            ]
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists with this email or phone' });
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);

        const user = await User.create({
            name,
            email: email || undefined,
            phone: phone || undefined,
            password,
            otp,
            otpExpiry,
            isEmailVerified: false
        });

        // Send OTP email
        console.log(`🔑 DEBUG: OTP for ${name} (${email || phone}): ${otp}`);
        if (email) {
            await sendOTPEmail(email, otp, name);
        }

        // Award signup bonus
        await awardPoints(user._id, POINTS_CONFIG.SIGNUP_BONUS, 'Welcome to Eco Platform!', 'signup_bonus');

        res.status(201).json({
            success: true,
            message: `OTP sent to ${email || phone}. Please verify to continue.`,
            userId: user._id
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and activate account
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        user.isVerified = true;
        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        user.lastLogin = new Date();
        user.streak = 1;
        await user.save();

        const token = generateToken(user._id);

        // Auto-assign clan based on location (default)
        const defaultClan = await Clan.findOne({ isNGO: false });
        if (defaultClan && !user.clanId) {
            user.clanId = defaultClan._id;
            user.clanName = defaultClan.name;
            await user.save();
            await Clan.findByIdAndUpdate(defaultClan._id, {
                $push: { members: { userId: user._id, role: 'member' } }
            });
        }

        await checkStreakBadges(user._id);

        res.json({
            success: true,
            message: 'Account verified successfully!',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                totalPoints: user.totalPoints,
                streak: user.streak,
                level: user.level,
                badges: user.badges,
                clanId: user.clanId,
                clanName: user.clanName
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        console.log(`🔑 DEBUG: OTP Resend for ${user.name}: ${otp}`);

        if (user.email) {
            await sendOTPEmail(user.email, otp, user.name);
        }

        res.json({ success: true, message: 'OTP resent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', [
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone is required' });
        }

        const query = email ? { email } : { phone };
        const user = await User.findOne(query);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.isBanned) {
            return res.status(403).json({ success: false, message: 'Account banned due to fraud' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Update streak on login
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
        if (lastLogin) lastLogin.setHours(0, 0, 0, 0);

        if (!lastLogin || lastLogin < today) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastLogin && lastLogin.getTime() === yesterday.getTime()) {
                user.streak += 1;
                if (user.streak % 7 === 0) {
                    await awardPoints(user._id, POINTS_CONFIG.STREAK_7_DAYS, `${user.streak}-day streak bonus!`, 'streak_milestone');
                } else {
                    await awardPoints(user._id, POINTS_CONFIG.DAILY_STREAK, 'Daily login streak', 'daily_streak');
                }
            } else if (!lastLogin) {
                user.streak = 1;
            } else {
                user.streak = 1;
            }
        }

        user.lastLogin = new Date();
        await user.save();
        await checkStreakBadges(user._id);

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                totalPoints: user.totalPoints,
                streak: user.streak,
                level: user.level,
                badges: user.badges,
                clanId: user.clanId,
                clanName: user.clanName,
                contributions: user.contributions
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/auth/send-otp-login
// @desc    Send OTP for OTP-based login
router.post('/send-otp-login', async (req, res) => {
    try {
        const { email, phone } = req.body;
        const query = email ? { email } : { phone };
        const user = await User.findOne(query);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        console.log(`🔑 DEBUG: Login OTP for ${user.name}: ${otp}`);

        if (email) await sendOTPEmail(email, otp, user.name);

        res.json({ success: true, message: 'Login OTP sent', userId: user._id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   POST /api/auth/otp-login
// @desc    Login with OTP
router.post('/otp-login', async (req, res) => {
    try {
        const { userId, otp } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.otp !== otp || new Date() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.otp = undefined;
        user.otpExpiry = undefined;
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);
        res.json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -otp -otpExpiry')
            .populate('clanId', 'name region points');

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
