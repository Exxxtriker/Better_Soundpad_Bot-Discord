const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    money: { type: Number, default: 0 },
    rank: { type: String, default: 'Novato' },
    emblems: { type: [String], default: [] },
    rewards: { type: [String], default: [] },
    customizations: {
        color: {
            type: String,
            default: '#8B1E2D',
            match: /^#[0-9a-f]{6}$/i,
        },
        title: {
            type: String, default: '', trim: true, maxlength: 30,
        },
        motto: {
            type: String, default: '', trim: true, maxlength: 80,
        },
        crest: {
            type: String, default: '⚔️', trim: true, maxlength: 8,
        },
    },
    lastDaily: { type: Date, default: null },
    lastInteraction: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
