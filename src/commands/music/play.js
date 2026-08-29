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
const { PassThrough } = require('stream');
const ffmpegPath = require('ffmpeg-static');
const activePlayers = require('../../handlers/activePlayers');
const { safelyDestroyVoiceConnection } = require('../../utils/voiceConnection');

const YT_DLP_PATH = path.join(__dirname, '../commands-audios/yt-dlp.exe');
const COOKIES_PATH = path.join(__dirname, '../commands-audios/cookies.txt');
const STREAM_URL_MAX_AGE = 4 * 60 * 60 * 1000;
const DEFAULT_MUSIC_VOLUME = 100;
const MAX_SPOTIFY_QUEUE_SIZE = 1_000;

// ─── Fila por guild ───────────────────────────────────────────────
const guildQueues = new Map(); // guildId -> { songs[], player, connection, playing }
const playerMessages = new Map(); // guildId -> Message
const playerMessageDeleteListeners = new Map(); // guildId -> { client, listener }
const pendingPlayRequests = new Map(); // guildId -> quantidade de /play em processamento
const retriedDistubeSongs = new WeakSet();
let distube = null;
let spotifyPlugin = null;
let spotifyPublicPlugin = null;

function beginPlayRequest(guildId) {
    pendingPlayRequests.set(guildId, (pendingPlayRequests.get(guildId) ?? 0) + 1);
}

function endPlayRequest(guildId) {
    const remaining = (pendingPlayRequests.get(guildId) ?? 1) - 1;
    if (remaining > 0) pendingPlayRequests.set(guildId, remaining);
    else pendingPlayRequests.delete(guildId);
}

function clearPlayerMessage(guildId, expectedMessageId) {
    const currentMessage = playerMessages.get(guildId);
    if (expectedMessageId && currentMessage?.id !== expectedMessageId) return false;

    playerMessages.delete(guildId);
    const registration = playerMessageDeleteListeners.get(guildId);
    if (registration) {
        registration.client.removeListener('messageDelete', registration.listener);
        playerMessageDeleteListeners.delete(guildId);
    }
    return Boolean(currentMessage || registration);
}

function registerPlayerMessage(guildId, message, client) {
    clearPlayerMessage(guildId);
    playerMessages.set(guildId, message);

    const listener = (deletedMessage) => {
        if (deletedMessage.id === message.id) clearPlayerMessage(guildId, message.id);
    };
    playerMessageDeleteListeners.set(guildId, { client, listener });
    client.on('messageDelete', listener);
}

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

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'youtu.be') {
        const videoId = parsed.pathname.split('/').filter(Boolean)[0];
        if (videoId) return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    }

    if (hostname.endsWith('youtube.com')) {
        const videoId = parsed.searchParams.get('v');
        if (videoId) return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    }

    return parsed.toString();
}

function stopProcesses(queue) {
    queue?.currentProcesses?.cancel?.();
    queue?.currentProcesses?.ytdlp?.kill();
    queue?.currentProcesses?.ffmpeg?.kill();
    if (queue) queue.currentProcesses = null;
}

function handleAudioPlayerError(error) {
    if (/write after end/i.test(error?.message ?? '')) return;
    console.error(`Erro no player de áudio: ${error?.message ?? error}`);
}

async function dismissReply(interaction) {
    await interaction.deleteReply().catch((error) => {
        console.error('Não foi possível remover a confirmação do comando:', error);
    });
}

function getSelectedStreamData(info) {
    const selectedFormat = info.requested_downloads?.[0] ?? info;
    const streamUrl = selectedFormat.url ?? info.url;
    if (!streamUrl) throw new Error('O YouTube não retornou uma URL de áudio reproduzível.');

    return {
        streamUrl,
        httpHeaders: selectedFormat.http_headers ?? info.http_headers ?? {},
    };
}

function buildFfmpegHeaders(headers = {}) {
    return Object.entries(headers)
        .filter(([name, value]) => name && typeof value === 'string' && !/[\r\n]/.test(`${name}${value}`))
        .map(([name, value]) => `${name}: ${value}\r\n`)
        .join('');
}

