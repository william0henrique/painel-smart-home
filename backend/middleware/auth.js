// middleware/auth.js - Middleware de autenticação JWT
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');

/**
 * Middleware principal de autenticação
 * Verifica JWT no header Authorization ou cookie
 */
function requireAuth(req, res, next) {
  try {
    let token = null;

    // 1. Tentar pegar do header Authorization (Bearer token)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Tentar pegar do cookie httpOnly
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Token não fornecido.',
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Sessão expirada. Faça login novamente.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Token inválido.',
    });
  }
}

/**
 * Middleware de proteção contra brute force no login
 * Limita tentativas por IP e por username
 */
function bruteForceProtection(req, res, next) {
  const db = getDb();
  const ip = req.ip || req.connection.remoteAddress;
  const username = req.body?.username;

  // Contar tentativas falhas nos últimos 15 minutos
  const recentAttempts = db.prepare(`
    SELECT COUNT(*) as count 
    FROM login_attempts 
    WHERE ip = ? 
      AND success = 0 
      AND attempted_at > datetime('now', '-15 minutes')
  `).get(ip);

  if (recentAttempts.count >= 10) {
    // Log da tentativa bloqueada
    console.warn(`[SECURITY] Brute force bloqueado - IP: ${ip}, usuário: ${username}`);

    return res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      code: 'BRUTE_FORCE_BLOCKED',
    });
  }

  next();
}

/**
 * Registra tentativa de login no banco
 */
function logLoginAttempt(ip, username, success) {
  const db = getDb();
  db.prepare(`
    INSERT INTO login_attempts (ip, username, success) 
    VALUES (?, ?, ?)
  `).run(ip, username, success ? 1 : 0);
}

module.exports = { requireAuth, bruteForceProtection, logLoginAttempt };
