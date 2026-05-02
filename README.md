# 🏠 Painel Smart Home

Dashboard moderna e segura para controlar dispositivos **Tuya / Smart Life** pela nuvem, com interface glassmorphism, modo escuro e suporte a automações.

![Stack](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Stack](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs)
![Stack](https://img.shields.io/badge/SQLite-3-003b57?style=flat-square&logo=sqlite)
![Stack](https://img.shields.io/badge/Tuya-Cloud_API-ff6d00?style=flat-square)

---

## ✨ Funcionalidades

- 🔐 **Login seguro** com JWT + bcrypt + proteção brute force
- 🏠 **Dashboard** com cards de dispositivos por categoria
- 💡 **Controle de lâmpadas** — ligar/desligar, brilho, cor RGB, temperatura
- 🔌 **Controle de tomadas e interruptores**
- ⚡ **Automações** — crie cenas como "Modo Cinema" ou "Modo Dormir"
- 🔄 **Auto-refresh** configurável dos estados
- 📱 **Responsivo** para celular e desktop
- 🌙 **Modo escuro / claro** com glassmorphism
- 🛡️ **Segurança** — credenciais Tuya nunca expostas no frontend
- 💾 **Cache local** SQLite para fallback offline

---

## 🗂️ Estrutura do Projeto

```
painel-smart-home/
├── backend/
│   ├── database/
│   │   └── init.js              # Inicialização SQLite
│   ├── middleware/
│   │   └── auth.js              # JWT + brute force
│   ├── routes/
│   │   ├── auth.js              # Login/logout/senha
│   │   ├── devices.js           # Controle Tuya
│   │   ├── automations.js       # CRUD automações
│   │   └── settings.js          # Configurações
│   ├── scripts/
│   │   └── createAdmin.js       # Criar usuário admin
│   ├── services/
│   │   └── tuyaService.js       # Integração Tuya Cloud API
│   ├── .env.example             # Template de configuração
│   ├── package.json
│   └── server.js                # Servidor Express
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeviceCard.jsx   # Card de dispositivo
│   │   │   ├── Layout.jsx       # Layout com sidebar
│   │   │   └── Toast.jsx        # Notificações
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Estado de autenticação
│   │   ├── hooks/
│   │   │   └── useToast.js      # Hook de notificações
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── AutomationsPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── services/
│   │   │   └── api.js           # Cliente API (sem credenciais Tuya!)
│   │   ├── styles/
│   │   │   └── global.css       # Design system
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── iniciar.bat                   # Script Windows
├── package.json                  # Scripts raiz
├── .gitignore
└── README.md
```

---

## ⚡ Instalação Rápida

### Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- Conta na [Tuya IoT Platform](https://iot.tuya.com)

### 1. Clonar o projeto

```bash
git clone <url-do-repo>
cd painel-smart-home
```

### 2. Instalar dependências

```bash
# Instalar tudo de uma vez (raiz)
npm install
npm run install:all

# OU instalar separado:
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configurar o `.env` do backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `backend/.env`:

```env
# Obtenha em: https://iot.tuya.com -> Cloud -> seu projeto
TUYA_CLIENT_ID=seu_client_id_aqui
TUYA_CLIENT_SECRET=seu_client_secret_aqui
TUYA_BASE_URL=https://openapi.tuyabr1.com

# Gere uma chave aleatória longa (mín. 32 chars)
JWT_SECRET=coloque_uma_chave_muito_secreta_e_longa_aqui

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4. Criar usuário admin

```bash
cd backend
npm run create-admin
```

Siga as instruções no terminal para definir usuário e senha.

### 5. Iniciar o projeto

```bash
# Da pasta raiz — inicia backend + frontend juntos:
npm run dev

# OU separadamente:
npm run dev:backend    # Terminal 1
npm run dev:frontend   # Terminal 2
```

Acesse: **http://localhost:5173**

---

## 🪟 Windows — Iniciar com um clique

Execute o arquivo `iniciar.bat` na pasta raiz.

O script:
- Verifica se Node.js está instalado
- Cria o `.env` se não existir e abre para edição
- Instala dependências automaticamente
- Detecta se não há usuário e executa o `create-admin`
- Abre o backend e frontend em janelas separadas
- Abre o navegador automaticamente

---

## 🌐 Obter credenciais da Tuya

1. Acesse [iot.tuya.com](https://iot.tuya.com) e crie uma conta
2. Vá em **Cloud → Development → Create Cloud Project**
3. Selecione a região correta (Brasil → **Data Center: America**)
4. Em **API Products**, adicione: `IoT Core` e `Smart Home Basic Service`
5. Vá em **Overview** e copie o **Client ID** e **Client Secret**
6. Em **Devices**, vincule sua conta Smart Life / Tuya

**Regiões disponíveis para `TUYA_BASE_URL`:**
| Região | URL |
|--------|-----|
| Brasil / América do Sul | `https://openapi.tuyabr1.com` |
| EUA / Américas | `https://openapi.tuyaus.com` |
| Europa | `https://openapi.tuyaeu.com` |
| China | `https://openapi.tuyacn.com` |
| Índia | `https://openapi.tuyain.com` |

---

## 🔒 Segurança

### Medidas implementadas

| Medida | Implementação |
|--------|--------------|
| Senhas criptografadas | bcrypt (custo 12) |
| Autenticação | JWT com expiração |
| Proteção brute force | 10 tentativas / 15 min por IP |
| Rate limiting global | 500 req / 15 min |
| Headers de segurança | Helmet.js |
| CORS restrito | Apenas origem do frontend |
| Body limit | 10kb máximo |
| Credenciais Tuya | Apenas no backend (.env) |
| Erros sensíveis | Nunca expostos ao frontend |
| Cookie httpOnly | Opcional, além do Bearer token |
| Logs de login | Registrado por IP e usuário |

### Boas práticas

- **Nunca** commite o arquivo `.env`
- Use uma senha forte (mínimo 12 caracteres)
- Configure `JWT_SECRET` com pelo menos 32 caracteres aleatórios
- Em produção, use HTTPS sempre

---

## 🚀 Deploy em Produção

### Opção 1: Cloudflare Tunnel (Recomendado — gratuito)

Permite expor o painel pela internet com HTTPS sem abrir portas no roteador.

1. Instale o `cloudflared`:
   ```bash
   # Windows (via winget)
   winget install Cloudflare.cloudflared
   
   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   ```

2. Autentique:
   ```bash
   cloudflared tunnel login
   ```

3. Crie um tunnel:
   ```bash
   cloudflared tunnel create smart-home
   ```

4. Configure `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <ID-do-tunnel>
   credentials-file: ~/.cloudflared/<ID>.json

   ingress:
     - hostname: smarthome.seudominio.com
       service: http://localhost:3001
     - service: http_status:404
   ```

5. No Cloudflare Dashboard, adicione um DNS CNAME:
   - Nome: `smarthome`
   - Destino: `<ID-do-tunnel>.cfargotunnel.com`

6. Inicie o tunnel:
   ```bash
   cloudflared tunnel run smart-home
   ```

7. Atualize o `.env` do backend:
   ```env
   NODE_ENV=production
   FRONTEND_URL=https://smarthome.seudominio.com
   ```

8. Faça o build do frontend:
   ```bash
   npm run build:frontend
   npm start
   ```

### Opção 2: Nginx + Let's Encrypt (VPS)

```nginx
server {
    listen 443 ssl;
    server_name smarthome.seudominio.com;

    ssl_certificate /etc/letsencrypt/live/smarthome.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smarthome.seudominio.com/privkey.pem;

    # Frontend (arquivos estáticos)
    location / {
        root /var/www/painel-smart-home/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name smarthome.seudominio.com;
    return 301 https://$host$request_uri;
}
```

Obter certificado SSL:
```bash
certbot --nginx -d smarthome.seudominio.com
```

---

## 📋 Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run install:all` | Instala todas as dependências |
| `npm run dev` | Backend + Frontend em modo dev |
| `npm run dev:backend` | Só o backend (nodemon) |
| `npm run dev:frontend` | Só o frontend (Vite) |
| `npm run build:frontend` | Build de produção do frontend |
| `npm start` | Backend em modo produção |
| `npm run create-admin` | Criar usuário administrador |

---

## 🔧 Solução de Problemas

**"Nenhum dispositivo encontrado"**
- Verifique `TUYA_CLIENT_ID` e `TUYA_CLIENT_SECRET` no `.env`
- Confirme a região correta em `TUYA_BASE_URL`
- Certifique-se que os dispositivos estão vinculados ao projeto no iot.tuya.com
- Use "Testar Conexão" em Configurações

**"Erro 1010 - Token inválido"**
- O Client ID ou Secret estão incorretos
- Verifique se o projeto Tuya tem os produtos de API necessários habilitados

**"CORS Error" no browser**
- Confirme que `FRONTEND_URL` no `.env` bate com a URL do frontend

**"Muitas tentativas de login"**
- Aguarde 15 minutos ou reinicie o backend (em desenvolvimento)

---

## 📱 Uso Mobile

O painel é totalmente responsivo. Para acessar do celular na mesma rede:

1. Descubra o IP do computador: `ipconfig` (Windows) ou `ip addr` (Linux)
2. Acesse `http://IP-DO-COMPUTADOR:5173` no celular

Para acesso externo, use o Cloudflare Tunnel (ver seção Deploy).

---

## 📄 Licença

MIT — Uso livre para projetos pessoais e comerciais.
