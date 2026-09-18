/* eslint-disable max-len */
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const AudioPlayerManager = require('../../handlers/AudioPlayerHandler');
const activePlayers = require('../../handlers/activePlayers');
const { getCategoryEmoji } = require('../../utils/audioCatalog');
const { isMusicActive } = require('../music/play');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soundpad')
        .setDescription('Abre o painel de áudios do bardo para tocar efeitos sonoros e músicas de fundo.')
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
            return interaction.reply({
                content: '⚠️ O soundpad só pode ser usado dentro de um servidor.',
                flags: 64,
            });
        }

        const guildId = interaction.guild.id;

        if (isMusicActive(guildId)) {
            return interaction.reply({
                content: '⚠️ O player de música está ativo. Encerre-o antes de usar `/soundpad`.',
                flags: 64,
            });
        }

        const existingPlayer = activePlayers.get(guildId);
        if (existingPlayer?.destroyed) activePlayers.delete(guildId);
        if (activePlayers.has(guildId)) {
            return interaction.reply({ content: '⚠️ Já existe um menu de áudio ativo neste servidor!', flags: 64 });
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '⚠️ Você precisa estar em um canal de voz para usar este comando!', flags: 64 });
        }

        const botPermissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.reply({
                content: '⚠️ Preciso das permissões Conectar e Falar nesse canal.',
                flags: 64,
            });
        }

        const textPermissions = interaction.channel.permissionsFor?.(interaction.guild.members.me);
        if (!textPermissions?.has([
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.EmbedLinks,
        ])) {
            return interaction.reply({
                content: '⚠️ Preciso das permissões Ver Canal, Enviar Mensagens e Inserir Links neste canal.',
                flags: 64,
            });
        }

        const audioFolder = path.join(__dirname, 'audios');
        if (!fs.existsSync(audioFolder)) {
            return interaction.reply({ content: '⚠️ A pasta de áudios não foi encontrada!', flags: 64 });
        }

        // Reserva o servidor antes do primeiro await e impede duas inicializações simultâneas.
        const reservation = { initializing: true, destroyed: false };
        activePlayers.set(guildId, reservation);
        try {
            await interaction.deferReply({ flags: 64 });
        } catch (error) {
            if (activePlayers.get(guildId) === reservation) activePlayers.delete(guildId);
            if ([10062, 40060].includes(Number(error.code))) return undefined;
            throw error;
        }

        const supportedExtensions = ['.mp3', '.ogg', '.wav'];
        let audioFiles;
        try {
            audioFiles = fs.readdirSync(audioFolder)
                .filter((file) => supportedExtensions.includes(path.extname(file).toLowerCase()));
        } catch (error) {
            if (activePlayers.get(guildId) === reservation) activePlayers.delete(guildId);
            console.error('Erro ao ler a pasta do soundpad:', error);
            return interaction.editReply({
                content: '❌ Não foi possível ler a pasta de áudios.',
            });
        }
        const audioNames = [...new Set(audioFiles.map((file) => path.basename(file, path.extname(file))))];

        if (audioNames.length === 0) {
            if (activePlayers.get(guildId) === reservation) activePlayers.delete(guildId);
            return interaction.editReply({ content: '⚠️ Nenhum áudio encontrado na pasta!' });
        }

        let deleteListener;
        let playerManager;
        const cleanup = () => {
            if (activePlayers.get(guildId) === playerManager) activePlayers.delete(guildId);
            if (deleteListener) interaction.client.removeListener('messageDelete', deleteListener);
        };

        try {
            playerManager = new AudioPlayerManager(
                interaction.guild,
                voiceChannel,
                audioFolder,
                supportedExtensions,
                interaction.client,
                cleanup,
            );
        } catch (error) {
            if (activePlayers.get(guildId) === reservation) activePlayers.delete(guildId);
            console.error('Erro ao preparar player de áudio:', error);
            return interaction.editReply('❌ Não foi possível preparar o soundpad neste servidor.');
        }
        activePlayers.set(guildId, playerManager);

        // Função para criar embed atualizado
        const createEmbed = () => {
            const currentCategory = playerManager.selectedCategory || 'Sem áudios';
            const fields = [
                {
                    name: '📚 Categoria',
                    value: `${getCategoryEmoji(currentCategory)} **${currentCategory}**\n${playerManager.getSelectedEntries().length} áudio(s)`,
                    inline: true,
                },
                { name: '🔊 Volume', value: `${Math.round(playerManager.volume * 100)}%`, inline: true },
                { name: '🔁 Loop', value: playerManager.loopEnabled ? 'Ativado' : 'Desativado', inline: true },
            ];
            if (playerManager.currentAudioName) {
                const metadata = playerManager.getAudioMetadata();
                const sourceLabel = metadata?.source === 'youtube' ? 'YouTube' : 'Discord';
                fields.push({
                    name: '🎶 Tocando agora',
                    value: [
                        `**${playerManager.getDisplayName(playerManager.currentAudioName)}**`,
                        metadata?.sourceChannel
                            ? `📡 ${sourceLabel}: **${metadata.sourceChannel}**`
                            : '📡 Origem não registrada',
                    ].join('\n'),
                });
            }
            return new EmbedBuilder()
                .setTitle('🎶 Repertório do Bardo')
                .setDescription('Escolha primeiro uma **categoria** e depois o **áudio** que acompanhará a aventura.')
                .setColor(0x8A2BE2)
                .setThumbnail('https://img1.picmix.com/output/stamp/normal/2/1/0/5/2725012_1e75a.gif')
                .addFields(fields)
                .setImage('https://media.discordapp.net/attachments/1402058526788161696/1408461378418901023/LwVJ.gif')
                .setFooter({ text: 'O bardo espera ansioso por sua escolha... 🎤' });
        };

        // Função para criar componentes (menus e botões) com paginação dinâmica
        const createRows = () => {
            const rows = [];
            const totalPages = playerManager.getTotalPages();
            const categories = playerManager.getCategories().slice(0, 25);
            const slice = playerManager.getAudioPage();

            if (categories.length > 0) {
                const categoryMenu = new StringSelectMenuBuilder()
                    .setCustomId('soundpad_category')
                    .setPlaceholder('Escolha uma categoria')
                    .addOptions(categories.map((category) => ({
                        label: category,
                        value: category,
                        description: `${playerManager.audioCatalog.get(category).length} áudio(s) disponíveis`,
                        emoji: getCategoryEmoji(category),
                        default: category === playerManager.selectedCategory,
                    })));
                rows.push(new ActionRowBuilder().addComponents(categoryMenu));
            }

            if (slice.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('soundpad_select')
                    .setPlaceholder(`Escolha um áudio • página ${playerManager.currentPage}/${totalPages}`)
                    .addOptions(slice.map((entry, index) => ({
                        label: entry.displayName.length > 100
                            ? `${entry.displayName.slice(0, 97)}...`
                            : entry.displayName,
                        value: String(index),
                        emoji: '🎻',
                    })));
                rows.push(new ActionRowBuilder().addComponents(selectMenu));
            }

            rows.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('soundpad_previous').setLabel('Página anterior').setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                        .setDisabled(playerManager.currentPage <= 1),
                    new ButtonBuilder()
                        .setCustomId('soundpad_next').setLabel('Próxima página').setStyle(ButtonStyle.Secondary)
                        .setEmoji('▶️')
                        .setDisabled(playerManager.currentPage >= totalPages),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('soundpad_resume').setLabel('Play').setStyle(ButtonStyle.Success)
                        .setEmoji('▶️'),
                    new ButtonBuilder().setCustomId('soundpad_pause').setLabel('Pause').setStyle(ButtonStyle.Danger)
                        .setEmoji('⏸️'),
                    new ButtonBuilder().setCustomId('soundpad_loop').setLabel(`Loop: ${playerManager.loopEnabled ? 'Ativado' : 'Desativado'}`).setStyle(playerManager.loopEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('soundpad_reload').setLabel('Recarregar').setStyle(ButtonStyle.Success)
                        .setEmoji('⏳'),
                    new ButtonBuilder().setCustomId('soundpad_stop').setLabel('Parar').setStyle(ButtonStyle.Danger)
                        .setEmoji('⏹️'),
                    new ButtonBuilder().setCustomId('soundpad_volume_up').setLabel('+').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔊'),
                    new ButtonBuilder().setCustomId('soundpad_volume_down').setLabel('-').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔉'),
                    new ButtonBuilder().setCustomId('soundpad_close').setLabel('Encerrar').setStyle(ButtonStyle.Danger)
                        .setEmoji('🛑'),
                ),
            );

            return rows;
        };

        let sentMessage;
        try {
            sentMessage = await interaction.channel.send({
                embeds: [createEmbed()],
                components: createRows(),
            });
        } catch (error) {
            playerManager.destroy();
            console.error('Erro ao criar painel de áudio:', error);
            return interaction.editReply('❌ Não foi possível criar o painel de áudio neste canal.');
        }

        playerManager.setSentMessage(sentMessage);
        playerManager.setUpdateMessageFunction(async () => {
            if (playerManager.destroyed) return;
            await sentMessage.edit({ embeds: [createEmbed()], components: createRows() })
                .catch((error) => {
                    if (error.code === 10008) {
                        playerManager.destroy();
                        return;
                    }
                    throw error;
                });
        });

        // Listener para deletar o menu manualmente
        deleteListener = async (message) => {
            if (message.id === sentMessage.id) {
                playerManager.destroy();
            }
        };
        interaction.client.on('messageDelete', deleteListener);

        // Inicia idleTimeout automaticamente
        playerManager.startIdleTimeout();
        await interaction.deleteReply().catch((error) => {
            if (![10008, 10062].includes(Number(error.code))) {
                console.error('Não foi possível remover a confirmação do painel:', error);
            }
        });
        return undefined;
    },
};
