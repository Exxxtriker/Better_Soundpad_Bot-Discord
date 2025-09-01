const Profile = require('../models/profile');

const XP_PER_MESSAGE = 5;
const INTERACTION_COOLDOWN = 60 * 1000; // 1 minuto entre interações

// Função para adicionar XP e pontos
async function addInteraction(userId, username) {
    let profile = await Profile.findOne({ userId });
    const now = new Date();

    if (!profile) {
        profile = new Profile({ userId, username });
    } else {
        profile.username = username; // atualiza nome caso mude
    }

    // Limitar spam
    if (profile.lastInteraction && now - profile.lastInteraction < INTERACTION_COOLDOWN) {
        return profile; // não adiciona XP se ainda estiver no cooldown
    }

    profile.points += XP_PER_MESSAGE;
    profile.xp += XP_PER_MESSAGE;
    profile.lastInteraction = now;

    // Calcula nível (ex: 100 XP = nível 2)
    const xpNeeded = profile.level * 100;
    if (profile.xp >= xpNeeded) {
        profile.level += 1;
        profile.xp -= xpNeeded;
    }

    await profile.save();
    return profile;
}

// Função para desbloquear emblemas
async function checkEmblems(profile) {
    const newEmblems = [];

    if (profile.points >= 10 && !profile.emblems.includes('Novato')) {
        profile.emblems.push('Novato');
        newEmblems.push('Novato');
    }
    if (profile.points >= 50 && !profile.emblems.includes('Interativo')) {
        profile.emblems.push('Interativo');
        newEmblems.push('Interativo');
    }
    if (profile.points >= 100 && !profile.emblems.includes('Veterano')) {
        profile.emblems.push('Veterano');
        newEmblems.push('Veterano');
    }

    await profile.save();
    return newEmblems;
}

// Obter perfil
async function getProfile(userId) {
    return await Profile.findOne({ userId });
}

module.exports = { addInteraction, checkEmblems, getProfile };
