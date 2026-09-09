const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const Profile = require('../../models/profile');
const MerchantStock = require('../../models/merchantStock');
const {
    calculateRank,
    getProfile,
    withProfileLock,
} = require('../../utils/profileManager');

const RELIC_ITEMS = [
    {
        id: 'deep_candle',
        type: 'relic',
        emoji: '🕯️',
        name: 'Vela das Profundezas',
        rarity: 'Comum',
        price: 250,
        description: 'Sua chama revela inscrições esquecidas nas masmorras.',
    },
    {
        id: 'obsidian_dice',
        type: 'relic',
        emoji: '🎲',
        name: 'Dados de Obsidiana',
        rarity: 'Comum',
        price: 400,
        description: 'Um conjunto escuro, lapidado para aventureiros de sorte.',
    },
    {
        id: 'wanderer_compass',
        type: 'relic',
        emoji: '🧭',
        name: 'Bússola do Errante',
        rarity: 'Raro',
        price: 600,
        description: 'Dizem que aponta para aquilo que seu portador mais procura.',
    },
    {
        id: 'forgotten_grimoire',
        type: 'relic',
        emoji: '📖',
        name: 'Grimório Desbotado',
        rarity: 'Raro',
        price: 850,
        description: 'Suas páginas guardam fragmentos de feitiços ancestrais.',
    },
    {
        id: 'dungeon_key',
        type: 'relic',
        emoji: '🗝️',
        name: 'Chave da Masmorra',
        rarity: 'Épico',
        price: 1100,
        description: 'Nenhum aventureiro descobriu ainda qual porta ela abre.',
    },
    {
        id: 'bard_ring',
        type: 'relic',
        emoji: '💍',
        name: 'Anel do Bardo',
        rarity: 'Épico',
        price: 1500,
        description: 'Uma pequena melodia ressoa quando o luar toca sua pedra.',
    },
    {
        id: 'lost_king_crown',
        type: 'relic',
        emoji: '👑',
        name: 'Coroa do Rei Perdido',
        rarity: 'Lendário',
        price: 2200,
        description: 'Última lembrança de um reino apagado dos mapas.',
    },
    {
        id: 'dragon_egg',
        type: 'relic',
        emoji: '🐉',
        name: 'Ovo de Dragão',
        rarity: 'Lendário',
        price: 3000,
        description: 'Está estranhamente quente. Talvez ainda exista vida lá dentro.',
    },
    {
        id: 'moon_feather',
        type: 'relic',
        emoji: '🪶',
        name: 'Pena da Coruja Lunar',
        rarity: 'Raro',
        price: 700,
        description: 'Brilha suavemente quando uma criatura se aproxima no escuro.',
    },
    {
        id: 'kraken_map',
        type: 'relic',
        emoji: '🗺️',
        name: 'Mapa do Kraken',
        rarity: 'Épico',
        price: 1300,
        description: 'As rotas desenhadas mudam sempre que a maré sobe.',
    },
    {
        id: 'phoenix_ember',
        type: 'relic',
        emoji: '🔥',
        name: 'Brasa da Fênix',
        rarity: 'Lendário',
        price: 2800,
        description: 'Uma chama eterna que não queima as mãos de quem tem coragem.',
    },
    {
        id: 'giant_horn',
        type: 'relic',
        emoji: '📯',
        name: 'Trompa do Gigante',
        rarity: 'Épico',
        price: 1700,
        description: 'Seu chamado pode ser ouvido além das montanhas do norte.',
    },
    {
        id: 'star_fragment',
        type: 'relic',
        emoji: '🌠',
        name: 'Fragmento de Estrela',
        rarity: 'Lendário',
        price: 3500,
        description: 'Um pedaço frio do céu, cobiçado pelos maiores arquimagos.',
    },
    {
        id: 'mimic_coin',
        type: 'relic',
        emoji: '🪙',
        name: 'Moeda do Mímico',
        rarity: 'Raro',
        price: 750,
        description: 'Às vezes ela pisca. O mercador insiste que é apenas um reflexo.',
    },
    {
        id: 'void_hourglass',
        type: 'relic',
        emoji: '⌛',
        name: 'Ampulheta do Vazio',
        rarity: 'Lendário',
        price: 4000,
        description: 'Sua areia sobe, mas somente durante noites sem lua.',
    },
    {
        id: 'silver_goblet',
        type: 'relic',
        emoji: '🏆',
        name: 'Cálice de Prata Élfica',
        rarity: 'Épico',
        price: 1900,
        description: 'Nenhum veneno permanece ativo quando colocado dentro dele.',
    },
];

