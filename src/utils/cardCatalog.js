const { randomInt, randomUUID } = require('node:crypto');
const path = require('node:path');

const RARITIES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico'];
const RARITY_COLORS = {
    Comum: 0x8B8D91,
    Incomum: 0x2F6B4F,
    Raro: 0x345995,
    Épico: 0x6A3D7C,
    Lendário: 0xC9A227,
    Mítico: 0xB326C9,
};
const COMBINE_CHANCES = {
    Comum: 60,
    Incomum: 50,
    Raro: 40,
    Épico: 25,
    Lendário: 10,
    Mítico: 0,
};
const CARD_BASE_VALUES = {
    Comum: 100,
    Incomum: 250,
    Raro: 750,
    Épico: 2_500,
    Lendário: 9_000,
    Mítico: 35_000,
};
const FLOAT_CONDITIONS = [
    { maximum: 0.07, name: 'Nova de Fábrica', emoji: '💎' },
    { maximum: 0.15, name: 'Pouco Usada', emoji: '✨' },
    { maximum: 0.38, name: 'Testada em Campo', emoji: '🛡️' },
    { maximum: 0.45, name: 'Bem Desgastada', emoji: '⚒️' },
    { maximum: 1.000001, name: 'Marcada por Batalhas', emoji: '🩸' },
];
const FLOAT_PRECISION = 1_000_000;

const CARD_ARTWORK = {
    class_warrior: 'class_warrior.png',
    class_rogue: 'class_rogue.png',
    class_ranger: 'class_ranger.png',
    class_bard: 'class_bard.png',
    class_cleric: 'class_cleric.png',
    class_barbarian: 'class_barbarian.png',
    class_monk: 'class_monk.png',
    class_druid: 'class_druid.png',
    class_paladin: 'class_paladin.png',
    class_sorcerer: 'class_sorcerer.png',
    class_artificer: 'class_artificer.png',
    class_warlock: 'class_warlock.png',
    class_wizard: 'class_wizard.png',
    class_necromancer: 'class_necromancer.png',
    class_runeknight: 'class_runeknight.png',
    class_chronomancer: 'class_chronomancer.png',
    race_human: 'race_human.png',
    race_elf: 'race_elf.png',
    race_dwarf: 'race_dwarf.png',
    race_halfling: 'race_halfling.png',
    race_orc: 'race_orc.png',
    race_gnome: 'race_gnome.png',
    race_goblin: 'race_goblin.png',
    race_kobold: 'race_kobold.png',
    race_tiefling: 'race_tiefling.png',
    race_dragonborn: 'race_dragonborn.png',
    race_genasi: 'race_genasi.png',
    race_tabaxi: 'race_tabaxi.png',
    race_aasimar: 'race_aasimar.png',
    race_firbolg: 'race_firbolg.png',
    race_changeling: 'race_changeling.png',
    race_triton: 'race_triton.png',
    race_celestial: 'race_celestial.png',
    race_ancient_dragon: 'race_ancient_dragon.png',
    terrain_ancient_forest: 'terrain_ancient_forest.png',
    terrain_golden_plains: 'terrain_golden_plains.png',
    terrain_witch_swamp: 'terrain_witch_swamp.png',
    terrain_scarlet_desert: 'terrain_scarlet_desert.png',
    terrain_lost_kingdom_ruins: 'terrain_lost_kingdom_ruins.png',
    terrain_underground_city: 'terrain_underground_city.png',
    terrain_floating_islands: 'terrain_floating_islands.png',
    terrain_dragon_valley: 'terrain_dragon_valley.png',
    terrain_infinite_library: 'terrain_infinite_library.png',
    terrain_worlds_end_throne: 'terrain_worlds_end_throne.png',
    terrain_astral_realm: 'terrain_astral_realm.png',
    terrain_world_heart: 'terrain_world_heart.png',
    tormenta_deity_aharadak: 'tormenta_deity_aharadak.png',
    tormenta_deity_allihanna: 'tormenta_deity_allihanna.png',
    tormenta_deity_arsenal: 'tormenta_deity_arsenal.png',
    tormenta_deity_azgher: 'tormenta_deity_azgher.png',
    tormenta_deity_hyninn: 'tormenta_deity_hyninn.png',
    tormenta_deity_kallyadranoch: 'tormenta_deity_kallyadranoch.png',
    tormenta_deity_khalmyr: 'tormenta_deity_khalmyr.png',
    tormenta_deity_lena: 'tormenta_deity_lena.png',
    tormenta_deity_lin_wu: 'tormenta_deity_lin_wu.png',
    tormenta_deity_marah: 'tormenta_deity_marah.png',
    tormenta_deity_megalokk: 'tormenta_deity_megalokk.png',
    tormenta_deity_nimb: 'tormenta_deity_nimb.png',
    tormenta_deity_oceano: 'tormenta_deity_oceano.png',
    tormenta_deity_sszzaas: 'tormenta_deity_sszzaas.png',
    tormenta_deity_tanna_toh: 'tormenta_deity_tanna_toh.png',
    tormenta_deity_tenebra: 'tormenta_deity_tenebra.png',
    tormenta_deity_thwor: 'tormenta_deity_thwor.png',
    tormenta_deity_thyatis: 'tormenta_deity_thyatis.png',
    tormenta_deity_valkaria: 'tormenta_deity_valkaria.png',
    tormenta_deity_wynna: 'tormenta_deity_wynna.png',
    tormenta_fallen_glorienn: 'tormenta_fallen_glorienn.png',
    tormenta_fallen_keenn: 'tormenta_fallen_keenn.png',
    tormenta_fallen_ragnar: 'tormenta_fallen_ragnar.png',
    tormenta_fallen_tauron: 'tormenta_fallen_tauron.png',
    tormenta_fallen_tillian: 'tormenta_fallen_tillian.png',
    tormenta_forgotten_divina_serpente: 'tormenta_forgotten_divina_serpente.png',
    tormenta_minor_sckhar: 'tormenta_minor_sckhar.png',
    tormenta_minor_beluhga: 'tormenta_minor_beluhga.png',
    tormenta_minor_benthos: 'tormenta_minor_benthos.png',
    tormenta_minor_rhond: 'tormenta_minor_rhond.png',
    tormenta_minor_hippion: 'tormenta_minor_hippion.png',
    tormenta_minor_tibar: 'tormenta_minor_tibar.png',
    tormenta_legend_lisandra: 'tormenta_legend_lisandra.png',
    tormenta_legend_sandro_galtran: 'tormenta_legend_sandro_galtran.png',
    tormenta_legend_niele: 'tormenta_legend_niele.png',
    tormenta_legend_tork: 'tormenta_legend_tork.png',
};

