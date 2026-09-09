const { ActivityType, Events } = require('discord.js');
const { syncApplicationCommands } = require('../utils/commandSync');

const activityIntervals = new WeakMap();
const STARTUP_BANNER = [
    '┏┓• ┓        ┏┳┓┓     ┓      ┓',
    '┃┓┓┏┫┏┓┏┓┏┓   ┃ ┣┓┏┓  ┣┓┏┓┏┓┏┫',
    '┗┛┗┗┻┗ ┗┛┛┗   ┻ ┛┗┗   ┗┛┗┻┛ ┗┻',
].join('\n');

function createStartupBanner(latency, serverCount, options = {}) {
    const {
        color = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb',
        columns = process.stdout.columns ?? 80,
    } = options;
    const latencyText = Number.isFinite(latency) && latency >= 0 ? `${Math.round(latency)} ms` : 'Aguardando';
    const serversText = Number.isInteger(serverCount) && serverCount >= 0 ? String(serverCount) : 'Indisponível';
    const paint = (text, code) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
    const stats = [
        ['STATUS', 'ONLINE', '32'],
        ['LATÊNCIA', latencyText, '36'],
        ['SERVIDORES', serversText, '37'],
    ];

    // Sem comandos de cursor: não apaga erros e continua legível em arquivos de log.
    if (columns < 40) {
        return [
            '', paint(STARTUP_BANNER, '1;33'), '',
            ...stats.map(([label, value, shade]) => paint(`${label}: ${value}`, shade)),
            'Erros: logs/logs.txt', '',
        ].join('\n');
    }

    const width = Math.min(56, columns - 2);
    const border = (left, right) => paint(`${left}${'─'.repeat(width)}${right}`, '90');
    const row = (text = '', shade = '37', centered = false) => {
        const content = text.slice(0, width - 4);
        const left = centered ? Math.floor((width - content.length) / 2) : 2;
        const padded = `${' '.repeat(left)}${content}`.padEnd(width);
        return `${paint('│', '90')}${paint(padded, shade)}${paint('│', '90')}`;
    };

    return [
        '',
        border('╭', '╮'),
        row(),
        ...STARTUP_BANNER.split('\n').map((line) => row(line, '1;33', true)),
        row(),
        row('RPG  /  MÚSICA  /  AVENTURAS', '90', true),
        row(),
        border('├', '┤'),
        row(),
        ...stats.map(([label, value, shade]) => row(`${label.padEnd(13)}${value}`, shade)),
        row(),
        border('├', '┤'),
        row('ERROS        logs/logs.txt', '90'),
        row('Ctrl+C para encerrar', '90'),
        border('╰', '╯'),
        '',
    ].join('\n');
}

function canUpdatePresence(bot) {
    return Boolean(bot.user && bot.isReady() && bot.ws?.shards?.size > 0);
}

function isMissingShardError(error) {
    return error instanceof RangeError && /^Shard \d+ not found$/.test(error.message);
}

function stopActivityRotation(bot) {
    const interval = activityIntervals.get(bot);
    if (!interval) return false;
    clearInterval(interval);
    activityIntervals.delete(bot);
    return true;
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(bot) {
        const requestStartedAt = Date.now();
        await bot.guilds.fetch();
        const requestLatency = Date.now() - requestStartedAt;
        const gatewayLatency = bot.ws.ping;
        const latency = Number.isFinite(gatewayLatency) && gatewayLatency >= 0
            ? gatewayLatency
            : requestLatency;
        process.stdout.write(createStartupBanner(latency, bot.guilds.cache.size));

        // Lista de atividades para alternar (sem timer)
        const activities = [
            {
                text: 'Desenvolvido por @Exxxtriker',
                details: 'Competitive',
                type: ActivityType.Listening,
            },
            {
                text: `${bot.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} Users | ${bot.guilds.cache.size} Servers`,
                details: 'Active on Multiple Servers',
                type: ActivityType.Listening,
            },
        ];

        let currentIndex = 0; // Inicia o índice da rotação de atividades

        // Função para alternar entre as atividades
        function updateActivity() {
            if (!canUpdatePresence(bot)) return;
            const activity = activities[currentIndex];

            try {
                bot.user.setActivity(activity.text, {
                    type: activity.type,
                    details: activity.details,
                });
            } catch (error) {
                if (!isMissingShardError(error)) {
                    console.error('Erro ao atualizar atividade do Discord:', error);
                }
                return;
            }

            // Incrementa o índice para a próxima atividade (faz rotação)
            currentIndex = (currentIndex + 1) % activities.length;
        }

        // Atualiza a atividade a cada 10 segundos
        stopActivityRotation(bot);
        const activityInterval = setInterval(updateActivity, 10000); // A cada 10 segundos
        activityInterval.unref();
        activityIntervals.set(bot, activityInterval);

        // Inicializa a primeira atividade imediatamente
        updateActivity();

        // Mantém o Discord igual aos arquivos locais e remove registros antigos de servidor.
        await syncApplicationCommands(bot);
    },
    canUpdatePresence,
    createStartupBanner,
    isMissingShardError,
    stopActivityRotation,
};
