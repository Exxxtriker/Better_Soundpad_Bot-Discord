const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { token } = require('./config');
const dns = require('dns');

dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Criação do client
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

const audioInteractionHandler = require('./src/handlers/audioInteractionHandler');
client.on('interactionCreate', audioInteractionHandler);

const musicInteractionHandler = require('./src/handlers/musicInteractionHandler');
client.on('interactionCreate', musicInteractionHandler);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado!'))
    .catch((err) => console.log('❌ Erro ao conectar no MongoDB:', err));

client.login(token);
