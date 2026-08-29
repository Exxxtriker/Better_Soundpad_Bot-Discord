const {
    advanceCustomQueue,
    clearPlayerMessage,
    getDistubeQueue,
    guildQueues,
    stopCustomQueue,
    updateMessage,
} = require('../commands/music/play');

const MUSIC_BUTTONS = new Set([
    'music_prev',
    'music_pause',
    'music_skip',
    'music_stop',
    'music_loop',
    'music_shuffle',
    'music_queue',
]);

module.exports = async (interaction) => {
    if (!interaction.isButton() || !MUSIC_BUTTONS.has(interaction.customId)) return;
    if (!interaction.inGuild()) return;

    const { guildId } = interaction;
    const customQueue = guildQueues.get(guildId);
    const distubeQueue = getDistubeQueue(guildId);
    const queue = customQueue ?? distubeQueue;

    if (!queue) {
        await interaction.reply({ content: '❌ Não há nenhuma música tocando no momento!', flags: 64 });
        return;
    }

    const voiceChannelId = customQueue?.connection?.joinConfig?.channelId
        ?? distubeQueue?.voiceChannel?.id;
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== voiceChannelId) {
        await interaction.reply({
            content: '⚠️ Entre no mesmo canal de voz do bot para usar estes controles.',
            flags: 64,
        });
        return;
    }

    await interaction.deferUpdate();

    try {
        switch (interaction.customId) {
        case 'music_pause':
            if (customQueue) {
                if (customQueue.paused) customQueue.player.unpause();
                else customQueue.player.pause();
                customQueue.paused = !customQueue.paused;
            } else if (distubeQueue.paused) await distubeQueue.resume();
            else await distubeQueue.pause();
            await updateMessage(guildId);
            break;

        case 'music_skip':
            if (customQueue) await advanceCustomQueue(guildId, interaction.channel);
            else await distubeQueue.skip();
            await updateMessage(guildId);
            break;

        case 'music_prev':
            if (customQueue) {
                const changed = await advanceCustomQueue(guildId, interaction.channel, 'previous');
                if (!changed) throw new Error('Não há música anterior.');
            } else {
                await distubeQueue.previous();
            }
            await updateMessage(guildId);
            break;

        case 'music_stop':
            if (customQueue) await stopCustomQueue(guildId);
            else await distubeQueue.stop();
            clearPlayerMessage(guildId, interaction.message.id);
            await interaction.message.delete().catch(() => {});
            break;

        case 'music_loop':
            if (customQueue) {
                const modes = ['off', 'song', 'queue'];
                customQueue.loop = modes[(modes.indexOf(customQueue.loop) + 1) % modes.length];
            } else {
                distubeQueue.setRepeatMode();
            }
            await updateMessage(guildId);
            break;

        case 'music_shuffle':
            if (customQueue) {
                const current = customQueue.songs.shift();
                customQueue.songs.sort(() => Math.random() - 0.5);
                if (current) customQueue.songs.unshift(current);
            } else {
                await distubeQueue.shuffle();
            }
            await updateMessage(guildId);
            break;

        case 'music_queue': {
            const songs = queue.songs ?? [];
            if (songs.length === 0) throw new Error('A fila está vazia.');
            const list = songs.slice(0, 10).map((song, index) => {
                const position = index === 0 ? '▶️' : `\`${index}.\``;
                return `${position} **${song.title ?? song.name}** \`${song.formattedDuration ?? '?:??'}\``;
            }).join('\n');
            const extra = songs.length > 10 ? `\n...e mais **${songs.length - 10}** músicas.` : '';
            await interaction.followUp({ content: `🎶 **Fila atual:**\n${list}${extra}`, flags: 64 });
            break;
        }

        default:
            break;
        }
    } catch (error) {
        console.error('Erro ao controlar player de música:', error);
        await interaction.followUp({ content: `❌ ${error.message || 'Não foi possível executar o controle.'}`, flags: 64 });
    }
};
