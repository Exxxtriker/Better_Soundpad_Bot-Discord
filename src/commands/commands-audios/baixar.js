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
    MAX_AUDIO_DURATION_SECONDS,
    MAX_DOWNLOADED_AUDIO_BYTES,
    resolveInside,
    sanitizeBaseName,
    validateYouTubeUrl,
} = require('../../utils/audioFiles');
const { saveAudioMetadata } = require('../../utils/audioMetadata');

function parseDownloadMetadata(output) {
    return String(output || '').split(/\r?\n/).reduce((metadata, line) => {
        if (metadata || !line.trim().startsWith('{')) return metadata;
        try {
            const parsed = JSON.parse(line);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }, null);
}

function resolveDownloadedAudioPath(metadata, expectedPath, audioFolderPath) {
    if (!metadata?.filepath) return expectedPath;
    const candidate = path.resolve(metadata.filepath);
    const expectedFolder = path.resolve(audioFolderPath);
    const isSafeAudioPath = path.dirname(candidate) === expectedFolder
        && path.extname(candidate).toLowerCase() === '.mp3';
    return isSafeAudioPath ? candidate : expectedPath;
}

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
                { name: 'SoundEffects', value: 'SoundEffects' },
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
                '-f', 'bestaudio/best',
                '--audio-format', 'mp3',
                '--no-playlist',
                '--no-overwrites',
                '--max-filesize', '100M',
                '--match-filter', `duration <= ${MAX_AUDIO_DURATION_SECONDS}`,
                '--quiet',
                '--no-warnings',
                '--no-simulate',
                '--print', 'after_move:{"channel":%(channel)j,"filepath":%(filepath)j}',
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
                            content: '❌ Falha ao baixar o áudio. Confira a URL e os limites de 2 horas e 100 MB.',
                            flags: 64,
                        });
                        return;
                    }

                    const downloadMetadata = parseDownloadMetadata(stdout);
                    const downloadedPath = resolveDownloadedAudioPath(
                        downloadMetadata,
                        finalPath,
                        audioFolderPath,
                    );

                    if (!fs.existsSync(downloadedPath)) {
                        console.error('O yt-dlp terminou sem gerar o arquivo esperado.', {
                            expectedPath: finalPath,
                            reportedPath: downloadMetadata?.filepath,
                            output: stdout,
                            details: stderr,
                            limits: 'Duração máxima de 2 horas e download máximo de 100 MB.',
                        });
                        await interaction.followUp({
                            content: '❌ O vídeo não gerou um áudio. Confira os limites de **2 horas** e **100 MB**.',
                            flags: 64,
                        });
                        return;
                    }

                    if (fs.statSync(downloadedPath).size > MAX_DOWNLOADED_AUDIO_BYTES) {
                        fs.unlinkSync(downloadedPath);
                        await interaction.followUp({ content: '❌ O áudio convertido ultrapassou 100 MB.', flags: 64 });
                        return;
                    }

                    if (downloadedPath !== finalPath) fs.renameSync(downloadedPath, finalPath);
                    const sourceChannel = downloadMetadata?.channel;
                    saveAudioMetadata(audioFolderPath, fileName, {
                        source: 'youtube',
                        sourceChannel: sourceChannel && sourceChannel !== 'NA'
                            ? sourceChannel
                            : 'Canal não identificado',
                    });

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
    parseDownloadMetadata,
    resolveDownloadedAudioPath,
};
