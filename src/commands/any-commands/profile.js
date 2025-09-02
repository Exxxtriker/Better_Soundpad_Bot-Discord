const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfile } = require('../../utils/profileManager');

function generateXPBar(currentXP, level) {
    const totalXP = level * 100;
    const percent = currentXP / totalXP;

    const barLength = 20;
    const filledLength = Math.round(barLength * percent);
    const emptyLength = barLength - filledLength;

    // Barra lendária: runas preenchidas ✦, runas vazias ✧
    const filledBar = '✦'.repeat(filledLength);
    const emptyBar = '✧'.repeat(emptyLength);

    return `${filledBar}${emptyBar} ${Math.floor(percent * 100)}%`;
}

function levelTitle(level) {
    if (level >= 20) return '🌟 Lendário 🌟';
    if (level >= 15) return '🔥 Mestre 🔥';
    if (level >= 10) return '🛡️ Herói 🛡️';
    if (level >= 5) return '🏹 Aventureiro 🏹';
    return '🌱 Novato 🌱';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra o perfil lendário do aventureiro')
        .addUserOption((option) => option.setName('usuario')
            .setDescription('Escolha um aventureiro')),

    async execute(interaction) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: 0 });
            }

            const user = interaction.options.getUser('usuario') || interaction.user;
            const profile = await getProfile(user.id);

            if (!profile) {
                const response = 'Este aventureiro ainda não deixou sua marca neste reino místico.';
                if (interaction.deferred) return await interaction.editReply(response);
                return await interaction.reply(response);
            }

            profile.emblems = profile.emblems || [];
            profile.rewards = profile.rewards || [];

            const xpBar = generateXPBar(profile.xp, profile.level);
            const title = levelTitle(profile.level);

            const embed = new EmbedBuilder()
                .setTitle(`🗡️ Perfil Do ${user.username}`)
                .setColor(profile.customizations.color || '#00FF00')
                .setDescription('📜 Jornada do aventureiro: conquistas, emblemas e glórias de um verdadeiro herói.')
                .addFields(
                    { name: '🏅 Pontos', value: `${profile.points}`, inline: true },
                    { name: '⚔️ Nível', value: `${profile.level} • ${title}`, inline: true },
                    { name: '✨ XP Atual', value: xpBar, inline: false },
                    { name: '🏵️ Emblemas', value: profile.emblems.length ? profile.emblems.join(' | ') : 'Nenhum', inline: false },
                    { name: '🎁 Recompensas', value: profile.rewards.length ? profile.rewards.join(' | ') : 'Nenhuma', inline: false },
                    { name: '📛 Título', value: profile.customizations.title || 'Nenhum', inline: true },
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: '⚔️ Continue sua jornada, aventureiro, e torne-se lenda!' });

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