// ─── Pega info da música via yt-dlp ──────────────────────────────
function getSongInfo(query) {
    return new Promise((resolve, reject) => {
        const input = /^https:\/\//i.test(query) ? query : `ytsearch1:${query}`;
        execFile(YT_DLP_PATH, [
            '--cookies', COOKIES_PATH,
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0',
            '-f', 'bestaudio/best',
            '--dump-json',
            '--no-warnings',
            '--quiet',
            '--no-playlist',
            input,
        ], { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout) => {
            if (error) return reject(new Error(error.message));
            try {
                const info = JSON.parse(stdout.trim().split('\n')[0]);
                const streamData = getSelectedStreamData(info);
                resolve({
                    title: info.title ?? 'Desconhecido',
                    duration: info.duration ?? 0,
                    thumbnail: info.thumbnail ?? null,
                    url: info.webpage_url ?? query,
                    uploader: info.uploader ?? 'Desconhecido',
                    formattedDuration: formatDuration(info.duration ?? 0),
                    ...streamData,
                    resolvedAt: Date.now(),
                    user: null, // preenchido depois
                });
            } catch {
                reject(new Error('Erro ao parsear informações da música.'));
            }
        });
    });
}

// ─── Stream direto da URL resolvida pelo yt-dlp ──────────────────
function createYtStream(song) {
    const headers = buildFfmpegHeaders(song.httpHeaders);
    const inputOptions = headers ? ['-headers', headers] : [];
    const output = new PassThrough();
    const processes = {
        ytdlp: null,
        ffmpeg: null,
        cancelled: false,
        cancel() {
            this.cancelled = true;
            this.ytdlp?.kill();
            this.ffmpeg?.kill();
        },
    };
    let directBytes = 0;
    let directError = '';
    let directFinished = false;
    let fallbackStarted = false;

    const startFallback = () => {
        if (fallbackStarted || processes.cancelled) return;
        fallbackStarted = true;

        const ytdlp = spawn(YT_DLP_PATH, [
            '--cookies', COOKIES_PATH,
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0',
            '-f', 'bestaudio/best',
            '--no-playlist',
            '--no-warnings',
            '--quiet',
            '-o', '-',
            song.streamQuery ?? song.url,
        ]);
        const fallbackFfmpeg = spawn(ffmpegPath, [
            '-nostdin',
            '-loglevel', 'error',
            '-i', 'pipe:0',
            '-vn',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1',
        ]);

        processes.ytdlp = ytdlp;
        processes.ffmpeg = fallbackFfmpeg;
        ytdlp.stdout.on('error', () => {});
        fallbackFfmpeg.stdin.on('error', () => {});
        fallbackFfmpeg.stdout.on('error', () => {});
        ytdlp.stdout.pipe(fallbackFfmpeg.stdin);
        fallbackFfmpeg.stdout.pipe(output, { end: false });
        ytdlp.stderr.on('data', (data) => console.error('[yt-dlp]', data.toString()));
        fallbackFfmpeg.stderr.on('data', (data) => console.error('[ffmpeg]', data.toString()));
        ytdlp.on('error', (error) => console.error('Falha ao iniciar yt-dlp:', error));
        fallbackFfmpeg.on('error', (error) => {
            console.error('Falha ao iniciar FFmpeg:', error);
            fallbackFfmpeg.stdout.unpipe(output);
            if (!output.destroyed && !output.writableEnded) output.end();
        });
        ytdlp.on('close', () => {
            if (!fallbackFfmpeg.stdin.destroyed) fallbackFfmpeg.stdin.end();
        });
        fallbackFfmpeg.on('close', () => {
            if (!output.destroyed && !output.writableEnded) output.end();
        });
    };

    if (song.forceCompatibleStream) {
        startFallback();
        return { stream: output, processes };
    }

    const ffmpeg = spawn(ffmpegPath, [
        '-nostdin',
        '-loglevel', 'error',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_on_network_error', '1',
        '-reconnect_on_http_error', '4xx,5xx',
        '-reconnect_delay_max', '5',
        '-rw_timeout', '15000000',
        ...inputOptions,
        '-i', song.streamUrl,
        '-vn',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
    ]);
    processes.ffmpeg = ffmpeg;

    ffmpeg.stdout.on('error', () => {});
    ffmpeg.stdout.on('data', (chunk) => {
        directBytes += chunk.length;
        if (!output.destroyed && !output.writableEnded) output.write(chunk);
    });
    ffmpeg.stderr.on('data', (data) => {
        directError = `${directError}${data}`.slice(-4_000);
    });
    ffmpeg.on('error', (error) => {
        console.error('Falha ao iniciar FFmpeg:', error);
        if (!directFinished && directBytes === 0) startFallback();
    });
    ffmpeg.on('close', (code) => {
        if (directFinished) return;
        directFinished = true;
        if (!processes.cancelled && code !== 0 && directBytes === 0) {
            startFallback();
        } else if (!output.destroyed && !output.writableEnded) {
            if (code !== 0 && directError) console.error('[ffmpeg-direto]', directError);
            output.end();
        }
    });

    return { stream: output, processes };
}