const PROFILE_BOOSTER_ITEMS = [
    {
        id: 'xp_elixir',
        type: 'xp',
        emoji: '🧪',
        name: 'Elixir de Experiência',
        rarity: 'Comum',
        price: 400,
        effect: 50,
        description: 'Concede imediatamente 50 XP ao aventureiro que o beber.',
    },
    {
        id: 'greater_xp_elixir',
        type: 'xp',
        emoji: '⚗️',
        name: 'Elixir Superior',
        rarity: 'Épico',
        price: 1100,
        effect: 175,
        description: 'Uma mistura poderosa que concede imediatamente 175 XP.',
    },
    {
        id: 'renown_tome',
        type: 'points',
        emoji: '📜',
        name: 'Tomo do Renome',
        rarity: 'Raro',
        price: 550,
        effect: 100,
        description: 'Acrescenta 100 pontos de renome às crônicas do aventureiro.',
    },
    {
        id: 'glory_banner',
        type: 'points',
        emoji: '🚩',
        name: 'Estandarte da Glória',
        rarity: 'Épico',
        price: 1400,
        effect: 300,
        description: 'Acrescenta 300 pontos de renome ao nome de seu portador.',
    },
];

const CARD_ITEMS = [
    {
        id: 'basic_card_pack',
        type: 'pack_basic',
        emoji: '📦',
        name: 'Pacote de Cartas Básico',
        rarity: 'Comum',
        price: 650,
        effect: 1,
        description: 'Contém duas cartas colecionáveis e o Coringa cerimonial do Gideon.',
    },
    {
        id: 'arcane_card_pack',
        type: 'pack_arcane',
        emoji: '🔮',
        name: 'Pacote de Cartas Arcano',
        rarity: 'Lendário',
        price: 1800,
        effect: 1,
        description: 'Contém duas cartas raras ou superiores e o Coringa cerimonial do Gideon.',
    },
    {
        id: 'card_organizer',
        type: 'card_organizer',
        emoji: '🗂️',
        name: 'Organizador de Inventário',
        rarity: 'Incomum',
        price: 900,
        effect: 1,
        description: 'Libera uma nova forma permanente de ordenar seu álbum. Máximo: nível 3.',
    },
    {
        id: 'rarity_booster',
        type: 'rarity_booster',
        emoji: '✨',
        name: 'Booster de Raridade',
        rarity: 'Raro',
        price: 1200,
        effect: 1,
        description: 'Eleva em um nível a primeira carta colecionável do próximo pacote.',
    },
    {
        id: 'description_scroll',
        type: 'description_scroll',
        emoji: '📝',
        name: 'Pergaminho de Descrição',
        rarity: 'Comum',
        price: 450,
        effect: 1,
        description: 'Permite gravar uma descrição pessoal em uma carta da sua coleção.',
    },
    {
        id: 'wedding_ring',
        type: 'wedding_ring',
        emoji: '💍',
        name: 'Anel de Casamento',
        rarity: 'Lendário',
        price: 2500,
        effect: 1,
        description: 'Permite criar um vínculo de casamento com uma carta que você possui.',
    },
    {
        id: 'card_bag',
        type: 'card_bag',
        emoji: '🎒',
        name: 'Bolsa de Cartas',
        rarity: 'Épico',
        price: 2000,
        effect: 10,
        description: 'Aumenta permanentemente o inventário em 10 espaços. Máximo: 100.',
    },
];

const PROFILE_ITEMS = [...RELIC_ITEMS, ...PROFILE_BOOSTER_ITEMS];
const MERCHANT_ITEMS = [...PROFILE_ITEMS, ...CARD_ITEMS];

