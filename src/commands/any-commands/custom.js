const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder,
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
        .setDescription('Personalize seu perfil lendário'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            let profile = await getProfile(userId);
            if (!profile) {
                profile = new Profile({ userId, username: interaction.user.username });
                await profile.save();
            }

            // Menu de customização
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('profile_custom')
                        .setPlaceholder('Escolha o que deseja customizar')
                        .addOptions([
                            { label: 'Cor do Perfil', value: 'color' },
                            { label: 'Título Personalizado', value: 'title' },
                            // Pode adicionar outros tipos de customização aqui
                        ]),
                );

            const embed = new EmbedBuilder()
                .setTitle('🎨 Menu de Customização')
                .setColor(profile.customizations.color || '#00FF00')
                .setDescription('Selecione uma opção abaixo para customizar seu perfil.')
                .setFooter({ text: '⚔️ Customize e torne seu perfil único!' });

            await interaction.reply({ embeds: [embed], components: [row], flags: 64 });

            // Collector para interações com o menu
            const collector = interaction.channel.createMessageComponentCollector({
                filter: (i) => i.user.id === userId,
                time: 120000, // 2 minutos para interação
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'profile_custom') {
                    const choice = i.values[0];

                    if (choice === 'color') {
                        // Menu secundário para escolher cor
                        const colorRow = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('profile_color')
                                    .setPlaceholder('Escolha a cor do perfil')
                                    .addOptions(Object.keys(COLORS).map((c) => ({
                                        label: c,
                                        value: c,
                                    }))),
                            );

                        await i.update({ content: 'Escolha a nova cor do seu perfil:', components: [colorRow], embeds: [] });
                    } else if (choice === 'title') {
                        await i.update({ content: 'Digite o título que deseja para seu perfil (máx 30 caracteres):', components: [], embeds: [] });

                        const filter = (m) => m.author.id === userId;
                        const collected = await interaction.channel.awaitMessages({
                            filter, max: 1, time: 60000, errors: ['time'],
                        }).catch(() => null);

                        if (collected && collected.first()) {
                            let newTitle = collected.first().content;
                            if (newTitle.length > 30) newTitle = newTitle.slice(0, 30);

                            profile.customizations.title = newTitle;
                            await profile.save();

                            await interaction.followUp({ content: `✅ Título atualizado para: **${newTitle}**`, flags: 64 });
                        } else {
                            await interaction.followUp({ content: '❌ Tempo esgotado. Tente novamente.', flags: 64 });
                        }
                    }
                } else if (i.customId === 'profile_color') {
                    const newColor = i.values[0];
                    profile.customizations.color = COLORS[newColor];
                    await profile.save();

                    await i.update({ content: `✅ Cor do perfil alterada para: **${newColor}**`, components: [], embeds: [] });
                }
            });
        } catch (error) {
            console.error('Erro no comando /customizar:', error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao tentar customizar seu perfil.', flags: 64 });
        }
    },
};
