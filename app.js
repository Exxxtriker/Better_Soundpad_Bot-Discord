/* eslint-disable import/order -- o logger precisa iniciar antes dos outros módulos da aplicação. */
const {
    installErrorLogger,
    registerRuntimeErrorSources,
    reportCriticalError,
    writeErrorLog,
} = require('./src/utils/errorLogger');
const { enableErrorOnlyConsole } = require('./src/utils/errorOnlyConsole');

enableErrorOnlyConsole();
installErrorLogger();

const dns = require('node:dns');
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { token } = require('./config');
const { stopActivityRotation } = require('./src/events/botOn');
/* eslint-enable import/order */

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

registerRuntimeErrorSources({
    client,
});

const musicInteractionHandler = require('./src/handlers/musicInteractionHandler');

client.on('interactionCreate', (interaction) => {
    musicInteractionHandler(interaction).catch((error) => console.error('Erro no player de música:', error));
});

const carouselInteractionHandler = require('./src/handlers/carouselInteractionHandler');

client.on('interactionCreate', (interaction) => {
    carouselInteractionHandler.handleCarouselInteraction(interaction)
        .catch((error) => console.error('Erro no carrossel:', error));
});

async function connectMongo() {
    try {
        await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    } catch (error) {
        const isSrvDnsRefusal = error.code === 'ECONNREFUSED' && error.syscall === 'querySrv';
        const fallbackEnabled = process.env.CUSTOM_DNS !== 'false';
        if (!isSrvDnsRefusal || !fallbackEnabled) throw error;

        writeErrorLog('RECOVERED_ERROR', [
            'Falha inicial de DNS ao conectar ao MongoDB; tentando DNS público:',
            error,
        ]);
        await mongoose.disconnect().catch((disconnectError) => {
            console.error('Erro ao preparar a nova tentativa do MongoDB:', disconnectError);
        });
        dns.setServers(PUBLIC_DNS_SERVERS);
        await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    }
}

async function start() {
    try {
        if (!process.env.MONGO_URI) throw new Error('Variável de ambiente ausente: MONGO_URI');
        await connectMongo();
        registerRuntimeErrorSources({ databaseConnection: mongoose.connection });
        await client.login(token);
    } catch (error) {
        reportCriticalError('Falha ao iniciar o bot:', error);
        process.exitCode = 1;
    }
}

async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    stopActivityRotation(client);
    try {
        await client.destroy();
    } catch (error) {
        console.error('Erro ao encerrar o cliente Discord:', error);
    }
    await mongoose.disconnect().catch((error) => console.error('Erro ao desconectar MongoDB:', error));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

start();
