/* eslint-disable max-len */
/**
 * This command uses yt-dlp
 * Copyright (c) 2019-2024 yt-dlp developers
 * Repository: https://github.com/yt-dlp/yt-dlp
 * License: The Unlicense
 */
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ytmp3')
        .setDescription('Baixa um vídeo do YouTube e salva como .mp3')
        .addStringOption((option) => option.setName('nome')
            .setDescription('Nome do arquivo de saída (sem extensão)')
            .setRequired(true))
        .addStringOption((option) => option.setName('tipo')
            .setDescription('Tipo de áudio')
            .setRequired(true)
            .addChoices(
                { name: 'Meme', value: 'Meme' },
                { name: 'SoundTrack', value: 'SoundTrack' },
                { name: 'Music', value: 'Music' },
            ))
        .addStringOption((option) => option.setName('url')
            .setDescription('URL do vídeo do YouTube')
            .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        const nome = interaction.options.getString('nome');
        const tipo = interaction.options.getString('tipo');
        const url = interaction.options.getString('url');

        const fileName = `${tipo}-${nome}`;

        await interaction.reply({ content: '🎶 Baixando e convertendo, aguarde...', flags: 64 });

        try {
            const audioFolderPath = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolderPath)) {
                fs.mkdirSync(audioFolderPath, { recursive: true });
            }

            const filePath = path.join(audioFolderPath, `${fileName}.mp3`);
            const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');

            const cookiesPath = path.join(__dirname, 'cookies.txt');

            execFile(ytDlpPath, [
                '--cookies', cookiesPath,

                '--extractor-args',
                'youtube:player_client=android',

                '--user-agent',
                'Mozilla/5.0',

                '-x',
                '--audio-format', 'mp3',

                '--quiet',
                '--no-warnings',

                '-o',
                `${filePath}.%(ext)s`,

                url,
            ], (error, stdout, stderr) => {
                if (error) {
                    console.error('Erro no yt-dlp:', stderr || error);

                    return interaction.followUp({
                        content: `❌ Falha ao baixar áudio\n\`\`\`${stderr || error.message}\`\`\``,
                        flags: 64,
                    });
                }

                interaction.followUp({
                    content: `✅ Áudio salvo como **${fileName}.mp3**`,
                    flags: 64,
                });
            });
        } catch (err) {
            console.error('Erro ao processar:', err);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao processar o vídeo.', flags: 64 });
        }
    },
};
