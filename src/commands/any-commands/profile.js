const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfile } = require('../../utils/profileManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra o seu perfil')
        .addUserOption((option) => option.setName('usuario')
            .setDescription('Escolha um usuário')),
    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const profile = await getProfile(user.id);

        if (!profile) return interaction.reply('Esse usuário ainda não interagiu com o bot.');

        const embed = new EmbedBuilder()
            .setTitle(`${user.username} • Perfil`)
            .setColor(profile.customizations.color)
            .addFields(
                { name: 'Pontos', value: `${profile.points}`, inline: true },
                { name: 'Nível', value: `${profile.level}`, inline: true },
                { name: 'XP Atual', value: `${profile.xp}/${profile.level * 100}`, inline: true },
                { name: 'Emblemas', value: profile.emblems.length ? profile.emblems.join(', ') : 'Nenhum', inline: false },
                { name: 'Título', value: profile.customizations.title || 'Nenhum', inline: true },
            )
            .setFooter({ text: 'Interaja com o bot para ganhar pontos e subir de nível!' });

        interaction.reply({ embeds: [embed] });
    },
};
