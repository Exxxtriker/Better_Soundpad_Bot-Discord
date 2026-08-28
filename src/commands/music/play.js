/* eslint-disable max-len */
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField,
} = require('discord.js');
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType,
} = require('@discordjs/voice');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { DisTube } = require('distube');
const { execFile, spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const YT_DLP_PATH = path.join(__dirname, '../commands-audios/yt-dlp.exe');
const COOKIES_PATH = path.join(__dirname, '../commands-audios/cookies.txt');

// ─── Fila por guild ───────────────────────────────────────────────
const guildQueues = new Map(); // guildId -> { songs[], player, connection, playing }
const playerMessages = new Map(); // guildId -> Message
let distube = null;

function formatDuration(seconds) {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = wholeSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getLoopMode(customMode, repeatMode = 0) {
    if (customMode) return customMode;
    return ['off', 'song', 'queue'][repeatMode] ?? 'off';
}

function validateQuery(query) {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 200) {
        throw new Error('Use uma busca entre 1 e 200 caracteres.');
    }

    if (!/^https?:\/\//i.test(trimmed)) return trimmed;

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error('URL inválida.');
    }

    const allowedHosts = [
        'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be',
        'spotify.com', 'open.spotify.com', 'soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com',
    ];
    if (parsed.protocol !== 'https:' || !allowedHosts.includes(parsed.hostname.toLowerCase())) {
        throw new Error('Apenas links HTTPS do YouTube, Spotify e SoundCloud são aceitos.');
    }

    return parsed.toString();
}

function stopProcesses(queue) {
    queue?.currentProcesses?.ytdlp?.kill();
    queue?.currentProcesses?.ffmpeg?.kill();
    if (queue) queue.currentProcesses = null;
}

// ─── Pega info da música via yt-dlp ──────────────────────────────
function getSongInfo(query) {
    return new Promise((resolve, reject) => {
        const input = /^https:\/\//i.test(query) ? query : `ytsearch1:${query}`;
        execFile(YT_DLP_PATH, [
            '--cookies', COOKIES_PATH,
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0',
            '--dump-json',
            '--no-warnings',
            '--quiet',
            '--no-playlist',
            input,
        ], { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout) => {
            if (error) return reject(new Error(error.message));
            try {
                const info = JSON.parse(stdout.trim().split('\n')[0]);
                resolve({
                    title: info.title ?? 'Desconhecido',
                    duration: info.duration ?? 0,
                    thumbnail: info.thumbnail ?? null,
                    url: info.webpage_url ?? query,
                    uploader: info.uploader ?? 'Desconhecido',
                    formattedDuration: formatDuration(info.duration ?? 0),
                    user: null, // preenchido depois
                });
            } catch {
                reject(new Error('Erro ao parsear informações da música.'));
            }
        });
    });
}

// ─── Stream de áudio via yt-dlp + ffmpeg ─────────────────────────
function createYtStream(url) {
    const ytdlp = spawn(YT_DLP_PATH, [
        '--cookies', COOKIES_PATH,
        '--extractor-args', 'youtube:player_client=android',
        '--user-agent', 'Mozilla/5.0',
        '-f', 'bestaudio/best',
        '--no-warnings',
        '--quiet',
        '-o', '-',
        url,
    ]);

    const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-loglevel', 'error',
        'pipe:1',
    ]);

    ytdlp.stdout.on('error', () => {});
    ytdlp.stdin?.on('error', () => {});
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ytdlp.stderr.on('data', (data) => console.error('[yt-dlp]', data.toString()));
    ffmpeg.stderr.on('data', (data) => console.error('[ffmpeg]', data.toString()));
    ytdlp.on('error', (error) => console.error('Falha ao iniciar yt-dlp:', error));
    ffmpeg.on('error', (error) => console.error('Falha ao iniciar FFmpeg:', error));

    ytdlp.on('close', () => {
        if (!ffmpeg.stdin.destroyed) ffmpeg.stdin.end();
    });

    return { stream: ffmpeg.stdout, ytdlp, ffmpeg };
}

function createEmbed(guildId) {
    const queue = guildQueues.get(guildId);
    const distubeQueue = distube?.getQueue(guildId);
    const song = queue?.songs[0] ?? distubeQueue?.songs[0] ?? null;
    const loopMode = getLoopMode(queue?.loop, distubeQueue?.repeatMode);
    let loopLabel = '🚫 Off';
    if (loopMode === 'song') loopLabel = '🔂 Música';
    if (loopMode === 'queue') loopLabel = '🔁 Fila';
    const queueSize = queue?.songs.length ?? distubeQueue?.songs.length ?? 0;
    const requester = song?.user ?? song?.member?.user;

    const embed = new EmbedBuilder().setColor(song ? 0x8A2BE2 : 0x2B2D31).setAuthor({ name: '🎵 Player de Música' });

    if (song) {
        embed
            .setTitle(song.title ?? song.name ?? 'Faixa desconhecida')
            .setURL(song.url)
            .setThumbnail(song.thumbnail ?? 'https://cdn.discordapp.com/embed/avatars/0.png')
            .addFields(
                { name: '⏱️ Duração', value: `\`${song.formattedDuration ?? '?:??'}\``, inline: true },
                { name: '🔁 Loop', value: loopLabel, inline: true },
                { name: '📋 Na fila', value: `\`${queueSize}\` música(s)`, inline: true },
                { name: '👤 Pedido por', value: requester ? `<@${requester.id}>` : 'Desconhecido', inline: true },
            )
            .setFooter({ text: 'Use /play para adicionar mais músicas!' });
    } else {
        embed
            .setTitle('Nenhuma música tocando')
            .setDescription('> 😴 A fila está vazia.\n> Use `/play <nome ou link>` para começar!')
            .setFooter({ text: 'Suporta YouTube, Spotify e SoundCloud' });
    }

    return embed;
}

