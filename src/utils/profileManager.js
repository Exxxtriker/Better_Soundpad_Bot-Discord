const Profile = require('../models/profile');

const XP_PER_MESSAGE = 5;
const INTERACTION_COOLDOWN = 60 * 1000; // 1 minuto

function calculateRank(level) {
    if (level >= 20) return 'Lendário';
    if (level >= 15) return 'Mestre';
    if (level >= 10) return 'Herói';
    if (level >= 5) return 'Aventureiro';
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

    profile.points += XP_PER_MESSAGE;
    profile.xp += XP_PER_MESSAGE;
    profile.lastInteraction = now;

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

    // Emblemas
    if (profile.points >= 10 && !profile.emblems.includes('Novato')) {
        profile.emblems.push('Novato');
        newEmblems.push('Novato');
        profile.rewards.push('Cor Verde'); // recompensa automática
        newRewards.push('Cor Verde');
    }
    if (profile.points >= 50 && !profile.emblems.includes('Interativo')) {
        profile.emblems.push('Interativo');
        newEmblems.push('Interativo');
        profile.rewards.push('Banner Azul');
        newRewards.push('Banner Azul');
    }
    if (profile.points >= 100 && !profile.emblems.includes('Mestre')) {
        profile.emblems.push('Mestre');
        newEmblems.push('Mestre');
        profile.rewards.push('Avatar Especial');
        newRewards.push('Avatar Especial');
    }
    if (profile.level >= 10 && !profile.emblems.includes('Herói')) {
        profile.emblems.push('Herói');
        newEmblems.push('Herói');
        profile.rewards.push('Título Heroico');
        newRewards.push('Título Heroico');
    }

    await profile.save();
    return { newEmblems, newRewards };
}

async function getProfile(userId) {
    return await Profile.findOne({ userId });
}

module.exports = { addInteraction, checkEmblems, getProfile };
