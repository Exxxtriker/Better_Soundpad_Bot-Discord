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
        color: { type: String, default: '#00FF00' },
        title: { type: String, default: '' },
    },
    lastDaily: { type: Date, default: null },
    lastInteraction: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
