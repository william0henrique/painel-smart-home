// services/tuyaService.js - Integração completa com Tuya Cloud API
const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyabr1.com';
const CLIENT_ID = process.env.TUYA_CLIENT_ID;
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET;

// Cache de token para evitar requisições desnecessárias
let tokenCache = {
  access_token: null,
  expire_time: 0,
};

/**
 * Gera assinatura HMAC-SHA256 para autenticação Tuya
 */
function generateSign(clientId, secret, t, accessToken, method, path, body = '') {
  const contentHash = crypto
    .createHash('sha256')
    .update(body)
    .digest('hex');

  const stringToSign = [method, contentHash, '', path].join('\n');
  const signStr = clientId + (accessToken || '') + t + stringToSign;

  return crypto
    .createHmac('sha256', secret)
    .update(signStr)
    .digest('hex')
    .toUpperCase();
}

/**
 * Obtém token de acesso da Tuya (com cache)
 */
async function getAccessToken() {
  const now = Date.now();

  // Verificar se token ainda é válido (com 5 min de margem)
  if (tokenCache.access_token && tokenCache.expire_time > now + 300000) {
    return tokenCache.access_token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('TUYA_CLIENT_ID e TUYA_CLIENT_SECRET não configurados no .env');
  }

  const t = now.toString();
  const sign = generateSign(CLIENT_ID, CLIENT_SECRET, t, '', 'GET', '/v1.0/token?grant_type=1');

  try {
    const response = await axios.get(`${BASE_URL}/v1.0/token?grant_type=1`, {
      headers: {
        client_id: CLIENT_ID,
        sign: sign,
        t: t,
        sign_method: 'HMAC-SHA256',
      },
      timeout: 10000,
    });

    if (!response.data.success) {
      throw new Error(`Tuya Auth Error: ${response.data.msg || 'Falha na autenticação'}`);
    }

    const { access_token, expire_time } = response.data.result;

    tokenCache = {
      access_token,
      expire_time: now + (expire_time * 1000),
    };

    return access_token;
  } catch (err) {
    if (err.response) {
      throw new Error(`Erro na API Tuya: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

/**
 * Faz requisição autenticada para a API Tuya
 */
async function tuyaRequest(method, path, body = null) {
  const accessToken = await getAccessToken();
  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';

  const sign = generateSign(
    CLIENT_ID,
    CLIENT_SECRET,
    t,
    accessToken,
    method.toUpperCase(),
    path,
    bodyStr
  );

  const config = {
    method: method.toUpperCase(),
    url: `${BASE_URL}${path}`,
    headers: {
      client_id: CLIENT_ID,
      access_token: accessToken,
      sign: sign,
      t: t,
      sign_method: 'HMAC-SHA256',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  };

  if (body) {
    config.data = body;
  }

  const response = await axios(config);

  if (!response.data.success) {
    const errCode = response.data.code;
    const errMsg = response.data.msg;

    // Tratar erro de token expirado
    if (errCode === 1010) {
      tokenCache = { access_token: null, expire_time: 0 };
      throw new Error('TOKEN_EXPIRED');
    }

    throw new Error(`Tuya API Error [${errCode}]: ${errMsg}`);
  }

  return response.data.result;
}

/**
 * Busca lista de dispositivos da conta Tuya
 */
async function getDevices() {
  try {
    // Buscar usuários da conta (necessário para listar dispositivos)
    const usersResult = await tuyaRequest('GET', '/v1.0/iot-01/associated-users/devices?page_size=50');

    // Formatar dispositivos
    const devices = (usersResult?.list || usersResult?.devices || []).map(formatDevice);
    return devices;
  } catch (err) {
    // Tentar endpoint alternativo
    try {
      const result = await tuyaRequest('GET', '/v1.1/iot-01/associated-users/devices?page_size=50');
      return (result?.list || []).map(formatDevice);
    } catch {
      throw err;
    }
  }
}

/**
 * Formata dispositivo para padrão do painel
 * Detecta automaticamente capacidades (gang count, sensor type, etc.)
 */
function formatDevice(device) {
  const status = device.status || [];
  const category = mapCategory(device.category);

  // --- Detectar número de botões em interruptores multi-gang ---
  // Procura por switch_1, switch_2 ... switch_6 nos status
  const switchKeys = status
    .map(s => s.code)
    .filter(c => /^switch_\d+$/.test(c))
    .map(c => parseInt(c.replace('switch_', ''), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  const gangCount = switchKeys.length > 0 ? Math.max(...switchKeys) : 1;

  // --- Detectar nomes dos botões (se disponíveis no status) ---
  const switchNames = {};
  for (let i = 1; i <= gangCount; i++) {
    // Tuya às vezes expõe rótulos via 'switch_name_1' ou similar
    const nameEntry = status.find(s => s.code === `switch_name_${i}` || s.code === `name_${i}`);
    switchNames[i] = nameEntry?.value || `Botão ${i}`;
  }

  // --- Detectar capacidades de câmera ---
  const cameraFeatures = {
    hasPtz: status.some(s => ['ptz_stop', 'ptz_control', 'zoom_control'].includes(s.code)),
    hasMotionDetect: status.some(s => ['motion_switch', 'motion_sensitivity'].includes(s.code)),
    hasNightVision: status.some(s => ['basic_nightvision', 'ir_switch'].includes(s.code)),
    hasFloodLight: status.some(s => ['floodlight_switch', 'floodlight_lightness'].includes(s.code)),
    hasSiren: status.some(s => ['siren_switch', 'alarm_switch'].includes(s.code)),
    hasPrivacyMode: status.some(s => s.code === 'basic_private'),
    hasFlip: status.some(s => ['basic_flip', 'basic_osd'].includes(s.code)),
    motionDetect: status.find(s => s.code === 'motion_switch')?.value ?? false,
    nightVision: status.find(s => s.code === 'basic_nightvision')?.value ?? 'auto',
    privacyMode: status.find(s => s.code === 'basic_private')?.value ?? false,
    floodLight: status.find(s => s.code === 'floodlight_switch')?.value ?? false,
    siren: status.find(s => s.code === 'siren_switch' || s.code === 'alarm_switch')?.value ?? false,
  };

  // --- Detectar tipo de sensor de porta/contato ---
  const doorSensorState = category === 'door_sensor'
    ? (status.find(s => s.code === 'doorcontact_state' || s.code === 'contact' || s.code === 'state')?.value ?? null)
    : null;

  // --- Detectar sensor de movimento ---
  const motionState = category === 'motion_sensor'
    ? (status.find(s => s.code === 'pir' || s.code === 'motion_state' || s.code === 'occupancy')?.value ?? null)
    : null;

  return {
    id: device.id || device.device_id,
    name: device.name || device.device_name || 'Dispositivo sem nome',
    category,
    categoryRaw: device.category,
    online: device.online || false,
    icon: device.icon || null,
    productName: device.product_name || '',
    status,
    model: device.model || '',
    sub: device.sub || false,
    timeZone: device.time_zone || '',
    updateTime: device.update_time || 0,
    createTime: device.create_time || 0,
    // Capacidades detectadas automaticamente
    gangCount,          // Número de botões no interruptor (1,2,3...)
    switchNames,        // Labels dos botões { 1: 'Sala', 2: 'Quarto' }
    cameraFeatures,     // Capacidades de câmera
    doorSensorState,    // 'open' | 'closed' | null
    motionState,        // true | false | null
  };
}

/**
 * Mapeia categorias Tuya para categorias do painel
 */
function mapCategory(category) {
  const categoryMap = {
    // Luzes
    'dj': 'light',      // Lâmpada colorida RGB
    'dd': 'light',      // Fita de LED
    'fwd': 'light',     // Lâmpada flood
    'dc': 'light',      // Controlador de LED
    'xdd': 'light',     // Downlight
    'sl': 'light',      // Luz solar
    'ykq': 'light',     // Controle remoto luz
    'fs': 'light',      // Ventilador com luz
    'fsd': 'light',     // Luminária ventilador
    'tgq': 'light',     // Dimmer
    'gyd': 'light',     // Lâmpada com sensor de movimento
    'sxd': 'light',     // Luz de emergência

    // Tomadas/Plugues
    'cz': 'socket',     // Tomada/plug
    'pc': 'socket',     // Régua de tomadas
    'kg': 'socket',     // Tomada básica

    // Interruptores (qualquer número de botões)
    'tdq': 'switch',    // Interruptor (1,2,3,4 gang)
    'tgkg': 'switch',   // Interruptor com timer
    'wzkg': 'switch',   // Interruptor sem fio
    'wxkg': 'switch',   // Interruptor sem fio (variante)
    'ckmkzq': 'switch', // Controlador multi-canal
    'dlq': 'switch',    // Disjuntor inteligente

    // Câmeras e visão
    'sp': 'camera',     // Câmera IP / RTSP
    'dghsxj': 'camera', // Câmera de segurança
    'sgbj': 'camera',   // Câmera com alarme

    // Sensores de porta/janela
    'mcs': 'door_sensor',  // Sensor de contato (porta/janela)
    'ms': 'door_sensor',   // Sensor magnético

    // Sensores de movimento e presença
    'pir': 'motion_sensor',  // Sensor PIR
    'hps': 'motion_sensor',  // Sensor de presença
    'ldcg': 'motion_sensor', // Sensor de luminosidade+movimento

    // Sensores de ambiente
    'wsdcg': 'climate',  // Sensor temperatura/umidade
    'rs': 'climate',     // Termostato
    'kt': 'climate',     // Ar condicionado

    // Alarmes / segurança
    'jtmspro': 'security',
    'mc': 'security',   // Sensor de movimento (alarme)
    'sq': 'security',   // Sensor de fumaça/gás
    'cobj': 'security', // Sensor CO
    'jwbj': 'security', // Detector de inundação
    'rqbj': 'security', // Detector de gás

    // Cortinas
    'clkg': 'curtain',  // Controle de cortina
    'cl': 'curtain',    // Motor de cortina
    'cldl': 'curtain',  // Cortina motorizada

    // Outros
    'bh': 'other',
    'qn': 'other',
  };

  return categoryMap[category] || 'other';
}

/**
 * Busca status detalhado de um dispositivo
 */
async function getDeviceStatus(deviceId) {
  return await tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`);
}

/**
 * Envia comando para um dispositivo
 */
async function sendCommand(deviceId, commands) {
  // Normalizar: aceita array ou objeto único
  const commandList = Array.isArray(commands) ? commands : [commands];

  return await tuyaRequest('POST', `/v1.0/devices/${deviceId}/commands`, {
    commands: commandList,
  });
}

/**
 * Liga ou desliga um dispositivo
 */
async function toggleDevice(deviceId, state) {
  return await sendCommand(deviceId, { code: 'switch_led', value: state });
}

/**
 * Liga/desliga tomada ou interruptor simples
 */
async function toggleSwitch(deviceId, state, switchNum = 1) {
  const code = switchNum === 1 ? 'switch_1' : `switch_${switchNum}`;
  return await sendCommand(deviceId, { code, value: state });
}

/**
 * Ajusta brilho de uma lâmpada (0-1000 Tuya scale)
 */
async function setBrightness(deviceId, brightness) {
  // Tuya usa escala 10-1000
  const tuyaBrightness = Math.max(10, Math.min(1000, Math.round(brightness * 10)));
  return await sendCommand(deviceId, { code: 'bright_value_v2', value: tuyaBrightness });
}

/**
 * Ajusta temperatura de cor (warm/cold) em lâmpadas
 */
async function setColorTemp(deviceId, temp) {
  // Tuya usa escala 0-1000 (0=quente, 1000=frio)
  const tuyaTemp = Math.max(0, Math.min(1000, Math.round(temp * 10)));
  return await sendCommand(deviceId, { code: 'temp_value_v2', value: tuyaTemp });
}

/**
 * Ajusta cor RGB de uma lâmpada colorida
 */
async function setColor(deviceId, hue, saturation, value) {
  // Formato Tuya HSV
  return await sendCommand(deviceId, {
    code: 'colour_data_v2',
    value: {
      h: Math.max(0, Math.min(360, Math.round(hue))),
      s: Math.max(0, Math.min(1000, Math.round(saturation * 10))),
      v: Math.max(0, Math.min(1000, Math.round(value * 10))),
    },
  });
}

/**
 * Define modo de trabalho da lâmpada (white, colour, scene, music)
 */
async function setWorkMode(deviceId, mode) {
  return await sendCommand(deviceId, { code: 'work_mode', value: mode });
}

/**
 * Busca detalhes completos de um dispositivo
 */
async function getDeviceDetail(deviceId) {
  return await tuyaRequest('GET', `/v1.0/devices/${deviceId}`);
}

/**
 * Executa múltiplos comandos em batch para automações
 */
async function executeBatch(actions) {
  const results = [];

  for (const action of actions) {
    try {
      let result;

      switch (action.type) {
        case 'toggle':
          result = await toggleDevice(action.deviceId, action.value);
          break;
        case 'switch':
          result = await toggleSwitch(action.deviceId, action.value, action.switchNum || 1);
          break;
        case 'switchGang': {
          // Botão específico de interruptor multi-gang
          const gangNum = action.gangNum || action.switchNum || 1;
          result = await sendCommand(action.deviceId, [{ code: `switch_${gangNum}`, value: action.value }]);
          break;
        }
        case 'brightness':
          result = await setBrightness(action.deviceId, action.value);
          break;
        case 'color':
          result = await setColor(action.deviceId, action.h, action.s, action.v);
          break;
        case 'colorTemp':
          result = await setColorTemp(action.deviceId, action.value);
          break;
        case 'command':
          result = await sendCommand(action.deviceId, action.commands);
          break;
        // Câmera
        case 'camMotion':
          result = await cameraMotionDetect(action.deviceId, action.value);
          break;
        case 'camSiren':
          result = await cameraSiren(action.deviceId, action.value);
          break;
        case 'camFlood':
          result = await cameraFloodLight(action.deviceId, action.value);
          break;
        case 'camPrivacy':
          result = await cameraPrivacyMode(action.deviceId, action.value);
          break;
        default:
          throw new Error(`Tipo de ação desconhecido: ${action.type}`);
      }

      results.push({ success: true, action, result });

      // Pequeno delay entre comandos para não sobrecarregar a API
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      results.push({ success: false, action, error: err.message });
    }
  }

  return results;
}

/**
 * Controle PTZ de câmera (pan/tilt/zoom)
 * direction: 'up','down','left','right','zoom_in','zoom_out','stop'
 */
async function cameraPtz(deviceId, direction) {
  const dirMap = {
    up: '0',
    down: '1',
    left: '2',
    right: '3',
    zoom_in: '4',
    zoom_out: '5',
    stop: 'stop',
  };

  if (direction === 'stop') {
    return await sendCommand(deviceId, { code: 'ptz_stop', value: true });
  }

  return await sendCommand(deviceId, { code: 'ptz_control', value: dirMap[direction] || '0' });
}

/**
 * Liga/desliga luz de inundação da câmera
 */
async function cameraFloodLight(deviceId, state) {
  return await sendCommand(deviceId, { code: 'floodlight_switch', value: state });
}

/**
 * Liga/desliga sirene da câmera
 */
async function cameraSiren(deviceId, state) {
  try {
    return await sendCommand(deviceId, { code: 'siren_switch', value: state });
  } catch {
    return await sendCommand(deviceId, { code: 'alarm_switch', value: state });
  }
}

/**
 * Ativa/desativa detecção de movimento da câmera
 */
async function cameraMotionDetect(deviceId, state) {
  return await sendCommand(deviceId, { code: 'motion_switch', value: state });
}

/**
 * Ativa/desativa modo privacidade da câmera (tampa a lente)
 */
async function cameraPrivacyMode(deviceId, state) {
  return await sendCommand(deviceId, { code: 'basic_private', value: state });
}

/**
 * Visão noturna da câmera: 'auto' | 'on' | 'off'
 */
async function cameraNightVision(deviceId, mode) {
  return await sendCommand(deviceId, { code: 'basic_nightvision', value: mode });
}

/**
 * Retorna URL de snapshot da câmera (via Tuya Cloud)
 * Nem todos os modelos suportam — retorna null se falhar
 */
async function cameraSnapshot(deviceId) {
  try {
    // O endpoint real varia por modelo/versão Tuya
    const result = await tuyaRequest('POST', `/v1.0/devices/${deviceId}/camera/snapshot`, {});
    return result?.url || null;
  } catch {
    return null;
  }
}

/**
 * Testa conexão com a API Tuya
 */
async function testConnection() {
  try {
    await getAccessToken();
    return { connected: true, message: 'Conexão com Tuya API estabelecida com sucesso' };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

module.exports = {
  getDevices,
  getDeviceStatus,
  getDeviceDetail,
  sendCommand,
  toggleDevice,
  toggleSwitch,
  setBrightness,
  setColorTemp,
  setColor,
  setWorkMode,
  executeBatch,
  testConnection,
  // Câmera
  cameraPtz,
  cameraFloodLight,
  cameraSiren,
  cameraMotionDetect,
  cameraPrivacyMode,
  cameraNightVision,
  cameraSnapshot,
};
