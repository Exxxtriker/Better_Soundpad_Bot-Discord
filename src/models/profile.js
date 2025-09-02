const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    emblems: { type: [String], default: [] },
    rewards: { type: [String], default: [] },
    customizations: {
        color: { type: String, default: '#00FF00' },
        title: { type: String, default: '' },
    },
    lastInteraction: { type: Date, default: null },
});

module.exports = mongoose.model('Profile', profileSchema);
