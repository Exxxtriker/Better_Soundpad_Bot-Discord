const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { token } = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

require('./src/handlers/eventsHandler')(client);
require('./src/handlers/commandsHandler')(client);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado!'))
    .catch((err) => console.log('❌ Erro ao conectar no MongoDB:', err));

client.login(token);
