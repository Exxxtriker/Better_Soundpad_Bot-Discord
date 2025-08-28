const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uploadaudio')
        .setDescription('Envia um arquivo de áudio para a pasta do bot.')
        .addAttachmentOption((option) => option.setName('arquivo')
            .setDescription('Arquivo de áudio (.mp3, .ogg, .wav)')
            .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            // if (interaction.user.id !== '335012394226941966') {
            //     return interaction.editReply('Você é o meu patrono e só obedeço a ele ☠️');
            // }
            const attachment = interaction.options.getAttachment('arquivo');

            // Extensões suportadas
            const supportedExtensions = ['.mp3', '.ogg', '.wav'];
            const ext = path.extname(attachment.name).toLowerCase();

            if (!supportedExtensions.includes(ext)) {
                return interaction.reply({ content: '❌ Apenas arquivos de áudio (.mp3, .ogg, .wav) são permitidos!', flags: 64 });
            }

            // Pasta de destino
            const audioFolderPath = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolderPath)) {
                fs.mkdirSync(audioFolderPath, { recursive: true });
            }

            // Caminho completo do arquivo
            const filePath = path.join(audioFolderPath, attachment.name);

            // Baixar o arquivo do Discord
            const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            fs.writeFileSync(filePath, response.data);

            await interaction.reply({ content: `✅ O áudio **${attachment.name}** foi salvo na pasta com sucesso!`, flags: 64 });
        } catch (error) {
            console.error('Erro ao salvar o áudio:', error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao tentar salvar o áudio. Tente novamente mais tarde.', flags: 64 });
        }
    },
};
