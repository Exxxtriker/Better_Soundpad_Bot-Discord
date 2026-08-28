/* eslint-disable prefer-destructuring */
/* eslint-disable no-plusplus */
/* eslint-disable max-len */
const { SlashCommandBuilder } = require('discord.js');

const MAX_REPETITIONS = 20;
const MAX_TERMS = 20;
const MAX_DICE_PER_TERM = 100;
const MAX_DIE_SIDES = 100_000;
const MAX_RESPONSE_LENGTH = 1_900;

function parseExpression(rawInput) {
    const compact = rawInput.replace(/\s/g, '');
    const repeatMatch = compact.match(/^(\d+)#(.+)$/);
    const repeat = repeatMatch ? Number.parseInt(repeatMatch[1], 10) : 1;
    const expression = repeatMatch ? repeatMatch[2] : compact;

    if (repeat < 1 || repeat > MAX_REPETITIONS) {
        throw new Error(`Use entre 1 e ${MAX_REPETITIONS} repetições.`);
    }

    if (!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/i.test(expression)) {
        throw new Error('Expressão inválida. Exemplo: 3d6+2 ou 4#1d20+5.');
    }

    const terms = expression.match(/[+-]?(?:\d*d\d+|\d+)/gi) ?? [];
    if (terms.length > MAX_TERMS) throw new Error(`Use no máximo ${MAX_TERMS} termos.`);

    return { repeat, terms };
}

function rollTerm(rawTerm) {
    const negative = rawTerm.startsWith('-');
    const term = rawTerm.replace(/^[+-]/, '');
    const diceMatch = term.match(/^(\d*)d(\d+)$/i);

    if (!diceMatch) {
        const value = Number.parseInt(term, 10);
        if (!Number.isSafeInteger(value)) throw new Error('Modificador numérico muito grande.');
        return { total: negative ? -value : value, display: `${negative ? '-' : ''}${value}` };
    }

    const diceCount = Number.parseInt(diceMatch[1] || '1', 10);
    const sides = Number.parseInt(diceMatch[2], 10);
    if (diceCount < 1 || diceCount > MAX_DICE_PER_TERM) {
        throw new Error(`Cada termo deve ter entre 1 e ${MAX_DICE_PER_TERM} dados.`);
    }
    if (sides < 2 || sides > MAX_DIE_SIDES) {
        throw new Error(`Cada dado deve ter entre 2 e ${MAX_DIE_SIDES} lados.`);
    }

    const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * sides) + 1);
    const subtotal = rolls.reduce((sum, value) => sum + value, 0);
    const sign = negative ? '-' : '';
    return {
        total: negative ? -subtotal : subtotal,
        display: `${sign}[${rolls.join(', ')}] ${diceCount}d${sides}`,
    };
}

function isDiceExpression(rawInput) {
    if (typeof rawInput !== 'string' || rawInput.length > 200) return false;
    const compact = rawInput.trim().replace(/\s/g, '');
    return /d/i.test(compact) && /^[\dd#+-]+$/i.test(compact);
}

function rollExpression(rawInput) {
    const { repeat, terms } = parseExpression(rawInput);
    const results = [];

    for (let index = 0; index < repeat; index += 1) {
        const rolledTerms = terms.map(rollTerm);
        const total = rolledTerms.reduce((sum, result) => sum + result.total, 0);
        results.push(`\` ${total} \` ⟵ ${rolledTerms.map((result) => result.display).join(' + ')}`);
    }

    const content = results.join('\n');
    if (content.length > MAX_RESPONSE_LENGTH) {
        throw new Error('O resultado ficou grande demais. Reduza a quantidade de dados.');
    }

    return content;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rola expressões de RPG e mostra todos os dados + modificadores')
        .addStringOption((option) => option.setName('expressao')
            .setDescription('Expressão de rolagem de dados (ex: 20d8+60-5 ou 4#3d10+2d6)')
            .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            return interaction.reply(rollExpression(interaction.options.getString('expressao')));
        } catch (error) {
            return interaction.reply({ content: `❌ ${error.message}`, flags: 64 });
        }
    },
    isDiceExpression,
    rollExpression,
};
