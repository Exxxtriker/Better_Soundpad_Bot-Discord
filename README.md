#  Better Soundpad Bot — Discord

Um bot para Discord que funciona como um **sound-pad**, permitindo:

- Baixar músicas diretamente do YouTube  
- Fazer upload de arquivos de áudio localmente  
- Navegar por um menu interativo para escolher sons
- Sistema de pontos e nível via MongoDB
- Sistema de emojis da aplicação 

---

##  Tabela de Conteúdo

- [Visão Geral](#visão-geral)  
- [Funcionalidades](#funcionalidades)  
- [Tecnologias Utilizadas](#tecnologias-utilizadas)  
- [Instalação](#instalação)  
- [Configuração](#configuração)  

---

##  Visão Geral

Este bot traz toda a diversão de um sound-pad para o Discord. Com suporte a download do YouTube e upload manual de áudio, tudo controlado por um menu interativo para facilitar o uso em tempo real.

---

##  Funcionalidades

-  **Download de música do YouTube**  
  Permite adicionar e reproduzir faixas diretamente da internet.

-  **Upload de arquivos locais**  
  Carregue seus próprios sons para armazenar e reproduzir com facilidade.

-  **Menu interativo**  
  Navegue pelas opções de reprodução utilizando um sistema de comandos claras e intuitivas.


---

##  Tecnologias Utilizadas

- **Linguagem:** JavaScript (100 %)
- **Arquivos principais:**
  - `app.js` — lógica central do bot  
  - `config.js` — configurações (tokens, IDs de servidor, etc.)  
  - `slashBuilder.js` — publicação manual dos comandos via barra (slash commands)
- **Outros arquivos:**
  - `.eslintrc.json` — regras de linting  
  - `package.json` + `package-lock.json` — dependências e meta informações do projeto  
  - `.gitignore` — arquivos ignorados no controle de versão  
  - `src/` — possível pasta com código adicional ou estrutura modular

---

## Instalação
Para hospedar o bot localmente:
```bash
# Clone o repositório
git clone https://github.com/Exxxtriker/Better_Soundpad_Bot-Discord.git

# Instale as dependências
npm install

# Configure o arquivo .env com suas credenciais

# Publique os comandos após instalar ou alterar um comando
npm run deploy:commands

# Inicie o bot
npm start
```

## Configuração
- Crie um arquivo `.env` com `TOKEN`, `CLIENT_ID` e `MONGO_URI`.
- `APPLICATION_ID` é opcional; o comando de emojis usa o ID da aplicação conectada como alternativa.
- `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` habilitam a API oficial do Spotify e playlists com mais de 100 faixas.
- `RADIO_OWNER_ID` pode definir quem usa `/radio`.
- O bot usa DNS público automaticamente se o DNS do sistema recusar a consulta SRV do MongoDB.
- `CUSTOM_DNS=true` força DNS público desde o início; `CUSTOM_DNS=false` desabilita o fallback.
- `/uploadaudio` e `/ytmp3` exigem a permissão **Gerenciar Servidor** e limitam arquivos a 25 MB.

## Desenvolvimento

```bash
npm run dev       # reinicia ao detectar alterações
npm test          # executa lint e valida os slash commands
```

O processo normal de inicialização não republica comandos. Use `npm run deploy:commands`
somente quando a definição de algum slash command mudar.

Se o Windows bloquear `yt-dlp.exe`, abra as propriedades do arquivo, marque **Desbloquear**
e aplique a alteração antes de iniciar o bot.
