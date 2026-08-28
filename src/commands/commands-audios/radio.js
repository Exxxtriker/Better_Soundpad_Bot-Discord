const {
    AudioPlayerStatus,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
} = require('@discordjs/voice');
const { PermissionsBitField, SlashCommandBuilder } = require('discord.js');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const activeRadios = new Map();
const DEFAULT_RADIO_OWNER_ID = '1467356224487161876';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('radio')
        .setDescription('Conecta ao canal de voz e reproduz o áudio do desktop do host')
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const ownerId = process.env.RADIO_OWNER_ID || DEFAULT_RADIO_OWNER_ID;
        if (interaction.user.id !== ownerId) {
            return interaction.editReply('Você não tem permissão para usar este comando!');
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.editReply('Você precisa estar em um canal de voz para usar este comando!');
        }

        const botPermissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.editReply('Preciso das permissões Conectar e Falar nesse canal.');
        }

        const guildId = interaction.guild.id;
        if (activeRadios.has(guildId)) {
            return interaction.editReply('A rádio já está ativa neste servidor.');
        }

        let connection;
        let ffmpeg;
        let voiceStateListener;
        let cleaned = false;

        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            activeRadios.delete(guildId);
            if (voiceStateListener) interaction.client.removeListener('voiceStateUpdate', voiceStateListener);
            if (ffmpeg && !ffmpeg.killed) ffmpeg.kill();
            if (connection && !connection.destroyed) connection.destroy();
        };

        try {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

            ffmpeg = spawn(ffmpegPath, [
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-thread_queue_size', '2048',
                '-f', 'dshow',
                '-i', 'audio=CABLE Output (VB-Audio Virtual Cable)',
                '-ac', '2',
                '-ar', '48000',
                '-c:a', 'libopus',
                '-frame_duration', '5',
                '-flush_packets', '1',
                '-f', 'opus',
                '-loglevel', 'error',
                'pipe:1',
            ]);

            const player = createAudioPlayer();
            const resource = createAudioResource(ffmpeg.stdout);
            connection.subscribe(player);
            activeRadios.set(guildId, { connection, ffmpeg, player });
            voiceStateListener = () => {
                const humanMembers = voiceChannel.members.filter((member) => !member.user.bot);
                if (humanMembers.size === 0) cleanup();
            };
            interaction.client.on('voiceStateUpdate', voiceStateListener);

            ffmpeg.once('error', (error) => {
                console.error('Erro ao iniciar FFmpeg da rádio:', error);
                cleanup();
            });
            ffmpeg.stderr.on('data', (data) => console.error('[rádio/ffmpeg]', data.toString()));
            ffmpeg.once('close', cleanup);
            player.once('error', (error) => {
                console.error('Erro no player da rádio:', error);
                cleanup();
            });
            player.once(AudioPlayerStatus.Idle, cleanup);
            connection.once(VoiceConnectionStatus.Destroyed, cleanup);

            player.play(resource);
            return interaction.editReply(`Reproduzindo o áudio do desktop em: ${voiceChannel.name}`);
        } catch (error) {
            console.error('Erro ao iniciar rádio:', error);
            cleanup();
            return interaction.editReply('Não foi possível iniciar a rádio. Verifique o dispositivo de áudio virtual.');
        }
    },
};
