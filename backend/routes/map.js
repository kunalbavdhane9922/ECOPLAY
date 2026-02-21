const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MapModel = require('../models/Map');

/**
 * @route   POST /api/maps
 * @desc    Add a new pin when a user drops a location on the map
 * @access  Public (should ideally be private, but sticking to requested API)
 */
router.post('/', async (req, res) => {
    try {
        const { userId, username, title, description, latitude, longitude, category } = req.body;

        // Simple validation
        if (!userId || !username || !title || !description || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        const newPin = new MapModel({
            userId,
            username,
            title,
            description,
            latitude,
            longitude,
            category: category || 'other'
        });

        const savedPin = await newPin.save();

        // Broadcast the new pin to all connected clients
        const io = req.app.get('socketio');
        if (io) {
            io.emit('new_map_pin', savedPin);
        }

        res.status(201).json(savedPin);
    } catch (err) {
        console.error('Error saving map pin:', err);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

/**
 * @route   GET /api/maps
 * @desc    Fetch all stored map pins
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const pins = await MapModel.find().sort({ createdAt: -1 });
        res.status(200).json(pins);
    } catch (err) {
        console.error('Error fetching map pins:', err);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

module.exports = router;
