const { AudioPlayerStatus } = require('@discordjs/voice');
const { guildQueues, playerMessages, createEmbed, createRows, updateMessage, playNext } = require('../commands/music/play');

module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    const musicButtons = [
        'music_prev', 'music_pause', 'music_skip', 'music_stop',
        'music_loop', 'music_shuffle', 'music_queue',
    ];

    if (!musicButtons.includes(interaction.customId)) return;

    await interaction.deferUpdate();

    const guildId = interaction.guild.id;
    const queue = guildQueues.get(guildId);

    const noQueue = () => interaction.followUp({ content: '❌ Não há nenhuma música tocando no momento!', flags: 64 });

    switch (interaction.customId) {
        case 'music_pause':
            if (!queue) return noQueue();
            if (queue.paused) {
                queue.player.unpause();
                queue.paused = false;
            } else {
                queue.player.pause();
                queue.paused = true;
            }
            await updateMessage(guildId);
            break;

        case 'music_skip':
            if (!queue) return noQueue();
            queue.currentProcesses?.ytdlp?.kill();
            queue.currentProcesses?.ffmpeg?.kill();
            queue.songs.shift();
            await playNext(guildId, interaction.channel);
            break;

        case 'music_prev':
            if (!queue) return noQueue();
            if (queue.history.length === 0) {
                return interaction.followUp({ content: '⚠️ Não há música anterior!', flags: 64 });
            }
            queue.currentProcesses?.ytdlp?.kill();
            queue.currentProcesses?.ffmpeg?.kill();
            queue.songs.unshift(queue.history.pop());
            await playNext(guildId, interaction.channel);
            break;

        case 'music_stop':
            if (!queue) return noQueue();
            queue.songs = [];
            queue.currentProcesses?.ytdlp?.kill();
            queue.currentProcesses?.ffmpeg?.kill();
            queue.player.stop();
            queue.connection.destroy();
            guildQueues.delete(guildId);
            playerMessages.delete(guildId);
            await interaction.message.delete().catch(() => {});
            break;

        case 'music_loop': {
            if (!queue) return noQueue();
            const modes = ['off', 'song', 'queue'];
            const next = modes[(modes.indexOf(queue.loop) + 1) % modes.length];
            queue.loop = next;
            await updateMessage(guildId);
            break;
        }

        case 'music_shuffle': {
            if (!queue) return noQueue();
            const current = queue.songs.shift();
            queue.songs.sort(() => Math.random() - 0.5);
            queue.songs.unshift(current);
            await updateMessage(guildId);
            await interaction.followUp({ content: '🔀 Fila embaralhada!', flags: 64 });
            break;
        }

        case 'music_queue': {
            if (!queue || queue.songs.length === 0) return noQueue();
            const list = queue.songs
                .slice(0, 10)
                .map((s, i) => `${i === 0 ? '▶️' : `\`${i}.\``} **${s.title}** \`${s.formattedDuration}\``)
                .join('\n');
            const extra = queue.songs.length > 10 ? `\n...e mais **${queue.songs.length - 10}** músicas.` : '';
            await interaction.followUp({ content: `🎶 **Fila atual:**\n${list}${extra}`, flags: 64 });
            break;
        }
    }
};