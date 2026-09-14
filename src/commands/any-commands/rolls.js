/* eslint-disable prefer-destructuring */
/* eslint-disable no-plusplus */
/* eslint-disable max-len */
const { randomInt } = require('node:crypto');
const { SlashCommandBuilder } = require('discord.js');

const MAX_REPETITIONS = 20;
const MAX_TERMS = 20;
const MAX_DICE_PER_TERM = 100;
const MAX_DIE_SIDES = 100_000;
const MAX_RESPONSE_LENGTH = 1_900;
const MAX_EXPRESSION_LENGTH = 200;
const MAX_ARITHMETIC_TOKENS = 100;

function parseExpression(rawInput) {
    const compact = rawInput.replace(/\s/g, '');
    const repeatMatch = compact.match(/^(\d+)#(.+)$/);
    const repeat = repeatMatch ? Number.parseInt(repeatMatch[1], 10) : 1;
    const expression = repeatMatch ? repeatMatch[2] : compact;

    if (repeat < 1 || repeat > MAX_REPETITIONS) {
        throw new Error(`Use entre 1 e ${MAX_REPETITIONS} repetições.`);
    }

    if (!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+%?))*$/i.test(expression)) {
        throw new Error('Expressão inválida. Exemplo: 3d6+2, 1d20+50% ou 4#1d20+5.');
    }

    const terms = expression.match(/[+-]?(?:\d*d\d+|\d+%?)/gi) ?? [];
    if (terms.length > MAX_TERMS) throw new Error(`Use no máximo ${MAX_TERMS} termos.`);

    return { repeat, terms };
}

function rollDie(sides, randomInteger = randomInt) {
    return randomInteger(1, sides + 1);
}

