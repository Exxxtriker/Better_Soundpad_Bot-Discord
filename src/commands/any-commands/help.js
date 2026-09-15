const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const {
    buildCarouselControls,
    registerCarousel,
} = require('../../handlers/carouselInteractionHandler');

const HELP_PAGES = [
    {
        id: 'inicio',
        title: '🏰 Guia de Gideon',
        description: [
            'Gideon reúne música, dados e um minigame de coleção para campanhas de RPG.',
            '',
            '**Progressão automática**',
            'Ações no bot concedem XP e Renome.',
            'Perfis, moedas, cartas e estoques são separados por servidor.',
            '',
            '**Como navegar**',
            'Use `◀️` e `▶️` para folhear este guia.',
            '',
            '`/help` — Abre novamente este manual.',
        ].join('\n'),
    },
    {
        id: 'perfil',
        title: '🛡️ Perfil e economia',
        description: [
            '`/perfil` — Exibe sua ficha, nível, moedas, Renome e coleção.',
            '`/customizar` — Altera cor, título, lema e brasão da ficha.',
            '`/daily` — Resgata a recompensa diária de moedas.',
            '`/pagar` — Transfere moedas para outro jogador.',
            '`/mercador` — Compra melhorias, consumíveis e pacotes.',
            '',
            'Cada oferta recebe **1 a 6 unidades por servidor**.',
            'O mercador renova o estoque à **00:00**, no horário de Brasília.',
        ].join('\n'),
    },
    {
        id: 'colecao',
        title: '🃏 Coleção de cartas',
        description: [
            '`/codice` — Mostra todas as cartas existentes no jogo.',
            '`/pack` — Abre duas cartas e um Coringa cerimonial.',
            'Chance de magia por raridade: **Básico 12–40% • Arcano 28–55% • Grimório 100%**.',
            'As demais categorias disponíveis dividem igualmente a chance de cada raridade.',
            '`/cartas` — Folheia todas as cópias do seu álbum.',
            '`/carta ver` — Examina uma cópia pelo número de série.',
            '',
            '**Float** define o estado e o valor de cada exemplar.',
            'Quanto menor, mais conservada e valiosa é a carta.',
        ].join('\n'),
    },
    {
        id: 'cartas',
        title: '⚒️ Gerenciar cartas',
        description: [
            '`/carta descrever` — Usa um pergaminho para escrever na carta.',
            '`/carta casar` — Usa um anel e protege a carta com um vínculo.',
            '`/carta organizar` — Define a ordem padrão do álbum.',
            '`/combinar` — Consome duas cópias e tenta melhorar a raridade.',
            '`/tradecard` — Propõe uma troca entre dois jogadores.',
            '`/vendercarta` — Vende uma cópia pelo valor de seu Float.',
            '',
            'Cartas casadas não podem ser vendidas, trocadas ou combinadas.',
        ].join('\n'),
    },
    {
        id: 'musica',
        title: '🎶 Música e áudios',
        description: [
            '`/play` — Toca músicas e playlists de YouTube, Spotify e SoundCloud.',
            '`/audio` — Abre o repertório de SoundEffects, músicas e trilhas locais.',
            '',
            'Os players possuem fila, pausa, pular, voltar e loop.',
            'Também controlam volume e encerramento automático.',
            '',
            '`/play` e `/audio` são exclusivos.',
            'Quando um está ativo no servidor, o outro fica bloqueado.',
        ].join('\n'),
    },
    {
        id: 'utilidades',
        title: '🎲 Dados e administração',
        description: [
            '`/roll` — Rola dados ou calcula expressões matemáticas.',
            '`1d20+7`, `1d20+50%` ou `10x10+78` no chat — Detecta e resolve automaticamente.',
            '`/ping` — Mostra se Gideon está respondendo.',
            '`/clear` — Limpa mensagens; exige Gerenciar Mensagens.',
            '`/uploadaudio` — Envia um áudio; exige Gerenciar Servidor.',
            '`/ytmp3` — Salva um áudio do YouTube; exige Gerenciar Servidor.',
            '`/audiosize` — Informa o espaço ocupado pelos áudios.',
            '`/emoji` — Gerencia emojis; disponível somente ao dono do bot.',
        ].join('\n'),
    },
];

function createHelpEmbed(position) {
    const page = HELP_PAGES[position];
    return new EmbedBuilder()
        .setColor(0x8B1E2D)
        .setAuthor({ name: '📜 MANUAL DO AVENTUREIRO' })
        .setTitle(page.title)
        .setDescription(page.description)
        .setFooter({ text: `${position + 1}/${HELP_PAGES.length} • /help` });
}

function createHelpPayload(position) {
    return {
        embeds: [createHelpEmbed(position)],
        components: [buildCarouselControls(position, HELP_PAGES.length)],
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra todas as funções e comandos de Gideon.')
        .addStringOption((option) => option
            .setName('categoria')
            .setDescription('Abre o manual diretamente em uma categoria.')
            .addChoices(...HELP_PAGES.map((page) => ({
                name: page.title,
                value: page.id,
            }))))
        .setDMPermission(false),

    async execute(interaction) {
        const category = interaction.options.getString('categoria');
        const selected = HELP_PAGES.findIndex((page) => page.id === category);
        const position = selected >= 0 ? selected : 0;

        await interaction.reply(createHelpPayload(position));
        await registerCarousel(interaction, {
            position,
            total: HELP_PAGES.length,
            render: createHelpPayload,
        });
        return undefined;
    },

    HELP_PAGES,
    createHelpEmbed,
    createHelpPayload,
};