function createEmbed(guildId) {
    const queue = guildQueues.get(guildId);
    const distubeQueue = distube?.getQueue(guildId);
    const songs = queue?.songs ?? distubeQueue?.songs ?? [];
    const song = songs[0] ?? null;
    const loopMode = getLoopMode(queue?.loop, distubeQueue?.repeatMode);
    let loopLabel = '`Sem refrão`';
    if (loopMode === 'song') loopLabel = '`Uma balada`';
    if (loopMode === 'queue') loopLabel = '`Toda a jornada`';
    const queueSize = songs.length;
    const requester = song?.user ?? song?.member?.user;
    const isPaused = queue?.paused ?? distubeQueue?.paused ?? false;
    const volume = queue?.volume ?? distubeQueue?.volume ?? 100;
    const uploader = typeof song?.uploader === 'string' ? song.uploader : song?.uploader?.name;
    let embedColor = 0x2F4F3E;
    if (song) embedColor = isPaused ? 0xC9A227 : 0x7A1F2B;

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: '⚜️ GIDEON, O BARDO  •  SALÃO DAS CANÇÕES' });

    if (song) {
        const upcoming = songs.slice(1, 4).map((nextSong, index) => {
            const name = nextSong.title ?? nextSong.name ?? 'Faixa desconhecida';
            return `**${index + 1}.** ${name.slice(0, 70)}`;
        });
        const hiddenSongs = Math.max(0, songs.length - 4);
        if (hiddenSongs > 0) upcoming.push(`*e mais ${hiddenSongs} música(s)...*`);

        embed
            .setTitle(`🎻 ${(song.title ?? song.name ?? 'Balada desconhecida').slice(0, 230)}`)
            .setDescription([
                '> *“Que a melodia acompanhe vossa jornada...”*',
                '',
                isPaused ? '⏸️ **A BALADA ESTÁ EM DESCANSO**' : '▶️ **BALADA EM EXECUÇÃO**',
                uploader ? `🪕 Entoada por **${uploader.slice(0, 100)}**` : '🪕 Menestrel desconhecido',
            ].join('\n'))
            .addFields(
                { name: '⌛ Duração', value: `\`${song.formattedDuration ?? '?:??'}\``, inline: true },
                { name: '🔊 Intensidade', value: `\`${volume}%\``, inline: true },
                { name: '🔁 Encantamento', value: loopLabel, inline: true },
                { name: '📜 Pergaminho', value: `\`${queueSize}\` balada(s)`, inline: true },
                { name: '🛡️ Convocada por', value: requester ? `<@${requester.id}>` : '`Viajante desconhecido`', inline: true },
                {
                    name: '🗺️ Próximas baladas da jornada',
                    value: upcoming.length > 0 ? upcoming.join('\n') : '*O pergaminho não guarda outras canções.*',
                    inline: false,
                },
            )
            .setFooter({ text: 'Taverna de Gideon  •  Use /play para pedir uma canção' });

        if (/^https:\/\//i.test(song.url ?? '')) embed.setURL(song.url);
        if (/^https:\/\//i.test(song.thumbnail ?? '')) embed.setThumbnail(song.thumbnail);
    } else {
        embed
            .setTitle('🏰 O salão aguarda uma canção')
            .setDescription([
                '> *As cordas repousam e a taverna permanece em silêncio...*',
                '',
                'Use `/play` com o nome ou elo de uma canção para despertar o bardo.',
            ].join('\n'))
            .addFields(
                { name: '📜 Exemplo de invocação', value: '`/play The Dragonborn Comes`', inline: false },
                { name: '🗺️ Repertório dos reinos', value: '`YouTube`  •  `Spotify`  •  `SoundCloud`', inline: false },
            )
            .setFooter({ text: 'Que rolem os dados e ressoem as canções ⚔️' });
    }

    return embed;
}

function createRows(guildId) {
    const queue = guildQueues.get(guildId);
    const distubeQueue = distube?.getQueue(guildId);
    const isPaused = queue?.paused ?? distubeQueue?.paused ?? false;
    const loopMode = getLoopMode(queue?.loop, distubeQueue?.repeatMode);
    let loopLabel = 'Sem Refrão';
    if (loopMode === 'song') loopLabel = 'Uma Balada';
    if (loopMode === 'queue') loopLabel = 'Toda a Jornada';
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
            new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Encerrar')
                .setStyle(ButtonStyle.Danger),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel(loopLabel)
                .setStyle(loopStyle),
            new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('Embaralhar')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_queue').setEmoji('📜').setLabel('Pergaminho')
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
        if (err.code === 10008) {
            clearPlayerMessage(guildId, msg.id);
            return;
        }
        console.error('Erro ao atualizar embed:', err);
    }
}

