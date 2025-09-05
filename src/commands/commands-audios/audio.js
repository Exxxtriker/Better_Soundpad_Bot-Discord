const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} = require('@discordjs/voice');

const fs = require('fs');
const path = require('path');

const activeMenus = new Map(); // agora uma entrada por servidor

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audio')
        .setDescription('Toca um áudio do diretório de áudios no canal de voz.')
        .setDMPermission(false),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            if (activeMenus.has(guildId)) {
                return interaction.reply({
                    content: '⚠️ Já existe um menu de áudio ativo neste servidor!',
                    flags: 64,
                });
            }

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({
                    content: '⚠️ Você precisa estar em um canal de voz para usar este comando!',
                    flags: 64,
                });
            }

            const audioFolder = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolder)) {
                return interaction.reply({
                    content: '⚠️ A pasta de áudios não foi encontrada!',
                    flags: 64,
                });
            }

            const supportedExtensions = ['.mp3', '.ogg', '.wav'];
            const audioFiles = fs.readdirSync(audioFolder)
                .filter((file) => supportedExtensions.includes(path.extname(file)));
            const audioNames = [...new Set(audioFiles.map((file) => path.basename(file, path.extname(file))))];

            if (audioNames.length === 0) {
                return interaction.reply({
                    content: '⚠️ Nenhum áudio encontrado na pasta!',
                    flags: 64,
                });
            }

            activeMenus.set(guildId, true);

            let page = 0;
            let loopEnabled = false;
            let currentResource = null;

            const player = createAudioPlayer();
            player.setMaxListeners(0);

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                if (loopEnabled && currentResource?.metadata?.path) {
                    const resource = createAudioResource(currentResource.metadata.path, {
                        metadata: { path: currentResource.metadata.path },
                    });
                    currentResource = resource;
                    player.play(resource);
                } else {
                    currentResource = null;
                }
            });

            player.on('error', (error) => {
                console.error('Erro ao reproduzir o áudio:', error);
                interaction.channel.send('Erro ao tentar reproduzir o áudio.');
                currentResource = null;
            });

            const createRows = () => {
                const rows = [];
                const totalPages = Math.ceil(audioNames.length / 25);
                const slice = audioNames.slice(page * 25, (page + 1) * 25);

                if (slice.length > 0) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`audio_select_${page}`)
                        .setPlaceholder(`Selecione um áudio (página ${page + 1}/${totalPages})`)
                        .addOptions(slice.map((name) => ({
                            label: name.length > 100 ? `${name.slice(0, 97)}...` : name,
                            value: name,
                            emoji: '🎻',
                        })));
                    rows.push(new ActionRowBuilder().addComponents(selectMenu));
                }

                const navButtons = [];
                if (page > 0) {
                    navButtons.push(new ButtonBuilder().setCustomId('prev_page').setLabel('Anterior').setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️'));
                }
                if (page + 1 < totalPages) {
                    navButtons.push(new ButtonBuilder().setCustomId('next_page').setLabel('Próxima').setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️'));
                }
                if (navButtons.length) rows.push(new ActionRowBuilder().addComponents(...navButtons));

                rows.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('resume_audio').setLabel('Play').setStyle(ButtonStyle.Success)
                            .setEmoji('▶️'),
                        new ButtonBuilder().setCustomId('pause_audio').setLabel('Pause').setStyle(ButtonStyle.Danger)
                            .setEmoji('⏸️'),
                        // eslint-disable-next-line max-len
                        new ButtonBuilder().setCustomId('loop_toggle').setLabel(`Loop: ${loopEnabled ? 'Ativado' : 'Desativado'}`).setStyle(loopEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setEmoji('🔄'),
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reload').setLabel('Recarregar').setStyle(ButtonStyle.Success)
                            .setEmoji('⏳'),
                        new ButtonBuilder().setCustomId('stop_audio').setLabel('Parar').setStyle(ButtonStyle.Danger)
                            .setEmoji('⏹️'),
                        new ButtonBuilder().setCustomId('clear_selection').setLabel('Limpar escolha').setStyle(ButtonStyle.Secondary)
                            .setEmoji('🗑️'),
                    ),
                );

                return rows;
            };

            const embed = new EmbedBuilder()
                .setTitle('🎶 Um Bardo na Casa! Escolha sua melodia!')
                // eslint-disable-next-line max-len
                .setDescription('Saudações, viajante! 🎩✨\nEscolha uma das canções abaixo para embalar nossa aventura. Que a música comece e o espírito se eleve! 🎻🪕')
                .setColor(0x8A2BE2)
                .setThumbnail('https://img1.picmix.com/output/stamp/normal/2/1/0/5/2725012_1e75a.gif')
                .addFields(
                    { name: '💡 Dica', value: 'Use os botões abaixo para escolher o áudio que fará todos dançarem!' },
                    { name: '📝 Dica do Bardo', value: 'Deixe a canção guiar sua aventura, e quem sabe, até inspirar uma nova lenda!' },
                )
                .setImage('https://media.discordapp.net/attachments/1402058526788161696/1408461378418901023/LwVJ.gif')
                .setFooter({ text: 'O bardo espera ansioso por sua escolha... 🎤' });

            await interaction.deferReply();
            await interaction.deleteReply();

            const sentMessage = await interaction.channel.send({
                embeds: [embed],
                components: createRows(),
            });

            let menuActive = true;

            const collector = interaction.channel.createMessageComponentCollector({ idle: 5 * 60 * 1000 });

            const onMessageDelete = (deletedMessage) => {
                if (deletedMessage.id === sentMessage.id) {
                    menuActive = false;
                    activeMenus.delete(guildId);
                    player?.stop();
                    collector.stop('menu_deleted');
                }
            };

            interaction.channel.client.on('messageDelete', onMessageDelete);

            collector.on('collect', async (ci) => {
                if (!menuActive || ci.replied || ci.deferred) return;

                if (ci.isStringSelectMenu()) {
                    const audioName = ci.values[0];
                    const audioPath = supportedExtensions.map((ext) => path.join(audioFolder, audioName + ext))
                        .find((fullPath) => fs.existsSync(fullPath));
                    if (!audioPath) return ci.deferUpdate();
                    if (!ci.member.voice.channel || ci.member.voice.channel.id !== voiceChannel.id) return ci.deferUpdate();

                    currentResource = createAudioResource(audioPath, { metadata: { path: audioPath } });
                    player.play(currentResource);
                    await ci.deferUpdate();
                } else if (ci.isButton()) {
                    // eslint-disable-next-line default-case
                    switch (ci.customId) {
                    case 'next_page':
                        // eslint-disable-next-line no-plusplus
                        page++;
                        await ci.update({ components: createRows() });
                        break;
                    case 'prev_page':
                        // eslint-disable-next-line no-plusplus
                        page--;
                        await ci.update({ components: createRows() });
                        break;
                    case 'loop_toggle':
                        loopEnabled = !loopEnabled;
                        await ci.update({ components: createRows() });
                        break;
                    case 'pause_audio':
                        player?.pause();
                        await ci.deferUpdate();
                        break;
                    case 'resume_audio':
                        player?.unpause();
                        await ci.deferUpdate();
                        break;
                    case 'reload':
                        // eslint-disable-next-line no-case-declarations
                        const refreshedFiles = fs.readdirSync(audioFolder)
                            .filter((file) => supportedExtensions.includes(path.extname(file)));
                        audioNames.length = 0;
                        audioNames.push(...new Set(refreshedFiles.map((file) => path.basename(file, path.extname(file)))));
                        await ci.update({ components: createRows() });
                        break;
                    case 'stop_audio':
                        player?.stop();
                        await ci.deferUpdate();
                        break;
                    case 'clear_selection':
                        currentResource = null;
                        await ci.update({ components: createRows() });
                        break;
                    }
                }
            });

            collector.on('end', () => {
                menuActive = false;
                interaction.channel.client.off('messageDelete', onMessageDelete);
                activeMenus.delete(guildId);
                player?.stop();
                connection.destroy();
                currentResource = null;
                sentMessage.delete().catch(() => {});
            });
        } catch (error) {
            console.error('Erro no comando:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'Erro ao executar o comando.' });
            }
        }
    },
};