const RARITY_COLORS = {
    Comum: 0x8B8D91,
    Incomum: 0x2F6B4F,
    Raro: 0x345995,
    Épico: 0x6A3D7C,
    Lendário: 0xC9A227,
};
const moneyFormatter = new Intl.NumberFormat('pt-BR');

function getSaoPauloDayNumber(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Math.floor(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / 86_400_000);
}

function getDailyOfferKey(date = new Date()) {
    return String(getSaoPauloDayNumber(date));
}

function getStockId(guildId, dayKey, itemId) {
    return `${guildId}:${dayKey}:${itemId}`;
}

async function getSoldItemIds(guildId, dayKey, offers, StockModel = MerchantStock) {
    const stocks = await StockModel.find({
        guildId,
        dayKey,
        itemId: { $in: offers.map((item) => item.id) },
    }).lean();

    return new Set(stocks.map((stock) => stock.itemId));
}

function seededShuffle(items, seed) {
    const shuffled = [...items];
    let state = Math.abs(seed) % 2_147_483_647 || 1;

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        state = (state * 16_807) % 2_147_483_647;
        const selectedIndex = state % (index + 1);
        [shuffled[index], shuffled[selectedIndex]] = [shuffled[selectedIndex], shuffled[index]];
    }

    return shuffled;
}

function getDailyOffers(date = new Date(), count = 6, category = 'profile') {
    const dayNumber = getSaoPauloDayNumber(date);
    if (category === 'cards') {
        return seededShuffle(CARD_ITEMS, dayNumber * 47)
            .slice(0, Math.min(count, CARD_ITEMS.length));
    }

    const xpItems = PROFILE_BOOSTER_ITEMS.filter((item) => item.type === 'xp');
    const pointItems = PROFILE_BOOSTER_ITEMS.filter((item) => item.type === 'points');
    const guaranteedBoosters = [
        xpItems[dayNumber % xpItems.length],
        pointItems[Math.floor(dayNumber / 2) % pointItems.length],
    ];
    const offerCount = Math.min(count, PROFILE_ITEMS.length);
    const relicCount = Math.max(0, offerCount - guaranteedBoosters.length);
    const relics = seededShuffle(RELIC_ITEMS, dayNumber).slice(0, relicCount);

    return seededShuffle(
        [...guaranteedBoosters, ...relics].slice(0, offerCount),
        dayNumber * 31,
    );
}

function getRewardName(item) {
    return `${item.emoji} ${item.name}`;
}

function ownsItem(profile, item) {
    return item.type === 'relic'
        && Array.isArray(profile?.rewards)
        && profile.rewards.includes(getRewardName(item));
}

function reachedItemLimit(profile, item) {
    if (item.type === 'card_organizer') {
        return (Number(profile?.cardInventory?.organizerLevel) || 0) >= 3;
    }
    if (item.type === 'card_bag') {
        return (Number(profile?.cardInventory?.capacity) || 20) >= 100;
    }
    return false;
}

function getEffectLabel(item) {
    if (item.type === 'xp') return `+${moneyFormatter.format(item.effect)} XP imediato`;
    if (item.type === 'points') return `+${moneyFormatter.format(item.effect)} de renome`;
    if (item.type === 'pack_basic') return '+1 pacote de cartas básico';
    if (item.type === 'pack_arcane') return '+1 pacote de cartas arcano';
    if (item.type === 'card_organizer') return '+1 nível de organização do álbum';
    if (item.type === 'rarity_booster') return 'próxima carta recebe +1 raridade';
    if (item.type === 'description_scroll') return '+1 alteração de descrição';
    if (item.type === 'wedding_ring') return '+1 casamento com uma carta';
    if (item.type === 'card_bag') return `+${item.effect} espaços permanentes`;
    return 'Relíquia colecionável para o /perfil';
}

function getOfferDescription(profile, item, sold) {
    if (ownsItem(profile, item)) return `${item.rarity} • já pertence a você`;
    if (reachedItemLimit(profile, item)) return `${item.rarity} • melhoria máxima alcançada`;
    if (sold) return `${item.rarity} • esgotado neste servidor`;
    return `${moneyFormatter.format(item.price)} moedas • ${getEffectLabel(item)}`;
}