const CARD_CATALOG = [
    {
        id: 'class_warrior', type: 'Classe', name: 'Guerreiro', emoji: '⚔️', rarity: 'Comum',
    },
    {
        id: 'class_rogue', type: 'Classe', name: 'Ladino', emoji: '🗡️', rarity: 'Comum',
    },
    {
        id: 'class_ranger', type: 'Classe', name: 'Patrulheiro', emoji: '🏹', rarity: 'Comum',
    },
    {
        id: 'class_bard', type: 'Classe', name: 'Bardo', emoji: '🪕', rarity: 'Incomum',
    },
    {
        id: 'class_cleric', type: 'Classe', name: 'Clérigo', emoji: '✨', rarity: 'Incomum',
    },
    {
        id: 'class_barbarian', type: 'Classe', name: 'Bárbaro', emoji: '🪓', rarity: 'Incomum',
    },
    {
        id: 'class_monk', type: 'Classe', name: 'Monge', emoji: '🥋', rarity: 'Incomum',
    },
    {
        id: 'class_druid', type: 'Classe', name: 'Druida', emoji: '🌿', rarity: 'Raro',
    },
    {
        id: 'class_paladin', type: 'Classe', name: 'Paladino', emoji: '🛡️', rarity: 'Raro',
    },
    {
        id: 'class_sorcerer', type: 'Classe', name: 'Feiticeiro', emoji: '🔮', rarity: 'Raro',
    },
    {
        id: 'class_artificer', type: 'Classe', name: 'Artífice', emoji: '⚙️', rarity: 'Raro',
    },
    {
        id: 'class_warlock', type: 'Classe', name: 'Bruxo', emoji: '👁️', rarity: 'Épico',
    },
    {
        id: 'class_wizard', type: 'Classe', name: 'Arquimago', emoji: '🧙', rarity: 'Épico',
    },
    {
        id: 'class_necromancer', type: 'Classe', name: 'Necromante', emoji: '💀', rarity: 'Lendário',
    },
    {
        id: 'class_runeknight', type: 'Classe', name: 'Cavaleiro Rúnico', emoji: '⚜️', rarity: 'Lendário',
    },
    {
        id: 'class_chronomancer', type: 'Classe', name: 'Cronomante', emoji: '⌛', rarity: 'Mítico',
    },
    {
        id: 'race_human', type: 'Raça', name: 'Humano', emoji: '🧑', rarity: 'Comum',
    },
    {
        id: 'race_elf', type: 'Raça', name: 'Elfo', emoji: '🧝', rarity: 'Comum',
    },
    {
        id: 'race_dwarf', type: 'Raça', name: 'Anão', emoji: '⛏️', rarity: 'Comum',
    },
    {
        id: 'race_halfling', type: 'Raça', name: 'Pequenino', emoji: '🍀', rarity: 'Comum',
    },
    {
        id: 'race_orc', type: 'Raça', name: 'Orc', emoji: '🦷', rarity: 'Incomum',
    },
    {
        id: 'race_gnome', type: 'Raça', name: 'Gnomo', emoji: '🍄', rarity: 'Incomum',
    },
    {
        id: 'race_goblin', type: 'Raça', name: 'Goblin', emoji: '👺', rarity: 'Incomum',
    },
    {
        id: 'race_kobold', type: 'Raça', name: 'Kobold', emoji: '🦎', rarity: 'Incomum',
    },
    {
        id: 'race_tiefling', type: 'Raça', name: 'Tiefling', emoji: '😈', rarity: 'Raro',
    },
    {
        id: 'race_dragonborn', type: 'Raça', name: 'Draconato', emoji: '🐲', rarity: 'Raro',
    },
    {
        id: 'race_genasi', type: 'Raça', name: 'Genasi', emoji: '🌊', rarity: 'Raro',
    },
    {
        id: 'race_tabaxi', type: 'Raça', name: 'Tabaxi', emoji: '🐈', rarity: 'Raro',
    },
    {
        id: 'race_aasimar', type: 'Raça', name: 'Aasimar', emoji: '🪽', rarity: 'Épico',
    },
    {
        id: 'race_firbolg', type: 'Raça', name: 'Firbolg', emoji: '🌲', rarity: 'Épico',
    },
    {
        id: 'race_changeling', type: 'Raça', name: 'Metamorfo', emoji: '🎭', rarity: 'Épico',
    },
    {
        id: 'race_triton', type: 'Raça', name: 'Tritão', emoji: '🔱', rarity: 'Lendário',
    },
    {
        id: 'race_celestial', type: 'Raça', name: 'Celestial', emoji: '🌟', rarity: 'Lendário',
    },
    {
        id: 'race_ancient_dragon', type: 'Raça', name: 'Dragão Ancestral', emoji: '🐉', rarity: 'Mítico',
    },
    {
        id: 'terrain_ancient_forest', type: 'Terreno', name: 'Floresta Antiga', emoji: '🌲', rarity: 'Comum',
    },
    {
        id: 'terrain_golden_plains', type: 'Terreno', name: 'Planícies Douradas', emoji: '🌾', rarity: 'Comum',
    },
    {
        id: 'terrain_witch_swamp', type: 'Terreno', name: 'Pântano das Bruxas', emoji: '🌫️', rarity: 'Incomum',
    },
    {
        id: 'terrain_scarlet_desert', type: 'Terreno', name: 'Deserto Escarlate', emoji: '🏜️', rarity: 'Incomum',
    },
    {
        id: 'terrain_lost_kingdom_ruins', type: 'Terreno', name: 'Ruínas do Reino Perdido', emoji: '🏚️', rarity: 'Raro',
    },
    {
        id: 'terrain_underground_city', type: 'Terreno', name: 'Cidade Subterrânea', emoji: '🕳️', rarity: 'Raro',
    },
    {
        id: 'terrain_floating_islands', type: 'Terreno', name: 'Ilhas Flutuantes', emoji: '☁️', rarity: 'Épico',
    },
    {
        id: 'terrain_dragon_valley', type: 'Terreno', name: 'Vale dos Dragões', emoji: '🐲', rarity: 'Épico',
    },
    {
        id: 'terrain_infinite_library', type: 'Terreno', name: 'Biblioteca Infinita', emoji: '📚', rarity: 'Lendário',
    },
    {
        id: 'terrain_worlds_end_throne', type: 'Terreno', name: 'Trono do Fim do Mundo', emoji: '👑', rarity: 'Lendário',
    },
    {
        id: 'terrain_astral_realm', type: 'Terreno', name: 'Reino Astral', emoji: '🌌', rarity: 'Mítico',
    },
    {
        id: 'terrain_world_heart', type: 'Terreno', name: 'Coração do Mundo', emoji: '💠', rarity: 'Mítico',
    },
    {
        id: 'tormenta_deity_aharadak', type: 'Divindade de Arton', name: 'Aharadak', emoji: '👁️', rarity: 'Mítico',
    },
    {
        id: 'tormenta_deity_allihanna', type: 'Divindade de Arton', name: 'Allihanna', emoji: '🌿', rarity: 'Épico',
    },
    {
        id: 'tormenta_deity_arsenal', type: 'Divindade de Arton', name: 'Arsenal', emoji: '⚒️', rarity: 'Mítico',
    },
    {
        id: 'tormenta_deity_azgher', type: 'Divindade de Arton', name: 'Azgher', emoji: '☀️', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_hyninn', type: 'Divindade de Arton', name: 'Hyninn', emoji: '🎭', rarity: 'Épico',
    },
    {
        id: 'tormenta_deity_kallyadranoch', type: 'Divindade de Arton', name: 'Kallyadranoch', emoji: '🐉', rarity: 'Mítico',
    },
    {
        id: 'tormenta_deity_khalmyr', type: 'Divindade de Arton', name: 'Khalmyr', emoji: '⚖️', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_lena', type: 'Divindade de Arton', name: 'Lena', emoji: '🌱', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_lin_wu', type: 'Divindade de Arton', name: 'Lin-Wu', emoji: '🐲', rarity: 'Épico',
    },
    {
        id: 'tormenta_deity_marah', type: 'Divindade de Arton', name: 'Marah', emoji: '🕊️', rarity: 'Épico',
    },
    {
        id: 'tormenta_deity_megalokk', type: 'Divindade de Arton', name: 'Megalokk', emoji: '🦖', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_nimb', type: 'Divindade de Arton', name: 'Nimb', emoji: '🎲', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_oceano', type: 'Divindade de Arton', name: 'Oceano', emoji: '🌊', rarity: 'Épico',
    },
    {
        id: 'tormenta_deity_sszzaas', type: 'Divindade de Arton', name: 'Sszzaas', emoji: '🐍', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_tanna_toh', type: 'Divindade de Arton', name: 'Tanna-Toh', emoji: '📚', rarity: 'Épico',
    },
    {
        id: 'tormenta_deity_tenebra', type: 'Divindade de Arton', name: 'Tenebra', emoji: '🌑', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_thwor', type: 'Divindade de Arton', name: 'Thwor', emoji: '✊', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_thyatis', type: 'Divindade de Arton', name: 'Thyatis', emoji: '🔥', rarity: 'Lendário',
    },
    {
        id: 'tormenta_deity_valkaria', type: 'Divindade de Arton', name: 'Valkaria', emoji: '⚔️', rarity: 'Mítico',
    },
    {
        id: 'tormenta_deity_wynna', type: 'Divindade de Arton', name: 'Wynna', emoji: '🔮', rarity: 'Lendário',
    },
    {
        id: 'tormenta_fallen_glorienn', type: 'Divindade Caída', name: 'Glórienn', emoji: '🏹', rarity: 'Lendário',
    },
    {
        id: 'tormenta_fallen_keenn', type: 'Divindade Caída', name: 'Keenn', emoji: '🪓', rarity: 'Mítico',
    },
    {
        id: 'tormenta_fallen_ragnar', type: 'Divindade Caída', name: 'Ragnar', emoji: '💀', rarity: 'Mítico',
    },
    {
        id: 'tormenta_fallen_tauron', type: 'Divindade Caída', name: 'Tauron', emoji: '🐂', rarity: 'Mítico',
    },
    {
        id: 'tormenta_fallen_tillian', type: 'Divindade Caída', name: 'Tillian', emoji: '⚙️', rarity: 'Lendário',
    },
    {
        id: 'tormenta_forgotten_divina_serpente', type: 'Divindade Esquecida', name: 'Divina Serpente', emoji: '🐍', rarity: 'Lendário',
    },
    {
        id: 'tormenta_minor_sckhar', type: 'Deus Menor', name: 'Sckhar', emoji: '🐲', rarity: 'Lendário',
    },
    {
        id: 'tormenta_minor_beluhga', type: 'Deus Menor', name: 'Beluhga', emoji: '❄️', rarity: 'Lendário',
    },
    {
        id: 'tormenta_minor_benthos', type: 'Deus Menor', name: 'Benthos', emoji: '🔱', rarity: 'Lendário',
    },
    {
        id: 'tormenta_minor_rhond', type: 'Deus Menor', name: 'Rhond', emoji: '🔨', rarity: 'Épico',
    },
    {
        id: 'tormenta_minor_hippion', type: 'Deus Menor', name: 'Hippion', emoji: '🐎', rarity: 'Épico',
    },
    {
        id: 'tormenta_minor_tibar', type: 'Deus Menor', name: 'Tibar', emoji: '🪙', rarity: 'Épico',
    },
    {
        id: 'tormenta_legend_lisandra', type: 'Lenda de Arton', name: 'Lisandra', emoji: '🌹', rarity: 'Épico',
    },
    {
        id: 'tormenta_legend_sandro_galtran', type: 'Lenda de Arton', name: 'Sandro Galtran', emoji: '🗡️', rarity: 'Raro',
    },
    {
        id: 'tormenta_legend_niele', type: 'Lenda de Arton', name: 'Niele', emoji: '🎵', rarity: 'Lendário',
    },
    {
        id: 'tormenta_legend_tork', type: 'Lenda de Arton', name: 'Tork', emoji: '⚒️', rarity: 'Épico',
    },
];

