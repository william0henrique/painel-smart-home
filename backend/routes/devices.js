// routes/devices.js - Rotas de dispositivos Tuya
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const tuya = require('../services/tuyaService');
const { getDb } = require('../database/init');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(requireAuth);

// GET /api/devices - Lista todos os dispositivos
router.get('/', async (req, res) => {
  try {
    const devices = await tuya.getDevices();

    // Atualizar cache no banco
    const db = getDb();
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO device_cache (device_id, name, category, online, status, cached_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const upsertMany = db.transaction((devs) => {
      for (const d of devs) {
        upsert.run(d.id, d.name, d.category, d.online ? 1 : 0, JSON.stringify(d.status));
      }
    });

    upsertMany(devices);

    return res.json({ success: true, devices, count: devices.length });
  } catch (err) {
    console.error('[DEVICES] Erro ao listar dispositivos:', err.message);

    // Fallback: retornar cache se API falhar
    try {
      const db = getDb();
      const cached = db.prepare('SELECT * FROM device_cache').all();
      const devices = cached.map(d => ({
        id: d.device_id,
        name: d.name,
        category: d.category,
        online: d.online === 1,
        status: JSON.parse(d.status || '[]'),
        fromCache: true,
      }));

      return res.json({
        success: true,
        devices,
        count: devices.length,
        fromCache: true,
        cacheWarning: 'Dados do cache local (API Tuya indisponível)',
      });
    } catch {
      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar à API Tuya. Verifique as configurações.',
      });
    }
  }
});

// GET /api/devices/test - Testa conexão com Tuya
router.get('/test-connection', async (req, res) => {
  const result = await tuya.testConnection();
  return res.json(result);
});

// GET /api/devices/:id/status - Status de um dispositivo específico
router.get(
  '/:id/status',
  [param('id').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    try {
      const status = await tuya.getDeviceStatus(req.params.id);
      return res.json({ success: true, status });
    } catch (err) {
      console.error(`[DEVICES] Erro ao buscar status ${req.params.id}:`, err.message);
      return res.status(500).json({ success: false, error: 'Erro ao buscar status do dispositivo.' });
    }
  }
);

// POST /api/devices/:id/command - Envia comando para dispositivo
router.post(
  '/:id/command',
  [
    param('id').trim().notEmpty(),
    body('commands').isArray({ min: 1 }).withMessage('Comandos devem ser um array'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      const result = await tuya.sendCommand(req.params.id, req.body.commands);
      return res.json({ success: true, result });
    } catch (err) {
      console.error(`[DEVICES] Erro ao enviar comando:`, err.message);
      return res.status(500).json({ success: false, error: 'Erro ao enviar comando para o dispositivo.' });
    }
  }
);