function createRows(guildId) {
    const queue = guildQueues.get(guildId);
    const distubeQueue = distube?.getQueue(guildId);
    const isPaused = queue?.paused ?? distubeQueue?.paused ?? false;
    const loopMode = getLoopMode(queue?.loop, distubeQueue?.repeatMode);
    let loopLabel = '🚫 Loop';
    if (loopMode === 'song') loopLabel = '🔂 Música';
    if (loopMode === 'queue') loopLabel = '🔁 Fila';
    const loopStyle = loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success;

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setLabel('Anterior')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_pause').setEmoji(isPaused ? '▶️' : '⏸️')
                .setLabel(isPaused ? 'Continuar' : 'Pausar')
                .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Pular')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Parar')
                .setStyle(ButtonStyle.Danger),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel(loopLabel)
                .setStyle(loopStyle),
            new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('Aleatório')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_queue').setEmoji('📋').setLabel('Ver Fila')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
}

async function updateMessage(guildId) {
    const msg = playerMessages.get(guildId);
    if (!msg) return;
    try {
        await msg.edit({ embeds: [createEmbed(guildId)], components: createRows(guildId) });
    } catch (err) {
        console.error('Erro ao atualizar embed:', err);
    }
}

// ─── Toca a próxima música da fila ───────────────────────────────
async function playNext(guildId, textChannel) {
    const queue = guildQueues.get(guildId);
    if (!queue || queue.songs.length === 0) {
        stopProcesses(queue);
        if (queue?.connection && !queue.connection.destroyed) queue.connection.destroy();
        guildQueues.delete(guildId);
        await updateMessage(guildId);
        return;
    }

    const song = queue.songs[0];
    queue.paused = false;

    const { stream, ytdlp, ffmpeg } = createYtStream(song.url);
    queue.currentProcesses = { ytdlp, ffmpeg };

    const resource = createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true });
    resource.volume?.setVolume(queue.volume / 100);
    queue.player.play(resource);
    queue.currentResource = resource;

    await updateMessage(guildId);

    textChannel?.send({
        content: `🎵 Tocando agora: **${song.title}** \`${song.formattedDuration}\`${song.user ? ` — Pedido por **${song.user.tag}**` : ''}`,
        allowedMentions: { parse: [] },
    }).then((message) => setTimeout(() => message.delete().catch(() => {}), 10_000))
        .catch((error) => console.error('Erro ao anunciar música:', error));
}

// ─── DisTube para Spotify/SoundCloud ─────────────────────────────
function getDistube(client) {
    if (!distube) {
        distube = new DisTube(client, {
            plugins: [new SpotifyPlugin(), new SoundCloudPlugin()],
        });
        distube.on('playSong', (queue) => updateMessage(queue.id));
        distube.on('addSong', (queue) => updateMessage(queue.id));
        distube.on('finishSong', (queue) => updateMessage(queue.id));
        distube.on('deleteQueue', (queue) => updateMessage(queue.id));
        distube.on('disconnect', (queue) => updateMessage(queue.id));
        distube.on('error', (error, queue) => {
            console.error('DisTube error:', error);
            queue?.textChannel?.send({ content: '❌ Não foi possível reproduzir essa faixa.' })
                .catch(() => {});
        });
    }
    return distube;
}

function getDistubeQueue(guildId) {
    return distube?.getQueue(guildId);
}

async function stopCustomQueue(guildId) {
    const queue = guildQueues.get(guildId);
    if (!queue) return;

    queue.transitioning = true;
    queue.songs = [];
    stopProcesses(queue);
    queue.player.stop(true);
    if (!queue.connection.destroyed) queue.connection.destroy();
    guildQueues.delete(guildId);
    await updateMessage(guildId);
}

async function advanceCustomQueue(guildId, textChannel, direction = 'next') {
    const queue = guildQueues.get(guildId);
    if (!queue || queue.transitioning) return false;
    if (direction === 'previous' && queue.history.length === 0) return false;

    queue.transitioning = true;
    try {
        stopProcesses(queue);
        if (direction === 'previous') {
            const previous = queue.history.pop();
            queue.songs.unshift(previous);
        } else {
            const current = queue.songs.shift();
            if (current) queue.history.push(current);
        }
        await playNext(guildId, textChannel);
        return true;
    } finally {
        const activeQueue = guildQueues.get(guildId);
        if (activeQueue) activeQueue.transitioning = false;
    }
}

