/* eslint-disable max-len */
const { Events } = require('discord.js');
const { addInteraction, checkEmblems } = require('../utils/profileManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const { user } = interaction;

        // 🔹 Executa o comando original primeiro
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            // Execute o comando primeiro e aguarde sua conclusão
            await command.execute(interaction);

            // Verifica se a interação ainda é válida antes de prosseguir
            if (!interaction.isRepliable()) {
                return; // Interação não é mais válida, não tenta atualizações
            }

            // Só prossegue com atualizações de perfil se a interação ainda for válida
            try {
                // 🔹 Atualiza XP e perfil
                const profile = await addInteraction(user.id, user.username);

                // 🔹 Checa emblemas e recompensas
                const { newEmblems, newRewards } = await checkEmblems(profile);

                // 🔹 Envia notificações de conquistas se houver algo novo
                if (newEmblems.length > 0 || newRewards.length > 0) {
                    try {
                        // Tenta enviar como followUp se possível
                        await interaction.followUp({
                            content: `${user}, você desbloqueou:\n🏅 Emblemas: ${newEmblems.join(', ') || 'nenhum'}\n🎁 Recompensas: ${newRewards.join(', ') || 'nenhuma'}`,
                            ephemeral: true,
                        }).catch(() => { /* Ignora erros de followUp */ });
                    } catch {
                        // Ignora erros de notificação de conquistas
                    }
                }
            } catch (profileErr) {
                console.error('Erro ao atualizar perfil:', profileErr);
                // Não interrompe o fluxo por erros de perfil
            }
        } catch (err) {
            console.error('Erro ao processar interação:', err);

            // Tenta responder ao erro apenas se ainda não houver resposta
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⚠️ Houve um erro ao executar este comando.',
                        flags: 64, // 64 = ephemeral flag
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({
                        content: '⚠️ Houve um erro ao executar este comando.',
                    });
                }
            } catch (replyErr) {
                console.error('Erro ao tentar responder após falha:', replyErr);
            }
        }
    },
};
