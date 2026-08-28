const { Events } = require('discord.js');
const { addInteraction, checkEmblems } = require('../utils/profileManager');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        try {
            const profile = await addInteraction(message.author.id, message.author.username);
            const { newEmblems, newRewards } = await checkEmblems(profile);

            if (newEmblems.length > 0 || newRewards.length > 0) {
                let reply = `${message.author}, você desbloqueou:`;
                if (newEmblems.length > 0) reply += `\n**Emblemas:** ${newEmblems.join(', ')}`;
                if (newRewards.length > 0) reply += `\n**Recompensas:** ${newRewards.join(', ')}`;
                await message.channel.send({ content: reply, allowedMentions: { users: [message.author.id] } });
            }
        } catch (error) {
            console.error('Erro ao processar XP da mensagem:', error);
        }
    },
};
