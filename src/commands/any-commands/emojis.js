/* eslint-disable no-nested-ternary */
/* eslint-disable max-len */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

function formatEmoji(emoji) {
    return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Busca um emoji pelo ID ou lista todos os emojis da aplicação.')
        .addStringOption((option) => option.setName('id')
            .setDescription('ID do emoji (opcional)')
            .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const tokenFromEnv = process.env.TOKEN;
        if (!tokenFromEnv) return interaction.editReply('❌ BOT_TOKEN não definido.');

        const token = `Bot ${tokenFromEnv}`;

        let applicationId = process.env.APPLICATION_ID;
        if (!applicationId) {
            const { client } = interaction;
            if (!client.application?.id) await client.application?.fetch();
            applicationId = client.application?.id;
        }

        if (!applicationId) return interaction.editReply('❌ Application ID não encontrado.');

        const emojiId = interaction.options.getString('id');

        try {
            if (emojiId) {
                // Buscar emoji específico
                const { data: emoji } = await axios.get(
                    `https://discord.com/api/v10/applications/${applicationId}/emojis/${emojiId}`,
                    { headers: { Authorization: token } },
                );

                if (!emoji) return interaction.editReply('❌ Emoji não encontrado.');

                const embed = new EmbedBuilder()
                    .setTitle(`Emoji: ${emoji.name}`)
                    .setDescription(formatEmoji(emoji))
                    .addFields(
                        { name: 'ID', value: emoji.id, inline: true },
                        { name: 'Animado', value: emoji.animated ? '✅ Sim' : '❌ Não', inline: true },
                        { name: 'Criado por', value: emoji.user?.username || 'Desconhecido', inline: true },
                    )
                    .setColor('#00FFFF')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Listar todos os emojis
            const { data } = await axios.get(
                `https://discord.com/api/v10/applications/${applicationId}/emojis`,
                { headers: { Authorization: token } },
            );

            const emojis = data.items; // Ajuste principal: emojis dentro de items
            if (!emojis?.length) return interaction.editReply('❌ Nenhum emoji encontrado.');

            const maxEmojis = 50;
            const displayEmojis = emojis.slice(0, maxEmojis).map(formatEmoji).join(' ');

            const embed = new EmbedBuilder()
                .setTitle('Emojis da aplicação')
                .setDescription(displayEmojis + (emojis.length > maxEmojis ? `\n\n...e mais ${emojis.length - maxEmojis} emojis.` : ''))
                .setFooter({ text: `Total de emojis: ${emojis.length}` })
                .setColor('#00FFFF')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Erro ao buscar emoji(s):', err.response?.data ?? err.message ?? err);
            const message = err.response?.status === 401
                ? '401 Unauthorized — token inválido ou expirado.'
                : err.response?.status === 404
                    ? '❌ Emoji não encontrado.'
                    : `Erro: ${err.response?.data?.message ?? err.message}`;

            return interaction.editReply(message);
        }
    },
};
