const { Events } = require('discord.js');
const { addInteraction, checkEmblems } = require('../utils/profileManager');

module.exports = {
    name: Events.MessageCreate,
    async execute(bot, message) {
        if (!message) return;
        if (message.author.bot) return;

        const profile = await addInteraction(message.author.id, message.author.username);
        const { newEmblems, newRewards } = await checkEmblems(profile);

        if (newEmblems.length > 0 || newRewards.length > 0) {
            let reply = `${message.author}, você desbloqueou:`;
            if (newEmblems.length > 0) reply += `\n**Emblemas:** ${newEmblems.join(', ')}`;
            if (newRewards.length > 0) reply += `\n**Recompensas:** ${newRewards.join(', ')}`;
            message.channel.send(reply);
        }
    },
};
