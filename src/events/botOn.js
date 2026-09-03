const { ActivityType, Events } = require('discord.js');

const activityIntervals = new WeakMap();
const STARTUP_BANNER = [
    '  GGGG  III  DDDD   EEEEE   OOO   N   N',
    ' G       I   D   D  E      O   O  NN  N',
    ' G  GG   I   D   D  EEEE   O   O  N N N',
    ' G   G   I   D   D  E      O   O  N  NN',
    '  GGGG  III  DDDD   EEEEE   OOO   N   N',
    '',
    ' TTTTT  H   H  EEEEE      BBBB    AAA   RRRR   DDDD',
    '   T    H   H  E          B   B  A   A  R   R  D   D',
    '   T    HHHHH  EEEE       BBBB   AAAAA  RRRR   D   D',
    '   T    H   H  E          B   B  A   A  R  R   D   D',
    '   T    H   H  EEEEE      BBBB   A   A  R   R  DDDD',
].join('\n');

function createStartupBanner(latency, serverCount) {
    const roundedLatency = Math.max(0, Math.round(latency));
    return [
        STARTUP_BANNER,
        '',
        ` LATENCIA   : ${roundedLatency} ms`,
        ` SERVIDORES : ${serverCount}`,
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
    },
    canUpdatePresence,
    createStartupBanner,
    isMissingShardError,
    stopActivityRotation,
};
