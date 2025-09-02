/* eslint-disable no-nested-ternary */
/* eslint-disable no-empty */
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { getProfile } = require('../../utils/profileManager');
const Profile = require('../../models/profile');

const COLORS = {
    Verde: '#00FF00',
    Azul: '#1E90FF',
    Dourado: '#FFD700',
    Vermelho: '#FF4500',
    Roxo: '#800080',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customizar')
        .setDescription('🎨 Personalize seu perfil lendário'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            let profile = await getProfile(userId);

            if (!profile) {
                profile = new Profile({
                    userId,
                    username: interaction.user.username,
                    customizations: {},
                });
                await profile.save();
            }

            // Função para renderizar o menu principal
            const renderMainMenu = () => {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('profile_custom')
                    .setPlaceholder('⬇️ Escolha o que deseja customizar')
                    .addOptions([
                        { label: '🎨 Cor do Perfil', value: 'color', description: 'Altere a cor do seu perfil' },
                        { label: '🏷️ Título Personalizado', value: 'title', description: 'Defina um título único' },
                    ]);

                const row = new ActionRowBuilder().addComponents(menu);

                const embed = new EmbedBuilder()
                    .setTitle('⚒️ Painel de Customização')
                    .setColor(profile.customizations.color || '#5865F2')
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setDescription('Selecione uma opção no menu abaixo para customizar o seu perfil lendário.')
                    .setFooter({
                        text: '⚔️ Torne seu perfil único!',
                        iconURL: interaction.client.user.displayAvatarURL(),
                    });

                return { embeds: [embed], components: [row] };
            };

            await interaction.reply({
                ...renderMainMenu(),
                flags: 64,
            });

            // collector de menus/botões
            const collector = interaction.channel.createMessageComponentCollector({
                filter: (i) => i.user.id === userId,
                time: 120000,
            });

            // variável para guardar o coletor de mensagens (título)
            let messageCollector = null;

            collector.on('collect', async (i) => {
                if (i.customId === 'profile_custom') {
                    const choice = i.values[0];

                    // 🎨 Escolha de cor
                    if (choice === 'color') {
                        const colorMenu = new StringSelectMenuBuilder()
                            .setCustomId('profile_color')
                            .setPlaceholder('⬇️ Selecione uma cor')
                            .addOptions(
                                Object.keys(COLORS).map((c) => ({
                                    label: c,
                                    value: c,
                                    emoji:
                                        c === 'Verde' ? '🟢'
                                            : c === 'Azul' ? '🔵'
                                                : c === 'Dourado' ? '🌟'
                                                    : c === 'Vermelho' ? '🔴'
                                                        : '🟣',
                                })),
                            );

                        const colorRow = new ActionRowBuilder().addComponents(colorMenu);

                        // botão voltar
                        const backRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('back_to_menu')
                                .setLabel('⬅️ Voltar')
                                .setStyle(ButtonStyle.Secondary),
                        );

                        return i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('🎨 Escolha uma cor')
                                    .setDescription('Selecione abaixo a nova cor para o seu perfil.')
                                    .setColor(profile.customizations.color || '#5865F2'),
                            ],
                            components: [colorRow, backRow],
                        });
                    }

                    // 🏷️ Escolha de título
                    if (choice === 'title') {
                        await i.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('🏷️ Defina um título personalizado')
                                    .setDescription('Digite no chat o título que deseja (máx **30 caracteres**).')
                                    .setColor(profile.customizations.color || '#5865F2'),
                            ],
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('back_to_menu')
                                        .setLabel('⬅️ Voltar')
                                        .setStyle(ButtonStyle.Secondary),
                                ),
                            ],
                        });

                        // inicia o coletor de mensagens
                        const filter = (m) => m.author.id === userId;
                        messageCollector = interaction.channel.createMessageCollector({
                            filter,
                            max: 1,
                            time: 60000,
                        });

                        messageCollector.on('collect', async (msg) => {
                            let newTitle = msg.content;
                            if (newTitle.length > 30) newTitle = newTitle.slice(0, 30);

                            profile.customizations.title = newTitle;
                            await profile.save();

                            await interaction.followUp({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor('#57F287')
                                        .setDescription(`✅ Seu título foi atualizado para: **${newTitle}**`),
                                ],
                                flags: 64,
                            });
                        });

                        messageCollector.on('end', async (collected) => {
                            if (collected.size === 0) {
                                await interaction.followUp({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor('#ED4245')
                                            .setDescription('❌ Tempo esgotado. Tente novamente.'),
                                    ],
                                    flags: 64,
                                });
                            }
                        });
                    }
                }

                // 🎨 Atualização de cor
                if (i.customId === 'profile_color') {
                    const newColor = i.values[0];
                    profile.customizations.color = COLORS[newColor];
                    await profile.save();

                    return i.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(COLORS[newColor])
                                .setDescription(`✅ A cor do seu perfil foi alterada para: **${newColor}**`),
                        ],
                        components: [],
                    });
                }

                // ⬅️ Voltar
                if (i.customId === 'back_to_menu') {
                    // se tiver coletor de título ativo, cancela
                    if (messageCollector) {
                        messageCollector.stop();
                        messageCollector = null;
                    }
                    return i.update(renderMainMenu());
                }
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({ components: [] });
                } catch {}
            });
        } catch (error) {
            console.error('Erro no comando /customizar:', error);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ED4245')
                        .setDescription('❌ Ocorreu um erro ao tentar customizar seu perfil.'),
                ],
                flags: 64,
            });
        }
    },
};
