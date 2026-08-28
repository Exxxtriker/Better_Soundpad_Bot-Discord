const activePlayers = require('./activePlayers');

const AUDIO_BUTTONS = new Set([
    'resume_audio',
    'pause_audio',
    'stop_audio',
    'loop_toggle',
    'volume_up',
    'volume_down',
    'next_page',
    'prev_page',
    'reload',
]);

module.exports = async (interaction) => {
    const isAudioMenu = interaction.isStringSelectMenu()
        && interaction.customId === 'audio_select';
    const isAudioButton = interaction.isButton() && AUDIO_BUTTONS.has(interaction.customId);
    if (!isAudioMenu && !isAudioButton) return;
    if (!interaction.inGuild()) return;

    const playerManager = activePlayers.get(interaction.guildId);
    if (!playerManager || playerManager.destroyed) {
        await interaction.reply({ content: '⚠️ Este player não está mais ativo.', flags: 64 });
        return;
    }

    if (interaction.member.voice.channelId !== playerManager.voiceChannel.id) {
        await interaction.reply({
            content: '⚠️ Entre no mesmo canal de voz do bot para usar estes controles.',
            flags: 64,
        });
        return;
    }

    await interaction.deferUpdate();

    if (isAudioMenu) {
        playerManager.playAudio(interaction.values[0]);
        await playerManager.updateMessage?.();
        return;
    }

    switch (interaction.customId) {
    case 'resume_audio':
        playerManager.unpause();
        break;
    case 'pause_audio':
        playerManager.pause();
        break;
    case 'stop_audio':
        playerManager.stop();
        break;
    case 'loop_toggle':
        playerManager.toggleLoop();
        break;
    case 'volume_up':
        playerManager.setVolume(playerManager.volume + 0.1);
        break;
    case 'volume_down':
        playerManager.setVolume(playerManager.volume - 0.1);
        break;
    case 'next_page':
        playerManager.currentPage = Math.min(
            playerManager.currentPage + 1,
            playerManager.getTotalPages(),
        );
        break;
    case 'prev_page':
        playerManager.currentPage = Math.max(playerManager.currentPage - 1, 1);
        break;
    case 'reload':
        playerManager.reloadAudioList();
        break;
    default:
        return;
    }

    await playerManager.updateMessage?.();
};