const CARD_BY_ID = new Map(CARD_CATALOG.map((card) => [card.id, card]));

function getCard(cardId) {
    return CARD_BY_ID.get(cardId);
}

function getCardArtwork(cardOrId) {
    const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
    const filename = CARD_ARTWORK[cardId];
    if (!filename) return null;

    return {
        attachment: path.join(__dirname, '..', 'assets', 'cards', filename),
        name: filename,
        url: `attachment://${filename}`,
    };
}

function getCardsByRarity(rarity) {
    return CARD_CATALOG.filter((card) => card.rarity === rarity);
}

function getLegacyCardQuantity(profile, cardId) {
    if (profile?.cards?.get) return Number(profile.cards.get(cardId)) || 0;
    return Number(profile?.cards?.[cardId]) || 0;
}

function generateFloat(randomInteger = randomInt) {
    return randomInteger(FLOAT_PRECISION + 1) / FLOAT_PRECISION;
}

function formatFloat(float) {
    return Math.min(1, Math.max(0, Number(float) || 0)).toFixed(6);
}

function getFloatCondition(float) {
    const normalized = Math.min(1, Math.max(0, Number(float) || 0));
    return FLOAT_CONDITIONS.find((condition) => normalized < condition.maximum)
        || FLOAT_CONDITIONS.at(-1);
}

