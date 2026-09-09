const mongoose = require('mongoose');

const merchantStockSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    guildId: { type: String, required: true, index: true },
    dayKey: { type: String, required: true, index: true },
    itemId: { type: String, required: true },
    buyerId: { type: String, required: true },
    purchasedAt: { type: Date, default: Date.now },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0,
    },
}, { versionKey: false });

module.exports = mongoose.model('MerchantStock', merchantStockSchema);
