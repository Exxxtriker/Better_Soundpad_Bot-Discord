const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Função para calcular tamanho da pasta
function getFolderSize(folderPath) {
    let totalSize = 0;

    function calculateSize(dir) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                calculateSize(filePath);
            } else {
                totalSize += stats.size;
            }
        }
    }

    calculateSize(folderPath);
    return totalSize;
}

// Função para formatar automaticamente o tamanho
function formatSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    } if (bytes < 1024 ** 2) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    } if (bytes < 1024 ** 3) {
        return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    }
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audiosize')
        .setDescription('Mostra o tamanho total da pasta /audios'),

    async execute(interaction) {
        const folderPath = path.join(__dirname, 'audios'); // ajuste se necessário
        const sizeInBytes = getFolderSize(folderPath);
        const formattedSize = formatSize(sizeInBytes);

        await interaction.reply({
            content: `📂 A pasta **/audios** ocupa aproximadamente **${formattedSize}**`,
            flags: 64,
        });
    },
};
