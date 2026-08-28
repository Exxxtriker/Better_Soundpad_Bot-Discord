const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
    MAX_AUDIO_BYTES,
    SUPPORTED_AUDIO_EXTENSIONS,
    resolveInside,
    sanitizeBaseName,
} = require('../../utils/audioFiles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uploadaudio')
        .setDescription('Envia um arquivo de áudio para a pasta do bot.')
        .addAttachmentOption((option) => option.setName('arquivo')
            .setDescription('Arquivo de áudio (.mp3, .ogg, .wav)')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: '❌ Você precisa da permissão Gerenciar Servidor.', flags: 64 });
            }

            const attachment = interaction.options.getAttachment('arquivo');
            const ext = path.extname(attachment.name).toLowerCase();

            if (!SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
                return interaction.reply({ content: '❌ Apenas arquivos de áudio (.mp3, .ogg, .wav) são permitidos!', flags: 64 });
            }

            if (!attachment.contentType?.startsWith('audio/') || attachment.size > MAX_AUDIO_BYTES) {
                return interaction.reply({
                    content: '❌ O arquivo deve ser um áudio válido de até 25 MB.',
                    flags: 64,
                });
            }

            await interaction.deferReply({ flags: 64 });

            const audioFolderPath = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolderPath)) {
                fs.mkdirSync(audioFolderPath, { recursive: true });
            }

            const safeName = `${sanitizeBaseName(path.basename(attachment.name, ext))}${ext}`;
            const filePath = resolveInside(audioFolderPath, safeName);
            if (fs.existsSync(filePath)) {
                return interaction.editReply('❌ Já existe um áudio com esse nome.');
            }

            const response = await axios.get(attachment.url, {
                responseType: 'arraybuffer',
                timeout: 30_000,
                maxContentLength: MAX_AUDIO_BYTES,
                maxBodyLength: MAX_AUDIO_BYTES,
            });
            fs.writeFileSync(filePath, response.data);

            return interaction.editReply({ content: `✅ O áudio **${safeName}** foi salvo com sucesso!` });
        } catch (error) {
            console.error('Erro ao salvar o áudio:', error);
            const response = { content: `❌ ${error.message || 'Não foi possível salvar o áudio.'}` };
            if (interaction.deferred || interaction.replied) return interaction.editReply(response);
            return interaction.reply({ ...response, flags: 64 });
        }
    },
};