function getCardValue(cardOrId, float) {
    const card = typeof cardOrId === 'string' ? getCard(cardOrId) : cardOrId;
    if (!card) return 0;

    const normalized = Math.min(1, Math.max(0, Number(float) || 0));
    const wearMultiplier = 0.35 + (1.65 * ((1 - normalized) ** 2));
    let collectorMultiplier = 1;
    if (normalized < 0.001) collectorMultiplier = 1.75;
    else if (normalized < 0.01) collectorMultiplier = 1.25;
    return Math.max(1, Math.round(
        CARD_BASE_VALUES[card.rarity] * wearMultiplier * collectorMultiplier,
    ));
}

function createCardInstance(cardOrId, randomInteger = randomInt, uuid = randomUUID) {
    const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.id;
    if (!getCard(cardId)) throw new Error('Não é possível criar uma instância de carta inválida.');
    return {
        uid: uuid(),
        cardId,
        float: generateFloat(randomInteger),
        acquiredAt: new Date(),
    };
}

function getCardInstances(profile, cardId = null) {
    const instances = Array.from(profile?.cardInstances || [])
        .filter((instance) => instance?.uid && getCard(instance.cardId));
    const filtered = cardId
        ? instances.filter((instance) => instance.cardId === cardId)
        : instances;
    return filtered.sort((left, right) => Number(left.float) - Number(right.float));
}

