const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ytmp3')
        .setDescription('Baixa um vídeo do YouTube e salva como .mp3')
        .addStringOption((option) => option.setName('url')
            .setDescription('URL do vídeo do YouTube')
            .setRequired(true))
        .addStringOption((option) => option.setName('nome')
            .setDescription('Nome do arquivo de saída (sem extensão)')
            .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        const url = interaction.options.getString('url');
        const fileName = interaction.options.getString('nome') || `yt_audio_${Date.now()}`;

        await interaction.reply({ content: '🎶 Baixando e convertendo, aguarde...', flags: 64 });

        try {
            // if (interaction.user.id !== '335012394226941966') {
            //     return interaction.editReply('Você é o meu patrono e só obedeço a ele ☠️');
            // }
            const audioFolderPath = path.join(__dirname, 'audios');
            if (!fs.existsSync(audioFolderPath)) {
                fs.mkdirSync(audioFolderPath, { recursive: true });
            }

            const filePath = path.join(audioFolderPath, `${fileName}.mp3`);

            const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');

            execFile(ytDlpPath, [
                '-x',
                '--audio-format', 'mp3',
                '--quiet', // silencia logs
                '--no-warnings', // evita warnings
                '-o', filePath,
                url,
            ], (error, stdout, stderr) => {
                if (error) {
                    console.error('Erro no yt-dlp:', stderr || error);
                    return interaction.followUp({ content: '❌ Falha ao baixar áudio com yt-dlp', flags: 64 });
                }

                interaction.followUp({ content: `✅ Áudio salvo como **${fileName}.mp3**`, flags: 64 });
            });
        } catch (err) {
            console.error('Erro ao processar:', err);
            await interaction.followUp({ content: '❌ Ocorreu um erro ao processar o vídeo.', flags: 64 });
        }
    },
};
