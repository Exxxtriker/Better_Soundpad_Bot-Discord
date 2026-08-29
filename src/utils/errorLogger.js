const fs = require('node:fs');
const path = require('node:path');
const { inspect } = require('node:util');

const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'logs.txt');
const MAX_ENTRY_LENGTH = 20_000;
const SECRET_ENV_KEYS = [
    'TOKEN',
    'MONGO_URI',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
];
let installed = false;

function redactSecrets(text, environment = process.env) {
    return SECRET_ENV_KEYS.reduce((redacted, key) => {
        const secret = environment[key];
        if (typeof secret !== 'string' || secret.length < 4) return redacted;
        return redacted.split(secret).join('[SEGREDO_REMOVIDO]');
    }, String(text));
}

function formatValue(value) {
    if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    return inspect(value, {
        depth: 5,
        maxArrayLength: 50,
        maxStringLength: 5_000,
        breakLength: 120,
    });
}

function formatErrorEntry(level, values, environment = process.env, now = new Date()) {
    const body = redactSecrets(values.map(formatValue).join(' '), environment);
    const suffix = body.length > MAX_ENTRY_LENGTH ? '\n[REGISTRO TRUNCADO]' : '';
    return `[${now.toISOString()}] ${level}\n${body.slice(0, MAX_ENTRY_LENGTH)}${suffix}\n\n`;
}

function ensureLogFile(logFile = LOG_FILE) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.closeSync(fs.openSync(logFile, 'a'));
    return logFile;
}

function writeErrorLog(level, values, logFile = LOG_FILE) {
    ensureLogFile(logFile);
    fs.appendFileSync(logFile, formatErrorEntry(level, values), 'utf8');
}

function installErrorLogger() {
    if (installed) return LOG_FILE;

    ensureLogFile();
    const originalError = console.error.bind(console);
    const recordSafely = (level, values) => {
        try {
            writeErrorLog(level, values);
        } catch (loggingError) {
            originalError('Erro ao gravar logs:', loggingError);
        }
    };

    Object.assign(console, {
        error: (...values) => {
            recordSafely('ERROR', values);
            originalError(...values);
        },
    });

    process.on('uncaughtException', (error) => {
        recordSafely('UNCAUGHT_EXCEPTION', [error]);
        originalError('Exceção não tratada:', error);
        process.exit(1); // eslint-disable-line no-process-exit
    });

    process.on('unhandledRejection', (reason) => {
        recordSafely('UNHANDLED_REJECTION', [reason]);
        originalError('Promise rejeitada sem tratamento:', reason);
        process.exit(1); // eslint-disable-line no-process-exit
    });

    installed = true;
    return LOG_FILE;
}

module.exports = {
    LOG_FILE,
    ensureLogFile,
    formatErrorEntry,
    installErrorLogger,
    redactSecrets,
    writeErrorLog,
};