function getOfferStatus(profile, item, sold) {
    if (ownsItem(profile, item)) return '✅ Adquirido';
    if (reachedItemLimit(profile, item)) return '✅ Melhoria máxima alcançada';
    if (sold) return '❌ Esgotado neste servidor';
    return `🪙 ${moneyFormatter.format(item.price)} · ${getEffectLabel(item)}`;
}

function createCategoryMenu(selectedCategory) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('merchant_category')
            .setPlaceholder('Escolha uma ala do mercador')
            .addOptions(
                {
                    label: 'Perfil do aventureiro',
                    value: 'profile',
                    description: 'Relíquias, experiência e renome',
                    emoji: '🛡️',
                    default: selectedCategory === 'profile',
                },
                {
                    label: 'Cartas e coleção',
                    value: 'cards',
                    description: 'Pacotes, melhorias e itens especiais',
                    emoji: '🃏',
                    default: selectedCategory === 'cards',
                },
            ),
    );
}

function createShopMenu(profile, offers, soldItemIds) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('merchant_item')
        .setPlaceholder('Examine uma oferta')
        .addOptions(offers.map((item) => ({
            label: item.name,
            value: item.id,
            emoji: item.emoji,
            description: getOfferDescription(profile, item, soldItemIds.has(item.id)),
        })));

    return new ActionRowBuilder().addComponents(menu);
}

function renderLobby(profile, user, notice = '') {
    const money = Math.max(0, Number(profile?.money) || 0);
    const capacity = Number(profile?.cardInventory?.capacity) || 20;
    const organizer = Number(profile?.cardInventory?.organizerLevel) || 0;
    const noticeText = notice ? `${notice}\n\n` : '';
    const embed = new EmbedBuilder()
        .setColor(0x9C6B30)
        .setAuthor({ name: '⚜️ MERCADOR ERRANTE • GRANDE BAZAR' })
        .setTitle(`Saudações, ${user.displayName || user.globalName || user.username}`)
        .setThumbnail(user.displayAvatarURL?.({ size: 256 }) || null)
        .setDescription(`${noticeText}> “Cada ala guarda tesouros para uma jornada diferente...”`)
        .addFields(
            {
                name: '🛡️ Ala do Perfil',
                value: 'Relíquias, elixires de experiência e tomos de renome.',
                inline: true,
            },
            {
                name: '🃏 Ala das Cartas',
                value: 'Pacotes, organizadores, boosters, pergaminhos, anéis e bolsas.',
                inline: true,
            },
            {
                name: '🪙 Sua bolsa',
                value: `**${moneyFormatter.format(money)} moedas**`,
                inline: false,
            },
            {
                name: '📚 Seu códice',
                value: `Inventário **${capacity} espaços** · Organizador **nível ${organizer}/3**`,
                inline: false,
            },
        )
        .setFooter({ text: 'Escolha uma categoria no menu abaixo' });

    return { embeds: [embed], components: [createCategoryMenu()] };
}

function renderShop(profile, user, offers, soldItemIds = new Set(), notice = '', category = 'profile') {
    const money = Math.max(0, Number(profile?.money) || 0);
    const offerList = offers.map((item) => {
        const status = getOfferStatus(profile, item, soldItemIds.has(item.id));
        return `${item.emoji} **${item.name}** · ${item.rarity}\n└ ${status}`;
    }).join('\n');
    const noticeText = notice ? `${notice}\n\n` : '';

    const embed = new EmbedBuilder()
        .setColor(0x9C6B30)
        .setAuthor({
            name: category === 'cards'
                ? '🃏 MERCADOR ERRANTE • ALA DAS CARTAS'
                : '🛡️ MERCADOR ERRANTE • ALA DO PERFIL',
        })
        .setTitle(`Saudações, ${user.displayName || user.globalName || user.username}`)
        .setThumbnail(user.displayAvatarURL?.({ size: 256 }) || null)
        .setDescription(`${noticeText}> “Tenho artefatos que não encontrarás em nenhuma taverna...”`)
        .addFields(
            {
                name: '🪙 Sua bolsa',
                value: `**${moneyFormatter.format(money)} moedas**`,
                inline: false,
            },
            {
                name: '🧰 Ofertas de hoje',
                value: offerList,
                inline: false,
            },
        )
        .setFooter({ text: 'Uma unidade por servidor • O estoque renova diariamente' });

    return {
        embeds: [embed],
        components: [
            createCategoryMenu(category),
            createShopMenu(profile, offers, soldItemIds),
        ],
    };
}

