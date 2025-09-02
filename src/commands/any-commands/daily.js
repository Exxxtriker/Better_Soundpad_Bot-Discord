const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfile } = require('../../utils/profileManager');
const Profile = require('../../models/profile');

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000; // 24 horas
const DAILY_MIN = 200; // mínimo de ouro
const DAILY_MAX = 1000; // máximo de ouro

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Receba sua recompensa diária de ouro 💰'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const { username } = interaction.user;

            let profile = await getProfile(userId);
            if (!profile) {
                profile = new Profile({ userId, username });
            }

            const now = new Date();
            if (profile.lastDaily && now - profile.lastDaily < DAILY_COOLDOWN) {
                const remaining = DAILY_COOLDOWN - (now - profile.lastDaily);
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

                const embed = new EmbedBuilder()
                    .setTitle('⏳ Daily já coletado!')
                    .setColor('#FF4500')
                    .setDescription(`Você já coletou sua recompensa diária.\nTente novamente em **${hours}h ${minutes}m ${seconds}s**.`)
                    .setFooter({ text: 'Volte amanhã para coletar novamente!' });

                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            // Gera recompensa aleatória
            const reward = Math.floor(Math.random() * (DAILY_MAX - DAILY_MIN + 1)) + DAILY_MIN;
            profile.money = (profile.money || 0) + reward;
            profile.lastDaily = now;
            await profile.save();

            // Mensagem customizada dependendo do valor
            let message = 'Você recebeu sua recompensa diária!';
            if (reward > 800) message = '🍀 Que sorte! Você recebeu uma grande quantia!';
            else if (reward < 400) message = '😅 Foi um dia fraco, mas ainda assim recebeu algo.';

            const embed = new EmbedBuilder()
                .setTitle('💰 Recompensa Diária Recebida!')
                .setColor('#FFD700')
                .setDescription(`${message}\nVocê ganhou **${reward} 🪙**.`)
                .setFooter({ text: 'Volte amanhã para coletar novamente!' });

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erro no comando /daily:', error);
            return interaction.reply({ content: '❌ Ocorreu um erro ao tentar coletar o daily.', flags: 64 });
        }
    },
};
