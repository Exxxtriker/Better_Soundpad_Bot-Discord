/* eslint-disable max-len */
/**
 * This command uses yt-dlp
 * Copyright (c) 2019-2024 yt-dlp developers
 * Repository: https://github.com/yt-dlp/yt-dlp
 * License: The Unlicense
 */
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const {
    MAX_AUDIO_BYTES,
    MAX_AUDIO_DURATION_SECONDS,
    resolveInside,
    sanitizeBaseName,
    validateYouTubeUrl,
} = require('../../utils/audioFiles');

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
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: '❌ Você precisa da permissão Gerenciar Servidor.', flags: 64 });
            }

            const nome = sanitizeBaseName(interaction.options.getString('nome'));
            const tipo = interaction.options.getString('tipo');
            const url = validateYouTubeUrl(interaction.options.getString('url'));
            const fileName = `${tipo}-${nome}`;

            await interaction.reply({ content: '🎶 Baixando e convertendo, aguarde...', flags: 64 });

            const audioFolderPath = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolderPath)) {
                fs.mkdirSync(audioFolderPath, { recursive: true });
            }

            const outputTemplate = resolveInside(audioFolderPath, `${fileName}.%(ext)s`);
            const finalPath = resolveInside(audioFolderPath, `${fileName}.mp3`);
            if (fs.existsSync(finalPath)) {
                return interaction.followUp({ content: '❌ Já existe um áudio com esse nome.', flags: 64 });
            }
            const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');
            const cookiesPath = path.join(__dirname, 'cookies.txt');
            const args = [
                '--extractor-args',
                'youtube:player_client=android',
                '--user-agent',
                'Mozilla/5.0',
                '-x',
                '--audio-format', 'mp3',
                '--no-playlist',
                '--no-overwrites',
                '--max-filesize', '25M',
                '--match-filter', `duration <= ${MAX_AUDIO_DURATION_SECONDS}`,
                '--quiet',
                '--no-warnings',
                '-o',
                outputTemplate,
                url,
            ];

            if (fs.existsSync(cookiesPath)) args.unshift('--cookies', cookiesPath);

            execFile(ytDlpPath, args, { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
                try {
                    if (error) {
                        console.error('Erro no yt-dlp:', stderr || stdout || error);
                        await interaction.followUp({
                            content: '❌ Falha ao baixar o áudio. Confira a URL, a duração e o limite de 25 MB.',
                            flags: 64,
                        });
                        return;
                    }

                    if (!fs.existsSync(finalPath)) {
                        await interaction.followUp({
                            content: '❌ O download terminou sem gerar o arquivo esperado.',
                            flags: 64,
                        });
                        return;
                    }

                    if (fs.statSync(finalPath).size > MAX_AUDIO_BYTES) {
                        fs.unlinkSync(finalPath);
                        await interaction.followUp({ content: '❌ O áudio convertido ultrapassou 25 MB.', flags: 64 });
                        return;
                    }

                    await interaction.followUp({
                        content: `✅ Áudio salvo como **${fileName}.mp3**`,
                        flags: 64,
                    });
                } catch (callbackError) {
                    console.error('Erro ao finalizar download:', callbackError);
                    await interaction.followUp({
                        content: '❌ O download terminou, mas não foi possível finalizar o arquivo.',
                        flags: 64,
                    }).catch(() => {});
                }
            });
            return undefined;
        } catch (err) {
            console.error('Erro ao processar:', err);
            const response = { content: `❌ ${err.message || 'Não foi possível processar o vídeo.'}` };
            if (interaction.deferred || interaction.replied) return interaction.followUp({ ...response, flags: 64 });
            return interaction.reply({ ...response, flags: 64 });
        }
    },
};