function setCardQuantity(profile, cardId, quantity) {
    const normalized = Math.max(0, Number(quantity) || 0);
    if (profile?.cards?.set) profile.cards.set(cardId, normalized);
    else {
        if (!profile.cards) profile.cards = {};
        profile.cards[cardId] = normalized;
    }
}

function migrateLegacyCardInstances(profile) {
    if (!profile) return 0;
    if (!Array.isArray(profile.cardInstances)) profile.cardInstances = [];

    let changes = 0;
    CARD_CATALOG.forEach((card) => {
        const stored = getLegacyCardQuantity(profile, card.id);
        const current = getCardInstances(profile, card.id).length;
        for (let index = current; index < stored; index += 1) {
            profile.cardInstances.push(createCardInstance(card.id));
            changes += 1;
        }
        if (current > stored) {
            setCardQuantity(profile, card.id, current);
            changes += 1;
        }
    });

    const legacyMarriages = Array.from(profile.marriedCards || []);
    legacyMarriages.forEach((identifier) => {
        const card = getCard(identifier);
        if (!card) return;
        const instance = getCardInstances(profile, card.id)[0];
        if (!instance) return;
        profile.marriedCards = profile.marriedCards
            .filter((value) => value !== identifier);
        if (!profile.marriedCards.includes(instance.uid)) profile.marriedCards.push(instance.uid);
        changes += 1;
    });

    return changes;
}

