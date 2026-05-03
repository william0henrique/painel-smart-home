// server.js - Servidor principal do Painel Smart Home
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const { getDb } = require('./database/init');
const fs = require('fs');

if (process.env.RESET_DB === 'true') {
  try {
    const dbPath = require('path').join(__dirname, 'database.sqlite');

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🔥 Banco deletado automaticamente');
    }
  } catch (err) {
    console.error('Erro ao deletar banco:', err.message);
  }
}
const app = express();
const PORT = process.env.PORT || 3001;

// Proxy (Render/Cloudflare)
app.set('trust proxy', 1);

// Segurança
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'https://app.insectos.shop',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: Origin não permitida'), false);
  },
  credentials: true,
}));

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Banco
try {
  getDb();
  console.log('✅ Banco de dados inicializado');
} catch (err) {
  console.error('❌ Erro ao inicializar banco:', err.message);
  process.exit(1);
}

// 🔥 Criar/Atualizar admin SEMPRE
async function criarAdminPadrao() {
  try {
    const bcrypt = require('bcryptjs');
    const db = getDb();

    const username = 'william';
    const password = '123456';

    const hash = await bcrypt.hash(password, 10);

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username);

    if (!user) {
      db.prepare(

      ).run(username, hash, 'admin');
      console.log('👤 Admin criado: william / 123456');
    } else {
      db.prepare(
       'UPDATE users SET password_hash = ?, role = ? WHERE username = ?'
      ).run(hash, 'admin', username);
      console.log('👤 Admin atualizado: william / 123456');
    }

  } catch (err) {
    console.error('Erro ao criar admin:', err.message);
  }
}

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/settings', require('./routes/settings'));

// Teste API
app.get('/', (req, res) => {
  res.json({ success: true, message: 'API online' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
});

// Erros
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ success: false, error: 'Erro interno' });
});

// Start
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  await criarAdminPadrao();
});

module.exports = app;
