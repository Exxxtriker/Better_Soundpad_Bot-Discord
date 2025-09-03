/* eslint-disable no-nested-ternary */
/* eslint-disable max-len */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const OWNER_ID = '335012394226941966';

function formatEmoji(emoji) {
    return `${emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`} = \`${emoji.name}\` (\`${emoji.id}\`)`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Gerencia emojis da aplicação.')
        .addSubcommand((sub) => sub.setName('listar')
            .setDescription('Lista todos os emojis da aplicação.'))
        .addSubcommand((sub) => sub.setName('enviar')
            .setDescription('Envia (cria) um emoji novo.')
            .addStringOption((opt) => opt.setName('nome')
                .setDescription('Nome do emoji')
                .setRequired(true))
            .addAttachmentOption((opt) => opt.setName('arquivo')
                .setDescription('Imagem do emoji (png, jpg, gif)')
                .setRequired(true)))
        .addSubcommand((sub) => sub.setName('apagar')
            .setDescription('Apaga um emoji pelo ID.')
            .addStringOption((opt) => opt.setName('id')
                .setDescription('ID do emoji')
                .setRequired(true))),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ Apenas o dono do bot pode usar este comando.', ephemeral: true });
        }

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

        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'listar') {
                const { data } = await axios.get(
                    `https://discord.com/api/v10/applications/${applicationId}/emojis`,
                    { headers: { Authorization: token } },
                );

                const emojis = data.items;
                if (!emojis?.length) return interaction.editReply('❌ Nenhum emoji encontrado.');

                const emojiList = emojis.map(formatEmoji).join('\n');
                const embed = new EmbedBuilder()
                    .setTitle(`📜 Emojis (${emojis.length})`)
                    .setDescription(emojiList.slice(0, 4000)) // limite embed
                    .setColor('#00FFFF')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            if (sub === 'enviar') {
                const nome = interaction.options.getString('nome');
                const arquivo = interaction.options.getAttachment('arquivo');

                if (!arquivo.contentType?.startsWith('image/')) {
                    return interaction.editReply('❌ O arquivo precisa ser uma imagem (png, jpg, gif).');
                }

                const { data: emoji } = await axios.post(
                    `https://discord.com/api/v10/applications/${applicationId}/emojis`,
                    {
                        name: nome,
                        image: `data:${arquivo.contentType};base64,${Buffer.from(
                            await (await fetch(arquivo.url)).arrayBuffer(),
                        ).toString('base64')}`,
                    },
                    { headers: { Authorization: token, 'Content-Type': 'application/json' } },
                );

                return interaction.editReply(`✅ Emoji criado: ${formatEmoji(emoji)}`);
            }

            if (sub === 'apagar') {
                const id = interaction.options.getString('id');

                await axios.delete(
                    `https://discord.com/api/v10/applications/${applicationId}/emojis/${id}`,
                    { headers: { Authorization: token } },
                );

                return interaction.editReply(`🗑️ Emoji com ID \`${id}\` foi apagado.`);
            }
        } catch (err) {
            console.error('Erro ao gerenciar emojis:', err.response?.data ?? err.message ?? err);
            return interaction.editReply(`❌ Erro: ${err.response?.data?.message ?? err.message}`);
        }
    },
};