function resolveCardInstance(profile, identifier) {
    const instances = getCardInstances(profile);
    return instances.find((instance) => instance.uid === identifier)
        || instances.find((instance) => instance.cardId === identifier)
        || null;
}

function addCardInstance(profile, instance) {
    if (!Array.isArray(profile.cardInstances)) profile.cardInstances = [];
    profile.cardInstances.push(instance);
    setCardQuantity(
        profile,
        instance.cardId,
        getCardInstances(profile, instance.cardId).length,
    );
}

function removeCardInstances(profile, instanceIds) {
    const removed = getCardInstances(profile)
        .filter((instance) => instanceIds.includes(instance.uid));
    profile.cardInstances = Array.from(profile.cardInstances || [])
        .filter((instance) => !instanceIds.includes(instance.uid));
    profile.marriedCards = Array.from(profile.marriedCards || [])
        .filter((identifier) => !instanceIds.includes(identifier));
    instanceIds.forEach((instanceId) => {
        if (profile?.cardDescriptions?.delete) profile.cardDescriptions.delete(instanceId);
        else if (profile?.cardDescriptions) delete profile.cardDescriptions[instanceId];
    });
    new Set(removed.map((instance) => instance.cardId)).forEach((cardId) => {
        setCardQuantity(profile, cardId, getCardInstances(profile, cardId).length);
    });
    return removed;
}

function getCardQuantity(profile, cardId) {
    return Math.max(getCardInstances(profile, cardId).length, getLegacyCardQuantity(profile, cardId));
}

