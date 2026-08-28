const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const rollCommand = require('../src/commands/any-commands/rolls');
const downloadCommand = require('../src/commands/commands-audios/baixar');
const uploadCommand = require('../src/commands/commands-audios/upload');
const Profile = require('../src/models/profile');
const {
    resolveInside,
    sanitizeBaseName,
    validateYouTubeUrl,
} = require('../src/utils/audioFiles');

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

test('rolagem aplica corretamente o sinal negativo aos dados', async () => {
    const invalidResponse = await executeRoll('1-1d1');
    assert.match(invalidResponse.content, /entre 2 e/);

    const validResponse = await executeRoll('1-1d2');
    const total = Number(validResponse.match(/` (-?\d+) `/)[1]);
    assert.ok(total === 0 || total === -1);
});
