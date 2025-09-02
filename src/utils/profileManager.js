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
    let profile = await Profile.findOne({ userId });
    const now = new Date();

    if (!profile) profile = new Profile({ userId, username });
    else profile.username = username;

    if (profile.lastInteraction && now - profile.lastInteraction < INTERACTION_COOLDOWN) {
        return profile;
    }

    // Adiciona pontos e XP
    profile.points += POINTS_PER_MESSAGE;
    profile.xp += XP_PER_MESSAGE;
    profile.lastInteraction = now;

    // Atualiza nível se XP atingir o necessário
    const xpNeeded = profile.level * 100;
    if (profile.xp >= xpNeeded) {
        profile.level += 1;
        profile.xp -= xpNeeded;
        profile.rank = calculateRank(profile.level);
    }

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
            points: 50, level: 0, emblem: 'Novato', reward: { type: 'color', value: 'Verde' },
        },
        {
            points: 250, level: 5, emblem: 'Interativo', reward: { type: 'color', value: 'Azul' },
        },
        {
            points: 1000, level: 10, emblem: 'Herói', reward: { type: 'title', value: 'Título Heroico' },
        },
        {
            points: 3000, level: 20, emblem: 'Mestre', reward: { type: 'color', value: 'Dourado' },
        },
        {
            points: 7000, level: 35, emblem: 'Lendário', reward: { type: 'title', value: 'Título Lendário' },
        },
        {
            points: 15000, level: 50, emblem: 'Ancião', reward: { type: 'color', value: 'Roxo' },
        },
        {
            points: 30000, level: 70, emblem: 'Imortal', reward: { type: 'title', value: 'Título Imortal' },
        },
        {
            points: 50000, level: 90, emblem: 'Deus', reward: { type: 'color', value: 'Vermelho Rubi' },
        },
        {
            points: 90000, level: 100, emblem: '☀️ Eterno ☀️', reward: { type: 'title', value: 'Título Custom' },
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
            profile.rewards.push(rule.reward);
            newRewards.push(rule.reward);
        }
    }

    await profile.save();
    return { newEmblems, newRewards };
}

async function getProfile(userId) {
    return await Profile.findOne({ userId });
}

module.exports = { addInteraction, checkEmblems, getProfile };
