#  Better Soundpad Bot — Discord

Um bot para Discord que funciona como um **sound-pad**, permitindo:

- Baixar músicas diretamente do YouTube  
- Fazer upload de arquivos de áudio localmente  
- Navegar por um menu interativo para escolher sons

---

##  Tabela de Conteúdo

- [Visão Geral](#visão-geral)  
- [Funcionalidades](#funcionalidades)  
- [Tecnologias Utilizadas](#tecnologias-utilizadas)  
- [Instalação](#instalação)  
- [Uso](#uso)  
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

- **Linguagem:** JavaScript (100 %) :contentReference[oaicite:0]{index=0}  
- **Arquivos principais:**
  - `app.js` — lógica central do bot  
  - `config.js` — configurações (tokens, IDs de servidor, etc.)  
  - `slashBuilder.js` — criação e gerenciamento de comandos via barra (slash commands)  
- **Outros arquivos:**
  - `.eslintrc.json` — regras de linting  
  - `package.json` + `package-lock.json` — dependências e meta informações do projeto  
  - `.gitignore` — arquivos ignorados no controle de versão  
  - `src/` — possível pasta com código adicional ou estrutura modular :contentReference[oaicite:1]{index=1}

---

## Instalação
Para hospedar o bot localmente:
```bash
# Clone o repositório
git clone https://github.com/Exxxtriker/Better_Soundpad_Bot-Discord.git

# Instale as dependências
npm install

# Configure o arquivo .env com suas credenciais

# Inicie o bot
node index.js
```

## Configuração
- Utilize um arquivo `.env` para armazenar tokens e credenciais.
- Personalize comandos e permissões no arquivo de configuração do bot.
