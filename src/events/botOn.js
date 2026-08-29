const { ActivityType, Events } = require('discord.js');

const activityIntervals = new WeakMap();

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
        process.stdout.write(`✅ Bot online como ${bot.user.tag}\n`);
        await bot.guilds.fetch();

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
    isMissingShardError,
    stopActivityRotation,
};
