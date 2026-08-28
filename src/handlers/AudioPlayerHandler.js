/* eslint-disable max-len */
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior,
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');

class AudioPlayerManager {
    constructor(guild, voiceChannel, audioFolder, supportedExtensions, client, onDestroy) {
        this.guild = guild;
        this.voiceChannel = voiceChannel;
        this.audioFolder = audioFolder;
        this.supportedExtensions = supportedExtensions;
        this.client = client; // Discord client para ouvir voiceStateUpdate
        this.onDestroy = onDestroy;
        this.destroyed = false;

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

        this.currentPage = 1; // paginação
        this.itemsPerPage = 25; // áudios por página

        // Lista de áudios
        const files = fs.readdirSync(audioFolder)
            .filter((file) => supportedExtensions.includes(path.extname(file).toLowerCase()));
        this.audioNames = [...new Set(files.map((f) => path.basename(f, path.extname(f))))];

        // Listener do player
        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.loopEnabled && this.currentResource) {
                this.playResource(this.currentResource.metadata.path);
            } else {
                this.currentResource = null;
                this.currentAudioName = null;
                if (this.updateMessage) this.updateMessage();
                this.startIdleTimeout();
            }
        });

        this.player.on('playing', () => this.clearIdleTimeout());

        this.player.on('error', (error) => {
            console.error('Erro no player:', error);
            this.currentResource = null;
            this.currentAudioName = null;
            if (this.updateMessage) this.updateMessage();
            this.startIdleTimeout();
        });

        // 🔹 Monitora o canal automaticamente
        this.voiceStateListener = () => {
            const nonBotMembers = this.voiceChannel.members.filter((m) => !m.user.bot);
            if (nonBotMembers.size === 0) {
                // Ninguém humano no canal
                this.destroy({ deleteMessage: true });
            }
        };

        this.client.on('voiceStateUpdate', this.voiceStateListener);
    }

    // ----------------- Paginação e Reload -----------------
    getTotalPages() {
        return Math.ceil(this.audioNames.length / this.itemsPerPage) || 1;
    }

    getAudioPage() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.audioNames.slice(start, end);
    }

    reloadAudioList() {
        const files = fs.readdirSync(this.audioFolder)
            .filter((file) => this.supportedExtensions.includes(path.extname(file).toLowerCase()));
        this.audioNames = [...new Set(files.map((f) => path.basename(f, path.extname(f))))];
        this.currentPage = 1;
    }
    // -------------------------------------------------------

    setUpdateMessageFunction(fn) {
        this.updateMessage = fn;
    }

    setSentMessage(message) {
        this.sentMessage = message;
    }

    playAudio(audioName) {
        if (this.destroyed || !this.audioNames.includes(audioName)) return false;
        const audioPath = this.supportedExtensions
            .map((ext) => path.join(this.audioFolder, audioName + ext))
            .find((p) => fs.existsSync(p));
        if (!audioPath) return false;

        this.playResource(audioPath);
        this.currentAudioName = audioName;
        return true;
    }

    playResource(audioPath) {
        if (this.destroyed) return;
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
        this.player.stop(true);
        this.currentResource = null;
        this.currentAudioName = null;
        if (!this.destroyed) this.startIdleTimeout();
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

    destroy({ deleteMessage = false } = {}) {
        if (this.destroyed) return;
        this.destroyed = true;
        this.clearIdleTimeout();
        this.player.stop(true);
        this.currentResource = null;
        this.currentAudioName = null;
        if (this.connection && !this.connection.destroyed) {
            this.connection.destroy();
        }
        if (this.client && this.voiceStateListener) {
            this.client.removeListener('voiceStateUpdate', this.voiceStateListener);
            this.voiceStateListener = null;
        }
        if (deleteMessage && this.sentMessage && !this.sentMessage.deleted) {
            this.sentMessage.delete().catch(() => {});
        }
        this.onDestroy?.();
        this.onDestroy = null;
    }

    startIdleTimeout() {
        if (this.idleTimeout || this.destroyed) return;

        this.idleTimeout = setTimeout(() => {
            this.destroy({ deleteMessage: true });
        }, this.idleTime);
    }

    clearIdleTimeout() {
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }
    }
}

module.exports = AudioPlayerManager;
