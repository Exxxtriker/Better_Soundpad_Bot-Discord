/* eslint-disable max-len */
const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const AudioPlayerManager = require('../../handlers/AudioPlayerHandler');
const activePlayers = require('../../handlers/activePlayers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audio')
        .setDescription('Toca um áudio do diretório de áudios no canal de voz.')
        .setDMPermission(false),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        if (activePlayers.has(guildId)) {
            return interaction.reply({ content: '⚠️ Já existe um menu de áudio ativo neste servidor!', flags: 64 });
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '⚠️ Você precisa estar em um canal de voz para usar este comando!', flags: 64 });
        }

        const audioFolder = path.join(__dirname, 'audios');
        if (!fs.existsSync(audioFolder)) {
            return interaction.reply({ content: '⚠️ A pasta de áudios não foi encontrada!', flags: 64 });
        }

        const supportedExtensions = ['.mp3', '.ogg', '.wav'];
        const audioFiles = fs.readdirSync(audioFolder).filter((file) => supportedExtensions.includes(path.extname(file)));
        const audioNames = [...new Set(audioFiles.map((file) => path.basename(file, path.extname(file))))];

        if (audioNames.length === 0) {
            return interaction.reply({ content: '⚠️ Nenhum áudio encontrado na pasta!', flags: 64 });
        }

        const playerManager = new AudioPlayerManager(interaction.guild, voiceChannel, audioFolder, supportedExtensions);
        activePlayers.set(guildId, playerManager);

        // --- Função para criar embed atualizado ---
        const createEmbed = () => {
            const fields = [
                { name: '💡 Dica', value: 'Use os botões abaixo para escolher o áudio que fará todos dançarem!' },
                { name: '📝 Dica do Bardo', value: 'Deixe a canção guiar sua aventura, e quem sabe, até inspirar uma nova lenda!' },
                { name: '🔊 Volume', value: `${Math.round(playerManager.volume * 100)}%`, inline: true },
                { name: '🔁 Loop', value: playerManager.loopEnabled ? 'Ativado' : 'Desativado', inline: true },
            ];
            if (playerManager.currentAudioName) {
                fields.push({ name: '🎶 Tocando agora', value: `**${playerManager.currentAudioName}**` });
            }
            return new EmbedBuilder()
                .setTitle('🎶 Um Bardo na Casa! Escolha sua melodia!')
                .setDescription('Saudações, viajante! 🎩✨\nEscolha uma das canções abaixo para embalar nossa aventura. Que a música comece e o espírito se eleve! 🎻🪕')
                .setColor(0x8A2BE2)
                .setThumbnail('https://img1.picmix.com/output/stamp/normal/2/1/0/5/2725012_1e75a.gif')
                .addFields(fields)
                .setImage('https://media.discordapp.net/attachments/1402058526788161696/1408461378418901023/LwVJ.gif')
                .setFooter({ text: 'O bardo espera ansioso por sua escolha... 🎤' });
        };

        // --- Função para criar componentes (menus e botões) ---
        const createRows = () => {
            const rows = [];
            const totalPages = Math.ceil(audioNames.length / 25);
            const slice = audioNames.slice(0, 25);

            if (slice.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('audio_select')
                    .setPlaceholder(`Selecione um áudio (página 1/${totalPages})`)
                    .addOptions(slice.map((name) => ({
                        label: name.length > 100 ? `${name.slice(0, 97)}...` : name,
                        value: name,
                        emoji: '🎻',
                    })));
                rows.push(new ActionRowBuilder().addComponents(selectMenu));
            }

            rows.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('resume_audio').setLabel('Play').setStyle(ButtonStyle.Success)
                        .setEmoji('▶️'),
                    new ButtonBuilder().setCustomId('pause_audio').setLabel('Pause').setStyle(ButtonStyle.Danger)
                        .setEmoji('⏸️'),
                    new ButtonBuilder().setCustomId('loop_toggle').setLabel(`Loop: ${playerManager.loopEnabled ? 'Ativado' : 'Desativado'}`).setStyle(playerManager.loopEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder().setCustomId('volume_up').setLabel('+').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔊'),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('reload').setLabel('Recarregar').setStyle(ButtonStyle.Success)
                        .setEmoji('⏳'),
                    new ButtonBuilder().setCustomId('stop_audio').setLabel('Parar').setStyle(ButtonStyle.Danger)
                        .setEmoji('⏹️'),
                    new ButtonBuilder().setCustomId('clear_selection').setLabel('Limpar escolha').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🗑️'),
                    new ButtonBuilder().setCustomId('volume_down').setLabel('-').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔉'),
                ),
            );

            return rows;
        };

        await interaction.deferReply();
        await interaction.deleteReply();

        const sentMessage = await interaction.channel.send({
            embeds: [createEmbed()],
            components: createRows(),
        });

        playerManager.setSentMessage(sentMessage);
        playerManager.setUpdateMessageFunction(async () => {
            try {
                await sentMessage.edit({ embeds: [createEmbed()], components: createRows() });
            } catch (error) {
                console.error('Erro ao atualizar mensagem:', error);
            }
        });

        const { client } = interaction;

        // --- Idle timeout logic ---
        let idleTimeout;

        const startIdleTimeout = () => {
            if (idleTimeout) clearTimeout(idleTimeout);
            idleTimeout = setTimeout(async () => {
                if (playerManager.player.state.status === 'idle') {
                    try {
                        if (playerManager.connection && !playerManager.connection.destroyed) {
                            playerManager.destroy();
                        }
                        activePlayers.delete(guildId);
                        await sentMessage.delete().catch(() => {});
                    } catch (err) {
                        console.error('Erro ao destruir player após idle timeout:', err);
                    }
                }
            }, 30 * 60 * 1000); // 30 minutos
        };

        // Observa mudanças no estado do player
        playerManager.player.on('stateChange', (oldState, newState) => {
            if (newState.status === 'idle') {
                startIdleTimeout();
            } else if (newState.status === 'playing') {
                if (idleTimeout) clearTimeout(idleTimeout);
            }
        });

        // --- Detecta se a mensagem foi deletada manualmente ---
        client.on('messageDelete', (message) => {
            if (message.id === sentMessage.id) {
                if (playerManager.player.state.status === 'idle') {
                    if (idleTimeout) clearTimeout(idleTimeout);
                    try {
                        if (playerManager.connection && !playerManager.connection.destroyed) {
                            playerManager.destroy();
                        }
                        activePlayers.delete(guildId);
                        sentMessage.delete().catch(() => {});
                    } catch (err) {
                        console.error('Erro ao destruir player após delete:', err);
                    }
                }
            }
        });
    },
};
