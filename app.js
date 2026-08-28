const dns = require('node:dns');
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { token } = require('./config');

if (process.env.CUSTOM_DNS === 'true') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
}

// Criação do client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

require('./src/handlers/eventsHandler')(client);
require('./src/handlers/commandsHandler')(client);

const audioInteractionHandler = require('./src/handlers/audioInteractionHandler');

client.on('interactionCreate', (interaction) => {
    audioInteractionHandler(interaction).catch((error) => console.error('Erro no player de áudio:', error));
});

const musicInteractionHandler = require('./src/handlers/musicInteractionHandler');

client.on('interactionCreate', (interaction) => {
    musicInteractionHandler(interaction).catch((error) => console.error('Erro no player de música:', error));
});

async function start() {
    try {
        if (!process.env.MONGO_URI) throw new Error('Variável de ambiente ausente: MONGO_URI');
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
        console.log('✅ MongoDB conectado!');
        await client.login(token);
    } catch (error) {
        console.error('❌ Falha ao iniciar o bot:', error);
        process.exitCode = 1;
    }
}

async function shutdown(signal) {
    console.log(`Encerrando após ${signal}...`);
    client.destroy();
    await mongoose.disconnect().catch((error) => console.error('Erro ao desconectar MongoDB:', error));
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

start();