function renderItem(profile, item, sold = false, category = 'profile') {
    const money = Math.max(0, Number(profile?.money) || 0);
    const owned = ownsItem(profile, item);
    const maximum = reachedItemLimit(profile, item);
    const canAfford = money >= item.price;
    let buttonLabel = `Pagar ${moneyFormatter.format(item.price)} moedas`;
    if (owned) buttonLabel = 'Relíquia adquirida';
    else if (maximum) buttonLabel = 'Melhoria máxima';
    else if (sold) buttonLabel = 'Esgotado neste servidor';
    else if (!canAfford) buttonLabel = 'Moedas insuficientes';
    let buttonEmoji = '🪙';
    if (owned) buttonEmoji = '✅';
    else if (maximum) buttonEmoji = '✅';
    else if (sold) buttonEmoji = '❌';

    const embed = new EmbedBuilder()
        .setColor(RARITY_COLORS[item.rarity])
        .setTitle(`${item.emoji} ${item.name}`)
        .setDescription(`> ${item.description}`)
        .addFields(
            { name: '💎 Raridade', value: `**${item.rarity}**`, inline: true },
            { name: '🪙 Preço', value: `**${moneyFormatter.format(item.price)}**`, inline: true },
            { name: '👝 Sua bolsa', value: `**${moneyFormatter.format(money)}**`, inline: true },
            { name: '✨ Recompensa', value: `**${getEffectLabel(item)}**`, inline: false },
        );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('merchant_pay')
            .setLabel(buttonLabel)
            .setEmoji(buttonEmoji)
            .setStyle(owned || maximum || sold ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(owned || maximum || sold || !canAfford),
        new ButtonBuilder()
            .setCustomId('merchant_back')
            .setLabel('Voltar ao bazar')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('merchant_home')
            .setLabel('Categorias')
            .setEmoji('🏛️')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [createCategoryMenu(category), buttons] };
}

function createPurchaseError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

function isDuplicateStockError(error) {
    return error?.code === 11000 || error?.cause?.code === 11000;
}

