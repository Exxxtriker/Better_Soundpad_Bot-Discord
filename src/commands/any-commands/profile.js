const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfile } = require('../../utils/profileManager');

function generateXPBar(currentXP, level) {
    const totalXP = level * 100;
    const percent = Math.min(1, Math.max(0, currentXP / totalXP));

    const barLength = 20;
    const filledLength = Math.round(barLength * percent);
    const emptyLength = barLength - filledLength;

    const filledBar = '✦'.repeat(filledLength);
    const emptyBar = '✧'.repeat(emptyLength);

    return `${filledBar}${emptyBar} ${Math.floor(percent * 100)}%`;
}

function levelTitle(level) {
    if (level >= 90) return '👑 Overlord';
    if (level >= 70) return '🌌 Imperador Arcano';
    if (level >= 50) return '🔥 Senhor da Guerra';
    if (level >= 35) return '⚔️ Campeão do Reino';
    if (level >= 20) return '🛡️ Cavaleiro Real';
    if (level >= 10) return '🏹 Aventureiro';
    if (level >= 5) return '🌱 Aprendiz';
    return '🚜 Camponês';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra o perfil lendário do aventureiro'),

    async execute(interaction) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: 0 });
            }

            // Agora sempre pega o próprio usuário
            const { user } = interaction;
            const profile = await getProfile(user.id);

            if (!profile) {
                const response = 'Este aventureiro ainda não deixou sua marca neste reino místico.';
                if (interaction.deferred) return await interaction.editReply(response);
                return await interaction.reply(response);
            }

            profile.emblems = profile.emblems || [];
            profile.rewards = profile.rewards || [];
            profile.money = profile.money || 0;

            const xpBar = generateXPBar(profile.xp, profile.level);
            const title = levelTitle(profile.level);

            const embed = new EmbedBuilder()
                .setTitle(`📜 Perfil de ${user.displayName}`)
                .setColor(profile.customizations.color || '#00FF00')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription('**🌟 Jornada de um verdadeiro aventureiro**\n⚔️ Siga crescendo, conquiste glórias e torne-se uma lenda viva!')
                .addFields(
                    { name: '🏆 Nível & Título', value: `${profile.level} • ${title}`, inline: true },
                    { name: '💰 Ouro', value: `${profile.money} 🪙`, inline: true },
                    { name: '🏅 Pontos', value: `${profile.points}`, inline: true },
                    { name: '📛 Título Personalizado', value: profile.customizations.title || 'Nenhum', inline: false },
                    { name: '🏵️ Emblemas', value: profile.emblems.length ? profile.emblems.join(' • ') : 'Nenhum', inline: false },
                    { name: '✨ XP', value: xpBar, inline: false },
                )
                .setFooter({
                    text: '⚔️ Continue sua jornada e torne-se lenda! | Guardião do reino 🛡️',
                    iconURL: interaction.client.user.displayAvatarURL({ dynamic: true }),
                });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Erro no comando /perfil:', error);

            try {
                const errorMessage = { content: '❌ Houve um erro ao executar este comando.' };
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else if (!interaction.replied) {
                    await interaction.reply({ ...errorMessage, flags: 64 });
                }
            } catch (replyError) {
                console.error('Erro ao tentar responder após falha:', replyError);
            }
        }
    },
};
