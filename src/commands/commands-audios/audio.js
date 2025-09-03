/* eslint-disable max-len */
/* eslint-disable no-empty */
const {
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require('discord.js');
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const activeMenus = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audio')
        .setDescription('Toca um áudio do diretório de áudios no canal de voz.')
        .setDMPermission(false),

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;

            if (activeMenus[guildId]) {
                return interaction.reply({
                    content: `⚠️ Já existe um menu de áudio ativo neste servidor! Vá para o canal <#${activeMenus[guildId]}>.`,
                    flags: 64,
                });
            }

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: '⚠️ Você precisa estar em um canal de voz para usar este comando!', flags: 64 });
            }

            const audioFolderPath = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolderPath)) {
                return interaction.reply({ content: '⚠️ A pasta de áudios não foi encontrada!', flags: 64 });
            }

            const supportedExtensions = ['.mp3', '.ogg', '.wav'];
            const files = fs.readdirSync(audioFolderPath)
                .filter((file) => supportedExtensions.includes(path.extname(file)));
            const audioNames = [...new Set(files.map((file) => path.basename(file, path.extname(file))))];

            if (audioNames.length === 0) {
                return interaction.reply({ content: '⚠️ Nenhum áudio encontrado na pasta!', flags: 64 });
            }

            activeMenus[guildId] = interaction.channel.id;

            let page = 0;
            const pageSize = 25;
            let loopEnabled = false;
            let currentResource = null;
            let player = null;
            let connection = null;

            const getRows = (currentPage) => {
                const rows = [];
                const totalPages = Math.ceil(audioNames.length / pageSize);
                const start = currentPage * pageSize;
                const end = start + pageSize;
                const slice = audioNames.slice(start, end);

                if (slice.length > 0) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`audio_select_${currentPage}`)
                        .setPlaceholder(`Selecione um áudio (página ${currentPage + 1}/${totalPages})`)
                        .addOptions(slice.map((name) => ({
                            label: name.length > 100 ? `${name.slice(0, 97)}...` : name,
                            value: name,
                            emoji: '🎻',
                        })));

                    rows.push(new ActionRowBuilder().addComponents(selectMenu));
                }

                const navButtons = [];
                if (currentPage > 0) {
                    navButtons.push(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Anterior')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⬅️'),
                    );
                }
                if (currentPage + 1 < totalPages) {
                    navButtons.push(
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Próxima')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('➡️'),
                    );
                }
                if (navButtons.length) rows.push(new ActionRowBuilder().addComponents(...navButtons));

                const controlButtonsTop = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('resume_audio')
                        .setLabel('Play')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('▶️'),
                    new ButtonBuilder()
                        .setCustomId('pause_audio')
                        .setLabel('Pause')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⏸️'),
                    new ButtonBuilder()
                        .setCustomId('loop_toggle')
                        .setLabel(`Loop: ${loopEnabled ? 'Ativado' : 'Desativado'}`)
                        .setStyle(loopEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                );

                const controlButtonsBottom = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('reload')
                        .setLabel('Recarregar')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('⏳'),
                    new ButtonBuilder()
                        .setCustomId('leave')
                        .setLabel('Sair do canal')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⏹️'),
                    new ButtonBuilder()
                        .setCustomId('clear_selection')
                        .setLabel('Limpar escolha')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🗑️'),
                );

                rows.push(controlButtonsTop, controlButtonsBottom);
                return rows;
            };

            const embed = new EmbedBuilder()
                .setTitle('🎶 Um Bardo na Casa! Escolha sua melodia!')
                .setDescription('Saudações, viajante! 🎩✨\nEscolha uma das canções abaixo para embalar nossa aventura. Que a música comece e o espírito se eleve! 🎻🪕')
                .setColor(0x8A2BE2) // roxo místico, combina com fantasia/bardo
                .setThumbnail('https://img1.picmix.com/output/stamp/normal/2/1/0/5/2725012_1e75a.gif')
                .addFields(
                    { name: '💡 Dica', value: 'Use os botões abaixo para escolher o áudio que fará todos dançarem!' },
                    { name: '📝 Dica do Bardo', value: 'Deixe a canção guiar sua aventura, e quem sabe, até inspirar uma nova lenda!' },
                )
                .setImage('https://media.discordapp.net/attachments/1402058526788161696/1408461378418901023/LwVJ.gif')
                .setFooter({ text: 'O bardo espera ansioso por sua escolha... 🎤' });

            // responde só para o usuário que o menu foi criado
            await interaction.reply({ content: '🎶 Menu de áudios criado!', flags: 64 });

            // manda o menu real no canal para todos verem
            const sentMessage = await interaction.channel.send({
                embeds: [embed],
                components: getRows(page),
            });

            const collector = interaction.channel.createMessageComponentCollector({
                idle: 5 * 60 * 1000, // Muda de time para idle: só expira após 5 minutos sem interação
            });

            collector.on('collect', async (componentInteraction) => {
                if (componentInteraction.isStringSelectMenu()) {
                    const audioName = componentInteraction.values[0];
                    const audioPath = supportedExtensions.map((ext) => path.join(audioFolderPath, audioName + ext))
                        .find((fullPath) => fs.existsSync(fullPath));
                    if (!audioPath) {
                        return componentInteraction.reply({ content: `O áudio "${audioName}" não foi encontrado!`, flags: 64 });
                    }

                    if (!connection) {
                        connection = joinVoiceChannel({
                            channelId: componentInteraction.member.voice.channel.id,
                            guildId: componentInteraction.guild.id,
                            adapterCreator: componentInteraction.guild.voiceAdapterCreator,
                        });
                    }

                    if (!player) {
                        player = createAudioPlayer();
                        player.setMaxListeners(0);

                        player.on(AudioPlayerStatus.Idle, () => {
                            if (loopEnabled && currentResource?.metadata?.path) {
                                const newResource = createAudioResource(currentResource.metadata.path, {
                                    metadata: { path: currentResource.metadata.path },
                                });
                                currentResource = newResource;
                                player.play(newResource);
                            } else {
                                connection.destroy();
                                connection = null;
                                player = null;
                            }
                        });

                        player.on('error', (error) => {
                            console.error('Erro ao reproduzir o áudio:', error);
                            componentInteraction.followUp({ content: 'Erro ao tentar reproduzir o áudio.', flags: 64 });
                            if (connection) {
                                connection.destroy();
                                connection = null;
                                player = null;
                            }
                        });
                    }

                    currentResource = createAudioResource(audioPath, { metadata: { path: audioPath } });
                    connection.subscribe(player);
                    player.play(currentResource);

                    await componentInteraction.reply({
                        content: `▶️ Tocando: **${audioName}** no canal: **${componentInteraction.member.voice.channel.name}**`,
                        flags: 64,
                    });
                } else if (componentInteraction.isButton()) {
                    if (componentInteraction.customId === 'next_page') {
                        page += 1;
                        await componentInteraction.update({ components: getRows(page) });
                    } else if (componentInteraction.customId === 'prev_page') {
                        page -= 1;
                        await componentInteraction.update({ components: getRows(page) });
                    } else if (componentInteraction.customId === 'loop_toggle') {
                        loopEnabled = !loopEnabled;
                        await componentInteraction.update({ components: getRows(page) });
                    } else if (componentInteraction.customId === 'pause_audio' && player) {
                        player.pause();
                        await componentInteraction.reply({ content: '⏸️ Áudio pausado.', flags: 64 });
                    } else if (componentInteraction.customId === 'resume_audio' && player) {
                        player.unpause();
                        await componentInteraction.reply({ content: '▶️ Áudio retomado.', flags: 64 });
                    } else if (componentInteraction.customId === 'reload') {
                        const refreshedFiles = fs.readdirSync(audioFolderPath)
                            .filter((file) => supportedExtensions.includes(path.extname(file)));

                        audioNames.length = 0; // limpa a lista
                        audioNames.push(...new Set(refreshedFiles.map((file) => path.basename(file, path.extname(file)))));

                        await componentInteraction.update({ components: getRows(page) });
                        await componentInteraction.followUp({ content: '♻️ Lista de áudios recarregada!', flags: 64 });
                    } else if (componentInteraction.customId === 'leave') {
                        await componentInteraction.deferReply({ flags: 64 });

                        const userChannel = componentInteraction.member.voice.channel;

                        if (!connection || connection.joinConfig.channelId !== userChannel?.id) {
                            return componentInteraction.editReply({
                                content: '⚠️ O bardo não está na mesma taverna (call) que você!',
                            });
                        }

                        if (player) {
                            player.stop();
                        }
                        currentResource = null;

                        await componentInteraction.editReply({ content: '🎻 O bardo foi silenciado por uma força mística e deixou a taverna...' });
                    } else if (componentInteraction.customId === 'clear_selection') {
                        if (player) {
                            player.stop();
                        }
                        currentResource = null;
                        await componentInteraction.update({ components: getRows(page) });
                        await componentInteraction.followUp({ content: '🗑️ Escolha limpa e áudio parado.', flags: 64 });
                    }
                }
            });

            collector.on('end', async () => {
                const cleanup = async () => {
                    // Não limpa se ainda estiver tocando áudio ou pausado
                    if (player && (player.state.status === AudioPlayerStatus.Playing
                                 || player.state.status === AudioPlayerStatus.Paused)) {
                        return; // Mantém o menu e a conexão ativos se estiver tocando ou pausado
                    }

                    delete activeMenus[guildId];

                    try {
                        try {
                            await sentMessage.delete().catch(() => {});
                        } catch (error) {
                            if (error.code !== 10008) { // Unknown Message
                                console.error('Erro ao tentar deletar o menu:', error);
                            }
                        }
                    } catch (error) {
                        if (error.code === 10008) {
                            console.log('Menu já foi deletado anteriormente');
                        } else {
                            console.error('Erro ao tentar deletar o menu:', error);
                        }
                    }

                    if (connection) {
                        connection.destroy();
                        connection = null;
                    }
                    if (player) {
                        player.stop();
                        player = null;
                    }
                    currentResource = null;
                };

                if (!player || player.state.status === AudioPlayerStatus.Idle) {
                    await cleanup();
                } else {
                    player.once(AudioPlayerStatus.Idle, () => {
                        delete activeMenus[guildId];
                    });

                    const newCollector = interaction.channel.createMessageComponentCollector({
                        idle: 5 * 60 * 1000, // Muda de time para idle: só expira após 5 minutos sem interação
                    });

                    newCollector.on('collect', async (ci) => {
                        collector.emit('collect', ci);
                    });

                    newCollector.on('end', async () => {
                        collector.emit('end');
                        await cleanup();
                    });
                }
            });
        } catch (error) {
            console.error('Erro no comando:', error);
            await interaction.reply({ content: 'Erro ao executar o comando.', flags: 64 });
        }
    },
};