async function purchaseItem(purchase, dependencies = {}) {
    const ProfileModel = dependencies.ProfileModel || Profile;
    const StockModel = dependencies.StockModel || MerchantStock;
    const connection = dependencies.connection || ProfileModel.db;
    const {
        guildId,
        dayKey,
        userId,
        username,
        item,
    } = purchase;

    if (dayKey !== getDailyOfferKey()) {
        return { status: 'expired', profile: await ProfileModel.findOne({ guildId, userId }) };
    }

    try {
        return await withProfileLock(guildId, userId, () => connection.transaction(async (session) => {
            await StockModel.create([{
                _id: getStockId(guildId, dayKey, item.id),
                guildId,
                dayKey,
                itemId: item.id,
                buyerId: userId,
                expiresAt: new Date(Date.now() + 3 * 86_400_000),
            }], { session });

            const reward = getRewardName(item);
            const query = {
                guildId,
                userId,
                money: { $gte: item.price },
            };
            const increments = { money: -item.price };
            const update = {
                $inc: increments,
                $set: { username },
            };

            if (item.type === 'relic') {
                query.rewards = { $ne: reward };
                update.$addToSet = { rewards: reward };
            } else if (item.type === 'xp') {
                increments.xp = item.effect;
            } else if (item.type === 'points') {
                increments.points = item.effect;
            } else if (item.type.startsWith('pack_')) {
                increments[`cardPacks.${item.type.replace('pack_', '')}`] = item.effect;
            } else if (item.type === 'card_organizer') {
                query['cardInventory.organizerLevel'] = { $lt: 3 };
                increments['cardInventory.organizerLevel'] = item.effect;
            } else if (item.type === 'rarity_booster') {
                increments['cardInventory.rarityBoosters'] = item.effect;
            } else if (item.type === 'description_scroll') {
                increments['cardInventory.descriptionScrolls'] = item.effect;
            } else if (item.type === 'wedding_ring') {
                increments['cardInventory.weddingRings'] = item.effect;
            } else if (item.type === 'card_bag') {
                query['cardInventory.capacity'] = { $lt: 100 };
                increments['cardInventory.capacity'] = item.effect;
            }

            const purchasedProfile = await ProfileModel.findOneAndUpdate(
                query,
                update,
                { new: true, session },
            );

            if (purchasedProfile) {
                let levelsGained = 0;
                if (item.type === 'xp') {
                    while (purchasedProfile.xp >= purchasedProfile.level * 100) {
                        purchasedProfile.xp -= purchasedProfile.level * 100;
                        purchasedProfile.level += 1;
                        levelsGained += 1;
                    }
                    if (levelsGained > 0) {
                        purchasedProfile.rank = calculateRank(purchasedProfile.level);
                        await purchasedProfile.save({ session });
                    }
                }

                return {
                    status: 'purchased',
                    profile: purchasedProfile,
                    levelsGained,
                };
            }

            const profile = await ProfileModel.findOne({ guildId, userId }).session(session);
            if (ownsItem(profile, item)) throw createPurchaseError('owned');
            if (reachedItemLimit(profile, item)) throw createPurchaseError('maximum');
            throw createPurchaseError('insufficient');
        }));
    } catch (error) {
        const profile = await ProfileModel.findOne({ guildId, userId });
        if (isDuplicateStockError(error)) return { status: 'sold', profile };
        if (['owned', 'maximum', 'insufficient'].includes(error.code)) {
            return { status: error.code, profile };
        }
        throw error;
    }
}

