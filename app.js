const dns = require('node:dns');
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { installErrorLogger } = require('./src/utils/errorLogger');
const { enableErrorOnlyConsole } = require('./src/utils/errorOnlyConsole');
const { token } = require('./config');
const { stopActivityRotation } = require('./src/events/botOn');

enableErrorOnlyConsole();
installErrorLogger();

const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];
const MONGO_OPTIONS = { serverSelectionTimeoutMS: 10_000 };
let shuttingDown = false;

if (process.env.CUSTOM_DNS === 'true') {
    dns.setServers(PUBLIC_DNS_SERVERS);
}

// Criação do client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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

async function connectMongo() {
    try {
        await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    } catch (error) {
        const isSrvDnsRefusal = error.code === 'ECONNREFUSED' && error.syscall === 'querySrv';
        const fallbackEnabled = process.env.CUSTOM_DNS !== 'false';
        if (!isSrvDnsRefusal || !fallbackEnabled) throw error;

        await mongoose.disconnect().catch(() => {});
        dns.setServers(PUBLIC_DNS_SERVERS);
        await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    }
}

async function start() {
    try {
        if (!process.env.MONGO_URI) throw new Error('Variável de ambiente ausente: MONGO_URI');
        await connectMongo();
        await client.login(token);
    } catch (error) {
        console.error('❌ Falha ao iniciar o bot:', error);
        process.exitCode = 1;
    }
}

async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    stopActivityRotation(client);
    await client.destroy();
    await mongoose.disconnect().catch((error) => console.error('Erro ao desconectar MongoDB:', error));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

start();
