/* eslint-disable prefer-destructuring */
/* eslint-disable no-plusplus */
/* eslint-disable max-len */
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rola expressões de RPG e mostra todos os dados + modificadores')
        .addStringOption((option) => option.setName('expressao')
            .setDescription('Expressão de rolagem de dados (ex: 20d8+60-5 ou 4#3d10+2d6)')
            .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        let input = interaction.options.getString('expressao');

        let repeat = 1;
        const repeatMatch = input.match(/^(\d+)#(.+)$/);
        if (repeatMatch) {
            repeat = parseInt(repeatMatch[1], 10);
            input = repeatMatch[2];
        }

        const termoRegex = /([+-]?\d*d\d+|[+-]?\d+)/gi;
        const termos = input.match(termoRegex);

        if (!termos) {
            return interaction.reply({ content: '❌ Expressão inválida!', flags: 'ephemeral' });
        }

        const resultados = [];

        for (let r = 0; r < repeat; r++) {
            let total = 0;
            const expressaoFinal = [];

            for (let termo of termos) {
                termo = termo.replace(/\s/g, '');
                let sinal = '';
                if (termo.startsWith('+')) termo = termo.slice(1);
                else if (termo.startsWith('-')) {
                    sinal = '-';
                    termo = termo.slice(1);
                }

                const dadoMatch = termo.match(/^(\d*)d(\d+)$/i);
                if (dadoMatch) {
                    const numDice = parseInt(dadoMatch[1] || '1', 10);
                    const diceSides = parseInt(dadoMatch[2], 10);

                    const rolls = [];
                    for (let i = 0; i < numDice; i++) {
                        rolls.push(Math.floor(Math.random() * diceSides) + 1);
                    }
                    const subtotal = rolls.reduce((a, b) => a + b, 0);
                    total += subtotal;

                    expressaoFinal.push(`[${rolls.join(', ')}] ${numDice}d${diceSides}`);
                } else {
                    const num = parseInt(termo, 10);
                    total += sinal === '-' ? -num : num;
                    expressaoFinal.push(sinal === '-' ? `-${num}` : `${num}`);
                }
            }

            resultados.push(`\`${total}\` ⟵ ${expressaoFinal.join(' + ')}`);
        }

        await interaction.reply(resultados.join('\n'));
    },
};
