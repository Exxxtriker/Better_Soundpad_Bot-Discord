const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const Profile = require('../../models/profile');
const { getProfile } = require('../../utils/profileManager');

const COLORS = {
    Verde: '#00FF00',
    Azul: '#1E90FF',
    Dourado: '#FFD700',
    Vermelho: '#FF4500',
    Roxo: '#800080',
};

function createBackRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('back_to_menu')
            .setLabel('⬅️ Voltar')
            .setStyle(ButtonStyle.Secondary),
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('customizar')
        .setDescription('🎨 Personalize seu perfil lendário'),

    async execute(interaction) {
        const userId = interaction.user.id;
        let collector;

        try {
            let profile = await getProfile(userId);
            if (!profile) {
                profile = await Profile.findOneAndUpdate(
                    { userId },
                    { $set: { username: interaction.user.username }, $setOnInsert: { userId } },
                    { new: true, upsert: true, setDefaultsOnInsert: true },
                );
            }

            const renderMainMenu = () => {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('profile_custom')
                    .setPlaceholder('⬇️ Escolha o que deseja customizar')
                    .addOptions([
                        { label: '🎨 Cor do Perfil', value: 'color', description: 'Altere a cor do seu perfil' },
                        { label: '🏷️ Título Personalizado', value: 'title', description: 'Defina um título único' },
                    ]);

                const embed = new EmbedBuilder()
                    .setTitle('⚒️ Painel de Customização')
                    .setColor(profile.customizations.color || '#5865F2')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setDescription('Selecione uma opção abaixo para customizar o seu perfil lendário.')
                    .setFooter({
                        text: '⚔️ Torne seu perfil único!',
                        iconURL: interaction.client.user.displayAvatarURL(),
                    });

                return {
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                };
            };

            await interaction.reply({ ...renderMainMenu(), flags: 64 });
            const replyMessage = await interaction.fetchReply();
            collector = replyMessage.createMessageComponentCollector({
                filter: (componentInteraction) => componentInteraction.user.id === userId,
                time: 120_000,
            });

            collector.on('collect', async (componentInteraction) => {
                try {
                    if (componentInteraction.customId === 'profile_custom') {
                        const choice = componentInteraction.values[0];

                        if (choice === 'color') {
                            const colorMenu = new StringSelectMenuBuilder()
                                .setCustomId('profile_color')
                                .setPlaceholder('⬇️ Selecione uma cor')
                                .addOptions(Object.keys(COLORS).map((color) => ({
                                    label: color,
                                    value: color,
                                    emoji: {
                                        Verde: '🟢', Azul: '🔵', Dourado: '🌟', Vermelho: '🔴', Roxo: '🟣',
                                    }[color],
                                })));

                            await componentInteraction.update({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('🎨 Escolha uma cor')
                                        .setDescription('Selecione abaixo a nova cor para o seu perfil.')
                                        .setColor(profile.customizations.color || '#5865F2'),
                                ],
                                components: [
                                    new ActionRowBuilder().addComponents(colorMenu),
                                    createBackRow(),
                                ],
                            });
                            return;
                        }

                        const modalId = `profile_title_${interaction.id}`;
                        const titleInput = new TextInputBuilder()
                            .setCustomId('profile_title_input')
                            .setLabel('Título personalizado')
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(30)
                            .setRequired(true);
                        if (profile.customizations.title) {
                            titleInput.setValue(profile.customizations.title);
                        }
                        const modal = new ModalBuilder()
                            .setCustomId(modalId)
                            .setTitle('Título do perfil')
                            .addComponents(new ActionRowBuilder().addComponents(titleInput));

                        await componentInteraction.showModal(modal);
                        const modalInteraction = await componentInteraction.awaitModalSubmit({
                            filter: (submission) => submission.customId === modalId && submission.user.id === userId,
                            time: 60_000,
                        });
                        profile.customizations.title = modalInteraction.fields
                            .getTextInputValue('profile_title_input')
                            .trim()
                            .slice(0, 30);
                        await profile.save();
                        await modalInteraction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor('#57F287')
                                    .setDescription(`✅ Seu título foi atualizado para: **${profile.customizations.title}**`),
                            ],
                            components: [createBackRow()],
                        });
                        return;
                    }

                    if (componentInteraction.customId === 'profile_color') {
                        const colorName = componentInteraction.values[0];
                        profile.customizations.color = COLORS[colorName];
                        await profile.save();
                        await componentInteraction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(COLORS[colorName])
                                    .setDescription(`✅ A cor do seu perfil foi alterada para: **${colorName}**`),
                            ],
                            components: [createBackRow()],
                        });
                        return;
                    }

                    if (componentInteraction.customId === 'back_to_menu') {
                        await componentInteraction.update(renderMainMenu());
                    }
                } catch (error) {
                    if (error.code !== 'InteractionCollectorError') {
                        console.error('Erro em componente de customização:', error);
                    }
                }
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });
        } catch (error) {
            collector?.stop();
            console.error('Erro no comando /customizar:', error);
            const response = { content: '❌ Ocorreu um erro ao customizar o perfil.' };
            if (interaction.replied || interaction.deferred) return interaction.followUp({ ...response, flags: 64 });
            return interaction.reply({ ...response, flags: 64 });
        }

        return undefined;
    },
};
