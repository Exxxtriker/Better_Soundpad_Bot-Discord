const { Events } = require('discord.js');
const { addInteraction, checkEmblems } = require('../utils/profileManager');

module.exports = {
    name: Events.MessageCreate,
    async execute(bot, message) { // <- importante
        if (!message) return; // evita undefined
        if (message.author.bot) return;

        const profile = await addInteraction(message.author.id, message.author.username);
        const newEmblems = await checkEmblems(profile);

        if (newEmblems.length > 0) {
            message.channel.send(`${message.author}, você desbloqueou novos emblemas: ${newEmblems.join(', ')}`);
        }
    },
};
