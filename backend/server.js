// server.js - Servidor principal do Painel Smart Home
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// Inicializar banco de dados
const { getDb } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3001;

// =============================================
// SEGURANÇA: Headers HTTP com Helmet
// =============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// =============================================
// CORS - Apenas origem do frontend
// =============================================
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173', // Vite preview
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (ex: Postman em dev) apenas em dev
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin não permitida'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// =============================================
// Rate Limiting Global
// =============================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,
  message: { success: false, error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit mais restrito para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Muitas tentativas de login.' },
});

app.use(globalLimiter);

// =============================================
// Middlewares básicos
// =============================================
app.use(express.json({ limit: '10kb' })); // Limitar tamanho do body
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// Logs (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  // Em produção, log mais conciso
  app.use(morgan('combined'));
}

// =============================================
// Inicializar banco de dados
// =============================================
try {
  getDb(); // Inicializa e cria tabelas
  console.log('✅ Banco de dados inicializado');
} catch (err) {
  console.error('❌ Erro ao inicializar banco:', err.message);
  process.exit(1);
}

// =============================================
// Rotas da API
// =============================================
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/settings', require('./routes/settings'));

// Health check (sem autenticação)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    name: process.env.PANEL_NAME || 'Painel Smart Home',
  });
});

// =============================================
// Servir frontend em produção
// =============================================
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

// =============================================
// Tratamento de erros
// =============================================

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada.' });
});

// Erro global - NUNCA expor detalhes sensíveis
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

// =============================================
// Iniciar servidor
// =============================================
app.listen(PORT, () => {
  console.log('');
  console.log('🏠 ================================');
  console.log('   Painel Smart Home - Backend');
  console.log('🏠 ================================');
  console.log(`🚀 Servidor: http://localhost:${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Tuya API: ${process.env.TUYA_CLIENT_ID ? '✅ Configurada' : '❌ NÃO configurada'}`);
  console.log('');
});

module.exports = app;
const bcrypt = require("bcrypt");
const { getDb } = require("./database/init");

async function criarAdminPadrao() {
  try {
    const db = getDb();

    const existe = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get("william");

    if (!existe) {
      const senhaHash = await bcrypt.hash("123456", 10);

      db.prepare("INSERT INTO users (username, password) VALUES (?, ?)")
        .run("william", senhaHash);

      console.log("Admin criado: william / 123456");
    }
  } catch (err) {
    console.error("Erro ao criar admin:", err.message);
  }
}

criarAdminPadrao();