// POST /api/devices/:id/toggle - Liga/desliga dispositivo
router.post(
  '/:id/toggle',
  [
    param('id').trim().notEmpty(),
    body('state').isBoolean().withMessage('State deve ser boolean'),
    body('type').optional().isIn(['led', 'switch', 'socket']),
    body('switchNum').optional().isInt({ min: 1, max: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { state, type, switchNum } = req.body;

    try {
      let result;

      if (type === 'led') {
        result = await tuya.toggleDevice(req.params.id, state);
      } else {
        result = await tuya.toggleSwitch(req.params.id, state, switchNum || 1);
      }

      return res.json({ success: true, result });
    } catch (err) {
      // Tentar código alternativo se o primeiro falhar
      try {
        const result = await tuya.sendCommand(req.params.id, [{ code: 'switch', value: state }]);
        return res.json({ success: true, result });
      } catch {
        console.error(`[DEVICES] Erro ao toggle:`, err.message);
        return res.status(500).json({ success: false, error: 'Erro ao controlar dispositivo.' });
      }
    }
  }
);

// POST /api/devices/:id/brightness - Ajusta brilho
router.post(
  '/:id/brightness',
  [
    param('id').trim().notEmpty(),
    body('value').isInt({ min: 1, max: 100 }).withMessage('Brilho deve ser entre 1 e 100'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      const result = await tuya.setBrightness(req.params.id, req.body.value);
      return res.json({ success: true, result });
    } catch (err) {
      console.error(`[DEVICES] Erro ao ajustar brilho:`, err.message);
      return res.status(500).json({ success: false, error: 'Erro ao ajustar brilho.' });
    }
  }
);

// POST /api/devices/:id/color - Ajusta cor RGB
router.post(
  '/:id/color',
  [
    param('id').trim().notEmpty(),
    body('h').isInt({ min: 0, max: 360 }),
    body('s').isInt({ min: 0, max: 100 }),
    body('v').isInt({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { h, s, v } = req.body;

    try {
      // Primeiro setar modo cor
      await tuya.setWorkMode(req.params.id, 'colour');
      const result = await tuya.setColor(req.params.id, h, s, v);
      return res.json({ success: true, result });
    } catch (err) {
      console.error(`[DEVICES] Erro ao ajustar cor:`, err.message);
      return res.status(500).json({ success: false, error: 'Erro ao ajustar cor.' });
    }
  }
);

// POST /api/devices/:id/color-temp - Ajusta temperatura de cor
router.post(
  '/:id/color-temp',
  [
    param('id').trim().notEmpty(),
    body('value').isInt({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      await tuya.setWorkMode(req.params.id, 'white');
      const result = await tuya.setColorTemp(req.params.id, req.body.value);
      return res.json({ success: true, result });
    } catch (err) {
      console.error(`[DEVICES] Erro ao ajustar temperatura:`, err.message);
      return res.status(500).json({ success: false, error: 'Erro ao ajustar temperatura de cor.' });
    }
  }
);

// ─────────────────────────────────────────────────
// INTERRUPTORES MULTI-BOTÃO
// ─────────────────────────────────────────────────

// POST /api/devices/:id/switch/:num - Liga/desliga botão específico
router.post(
  '/:id/switch/:num',
  [
    param('id').trim().notEmpty(),
    param('num').isInt({ min: 1, max: 6 }).withMessage('Número do botão deve ser 1-6'),
    body('state').isBoolean().withMessage('State deve ser boolean'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const switchNum = parseInt(req.params.num, 10);
    const { state } = req.body;
    const code = `switch_${switchNum}`;

    try {
      const result = await tuya.sendCommand(req.params.id, [{ code, value: state }]);
      return res.json({ success: true, result, switchNum, state });
    } catch (err) {
      console.error(`[DEVICES] Erro ao controlar switch_${switchNum}:`, err.message);
      return res.status(500).json({ success: false, error: `Erro ao controlar botão ${switchNum}.` });
    }
  }
);

// POST /api/devices/:id/switch-all - Liga/desliga todos os botões de uma vez
router.post(
  '/:id/switch-all',
  [
    param('id').trim().notEmpty(),
    body('state').isBoolean(),
    body('gangCount').isInt({ min: 1, max: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { state, gangCount } = req.body;
    const commands = [];
    for (let i = 1; i <= gangCount; i++) {
      commands.push({ code: `switch_${i}`, value: state });
    }

    try {
      const result = await tuya.sendCommand(req.params.id, commands);
      return res.json({ success: true, result });
    } catch (err) {
      console.error('[DEVICES] Erro ao controlar todos os switches:', err.message);
      return res.status(500).json({ success: false, error: 'Erro ao controlar todos os botões.' });
    }
  }
);

// ─────────────────────────────────────────────────
// CÂMERA
// ─────────────────────────────────────────────────

// POST /api/devices/:id/camera/ptz - Controle PTZ
router.post(
  '/:id/camera/ptz',
  [
    param('id').trim().notEmpty(),
    body('direction').isIn(['up', 'down', 'left', 'right', 'zoom_in', 'zoom_out', 'stop'])
      .withMessage('Direção inválida'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    try {
      const result = await tuya.cameraPtz(req.params.id, req.body.direction);
      return res.json({ success: true, result });
    } catch (err) {
      console.error('[CAMERA] Erro PTZ:', err.message);
      return res.status(500).json({ success: false, error: 'Erro no controle PTZ.' });
    }
  }
);

// POST /api/devices/:id/camera/floodlight - Luz de inundação
router.post('/:id/camera/floodlight', [param('id').trim().notEmpty(), body('state').isBoolean()],
  async (req, res) => {
    try {
      const result = await tuya.cameraFloodLight(req.params.id, req.body.state);
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao controlar luz.' });
    }
  }
);

// POST /api/devices/:id/camera/siren - Sirene
router.post('/:id/camera/siren', [param('id').trim().notEmpty(), body('state').isBoolean()],
  async (req, res) => {
    try {
      const result = await tuya.cameraSiren(req.params.id, req.body.state);
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao controlar sirene.' });
    }
  }
);

// POST /api/devices/:id/camera/motion - Detecção de movimento
router.post('/:id/camera/motion', [param('id').trim().notEmpty(), body('state').isBoolean()],
  async (req, res) => {
    try {
      const result = await tuya.cameraMotionDetect(req.params.id, req.body.state);
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao configurar detecção de movimento.' });
    }
  }
);

// POST /api/devices/:id/camera/privacy - Modo privacidade
router.post('/:id/camera/privacy', [param('id').trim().notEmpty(), body('state').isBoolean()],
  async (req, res) => {
    try {
      const result = await tuya.cameraPrivacyMode(req.params.id, req.body.state);
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao configurar privacidade.' });
    }
  }
);

// POST /api/devices/:id/camera/nightvision - Visão noturna
router.post(
  '/:id/camera/nightvision',
  [param('id').trim().notEmpty(), body('mode').isIn(['auto', 'on', 'off'])],
  async (req, res) => {
    try {
      const result = await tuya.cameraNightVision(req.params.id, req.body.mode);
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao configurar visão noturna.' });
    }
  }
);

// GET /api/devices/:id/camera/snapshot - Tirar foto
router.get('/:id/camera/snapshot', [param('id').trim().notEmpty()],
  async (req, res) => {
    try {
      const url = await tuya.cameraSnapshot(req.params.id);
      if (url) {
        return res.json({ success: true, url });
      }
      return res.status(404).json({ success: false, error: 'Snapshot não disponível para este modelo.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao capturar snapshot.' });
    }
  }
);

module.exports = router;
