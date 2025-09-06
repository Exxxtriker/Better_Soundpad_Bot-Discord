const activePlayers = require('./activePlayers');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const { guildId } = interaction;
        if (!guildId) return;

        const playerManager = activePlayers.get(guildId);
        if (!playerManager) {
            return interaction.reply({ content: 'Nenhum player ativo neste servidor.', flags: 64 });
        }

        const memberVoiceChannel = interaction.member.voice.channel;
        if (!memberVoiceChannel || memberVoiceChannel.id !== playerManager.voiceChannel.id) {
            return interaction.reply({ content: 'Você precisa estar no mesmo canal de voz para usar os controles.', flags: 64 });
        }

        try {
            if (interaction.isStringSelectMenu()) {
                const audioName = interaction.values[0];
                playerManager.playAudio(audioName);
                if (playerManager.updateMessage) await playerManager.updateMessage();
                await interaction.deferUpdate();
            } else if (interaction.isButton()) {
                switch (interaction.customId) {
                case 'resume_audio':
                    playerManager.unpause();
                    await interaction.deferUpdate();
                    break;
                case 'pause_audio':
                    playerManager.pause();
                    await interaction.deferUpdate();
                    break;
                case 'loop_toggle':
                    playerManager.toggleLoop();
                    if (playerManager.updateMessage) await playerManager.updateMessage();
                    await interaction.deferUpdate();
                    break;
                case 'volume_up':
                    playerManager.setVolume(playerManager.volume + 0.1);
                    if (playerManager.updateMessage) await playerManager.updateMessage();
                    await interaction.deferUpdate();
                    break;
                case 'volume_down':
                    playerManager.setVolume(playerManager.volume - 0.1);
                    if (playerManager.updateMessage) await playerManager.updateMessage();
                    await interaction.deferUpdate();
                    break;
                case 'stop_audio':
                    playerManager.stop();
                    if (playerManager.updateMessage) await playerManager.updateMessage();
                    await interaction.deferUpdate();
                    break;
                case 'clear_selection':
                    playerManager.stop();
                    if (playerManager.updateMessage) await playerManager.updateMessage();
                    await interaction.deferUpdate();
                    break;
                case 'reload':
                    // Se quiser, atualize a lista de áudios aqui
                    await interaction.deferUpdate();
                    break;
                default:
                    await interaction.deferUpdate();
                    break;
                }
            }
        } catch (error) {
            console.error('Erro ao processar interação:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'Erro ao processar a interação.', flags: 64 });
            }
        }
    },
};
