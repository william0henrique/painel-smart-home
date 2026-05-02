// server.js - Servidor principal do Painel Smart Home
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const { getDb } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Render/Cloudflare proxy
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

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS: Origin não permitida'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middlewares
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
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

// Criar admin automático
async function criarAdminPadrao() {
  try {
    const db = getDb();
    const bcrypt = require('bcryptjs');
    const existe = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get('william');

    if (!existe) {
      const senhaHash = await bcrypt.hash('123456', 10);

      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run('william', senhaHash);

      console.log('👤 Admin criado: william / 123456');
    } else {
      console.log('👤 Admin já existe');
    }
  } catch (err) {
    console.error('Erro ao criar admin:', err.message);
  }
}

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    name: process.env.PANEL_NAME || 'Painel Smart Home',
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Painel Smart Home API online',
  });
});

// Servir frontend só se existir
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
}

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada.' });
});

// Erro global
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);

  if (err.message === 'CORS: Origin não permitida') {
    return res.status(403).json({ success: false, error: 'Acesso negado.' });
  }

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor.'
      : err.message,
  });
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log('');
  console.log('🏠 ================================');
  console.log('   Painel Smart Home - Backend');
  console.log('🏠 ================================');
  console.log(`🚀 Servidor: http://localhost:${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Tuya API: ${process.env.TUYA_ACCESS_ID ? '✅ Configurada' : '❌ NÃO configurada'}`);
  console.log('');

  await criarAdminPadrao();
});

module.exports = app;