function getCardTotal(profile) {
    return CARD_CATALOG.reduce(
        (total, card) => total + getCardQuantity(profile, card.id),
        0,
    );
}

function getCardDescription(profile, identifier) {
    const instance = resolveCardInstance(profile, identifier);
    const legacyCardId = instance?.cardId || identifier;
    if (profile?.cardDescriptions?.get) {
        return profile.cardDescriptions.get(identifier)
            || profile.cardDescriptions.get(legacyCardId)
            || '';
    }
    return profile?.cardDescriptions?.[identifier]
        || profile?.cardDescriptions?.[legacyCardId]
        || '';
}

function isCardMarried(profile, identifier) {
    if (!Array.isArray(profile?.marriedCards)) return false;
    if (profile.marriedCards.includes(identifier)) return true;
    const instance = resolveCardInstance(profile, identifier);
    return Boolean(instance && profile.marriedCards.includes(instance.cardId));
}

function getOwnedCards(profile, minimumQuantity = 1) {
    return CARD_CATALOG
        .map((card) => {
            const instances = getCardInstances(profile, card.id);
            const bestInstance = instances[0] || null;
            return {
                ...card,
                quantity: getCardQuantity(profile, card.id),
                instances,
                bestInstance,
                bestFloat: bestInstance?.float,
                bestValue: bestInstance ? getCardValue(card, bestInstance.float) : 0,
                totalValue: instances.reduce(
                    (total, instance) => total + getCardValue(card, instance.float),
                    0,
                ),
            };
        })
        .filter((card) => card.quantity >= minimumQuantity);
}

function getCollectionValue(profile) {
    return getCardInstances(profile).reduce((total, instance) => (
        total + getCardValue(instance.cardId, instance.float)
    ), 0);
}

function pickRandom(items, randomInteger = randomInt) {
    return items[randomInteger(items.length)];
}

function drawRarity(packType = 'basic', randomInteger = randomInt) {
    const roll = randomInteger(10_000);
    const thresholds = packType === 'arcane'
        ? [0, 0, 4_500, 7_500, 9_600, 10_000]
        : [4_500, 7_500, 9_100, 9_800, 9_980, 10_000];

    return RARITIES[thresholds.findIndex((threshold) => roll < threshold)];
}

function drawCard(packType = 'basic', randomInteger = randomInt, rarityBoost = 0) {
    const rolledRarity = drawRarity(packType, randomInteger);
    const rarityIndex = Math.min(
        RARITIES.length - 1,
        RARITIES.indexOf(rolledRarity) + Math.max(0, rarityBoost),
    );
    const rarity = RARITIES[rarityIndex];
    return pickRandom(getCardsByRarity(rarity), randomInteger);
}

function combineCards(card, randomInteger = randomInt) {
    const currentIndex = RARITIES.indexOf(card.rarity);
    if (currentIndex < 0 || currentIndex === RARITIES.length - 1) {
        throw new Error('Cartas míticas não podem ser combinadas.');
    }

    const chance = COMBINE_CHANCES[card.rarity];
    const upgraded = randomInteger(100) < chance;
    const resultRarity = upgraded ? RARITIES[currentIndex + 1] : card.rarity;

    return {
        chance,
        upgraded,
        card: pickRandom(getCardsByRarity(resultRarity), randomInteger),
    };
}

module.exports = {
    CARD_BASE_VALUES,
    CARD_CATALOG,
    COMBINE_CHANCES,
    FLOAT_CONDITIONS,
    RARITIES,
    RARITY_COLORS,
    addCardInstance,
    combineCards,
    createCardInstance,
    drawCard,
    drawRarity,
    formatFloat,
    getCard,
    getCardArtwork,
    getCardDescription,
    getCardInstances,
    getCardQuantity,
    getCardTotal,
    getCardValue,
    getCardsByRarity,
    getCollectionValue,
    getFloatCondition,
    getOwnedCards,
    isCardMarried,
    migrateLegacyCardInstances,
    removeCardInstances,
    resolveCardInstance,
    setCardQuantity,
};
