const activePlayers = require('./activePlayers');

module.exports = async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const guildId = interaction.guild.id;
    const playerManager = activePlayers.get(guildId);
    if (!playerManager) return;

    // --- Select Menu ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('audio_select')) {
        const audioName = interaction.values[0];
        if (playerManager.playAudio(audioName)) {
            await interaction.deferUpdate();
            if (playerManager.updateMessage) playerManager.updateMessage();
        } else {
            await interaction.deferUpdate();
        }
    }

    // --- Botões ---
    if (interaction.isButton()) {
        // eslint-disable-next-line default-case
        switch (interaction.customId) {
        case 'resume_audio':
            playerManager.unpause();
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'pause_audio':
            playerManager.pause();
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'stop_audio':
            playerManager.stop();
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'loop_toggle': {
            playerManager.toggleLoop();
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;
        }

        case 'volume_up':
            playerManager.setVolume(playerManager.volume + 0.1);
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'volume_down':
            playerManager.setVolume(playerManager.volume - 0.1);
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'next_page':
            playerManager.currentPage = Math.min(playerManager.currentPage + 1, playerManager.getTotalPages());
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'prev_page':
            playerManager.currentPage = Math.max(playerManager.currentPage - 1, 1);
            if (playerManager.updateMessage) playerManager.updateMessage();
            await interaction.deferUpdate();
            break;

        case 'reload':
            playerManager.reloadAudioList();
            await interaction.deferUpdate();
            break;
        }
    }
};
