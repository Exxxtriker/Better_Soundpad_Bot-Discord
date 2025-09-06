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

        this.idleTimeout = null; // Timeout para desconectar após ficar idle
        this.idleTime = 30 * 60 * 1000; // 30 minutos padrão

        this.player.on(AudioPlayerStatus.Idle, () => {
            // Se estiver em loop, toca de novo
            if (this.loopEnabled && this.currentResource) {
                this.playResource(this.currentResource.metadata.path);
            } else {
                this.currentResource = null;
                this.currentAudioName = null;

                // Atualiza a mensagem
                if (this.updateMessage) this.updateMessage();

                // Inicia o idleTimeout para desconectar após 30 minutos
                this.startIdleTimeout();
            }
        });

        this.player.on('playing', () => {
            // Se começar a tocar, cancela o idleTimeout
            this.clearIdleTimeout();
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

        // Inicia o idleTimeout quando parar manualmente
        this.startIdleTimeout();
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

    // Destrói a conexão com segurança
    destroy() {
        this.clearIdleTimeout(); // limpa timeout
        this.stop(); // para o player

        if (this.connection && !this.connection.destroyed) {
            this.connection.destroy();
        }
    }

    // Inicia o idleTimeout para desconectar
    startIdleTimeout() {
        if (this.idleTimeout) return; // já existe um timeout ativo

        this.idleTimeout = setTimeout(() => {
            this.destroy();

            // Deleta a mensagem caso exista
            if (this.sentMessage && !this.sentMessage.deleted) {
                this.sentMessage.delete().catch(() => {});
            }
        }, this.idleTime);
    }

    // Cancela o idleTimeout
    clearIdleTimeout() {
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }
    }
}

module.exports = AudioPlayerManager;
