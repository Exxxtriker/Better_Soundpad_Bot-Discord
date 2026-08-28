const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const rollCommand = require('../src/commands/any-commands/rolls');
const audioCommand = require('../src/commands/commands-audios/audio');
const downloadCommand = require('../src/commands/commands-audios/baixar');
const uploadCommand = require('../src/commands/commands-audios/upload');
const musicCommand = require('../src/commands/music/play');
const activePlayers = require('../src/handlers/activePlayers');
const Profile = require('../src/models/profile');
const {
    resolveInside,
    sanitizeBaseName,
    validateYouTubeUrl,
} = require('../src/utils/audioFiles');
const { safelyDestroyVoiceConnection } = require('../src/utils/voiceConnection');

test('nomes e caminhos de áudio permanecem dentro da pasta esperada', () => {
    const root = path.resolve('audios-test');
    const safeName = sanitizeBaseName('../../som inválido?.mp3');

    assert.equal(/[\\/]/.test(safeName), false);
    assert.equal(sanitizeBaseName('CON'), '_CON');
    assert.equal(path.dirname(resolveInside(root, safeName)), root);
    assert.throws(() => resolveInside(root, '../escape.mp3'), /Caminho/);
});

test('comandos que gravam arquivos exigem permissão administrativa', () => {
    assert.notEqual(downloadCommand.data.toJSON().default_member_permissions, null);
    assert.notEqual(uploadCommand.data.toJSON().default_member_permissions, null);
});

test('perfil possui defaults para rank e recompensas', () => {
    const profile = new Profile({ userId: '123', username: 'Teste' });
    const validationError = profile.validateSync();

    assert.equal(validationError, undefined);
    assert.equal(profile.rank, 'Novato');
    assert.deepEqual(profile.rewards, []);
});

test('download aceita somente links HTTPS do YouTube', () => {
    assert.match(validateYouTubeUrl('https://youtu.be/abc123'), /^https:\/\/youtu\.be/);
    assert.throws(() => validateYouTubeUrl('http://youtube.com/watch?v=abc'), /HTTPS/);
    assert.throws(() => validateYouTubeUrl('https://example.com/video'), /YouTube/);
});

test('player transforma links de Mix do YouTube em uma única faixa', () => {
    const mixUrl = 'https://www.youtube.com/watch?v=M_IglszUTOE&list=RDM_IglszUTOE&start_radio=1';
    assert.equal(
        musicCommand.validateQuery(mixUrl),
        'https://www.youtube.com/watch?v=M_IglszUTOE',
    );
    assert.equal(
        musicCommand.validateQuery('https://youtu.be/M_IglszUTOE?si=abc'),
        'https://www.youtube.com/watch?v=M_IglszUTOE',
    );
});

test('player reutiliza a URL direta e os cabeçalhos retornados pelo yt-dlp', () => {
    const selected = musicCommand.getSelectedStreamData({
        url: 'https://fallback.example/audio',
        requested_downloads: [{
            url: 'https://media.example/audio',
            http_headers: { 'User-Agent': 'yt-dlp', Referer: 'https://www.youtube.com/' },
        }],
    });

    assert.equal(selected.streamUrl, 'https://media.example/audio');
    assert.equal(
        musicCommand.buildFfmpegHeaders(selected.httpHeaders),
        'User-Agent: yt-dlp\r\nReferer: https://www.youtube.com/\r\n',
    );
    assert.equal(musicCommand.buildFfmpegHeaders({ Unsafe: 'valor\r\ninjetado' }), '');
});

test('menu medieval de música exibe status, intensidade e próximas baladas', () => {
    const guildId = 'guild-embed-test';
    musicCommand.guildQueues.set(guildId, {
        paused: false,
        volume: 80,
        loop: 'queue',
        songs: [
            {
                title: 'Música atual',
                url: 'https://www.youtube.com/watch?v=atual',
                uploader: 'Artista',
                formattedDuration: '3:15',
                user: { id: '123' },
            },
            { title: 'Próxima música', formattedDuration: '2:00' },
        ],
    });

    let embed;
    try {
        embed = musicCommand.createEmbed(guildId).toJSON();
    } finally {
        musicCommand.guildQueues.delete(guildId);
    }

    assert.match(embed.description, /BALADA EM EXECUÇÃO/);
    assert.equal(embed.fields.find((field) => field.name.includes('Intensidade')).value, '`80%`');
    assert.match(embed.fields.find((field) => field.name.includes('Próximas baladas')).value, /Próxima música/);
});

test('/audio é bloqueado enquanto o player de música está ativo no servidor', async () => {
    const guildId = 'guild-lock-test';
    let response;
    musicCommand.guildQueues.set(guildId, {});

    try {
        await audioCommand.execute({
            guild: { id: guildId },
            reply: async (payload) => {
                response = payload;
            },
        });
    } finally {
        musicCommand.guildQueues.delete(guildId);
    }

    assert.match(response.content, /player de música está ativo/i);
    assert.equal(response.flags, 64);
});

test('/play é bloqueado enquanto o painel de áudios está ativo no servidor', async () => {
    const guildId = 'guild-reverse-lock-test';
    let response;
    const interaction = {
        guildId,
        deferred: false,
        replied: false,
        deferReply: async () => {
            interaction.deferred = true;
        },
        editReply: async (payload) => {
            response = payload;
        },
    };
    activePlayers.set(guildId, {});

    try {
        await musicCommand.execute(interaction);
    } finally {
        activePlayers.delete(guildId);
    }

    assert.match(response, /painel de áudios está ativo/i);
    assert.equal(musicCommand.isMusicActive(guildId), false);
});

test('destruição repetida da conexão de voz não derruba o processo', () => {
    let calls = 0;
    const connection = {
        destroyed: false,
        destroy() {
            calls += 1;
            this.destroyed = true;
        },
    };

    assert.equal(safelyDestroyVoiceConnection(connection), true);
    assert.equal(safelyDestroyVoiceConnection(connection), false);
    assert.equal(calls, 1);
    assert.equal(safelyDestroyVoiceConnection({
        destroyed: false,
        destroy() {
            throw new Error('Cannot destroy VoiceConnection - it has already been destroyed');
        },
    }), false);
});

async function executeRoll(expression) {
    let response;
    await rollCommand.execute({
        options: { getString: () => expression },
        reply: async (payload) => {
            response = payload;
        },
    });
    return response;
}

test('rolagem rejeita cargas excessivas e expressões parciais', async () => {
    assert.match((await executeRoll('999#1d6')).content, /20 repetições/);
    assert.match((await executeRoll('1000d6')).content, /100 dados/);
    assert.match((await executeRoll('1d6texto')).content, /Expressão inválida/);
});

test('mensagens reconhecem apenas expressões completas de dados', () => {
    assert.equal(rollCommand.isDiceExpression('1d20+7'), true);
    assert.equal(rollCommand.isDiceExpression(' 4#2d6 + 3 '), true);
    assert.equal(rollCommand.isDiceExpression('eu tenho 1d20'), false);
    assert.equal(rollCommand.isDiceExpression('/play 1d20'), false);
    assert.match(rollCommand.rollExpression('1d2+7'), /^` (8|9) ` ⟵/);
});

test('rolagem aplica corretamente o sinal negativo aos dados', async () => {
    const invalidResponse = await executeRoll('1-1d1');
    assert.match(invalidResponse.content, /entre 2 e/);

    const validResponse = await executeRoll('1-1d2');
    const total = Number(validResponse.match(/` (-?\d+) `/)[1]);
    assert.ok(total === 0 || total === -1);
});
