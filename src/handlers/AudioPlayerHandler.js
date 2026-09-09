/* eslint-disable max-len */
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior,
} = require('@discordjs/voice');
const path = require('path');
const fs = require('fs');
const { safelyDestroyVoiceConnection } = require('../utils/voiceConnection');
const { createVoiceSessionGuard } = require('../utils/voiceSessionGuard');
const { buildAudioCatalog, parseAudioName } = require('../utils/audioCatalog');

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

        this.currentPage = 1; // paginação
        this.itemsPerPage = 25; // áudios por página

        // Lista de áudios
        this.reloadAudioList();

        // Listener do player
        this.player.on(AudioPlayerStatus.Idle, () => {
            if (this.destroyed) return;
            if (this.loopEnabled && this.currentResource) {
                this.playResource(this.currentResource.metadata.path);
            } else {
                this.currentResource = null;
                this.currentAudioName = null;
                if (this.updateMessage) this.updateMessage();
                this.startIdleTimeout();
            }
        });

        this.player.on('error', (error) => {
            console.error('Erro no player:', error);
            this.currentResource = null;
            this.currentAudioName = null;
            if (this.updateMessage) this.updateMessage();
            this.startIdleTimeout();
        });

        this.voiceGuard = createVoiceSessionGuard({
            client,
            voiceChannel,
            connection: this.connection,
            player: this.player,
            onLeave: () => this.destroy({ deleteMessage: true }),
        });
    }

    // ----------------- Paginação e Reload -----------------
    getTotalPages() {
        return Math.ceil(this.getSelectedEntries().length / this.itemsPerPage) || 1;
    }

    getAudioPage() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.getSelectedEntries().slice(start, end);
    }

    getCategories() {
        return [...this.audioCatalog.keys()];
    }

    getSelectedEntries() {
        return this.audioCatalog.get(this.selectedCategory) || [];
    }

    selectCategory(category) {
        if (!this.audioCatalog.has(category)) return false;
        this.selectedCategory = category;
        this.currentPage = 1;
        return true;
    }

    getDisplayName(audioName) {
        const entry = [...this.audioCatalog.values()]
            .flat()
            .find((audio) => audio.audioName === audioName);
        return entry?.displayName || parseAudioName(audioName).displayName;
    }

    reloadAudioList() {
        const previousCategory = this.selectedCategory;
        const files = fs.readdirSync(this.audioFolder)
            .filter((file) => this.supportedExtensions.includes(path.extname(file).toLowerCase()));
        this.audioNames = [...new Set(files.map((f) => path.basename(f, path.extname(f))))];
        this.audioCatalog = buildAudioCatalog(this.audioNames);
        this.selectedCategory = this.audioCatalog.has(previousCategory)
            ? previousCategory
            : this.getCategories()[0];
        this.currentPage = 1;
    }
    // -------------------------------------------------------

    setUpdateMessageFunction(fn) {
        this.updateMessage = fn;
    }

    setSentMessage(message) {
        if (this.destroyed) {
            message.delete().catch((error) => {
                if (error.code !== 10008) console.error('Erro ao remover o menu de áudio:', error);
            });
            return;
        }
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
        this.currentResource = null;
        this.currentAudioName = null;
        this.player.stop(true);
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
        this.voiceGuard?.dispose();
        this.player.stop(true);
        this.currentResource = null;
        this.currentAudioName = null;
        safelyDestroyVoiceConnection(this.connection);
        if (deleteMessage && this.sentMessage && !this.sentMessage.deleted) {
            this.sentMessage.delete().catch(() => {});
        }
        this.onDestroy?.();
        this.onDestroy = null;
    }

    startIdleTimeout() {
        this.voiceGuard?.syncState();
    }

    clearIdleTimeout() {
        this.voiceGuard?.clearIdleTimeout();
    }
}

module.exports = AudioPlayerManager;