// ─── Conecta ao canal de voz e monta o player ────────────────────
async function ensureQueue(guild, voiceChannel, textChannel) {
    if (guildQueues.has(guild.id)) return guildQueues.get(guild.id);

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

    const player = createAudioPlayer();
    connection.subscribe(player);

    const queue = {
        songs: [],
        player,
        connection,
        volume: 100,
        loop: 'off',
        paused: false,
        history: [],
        currentProcesses: null,
        currentResource: null,
        transitioning: false,
    };

    guildQueues.set(guild.id, queue);

    player.on(AudioPlayerStatus.Idle, async () => {
        const q = guildQueues.get(guild.id);
        if (!q || q.transitioning) return;

        q.transitioning = true;
        try {
            stopProcesses(q);
            if (q.loop === 'queue' && q.songs.length > 0) {
                q.songs.push(q.songs.shift());
            } else if (q.loop !== 'song') {
                const finished = q.songs.shift();
                if (finished) q.history.push(finished);
            }
            await playNext(guild.id, textChannel);
        } finally {
            const activeQueue = guildQueues.get(guild.id);
            if (activeQueue) activeQueue.transitioning = false;
        }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
        } catch {
            stopProcesses(guildQueues.get(guild.id));
            connection.destroy();
            guildQueues.delete(guild.id);
            await updateMessage(guild.id);
        }
    });

    return queue;
}

// ─── Exports ─────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Toca uma música ou playlist (YouTube, Spotify, SoundCloud, etc)')
        .addStringOption((option) => option.setName('query')
            .setDescription('Nome da música, link do YouTube, Spotify, SoundCloud...')
            .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.editReply('❌ Você precisa estar em um canal de voz!');
        const botPermissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.editReply('❌ Preciso das permissões Conectar e Falar nesse canal.');
        }

        try {
            const query = validateQuery(interaction.options.getString('query'));
            const queryUrl = /^https:\/\//i.test(query) ? new URL(query) : null;
            const isSpotify = queryUrl?.hostname.toLowerCase().includes('spotify.com');
            const isSoundCloud = queryUrl?.hostname.toLowerCase().includes('soundcloud.com');
            const customQueue = guildQueues.get(interaction.guild.id);
            const existingDistubeQueue = getDistubeQueue(interaction.guild.id);
            const activeVoiceChannelId = customQueue?.connection?.joinConfig?.channelId
                ?? existingDistubeQueue?.voiceChannel?.id;
            if (activeVoiceChannelId && activeVoiceChannelId !== voiceChannel.id) {
                return interaction.editReply('❌ Entre no mesmo canal de voz do bot para adicionar músicas.');
            }

            if (!playerMessages.has(interaction.guild.id)) {
                const sentMessage = await interaction.channel.send({
                    embeds: [createEmbed(interaction.guild.id)],
                    components: createRows(interaction.guild.id),
                });
                playerMessages.set(interaction.guild.id, sentMessage);
                const deleteListener = (message) => {
                    if (message.id === sentMessage.id) {
                        playerMessages.delete(interaction.guild.id);
                        interaction.client.removeListener('messageDelete', deleteListener);
                    }
                };
                interaction.client.on('messageDelete', deleteListener);
            }

            if (isSpotify || isSoundCloud) {
                if (guildQueues.has(interaction.guild.id)) {
                    return interaction.editReply('❌ Finalize a fila atual antes de trocar para Spotify/SoundCloud.');
                }
                const dt = getDistube(interaction.client);
                await dt.play(voiceChannel, query, { textChannel: interaction.channel, member: interaction.member });
                await updateMessage(interaction.guild.id);
                return interaction.editReply(`✅ Adicionado: **${query}**`);
            }

            if (getDistubeQueue(interaction.guild.id)) {
                return interaction.editReply('❌ Finalize a fila atual antes de trocar para YouTube.');
            }

            // YouTube ou busca por nome
            await interaction.editReply('🔍 Buscando...');
            const songInfo = await getSongInfo(query);
            songInfo.user = interaction.user;

            const queue = await ensureQueue(interaction.guild, voiceChannel, interaction.channel);
            queue.songs.push(songInfo);

            if (queue.player.state.status === AudioPlayerStatus.Idle) {
                await playNext(interaction.guild.id, interaction.channel);
            } else {
                await updateMessage(interaction.guild.id);
                await interaction.editReply(`✅ Adicionado à fila: **${songInfo.title}**`);
                return;
            }

            await interaction.editReply(`✅ Tocando: **${songInfo.title}**`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Não foi possível carregar essa música. Confira a busca ou o link.');
        }
    },

    // Exporta para o interaction handler
    guildQueues,
    playerMessages,
    createEmbed,
    createRows,
    updateMessage,
    playNext,
    advanceCustomQueue,
    getDistubeQueue,
    stopCustomQueue,
    formatDuration,
};
