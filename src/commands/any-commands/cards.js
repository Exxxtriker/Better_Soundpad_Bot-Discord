const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} = require('discord.js');
const { getProfile } = require('../../utils/profileManager');
const {
    RARITIES,
    getOwnedCards,
} = require('../../utils/cardCatalog');
const { createCardEmbed } = require('./card');

const ORDER_REQUIREMENTS = {
    rarity: 0,
    name: 1,
    type: 2,
    quantity: 3,
};

const ORDER_LABELS = {
    rarity: 'Raridade',
    name: 'Nome',
    type: 'Categoria',
    quantity: 'Quantidade',
};

function sortCards(cards, sortMode) {
    const rarityIndex = (card) => RARITIES.indexOf(card.rarity);
    return [...cards].sort((left, right) => {
        if (sortMode === 'name') return left.name.localeCompare(right.name, 'pt-BR');
        if (sortMode === 'type') {
            return left.type.localeCompare(right.type, 'pt-BR')
                || left.name.localeCompare(right.name, 'pt-BR');
        }
        if (sortMode === 'quantity') {
            return right.quantity - left.quantity
                || rarityIndex(right) - rarityIndex(left);
        }
        return rarityIndex(left) - rarityIndex(right)
            || left.name.localeCompare(right.name, 'pt-BR');
    });
}

function resolveSortMode(profile, requestedSortMode) {
    const organizer = Number(profile?.cardInventory?.organizerLevel) || 0;
    const savedSortMode = profile?.cardInventory?.sortMode || 'rarity';
    if (requestedSortMode && ORDER_REQUIREMENTS[requestedSortMode] <= organizer) {
        return requestedSortMode;
    }
    return ORDER_REQUIREMENTS[savedSortMode] <= organizer ? savedSortMode : 'rarity';
}

function buildCollectionSlides(user, profile, requestedSortMode) {
    const sortMode = resolveSortMode(profile, requestedSortMode);
    const cards = sortCards(getOwnedCards(profile), sortMode);
    const ownerName = user.displayName || user.globalName || user.username;
    const avatar = user.displayAvatarURL?.({ size: 64 });

    const slides = cards.flatMap((card) => [...(card.instances || [])]
        .sort((left, right) => Number(left.float) - Number(right.float))
        .map((instance) => {
            const payload = createCardEmbed(user, profile, card, '', instance);
            return {
                embed: payload.embeds[0],
                file: payload.files?.[0] || null,
            };
        }));

    slides.forEach((slide, index) => {
        const footer = {
            text: `Pertence a ${ownerName} • ${ORDER_LABELS[sortMode]} • ${index + 1}/${slides.length}`,
        };
        if (avatar) footer.iconURL = avatar;
        slide.embed.setFooter(footer);
    });

    return slides;
}

function buildCarouselControls(position, total, locked = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cards_previous')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(locked || position <= 0),
        new ButtonBuilder()
            .setCustomId('cards_next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(locked || position >= total - 1),
    );
}

function slidePayload(slide, position, total) {
    return {
        embeds: [slide.embed],
        components: total > 1 ? [buildCarouselControls(position, total)] : [],
        files: slide.file ? [slide.file] : [],
        attachments: [],
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cartas')
        .setDescription('Exibe uma coleção de cartas de classes, raças e terrenos.')
        .addUserOption((option) => option
            .setName('jogador')
            .setDescription('Jogador cuja coleção deseja examinar.'))
        .addStringOption((option) => option
            .setName('ordem')
            .setDescription('Ordem do álbum, liberada pelos organizadores.')
            .addChoices(
                { name: 'Raridade', value: 'rarity' },
                { name: 'Nome', value: 'name' },
                { name: 'Categoria', value: 'type' },
                { name: 'Quantidade', value: 'quantity' },
            ))
        .setDMPermission(false),

    async execute(interaction) {
        const user = interaction.options.getUser('jogador') || interaction.user;
        const requestedSortMode = interaction.options.getString('ordem');
        const profile = await getProfile(interaction.guildId, user.id);

        if (!profile) {
            return interaction.reply({
                content: '📭 Esse aventureiro ainda não possui um álbum neste servidor.',
                flags: 64,
            });
        }

        const organizer = Number(profile.cardInventory?.organizerLevel) || 0;
        if (requestedSortMode && ORDER_REQUIREMENTS[requestedSortMode] > organizer) {
            return interaction.reply({
                content: `🗂️ Essa ordem exige **Organizador nível ${ORDER_REQUIREMENTS[requestedSortMode]}**. Compre melhorias no /mercador.`,
                flags: 64,
            });
        }

        const slides = buildCollectionSlides(user, profile, requestedSortMode);
        if (!slides.length) {
            const ownerName = user.displayName || user.globalName || user.username;
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x7A1F2B)
                    .setTitle(`📭 Álbum de ${ownerName}`)
                    .setDescription('O códice está vazio. Use `/pack` para revelar sua primeira carta.')],
            });
        }

        let position = 0;
        await interaction.reply(slidePayload(slides[position], position, slides.length));
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 180_000 });

        collector.on('collect', async (componentInteraction) => {
            if (componentInteraction.user.id !== interaction.user.id) {
                await componentInteraction.reply({
                    content: '❌ Somente quem abriu o álbum pode folhear estas cartas.',
                    flags: 64,
                }).catch(() => {});
                return;
            }

            position += componentInteraction.customId === 'cards_next' ? 1 : -1;
            position = Math.max(0, Math.min(slides.length - 1, position));
            try {
                await componentInteraction.update(slidePayload(slides[position], position, slides.length));
            } catch (error) {
                if (error?.code !== 10008) console.error('Erro ao navegar pelo álbum:', error);
            }
        });

        collector.on('end', async () => {
            if (slides.length < 2) return;
            await interaction.editReply({
                components: [buildCarouselControls(position, slides.length, true)],
            }).catch(() => {});
        });

        return undefined;
    },

    buildCarouselControls,
    buildCollectionSlides,
    resolveSortMode,
    slidePayload,
    sortCards,
};
