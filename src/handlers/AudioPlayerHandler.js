const {
    joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior,
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

class AudioPlayerManager {
    constructor(guild, voiceChannel, audioFolder, supportedExtensions) {
        this.guild = guild;
        this.voiceChannel = voiceChannel;
        this.audioFolder = audioFolder;
        this.supportedExtensions = supportedExtensions;

        this.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        this.player = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
        });

        this.connection.subscribe(this.player);

        this.currentResource = null;
        this.currentAudioName = null;
        this.volume = 1.0;
        this.loopEnabled = false;

        this.updateMessage = null; // função para atualizar embed e componentes
        this.sentMessage = null; // mensagem enviada para editar

        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.loopEnabled && this.currentResource) {
                this.playResource(this.currentResource.metadata.path);
            } else {
                this.currentResource = null;
                this.currentAudioName = null;
                if (this.updateMessage) this.updateMessage();
            }
        });

        this.player.on('error', (error) => {
            console.error('Erro no player:', error);
            if (this.updateMessage) this.updateMessage();
        });
    }

    setUpdateMessageFunction(fn) {
        this.updateMessage = fn;
    }

    setSentMessage(message) {
        this.sentMessage = message;
    }

    playAudio(audioName) {
        const audioPath = this.supportedExtensions
            .map((ext) => path.join(this.audioFolder, audioName + ext))
            .find((p) => fs.existsSync(p));
        if (!audioPath) return false;

        this.playResource(audioPath);
        this.currentAudioName = audioName;
        return true;
    }

    playResource(audioPath) {
        const resource = createAudioResource(audioPath, { metadata: { path: audioPath }, inlineVolume: true });
        resource.volume.setVolume(this.volume);
        this.currentResource = resource;
        this.player.play(resource);
    }

    pause() {
        this.player.pause();
    }

    unpause() {
        this.player.unpause();
    }

    stop() {
        this.player.stop();
        this.currentResource = null;
        this.currentAudioName = null;
    }

    setVolume(volume) {
        this.volume = Math.min(2, Math.max(0, volume));
        if (this.currentResource) {
            this.currentResource.volume.setVolume(this.volume);
        }
    }

    toggleLoop() {
        this.loopEnabled = !this.loopEnabled;
        return this.loopEnabled;
    }

    destroy() {
        this.stop();
        this.connection.destroy();
    }
}

module.exports = AudioPlayerManager;
