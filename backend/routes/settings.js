// routes/settings.js - Rotas de configurações
const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../database/init');

const router = express.Router();
router.use(requireAuth);

// GET /api/settings - Retorna todas as configurações
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();

  const settings = {};
  rows.forEach(row => { settings[row.key] = row.value; });

  // Adicionar informações do ambiente (sem dados sensíveis!)
  settings.tuyaConfigured = !!(process.env.TUYA_CLIENT_ID && process.env.TUYA_CLIENT_SECRET);
  settings.tuyaRegion = process.env.TUYA_BASE_URL || 'https://openapi.tuyabr1.com';

  return res.json({ success: true, settings });
});

// PUT /api/settings - Atualiza configurações
router.put(
  '/',
  [
    body('panel_name').optional().trim().isLength({ min: 1, max: 100 }),
    body('theme').optional().isIn(['dark', 'light']),
    body('update_interval').optional().isInt({ min: 5000, max: 300000 }),
    body('language').optional().isIn(['pt-BR', 'en-US', 'es-ES']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const db = getDb();
    const allowedKeys = ['panel_name', 'theme', 'update_interval', 'language'];
    const updates = [];

    allowedKeys.forEach(key => {
      if (req.body[key] !== undefined) {
        updates.push({ key, value: String(req.body[key]) });
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma configuração válida fornecida.' });
    }

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    const upsertMany = db.transaction((items) => {
      for (const item of items) {
        upsert.run(item.key, item.value);
      }
    });

    upsertMany(updates);

    return res.json({ success: true, message: 'Configurações salvas.' });
  }
);

module.exports = router;