function createPurchaseMessage(item, result) {
    if (result.status === 'owned') return '⚠️ **Essa relíquia já pertence a você.**';
    if (result.status === 'maximum') return '✅ **Essa melhoria já atingiu o nível máximo.**';
    if (result.status === 'insufficient') {
        return '⚠️ **Você não possui moedas suficientes para essa oferta.**';
    }
    if (result.status === 'sold') return '❌ **Outro aventureiro comprou este item primeiro.**';
    if (result.status === 'expired') return '⌛ **O estoque foi renovado. Abra o mercador novamente.**';
    if (item.type === 'xp') {
        const levelText = result.levelsGained > 0
            ? ` Você avançou **${result.levelsGained} nível(is)**!`
            : '';
        return `✅ **Você recebeu ${moneyFormatter.format(item.effect)} XP.**${levelText}`;
    }
    if (item.type === 'points') {
        return `✅ **Você recebeu ${moneyFormatter.format(item.effect)} pontos de renome.**`;
    }
    if (item.type.startsWith('pack_')) {
        return '✅ **Um novo pacote foi adicionado ao seu códice. Use `/pack`.**';
    }
    if (item.type === 'card_organizer') {
        return `✅ **Organizador elevado para o nível ${result.profile.cardInventory.organizerLevel}/3.** Use \`/carta organizar\`.`;
    }
    if (item.type === 'rarity_booster') {
        return '✅ **Booster guardado. Ele será aplicado automaticamente na próxima carta aberta.**';
    }
    if (item.type === 'description_scroll') {
        return '✅ **Pergaminho guardado. Use `/carta descrever`.**';
    }
    if (item.type === 'wedding_ring') {
        return '✅ **Anel guardado. Use `/carta casar`.**';
    }
    if (item.type === 'card_bag') {
        return `✅ **Sua bolsa agora comporta ${result.profile.cardInventory.capacity} cartas.**`;
    }
    return `✅ **${item.name} agora faz parte das suas relíquias.**`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mercador')
        .setDescription('Visite as alas de perfil e cartas do mercador errante.')
        .setDMPermission(false),

    async execute(interaction) {
        const userId = interaction.user.id;
        const { guildId } = interaction;
        const dayKey = getDailyOfferKey();
        let category;
        let offers = [];
        let collector;
        let selectedItem;
        let soldItemIds = new Set();

        try {
            let profile = await getProfile(guildId, userId);
            if (!profile) {
                profile = await Profile.findOneAndUpdate(
                    { guildId, userId },
                    {
                        $set: { username: interaction.user.username },
                        $setOnInsert: { guildId, userId },
                    },
                    { new: true, upsert: true, setDefaultsOnInsert: true },
                );
            }
            await interaction.reply({
                ...renderLobby(profile, interaction.user),
                flags: 64,
            });
            const reply = await interaction.fetchReply();
            collector = reply.createMessageComponentCollector({
                filter: (componentInteraction) => componentInteraction.user.id === userId,
                time: 300_000,
            });

            collector.on('collect', async (componentInteraction) => {
                try {
                    if (componentInteraction.customId === 'merchant_category') {
                        [category] = componentInteraction.values;
                        const offerCount = category === 'cards' ? CARD_ITEMS.length : 6;
                        offers = getDailyOffers(new Date(), offerCount, category);
                        selectedItem = undefined;
                        soldItemIds = await getSoldItemIds(guildId, dayKey, offers);
                        await componentInteraction.update(renderShop(
                            profile,
                            interaction.user,
                            offers,
                            soldItemIds,
                            '',
                            category,
                        ));
                        return;
                    }

                    if (componentInteraction.customId === 'merchant_item') {
                        selectedItem = offers.find((item) => item.id === componentInteraction.values[0]);
                        if (!selectedItem) {
                            await componentInteraction.deferUpdate();
                            return;
                        }
                        soldItemIds = await getSoldItemIds(guildId, dayKey, offers);
                        await componentInteraction.update(renderItem(
                            profile,
                            selectedItem,
                            soldItemIds.has(selectedItem.id),
                            category,
                        ));
                        return;
                    }

                    if (componentInteraction.customId === 'merchant_home') {
                        category = undefined;
                        selectedItem = undefined;
                        offers = [];
                        soldItemIds = new Set();
                        await componentInteraction.update(renderLobby(profile, interaction.user));
                        return;
                    }

                    if (componentInteraction.customId === 'merchant_back') {
                        selectedItem = undefined;
                        soldItemIds = await getSoldItemIds(guildId, dayKey, offers);
                        await componentInteraction.update(renderShop(
                            profile,
                            interaction.user,
                            offers,
                            soldItemIds,
                            '',
                            category,
                        ));
                        return;
                    }

                    if (componentInteraction.customId !== 'merchant_pay' || !selectedItem) {
                        await componentInteraction.deferUpdate();
                        return;
                    }

                    const result = await purchaseItem({
                        guildId,
                        dayKey,
                        userId,
                        username: interaction.user.username,
                        item: selectedItem,
                    });
                    if (result.profile) profile = result.profile;
                    if (['purchased', 'sold'].includes(result.status)) {
                        soldItemIds.add(selectedItem.id);
                    }

                    await componentInteraction.update(renderShop(
                        profile,
                        interaction.user,
                        offers,
                        soldItemIds,
                        createPurchaseMessage(selectedItem, result),
                        category,
                    ));
                    selectedItem = undefined;
                } catch (error) {
                    console.error('Erro no painel do mercador:', error);
                }
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });
        } catch (error) {
            collector?.stop();
            console.error('Erro no comando /mercador:', error);
            const response = { content: '❌ O mercador fechou sua banca inesperadamente.' };

            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ ...response, flags: 64 }).catch(() => {});
            }
            return interaction.reply({ ...response, flags: 64 }).catch(() => {});
        }

        return undefined;
    },

    MERCHANT_ITEMS,
    CARD_ITEMS,
    PROFILE_ITEMS,
    createPurchaseMessage,
    getDailyOffers,
    getDailyOfferKey,
    getEffectLabel,
    getRewardName,
    getSoldItemIds,
    ownsItem,
    reachedItemLimit,
    purchaseItem,
    renderItem,
    renderLobby,
    renderShop,
};
