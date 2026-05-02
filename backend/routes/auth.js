// routes/auth.js - Rotas de autenticação
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../database/init');
const { bruteForceProtection, logLoginAttempt, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  bruteForceProtection,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Nome de usuário inválido'),
    body('password')
      .isLength({ min: 6, max: 100 })
      .withMessage('Senha inválida'),
  ],
  async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Validar campos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logLoginAttempt(ip, req.body.username, false);
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos. Verifique usuário e senha.',
      });
    }

    const { username, password } = req.body;

    try {
      const db = getDb();

      // Buscar usuário
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

      if (!user) {
        logLoginAttempt(ip, username, false);
        // Delay para evitar timing attacks
        await new Promise(r => setTimeout(r, 500));
        return res.status(401).json({
          success: false,
          error: 'Usuário ou senha incorretos.',
        });
      }

      // Verificar senha
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        logLoginAttempt(ip, username, false);
        return res.status(401).json({
          success: false,
          error: 'Usuário ou senha incorretos.',
        });
      }

      // Gerar JWT
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Atualizar último login
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      // Log de sucesso
      logLoginAttempt(ip, username, true);
      console.log(`[AUTH] Login bem-sucedido: ${username} (IP: ${ip})`);

      // Cookie httpOnly (mais seguro)
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      });

      return res.json({
        success: true,
        token, // Também retornar no body para o frontend armazenar se necessário
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('[AUTH] Erro no login:', err.message);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor.',
      });
    }
  }
);

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('auth_token');
  console.log(`[AUTH] Logout: ${req.user.username}`);
  return res.json({ success: true, message: 'Logout realizado com sucesso.' });
});

// GET /api/auth/me - Verifica token e retorna dados do usuário
router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, last_login FROM users WHERE id = ?').get(req.user.userId);

  if (!user) {
    return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
  }

  return res.json({ success: true, user });
});

// PUT /api/auth/change-password
router.put(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').isLength({ min: 6 }).withMessage('Senha atual inválida'),
    body('newPassword').isLength({ min: 8 }).withMessage('Nova senha deve ter ao menos 8 caracteres'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { currentPassword, newPassword } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!valid) {
      return res.status(401).json({ success: false, error: 'Senha atual incorreta.' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    res.clearCookie('auth_token');
    return res.json({ success: true, message: 'Senha alterada. Faça login novamente.' });
  }
);

module.exports = router;
router.get('/create-admin', async (req, res) => {
  const bcrypt = require('bcrypt')
  const db = require('../database/init').getDb()

  const existe = db.prepare('SELECT * FROM users WHERE username = ?').get('william')

  if (existe) {
    return res.json({ message: 'já existe' })
  }

  const senhaHash = await bcrypt.hash('123456', 10)

  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
    .run('william', senhaHash)

  res.json({ message: 'admin criado' })
})
