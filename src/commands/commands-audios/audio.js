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
        .setName('audio')
        .setDescription('Toca um áudio do diretório de áudios no canal de voz.')
        .setDMPermission(false),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        if (isMusicActive(guildId)) {
            return interaction.reply({
                content: '⚠️ O player de música está ativo. Encerre-o antes de usar `/audio`.',
                flags: 64,
            });
        }

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

        const audioFolder = path.join(__dirname, 'audios');
        if (!fs.existsSync(audioFolder)) {
            return interaction.reply({ content: '⚠️ A pasta de áudios não foi encontrada!', flags: 64 });
        }

        const supportedExtensions = ['.mp3', '.ogg', '.wav'];
        const audioFiles = fs.readdirSync(audioFolder)
            .filter((file) => supportedExtensions.includes(path.extname(file).toLowerCase()));
        const audioNames = [...new Set(audioFiles.map((file) => path.basename(file, path.extname(file))))];

        if (audioNames.length === 0) {
            return interaction.reply({ content: '⚠️ Nenhum áudio encontrado na pasta!', flags: 64 });
        }

        let deleteListener;
        let playerManager;
        const cleanup = () => {
            if (activePlayers.get(guildId) === playerManager) activePlayers.delete(guildId);
            if (deleteListener) interaction.client.removeListener('messageDelete', deleteListener);
        };

        playerManager = new AudioPlayerManager(
            interaction.guild,
            voiceChannel,
            audioFolder,
            supportedExtensions,
            interaction.client,
            cleanup,
        );
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
                    .setCustomId('audio_category')
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
                    .setCustomId('audio_select')
                    .setPlaceholder(`Escolha um áudio • página ${playerManager.currentPage}/${totalPages}`)
                    .addOptions(slice.map((entry) => ({
                        label: entry.displayName.length > 100
                            ? `${entry.displayName.slice(0, 97)}...`
                            : entry.displayName,
                        value: entry.audioName,
                        emoji: '🎻',
                    })));
                rows.push(new ActionRowBuilder().addComponents(selectMenu));
            }

            rows.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page').setLabel('Página anterior').setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                        .setDisabled(playerManager.currentPage <= 1),
                    new ButtonBuilder()
                        .setCustomId('next_page').setLabel('Próxima página').setStyle(ButtonStyle.Secondary)
                        .setEmoji('▶️')
                        .setDisabled(playerManager.currentPage >= totalPages),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('resume_audio').setLabel('Play').setStyle(ButtonStyle.Success)
                        .setEmoji('▶️'),
                    new ButtonBuilder().setCustomId('pause_audio').setLabel('Pause').setStyle(ButtonStyle.Danger)
                        .setEmoji('⏸️'),
                    new ButtonBuilder().setCustomId('loop_toggle').setLabel(`Loop: ${playerManager.loopEnabled ? 'Ativado' : 'Desativado'}`).setStyle(playerManager.loopEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('reload').setLabel('Recarregar').setStyle(ButtonStyle.Success)
                        .setEmoji('⏳'),
                    new ButtonBuilder().setCustomId('stop_audio').setLabel('Parar').setStyle(ButtonStyle.Danger)
                        .setEmoji('⏹️'),
                    new ButtonBuilder().setCustomId('volume_up').setLabel('+').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔊'),
                    new ButtonBuilder().setCustomId('volume_down').setLabel('-').setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔉'),
                    new ButtonBuilder().setCustomId('close_audio').setLabel('Encerrar').setStyle(ButtonStyle.Danger)
                        .setEmoji('🛑'),
                ),
            );

            return rows;
        };

        await interaction.deferReply({ flags: 64 });

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
            try {
                await sentMessage.edit({ embeds: [createEmbed()], components: createRows() });
            } catch (error) {
                console.error('Erro ao atualizar mensagem:', error);
            }
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
            console.error('Não foi possível remover a confirmação do painel:', error);
        });
        return undefined;
    },
};
