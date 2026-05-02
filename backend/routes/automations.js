// routes/automations.js - Rotas de automações
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../database/init');
const tuya = require('../services/tuyaService');

const router = express.Router();
router.use(requireAuth);

// GET /api/automations - Lista automações
router.get('/', (req, res) => {
  const db = getDb();
  const automations = db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all();

  const parsed = automations.map(a => ({
    ...a,
    actions: JSON.parse(a.actions || '[]'),
    is_active: a.is_active === 1,
  }));

  return res.json({ success: true, automations: parsed });
});

// POST /api/automations - Cria automação
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Nome obrigatório'),
    body('actions').isArray({ min: 1 }).withMessage('Pelo menos uma ação é necessária'),
    body('description').optional().trim().isLength({ max: 500 }),
    body('icon').optional().trim().isLength({ max: 50 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Cor inválida'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, description, icon, color, actions } = req.body;
    const db = getDb();

    try {
      const result = db.prepare(`
        INSERT INTO automations (name, description, icon, color, actions)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, description || '', icon || 'zap', color || '#6366f1', JSON.stringify(actions));

      const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(result.lastInsertRowid);

      return res.status(201).json({
        success: true,
        automation: {
          ...automation,
          actions: JSON.parse(automation.actions),
          is_active: automation.is_active === 1,
        },
      });
    } catch (err) {
      console.error('[AUTOMATIONS] Erro ao criar:', err.message);
      return res.status(500).json({ success: false, error: 'Erro ao criar automação.' });
    }
  }
);

// PUT /api/automations/:id - Atualiza automação
router.put(
  '/:id',
  [
    param('id').isInt(),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('actions').optional().isArray({ min: 1 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Automação não encontrada.' });
    }

    const { name, description, icon, color, actions, is_active } = req.body;

    db.prepare(`
      UPDATE automations SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        actions = COALESCE(?, actions),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || null,
      description !== undefined ? description : null,
      icon || null,
      color || null,
      actions ? JSON.stringify(actions) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
    return res.json({
      success: true,
      automation: {
        ...updated,
        actions: JSON.parse(updated.actions),
        is_active: updated.is_active === 1,
      },
    });
  }
);

// DELETE /api/automations/:id - Remove automação
router.delete('/:id', [param('id').isInt()], (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM automations WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Automação não encontrada.' });
  }

  db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
  return res.json({ success: true, message: 'Automação removida.' });
});

// POST /api/automations/:id/run - Executa automação
router.post('/:id/run', [param('id').isInt()], async (req, res) => {
  const db = getDb();
  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);

  if (!automation) {
    return res.status(404).json({ success: false, error: 'Automação não encontrada.' });
  }

  if (!automation.is_active) {
    return res.status(400).json({ success: false, error: 'Automação está desativada.' });
  }

  const actions = JSON.parse(automation.actions || '[]');

  try {
    console.log(`[AUTOMATIONS] Executando: "${automation.name}"`);
    const results = await tuya.executeBatch(actions);

    const hasErrors = results.some(r => !r.success);
    const status = hasErrors ? 'partial' : 'success';
    const message = hasErrors
      ? `Executado com ${results.filter(r => !r.success).length} erro(s)`
      : 'Executado com sucesso';

    // Log da execução
    db.prepare(`
      INSERT INTO automation_logs (automation_id, status, message)
      VALUES (?, ?, ?)
    `).run(automation.id, status, message);

    return res.json({ success: true, status, results, message });
  } catch (err) {
    console.error(`[AUTOMATIONS] Erro ao executar "${automation.name}":`, err.message);

    db.prepare(`
      INSERT INTO automation_logs (automation_id, status, message)
      VALUES (?, ?, ?)
    `).run(automation.id, 'error', err.message);

    return res.status(500).json({ success: false, error: 'Erro ao executar automação.' });
  }
});

// GET /api/automations/:id/logs - Histórico de execuções
router.get('/:id/logs', [param('id').isInt()], (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT * FROM automation_logs 
    WHERE automation_id = ? 
    ORDER BY executed_at DESC 
    LIMIT 20
  `).all(req.params.id);

  return res.json({ success: true, logs });
});

module.exports = router;
