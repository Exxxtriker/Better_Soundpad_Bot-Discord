/* eslint-disable max-len */
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
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

const YT_DLP_PATH = path.join(__dirname, '../commands-audios/yt-dlp.exe');
const COOKIES_PATH = path.join(__dirname, '../commands-audios/cookies.txt');

// ─── Fila por guild ───────────────────────────────────────────────
const guildQueues = new Map(); // guildId -> { songs[], player, connection, playing }
const playerMessages = new Map(); // guildId -> Message

// ─── Pega info da música via yt-dlp ──────────────────────────────
function getSongInfo(query) {
    return new Promise((resolve, reject) => {
        const input = query.startsWith('http') ? query : `ytsearch1:${query}`;
        execFile(YT_DLP_PATH, [
            '--cookies', COOKIES_PATH,
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'Mozilla/5.0',
            '--dump-json',
            '--no-warnings',
            '--quiet',
            '--no-playlist',
            input,
        ], (error, stdout) => {
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

    const ffmpeg = spawn('ffmpeg', [
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
    ytdlp.stderr.on('data', d => console.error('[yt-dlp]', d.toString()));
    ffmpeg.stderr.on('data', d => console.error('[ffmpeg]', d.toString()));

    ytdlp.on('close', () => {
        try { ffmpeg.stdin.end(); } catch {}
    });

    return { stream: ffmpeg.stdout, ytdlp, ffmpeg };
}

// ─── Helpers ─────────────────────────────────────────────────────
function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function createEmbed(guildId) {
    const queue = guildQueues.get(guildId);
    const song = queue?.songs[0] ?? null;
    const loopLabel = queue?.loop === 'song' ? '🔂 Música' : queue?.loop === 'queue' ? '🔁 Fila' : '🚫 Off';
    const queueSize = queue?.songs.length ?? 0;

    const embed = new EmbedBuilder().setColor(song ? 0x8A2BE2 : 0x2B2D31).setAuthor({ name: '🎵 Player de Música' });

    if (song) {
        embed
            .setTitle(song.title)
            .setURL(song.url)
            .setThumbnail(song.thumbnail ?? 'https://cdn.discordapp.com/embed/avatars/0.png')
            .addFields(
                { name: '⏱️ Duração', value: `\`${song.formattedDuration}\``, inline: true },
                { name: '🔁 Loop', value: loopLabel, inline: true },
                { name: '📋 Na fila', value: `\`${queueSize}\` música(s)`, inline: true },
                { name: '👤 Pedido por', value: song.user ? `<@${song.user.id}>` : 'Desconhecido', inline: true },
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
    const isPaused = queue?.paused ?? false;
    const loopMode = queue?.loop ?? 'off';
    const loopLabel = loopMode === 'off' ? '🚫 Loop' : loopMode === 'song' ? '🔂 Música' : '🔁 Fila';
    const loopStyle = loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success;

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setLabel('Anterior').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_pause').setEmoji(isPaused ? '▶️' : '⏸️').setLabel(isPaused ? 'Continuar' : 'Pausar').setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Pular').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Parar').setStyle(ButtonStyle.Danger),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel(loopLabel).setStyle(loopStyle),
            new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('Aleatório').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_queue').setEmoji('📋').setLabel('Ver Fila').setStyle(ButtonStyle.Secondary),
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
    }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));
}

// ─── DisTube para Spotify/SoundCloud ─────────────────────────────
let distube = null;
function getDistube(client) {
    if (!distube) {
        distube = new DisTube(client, {
            plugins: [new SpotifyPlugin(), new SoundCloudPlugin()],
        });
        distube.on('error', (channel, err) => {
            console.error('DisTube error:', err);
            channel?.send({ content: `❌ Erro: ${err.message}` });
        });
    }
    return distube;
}

// ─── Conecta ao canal de voz e monta o player ────────────────────
async function ensureQueue(guild, voiceChannel, textChannel, client) {
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
    };

    guildQueues.set(guild.id, queue);

    player.on(AudioPlayerStatus.Idle, async () => {
        const q = guildQueues.get(guild.id);
        if (!q) return;

        if (q.loop === 'song') {
            // Repete a música atual
            await playNext(guild.id, textChannel);
        } else {
            if (q.loop === 'queue' && q.songs.length > 0) {
                q.songs.push(q.songs.shift()); // move atual pro fim
            } else {
                q.history.push(q.songs.shift()); // remove da fila
            }
            await playNext(guild.id, textChannel);
        }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
        } catch {
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
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Nome da música, link do YouTube, Spotify, SoundCloud...')
                .setRequired(true)
        )
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.editReply('❌ Você precisa estar em um canal de voz!');

        const query = interaction.options.getString('query');

        // Cria painel do player se não existir
        if (!playerMessages.has(interaction.guild.id)) {
            const sentMessage = await interaction.channel.send({
                embeds: [createEmbed(interaction.guild.id)],
                components: createRows(interaction.guild.id),
            });
            playerMessages.set(interaction.guild.id, sentMessage);
            interaction.client.on('messageDelete', (message) => {
                if (message.id === sentMessage.id) playerMessages.delete(interaction.guild.id);
            });
        }

        const isSpotify = query.includes('spotify.com');
        const isSoundCloud = query.includes('soundcloud.com');

        try {
            if (isSpotify || isSoundCloud) {
                const dt = getDistube(interaction.client);
                await dt.play(voiceChannel, query, { textChannel: interaction.channel, member: interaction.member });
                return interaction.editReply(`✅ Adicionado: **${query}**`);
            }

            // YouTube ou busca por nome
            await interaction.editReply('🔍 Buscando...');
            const songInfo = await getSongInfo(query);
            songInfo.user = interaction.user;

            const queue = await ensureQueue(interaction.guild, voiceChannel, interaction.channel, interaction.client);
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
            await interaction.editReply(`❌ Erro: ${error.message}`);
        }
    },

    // Exporta para o interaction handler
    guildQueues,
    playerMessages,
    createEmbed,
    createRows,
    updateMessage,
    playNext,
    formatDuration,
};