function rollTerm(rawTerm, randomInteger = randomInt) {
    const negative = rawTerm.startsWith('-');
    const term = rawTerm.replace(/^[+-]/, '');
    const diceMatch = term.match(/^(\d*)d(\d+)$/i);

    if (!diceMatch) {
        if (term.endsWith('%')) {
            const percentage = Number.parseInt(term.slice(0, -1), 10);
            if (!Number.isSafeInteger(percentage)) throw new Error('Porcentagem muito grande.');
            return {
                percentage: negative ? -percentage : percentage,
                display: `${negative ? '-' : ''}${percentage}%`,
            };
        }
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

    const rolls = Array.from({ length: diceCount }, () => rollDie(sides, randomInteger));
    const subtotal = rolls.reduce((sum, value) => sum + value, 0);
    const sign = negative ? '-' : '';
    return {
        total: negative ? -subtotal : subtotal,
        display: `${sign}[${rolls.join(', ')}] ${diceCount}d${sides}`,
    };
}

function tokenizeArithmetic(rawInput) {
    const compact = rawInput
        .trim()
        .replace(/\s/g, '')
        .replace(/[xX×]/g, '*')
        .replace(/÷/g, '/');
    if (!compact || compact.length > MAX_EXPRESSION_LENGTH) {
        throw new Error(`A expressão deve ter até ${MAX_EXPRESSION_LENGTH} caracteres.`);
    }

    const tokens = [];
    let cursor = 0;

    while (cursor < compact.length) {
        const numberMatch = compact.slice(cursor).match(/^(?:\d+(?:[.,]\d+)?|[.,]\d+)/);
        if (numberMatch) {
            const value = Number(numberMatch[0].replace(',', '.'));
            if (!Number.isFinite(value)) throw new Error('Número inválido ou muito grande.');
            tokens.push({ type: 'number', value });
            cursor += numberMatch[0].length;
        } else {
            const operator = compact[cursor];
            if (!'+-*/()%'.includes(operator)) {
                throw new Error(`Símbolo inválido: ${operator}`);
            }
            tokens.push({ type: operator });
            cursor += 1;
        }

        if (tokens.length > MAX_ARITHMETIC_TOKENS) {
            throw new Error(`Use no máximo ${MAX_ARITHMETIC_TOKENS} elementos.`);
        }
    }

    return tokens;
}

function parseArithmeticExpression(rawInput) {
    const tokens = tokenizeArithmetic(rawInput);
    let position = 0;

    const peek = () => tokens[position];
    const consume = (type) => {
        if (peek()?.type !== type) return false;
        position += 1;
        return true;
    };

    function parsePrimary() {
        const token = peek();
        if (token?.type === 'number') {
            position += 1;
            return { type: 'number', value: token.value };
        }
        if (consume('(')) {
            // A referência circular é necessária para permitir parênteses aninhados.
            // eslint-disable-next-line no-use-before-define
            const expression = parseAdditive();
            if (!consume(')')) throw new Error('Parêntese não fechado.');
            return expression;
        }
        throw new Error('Era esperado um número ou parêntese.');
    }

    function parsePostfix() {
        let node = parsePrimary();
        if (consume('%')) node = { type: 'percent', argument: node };
        if (peek()?.type === '%') throw new Error('Porcentagem duplicada.');
        return node;
    }

    function parseUnary() {
        if (consume('+')) return { type: 'unary', operator: '+', argument: parseUnary() };
        if (consume('-')) return { type: 'unary', operator: '-', argument: parseUnary() };
        return parsePostfix();
    }

    function parseMultiplicative() {
        let node = parseUnary();
        while (peek()?.type === '*' || peek()?.type === '/') {
            const operator = peek().type;
            position += 1;
            node = {
                type: 'binary', operator, left: node, right: parseUnary(),
            };
        }
        return node;
    }

    function parseAdditive() {
        let node = parseMultiplicative();
        while (peek()?.type === '+' || peek()?.type === '-') {
            const operator = peek().type;
            position += 1;
            node = {
                type: 'binary', operator, left: node, right: parseMultiplicative(),
            };
        }
        return node;
    }

    const tree = parseAdditive();
    if (position !== tokens.length) throw new Error('Expressão matemática incompleta.');
    return tree;
}

function isDiceExpression(rawInput) {
    if (typeof rawInput !== 'string' || rawInput.length > MAX_EXPRESSION_LENGTH) return false;
    const compact = rawInput.trim().replace(/\s/g, '');
    if (/d/i.test(compact)) return /^[\dd#+%+-]+$/i.test(compact);

    // Números soltos não ativam o bot; deve existir ao menos uma operação.
    if (!/[+\-xX*×/÷%]/.test(compact)) return false;

    try {
        parseArithmeticExpression(compact);
        return true;
    } catch {
        return false;
    }
}

function evaluateArithmeticNode(node) {
    if (node.type === 'number') return node.value;
    if (node.type === 'percent') return evaluateArithmeticNode(node.argument) / 100;
    if (node.type === 'unary') {
        const value = evaluateArithmeticNode(node.argument);
        return node.operator === '-' ? -value : value;
    }

    const left = evaluateArithmeticNode(node.left);
    let right = evaluateArithmeticNode(node.right);

    // Como em uma calculadora: 85 + 50% significa 85 + (50% de 85).
    if ((node.operator === '+' || node.operator === '-') && node.right.type === 'percent') {
        right *= left;
    }

    let result;
    if (node.operator === '+') result = left + right;
    if (node.operator === '-') result = left - right;
    if (node.operator === '*') result = left * right;
    if (node.operator === '/') {
        if (right === 0) throw new Error('Não é possível dividir por zero.');
        result = left / right;
    }

    if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) {
        throw new Error('O resultado é grande demais.');
    }
    return result;
}

function formatArithmeticNumber(value) {
    const rounded = Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
    return new Intl.NumberFormat('pt-BR', {
        useGrouping: false,
        maximumFractionDigits: 6,
    }).format(rounded);
}

function calculateExpression(rawInput) {
    const tree = parseArithmeticExpression(rawInput);
    const total = evaluateArithmeticNode(tree);
    const display = rawInput.trim().replace(/[xX*×]/g, ' × ').replace(/[÷/]/g, ' ÷ ');
    return `\` ${formatArithmeticNumber(total)} \` ⟵ ${display}`;
}

function rollExpression(rawInput, randomInteger = randomInt) {
    if (!/d/i.test(rawInput)) return calculateExpression(rawInput);

    const { repeat, terms } = parseExpression(rawInput);
    const results = [];

    for (let index = 0; index < repeat; index += 1) {
        const rolledTerms = terms.map((term) => rollTerm(term, randomInteger));
        const total = rolledTerms.reduce((sum, result) => {
            if (result.percentage !== undefined) return sum + (sum * result.percentage) / 100;
            return sum + result.total;
        }, 0);
        const display = rolledTerms.map((result, termIndex) => {
            if (termIndex === 0) return result.display;
            if (result.display.startsWith('-')) return `- ${result.display.slice(1)}`;
            return `+ ${result.display}`;
        }).join(' ');
        results.push(`\` ${formatArithmeticNumber(total)} \` ⟵ ${display}`);
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
        .setDescription('Rola dados ou calcula uma expressão matemática')
        .addStringOption((option) => option.setName('expressao')
            .setDescription('Ex.: 1d20+7, 10x10+78 ou 85+50%')
            .setRequired(true))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            return interaction.reply(rollExpression(interaction.options.getString('expressao')));
        } catch (error) {
            return interaction.reply({ content: `❌ ${error.message}`, flags: 64 });
        }
    },
    calculateExpression,
    isDiceExpression,
    parseArithmeticExpression,
    rollDie,
    rollExpression,
};
