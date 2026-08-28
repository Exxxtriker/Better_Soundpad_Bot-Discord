const Profile = require('../models/profile');

const XP_PER_MESSAGE = 1; // XP por mensagem
const POINTS_PER_MESSAGE = 2; // Pontos por mensagem
const INTERACTION_COOLDOWN = 60 * 1000; // 1 minuto

function calculateRank(level) {
    if (level >= 90) return 'Ancião';
    if (level >= 70) return 'Lendário';
    if (level >= 50) return 'Mestre';
    if (level >= 30) return 'Herói';
    if (level >= 10) return 'Aventureiro';
    return 'Novato';
}

async function addInteraction(userId, username) {
    const now = new Date();
    const cooldownLimit = new Date(now.getTime() - INTERACTION_COOLDOWN);

    await Profile.updateOne(
        { userId },
        { $set: { username }, $setOnInsert: { userId } },
        { upsert: true, setDefaultsOnInsert: true },
    );

    const profile = await Profile.findOneAndUpdate(
        {
            userId,
            $or: [
                { lastInteraction: null },
                { lastInteraction: { $lte: cooldownLimit } },
            ],
        },
        {
            $inc: { points: POINTS_PER_MESSAGE, xp: XP_PER_MESSAGE },
            $set: { lastInteraction: now, username },
        },
        { new: true },
    );

    if (!profile) return Profile.findOne({ userId });

    const xpNeeded = profile.level * 100;
    if (profile.xp >= xpNeeded) {
        profile.level += 1;
        profile.xp -= xpNeeded;
    }

    profile.rank = calculateRank(profile.level);

    await profile.save();
    return profile;
}

// Verifica emblemas e desbloqueia recompensas
async function checkEmblems(profile) {
    const newEmblems = [];
    const newRewards = [];

    profile.emblems = profile.emblems || [];
    profile.rewards = profile.rewards || [];

    // Regras mais difíceis para desbloqueio
    const emblemRules = [
        {
            points: 50, level: 0, emblem: '<:d4:1412780743117246615> Novato',
        },
        {
            points: 250, level: 5, emblem: '<:d6:1412780753904996435> Interativo',
        },
        {
            points: 1000, level: 10, emblem: '<:d8:1412780768740114543> Herói',
        },
        {
            points: 3000, level: 20, emblem: '<:d10:1412780786675089478> Mestre',
        },
        {
            points: 7000, level: 35, emblem: '<:d12:1412780918837477387> Lendário',
        },
        {
            points: 15000, level: 50, emblem: '<:d20:1412780936055230567> Ancião',
        },
        {
            points: 30000, level: 70, emblem: '<:rpggoldshield:1412780636032209009> Imortal',
        },
        {
            points: 50000, level: 90, emblem: '<:rpgbigsword:1412780685571129374> Deus',
        },
        {
            points: 90000, level: 100, emblem: '<:rpgwarhammer:1412780570290815046> Eterno',
        },
    ];

    for (const rule of emblemRules) {
        if (
            profile.points >= rule.points
            && profile.level >= rule.level
            && !profile.emblems.includes(rule.emblem)
        ) {
            profile.emblems.push(rule.emblem);
            newEmblems.push(rule.emblem);
        }
    }

    await profile.save();
    return { newEmblems, newRewards };
}

async function getProfile(userId) {
    return Profile.findOne({ userId });
}

module.exports = { addInteraction, checkEmblems, getProfile };