// ─── Toca a próxima música da fila ───────────────────────────────
async function playNext(guildId, textChannel) {
    const queue = guildQueues.get(guildId);
    if (!queue || queue.songs.length === 0) {
        stopProcesses(queue);
        guildQueues.delete(guildId);
        safelyDestroyVoiceConnection(queue?.connection);
        await updateMessage(guildId);
        return;
    }

    const song = queue.songs[0];
    queue.paused = false;

    if (!song.streamUrl || Date.now() - song.resolvedAt > STREAM_URL_MAX_AGE) {
        const requester = song.user;
        const streamInfo = await getSongInfo(song.streamQuery ?? song.url);
        if (song.preserveMetadata) {
            song.streamUrl = streamInfo.streamUrl;
            song.httpHeaders = streamInfo.httpHeaders;
            song.resolvedAt = streamInfo.resolvedAt;
            song.streamQuery = streamInfo.url;
        } else {
            Object.assign(song, streamInfo);
        }
        song.user = requester;
    }

    const { stream, processes } = createYtStream(song);
    queue.currentProcesses = processes;

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

function getSpotifyPlugin() {
    if (!spotifyPlugin) {
        const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
        const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const spotifyOptions = spotifyClientId && spotifyClientSecret
            ? {
                api: {
                    clientId: spotifyClientId,
                    clientSecret: spotifyClientSecret,
                    topTracksCountry: 'BR',
                },
            }
            : {};

        spotifyPlugin = new SpotifyPlugin(spotifyOptions);
    }
    return spotifyPlugin;
}

function getSpotifyPublicPlugin() {
    if (!spotifyPublicPlugin) spotifyPublicPlugin = new SpotifyPlugin();
    return spotifyPublicPlugin;
}

async function resolveSpotify(query, options, primaryPlugin = getSpotifyPlugin(), publicPluginFactory = getSpotifyPublicPlugin) {
    try {
        return await primaryPlugin.resolve(query, options);
    } catch (error) {
        const isUnavailableEditorialPlaylist = error.errorCode === 'SPOTIFY_API_ERROR'
            && /Resource not found|Status code:\s*404/i.test(error.message);
        if (!isUnavailableEditorialPlaylist) throw error;

        return publicPluginFactory().resolve(query, options);
    }
}

function createSpotifyQueueSongs(resolved, user) {
    const tracks = Array.isArray(resolved.songs) ? resolved.songs : [resolved];
    if (tracks.length > MAX_SPOTIFY_QUEUE_SIZE) {
        throw new Error(`A playlist possui mais de ${MAX_SPOTIFY_QUEUE_SIZE} faixas.`);
    }

    return tracks.map((track) => {
        const title = track.name ?? track.title ?? 'Faixa desconhecida';
        const uploader = track.uploader?.name ?? track.uploader ?? 'Artista desconhecido';
        return {
            title,
            duration: track.duration ?? 0,
            formattedDuration: track.formattedDuration ?? formatDuration(track.duration ?? 0),
            thumbnail: track.thumbnail ?? null,
            url: track.url,
            uploader,
            user,
            streamQuery: `${title} ${uploader} official audio`.slice(0, 200),
            streamUrl: null,
            httpHeaders: {},
            resolvedAt: 0,
            preserveMetadata: true,
            forceCompatibleStream: true,
        };
    });
}

// ─── DisTube apenas para SoundCloud ──────────────────────────────
function getDistube(client) {
    if (!distube) {
        distube = new DisTube(client, {
            plugins: [new SoundCloudPlugin()],
            ffmpeg: {
                path: ffmpegPath,
                args: {
                    input: {
                        reconnect_on_network_error: 1,
                        reconnect_on_http_error: '4xx,5xx',
                        rw_timeout: 15_000_000,
                        user_agent: 'Mozilla/5.0',
                    },
                },
            },
        });
        distube.on('initQueue', (queue) => queue.setVolume(DEFAULT_MUSIC_VOLUME));
        distube.on('playSong', (queue) => updateMessage(queue.id));
        distube.on('addSong', (queue) => updateMessage(queue.id));
        distube.on('finishSong', (queue) => updateMessage(queue.id));
        distube.on('deleteQueue', (queue) => updateMessage(queue.id));
        distube.on('disconnect', (queue) => updateMessage(queue.id));
        distube.on('ffmpegDebug', (message) => {
            if (/Premature close|-10054|Will reconnect|Error in the pull function/i.test(message)) return;
            const isProcessError = /\[(?:process|stream)\] error:/i.test(message);
            const isFfmpegError = /\[ffmpeg\] log:.*(?:error|invalid|failed|forbidden|timed? out|reset)/i
                .test(message);
            if (!isProcessError && !isFfmpegError) return;
            const safeMessage = message.replace(/https?:\/\/\S+/gi, '[URL removida]');
            console.error('[DisTube/FFmpeg]', safeMessage);
        });
        distube.on('error', (error, queue, song) => {
            if (error.errorCode === 'FFMPEG_EXITED' && queue && song && !retriedDistubeSongs.has(song)) {
                retriedDistubeSongs.add(song);
                const playableSong = song.stream?.playFromSource ? song : song.stream?.song;
                if (playableSong?.stream) delete playableSong.stream.url;
                queue.songs.unshift(song);
                return;
            }

            console.error('DisTube error:', error);
            queue?.textChannel?.send({ content: '❌ Não foi possível reproduzir essa faixa; ela foi pulada.' })
                .then((message) => setTimeout(() => message.delete().catch(() => {}), 8_000))
                .catch(() => {});
        });
    }
    return distube;
}

function getDistubeQueue(guildId) {
    return distube?.getQueue(guildId);
}

function isMusicActive(guildId) {
    return pendingPlayRequests.has(guildId)
        || guildQueues.has(guildId)
        || Boolean(getDistubeQueue(guildId));
}

async function stopCustomQueue(guildId) {
    const queue = guildQueues.get(guildId);
    if (!queue) return;

    queue.transitioning = true;
    queue.songs = [];
    guildQueues.delete(guildId);
    stopProcesses(queue);
    queue.player.stop(true);
    safelyDestroyVoiceConnection(queue.connection);
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
    player.on('error', handleAudioPlayerError);
    connection.subscribe(player);

    const queue = {
        songs: [],
        player,
        connection,
        volume: DEFAULT_MUSIC_VOLUME,
        loop: 'off',
        paused: false,
        history: [],
        currentProcesses: null,
        currentResource: null,
        transitioning: false,
    };

    guildQueues.set(guild.id, queue);

    player.on(AudioPlayerStatus.Idle, () => {
        const handleIdle = async () => {
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
        };

        handleIdle().catch((error) => {
            console.error('Erro ao avançar a fila de música:', error);
            const activeQueue = guildQueues.get(guild.id);
            if (activeQueue) activeQueue.transitioning = false;
        });
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
        const handleDisconnect = async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                const activeQueue = guildQueues.get(guild.id);
                if (activeQueue?.connection === connection) guildQueues.delete(guild.id);
                stopProcesses(activeQueue);
                safelyDestroyVoiceConnection(connection);
                await updateMessage(guild.id);
            }
        };

        handleDisconnect().catch((error) => {
            console.error('Erro ao tratar desconexão do canal de voz:', error);
        });
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
        const { guildId } = interaction;
        beginPlayRequest(guildId);

        try {
            await interaction.deferReply({ flags: 64 });

            if (activePlayers.has(guildId)) {
                return interaction.editReply(
                    '⚠️ O painel de áudios está ativo. Encerre-o antes de usar `/play`.',
                );
            }

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply('❌ Você precisa estar em um canal de voz!');
            const botPermissions = voiceChannel.permissionsFor(interaction.guild.members.me);
            if (!botPermissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
                return interaction.editReply('❌ Preciso das permissões Conectar e Falar nesse canal.');
            }

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
                registerPlayerMessage(interaction.guild.id, sentMessage, interaction.client);
            }

            if (isSpotify) {
                if (getDistubeQueue(interaction.guild.id)) {
                    return interaction.editReply('❌ Finalize a fila do SoundCloud antes de usar Spotify.');
                }

                const resolved = await resolveSpotify(query, { member: interaction.member });
                const spotifySongs = createSpotifyQueueSongs(resolved, interaction.user);
                const queue = await ensureQueue(interaction.guild, voiceChannel, interaction.channel);
                queue.songs.push(...spotifySongs);

                if (queue.player.state.status === AudioPlayerStatus.Idle) {
                    await playNext(interaction.guild.id, interaction.channel);
                } else {
                    await updateMessage(interaction.guild.id);
                }
                await dismissReply(interaction);
                return;
            }

            if (isSoundCloud) {
                if (guildQueues.has(interaction.guild.id)) {
                    return interaction.editReply('❌ Finalize a fila atual antes de trocar para SoundCloud.');
                }
                const dt = getDistube(interaction.client);
                await dt.play(voiceChannel, query, { textChannel: interaction.channel, member: interaction.member });
                await updateMessage(interaction.guild.id);
                await dismissReply(interaction);
                return;
            }

            if (getDistubeQueue(interaction.guild.id)) {
                return interaction.editReply('❌ Finalize a fila atual antes de trocar para YouTube.');
            }

            // YouTube ou busca por nome
            const songInfo = await getSongInfo(query);
            songInfo.user = interaction.user;

            const queue = await ensureQueue(interaction.guild, voiceChannel, interaction.channel);
            queue.songs.push(songInfo);

            if (queue.player.state.status === AudioPlayerStatus.Idle) {
                await playNext(interaction.guild.id, interaction.channel);
            } else {
                await updateMessage(interaction.guild.id);
                await dismissReply(interaction);
                return;
            }

            await dismissReply(interaction);
        } catch (error) {
            console.error(error);
            const response = '❌ Não foi possível carregar essa música. Confira a busca ou o link.';
            if (interaction.deferred || interaction.replied) await interaction.editReply(response);
            else await interaction.reply({ content: response, flags: 64 });
        } finally {
            endPlayRequest(guildId);
        }
    },

    // Exporta para o interaction handler
    guildQueues,
    playerMessages,
    clearPlayerMessage,
    registerPlayerMessage,
    createEmbed,
    createRows,
    updateMessage,
    playNext,
    advanceCustomQueue,
    getDistubeQueue,
    isMusicActive,
    stopCustomQueue,
    formatDuration,
    validateQuery,
    getSelectedStreamData,
    buildFfmpegHeaders,
    handleAudioPlayerError,
    createSpotifyQueueSongs,
    resolveSpotify,
};
