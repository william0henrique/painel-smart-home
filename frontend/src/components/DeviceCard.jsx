// src/components/DeviceCard.jsx
// Suporta: lâmpadas RGB, interruptores multi-botão (1-6 gang),
//          câmeras PTZ, sensores de porta, sensores de movimento,
//          tomadas, clima, e dispositivos genéricos.
import { useState, useCallback } from 'react';
import {
  Lightbulb, Plug, ToggleLeft, Thermometer, Camera, Shield,
  Sun, Palette, ChevronDown, ChevronUp, Loader2,
  DoorOpen, DoorClosed, Eye, EyeOff, Activity, Power, Wind,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ZoomIn, ZoomOut, StopCircle,
} from 'lucide-react';
import { devicesAPI } from '../services/api';
import './DeviceCard.css';

// ── Configuração visual por categoria ─────────────────────────────
const CATEGORY_CONFIG = {
  light:         { icon: Lightbulb,  label: 'Lâmpada',      color: '#fbbf24', glow: 'rgba(251,191,36,0.3)' },
  socket:        { icon: Plug,       label: 'Tomada',        color: '#34d399', glow: 'rgba(52,211,153,0.3)' },
  switch:        { icon: ToggleLeft, label: 'Interruptor',   color: '#4f8ef7', glow: 'rgba(79,142,247,0.3)' },
  climate:       { icon: Thermometer,label: 'Clima',         color: '#22d3ee', glow: 'rgba(34,211,238,0.3)' },
  camera:        { icon: Camera,     label: 'Câmera',        color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
  door_sensor:   { icon: DoorClosed, label: 'Sensor Porta',  color: '#fb923c', glow: 'rgba(251,146,60,0.3)' },
  motion_sensor: { icon: Activity,   label: 'Sensor Mov.',   color: '#f472b6', glow: 'rgba(244,114,182,0.3)' },
  security:      { icon: Shield,     label: 'Segurança',     color: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  curtain:       { icon: Wind,       label: 'Cortina',       color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' },
  other:         { icon: Plug,       label: 'Dispositivo',   color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' },
};

const COLOR_PRESETS = [
  { label: 'Branco',   h: 0,   s: 0,   v: 100, bg: '#ffffff' },
  { label: 'Quente',   h: 30,  s: 80,  v: 100, bg: '#ffb347' },
  { label: 'Vermelho', h: 0,   s: 100, v: 100, bg: '#ff4444' },
  { label: 'Verde',    h: 120, s: 100, v: 80,  bg: '#44ff44' },
  { label: 'Azul',     h: 240, s: 100, v: 100, bg: '#4488ff' },
  { label: 'Roxo',     h: 280, s: 100, v: 100, bg: '#aa44ff' },
  { label: 'Rosa',     h: 320, s: 100, v: 100, bg: '#ff44aa' },
  { label: 'Ciano',    h: 180, s: 100, v: 100, bg: '#44ffff' },
];

function getVal(status, codes) {
  if (!Array.isArray(status)) return null;
  for (const code of codes) {
    const found = status.find(s => s.code === code);
    if (found !== undefined) return found?.value ?? null;
  }
  return null;
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : '148,163,184';
}

// ── Toggle reutilizável ────────────────────────────────────────────
function SwitchToggle({ checked, disabled, loading, onChange, color }) {
  return (
    <label className={`toggle-switch ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={!!checked} onChange={onChange} disabled={disabled} />
      <div
        className="toggle-track"
        style={checked && color ? { background: `${color}44`, borderColor: `${color}88` } : {}}
      />
      <div
        className="toggle-thumb"
        style={checked && color ? { background: color } : {}}
      />
      {loading && <Loader2 size={14} className="toggle-loader" />}
    </label>
  );
}

// ── Cabeçalho reutilizável ─────────────────────────────────────────
function CardHeader({ device, cfg, statusText, children }) {
  const Icon = cfg.icon;
  return (
    <div className="device-header">
      <div className="device-icon-wrap" style={{ background: `rgba(${hexToRgb(cfg.color)},0.15)` }}>
        <Icon size={22} style={{ color: cfg.color }} />
      </div>
      <div className="device-info">
        <h3 className="device-name" title={device.name}>{device.name}</h3>
        <div className="device-meta">
          <span className={`status-dot ${device.online ? 'online' : 'offline'}`} />
          <span className="device-status-text">{statusText}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  ROTEADOR PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function DeviceCard({ device, onToast }) {
  const cfg = CATEGORY_CONFIG[device.category] || CATEGORY_CONFIG.other;

  switch (device.category) {
    case 'switch':        return <SwitchCard       device={device} cfg={cfg} onToast={onToast} />;
    case 'light':         return <LightCard         device={device} cfg={cfg} onToast={onToast} />;
    case 'camera':        return <CameraCard        device={device} cfg={cfg} onToast={onToast} />;
    case 'door_sensor':   return <DoorSensorCard    device={device} cfg={cfg} onToast={onToast} />;
    case 'motion_sensor': return <MotionSensorCard  device={device} cfg={cfg} onToast={onToast} />;
    default:              return <GenericCard        device={device} cfg={cfg} onToast={onToast} />;
  }
}

// ══════════════════════════════════════════════════════════════════
//  INTERRUPTOR MULTI-BOTÃO (1–6 gang)
// ══════════════════════════════════════════════════════════════════
function SwitchCard({ device, cfg, onToast }) {
  const gangCount   = device.gangCount   || 1;
  const switchNames = device.switchNames || {};

  const initStates = () => {
    const s = {};
    for (let i = 1; i <= gangCount; i++) {
      const entry = device.status?.find(x => x.code === `switch_${i}`);
      s[i] = entry?.value ?? false;
    }
    return s;
  };

  const [states, setStates]     = useState(initStates);
  const [loading, setLoading]   = useState(null); // número do gang ou 'all'
  const [expanded, setExpanded] = useState(false);

  const toggleGang = async (num) => {
    if (!device.online || loading) return;
    const next = !states[num];
    setLoading(num);
    setStates(p => ({ ...p, [num]: next }));
    try {
      await devicesAPI.switchGang(device.id, num, next);
      onToast?.(`${switchNames[num] || `Botão ${num}`} ${next ? 'ligado' : 'desligado'}`, 'success');
    } catch {
      setStates(p => ({ ...p, [num]: !next }));
      onToast?.('Erro ao controlar botão', 'error');
    } finally { setLoading(null); }
  };

  const toggleAll = async (target) => {
    if (!device.online || loading) return;
    const prev = { ...states };
    const next = {};
    for (let i = 1; i <= gangCount; i++) next[i] = target;
    setLoading('all');
    setStates(next);
    try {
      await devicesAPI.switchAll(device.id, target, gangCount);
      onToast?.(`Todos ${target ? 'ligados' : 'desligados'}`, 'success');
    } catch {
      setStates(prev);
      onToast?.('Erro ao controlar dispositivo', 'error');
    } finally { setLoading(null); }
  };

  const anyOn = Object.values(states).some(Boolean);
  const allOn = Object.values(states).every(Boolean);
  const onCount = Object.values(states).filter(Boolean).length;

  const statusText = !device.online
    ? 'Offline'
    : gangCount === 1
      ? (anyOn ? 'Ligado' : 'Desligado')
      : `${onCount}/${gangCount} ligados`;

  return (
    <div
      className={`device-card glass-card ${anyOn ? 'device-on' : ''} ${!device.online ? 'device-offline' : ''}`}
      style={{ '--card-color': cfg.color, '--card-glow': cfg.glow }}
    >
      <CardHeader device={device} cfg={cfg} statusText={statusText}>
        {/* Toggle direto no header apenas quando há 1 botão */}
        {gangCount === 1 && (
          <SwitchToggle
            checked={states[1]}
            disabled={!device.online || !!loading}
            loading={loading === 1}
            onChange={() => toggleGang(1)}
          />
        )}
      </CardHeader>

      {gangCount > 1 && (
        <>
          <button className="device-expand-btn" onClick={() => setExpanded(v => !v)}>
            <span>{gangCount} botões independentes</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div className="device-controls">
              {/* Ação rápida — tudo */}
              <div className="multi-switch-all">
                <button
                  className="btn btn-sm btn-ghost multi-all-btn"
                  onClick={() => toggleAll(false)}
                  disabled={!device.online || !anyOn || loading === 'all'}
                >
                  <Power size={13} /> Desligar tudo
                </button>
                <button
                  className="btn btn-sm btn-ghost multi-all-btn"
                  onClick={() => toggleAll(true)}
                  disabled={!device.online || allOn || loading === 'all'}
                >
                  <Power size={13} /> Ligar tudo
                </button>
              </div>

              {/* Um toggle por botão */}
              {Array.from({ length: gangCount }, (_, i) => i + 1).map(num => (
                <div key={num} className="gang-row">
                  <div className="gang-label">
                    <span
                      className="gang-num"
                      style={{ background: states[num] ? `${cfg.color}33` : undefined,
                               borderColor: states[num] ? `${cfg.color}66` : undefined,
                               color: states[num] ? cfg.color : undefined }}
                    >
                      {num}
                    </span>
                    <span className="gang-name">{switchNames[num] || `Botão ${num}`}</span>
                    {states[num] && <span className="gang-on-dot" style={{ background: cfg.color }} />}
                  </div>
                  <SwitchToggle
                    checked={states[num]}
                    disabled={!device.online || (loading !== null && loading !== num)}
                    loading={loading === num}
                    onChange={() => toggleGang(num)}
                    color={cfg.color}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="device-badge">
        {cfg.label}{gangCount > 1 ? ` · ${gangCount} gang` : ''}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  LÂMPADA (brilho, temp. cor, RGB)
// ══════════════════════════════════════════════════════════════════
function LightCard({ device, cfg, onToast }) {
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ls, setLs]             = useState(device.status || []);

  const isOn      = getVal(ls, ['switch_led', 'switch_1', 'switch']);
  const bright    = getVal(ls, ['bright_value_v2', 'bright_value']);
  const colorTemp = getVal(ls, ['temp_value_v2', 'temp_value']);
  const hasColor  = ls.some(s => ['colour_data_v2', 'colour_data'].includes(s.code));
  const hasBright = ls.some(s => ['bright_value_v2', 'bright_value'].includes(s.code));
  const hasCTemp  = ls.some(s => ['temp_value_v2', 'temp_value'].includes(s.code));

  const upd = (code, value) => setLs(prev => {
    const i = prev.findIndex(s => s.code === code);
    if (i >= 0) { const n = [...prev]; n[i] = { code, value }; return n; }
    return [...prev, { code, value }];
  });

  const handleToggle = async () => {
    if (!device.online || loading) return;
    setLoading(true);
    const next = !isOn;
    const code = ls.find(s => s.code === 'switch_led') ? 'switch_led' : 'switch_1';
    upd(code, next);
    try {
      await devicesAPI.toggle(device.id, next, 'led');
      onToast?.(`${device.name} ${next ? 'ligada' : 'desligada'}`, 'success');
    } catch { upd(code, !next); onToast?.('Erro ao controlar lâmpada', 'error'); }
    finally { setLoading(false); }
  };

  const handleBright = async (v) => {
    upd('bright_value_v2', v * 10);
    try { await devicesAPI.setBrightness(device.id, v); }
    catch { onToast?.('Erro no brilho', 'error'); }
  };

  const handleCTemp = async (v) => {
    upd('temp_value_v2', v * 10);
    try { await devicesAPI.setColorTemp(device.id, v); }
    catch { onToast?.('Erro na temperatura', 'error'); }
  };

  const handleColor = async (h, s, v) => {
    try { await devicesAPI.setColor(device.id, h, s, v); onToast?.('Cor aplicada!', 'success'); }
    catch { onToast?.('Erro na cor', 'error'); }
  };

  const bPct = bright    ? Math.round(bright / 10)    : 100;
  const tPct = colorTemp ? Math.round(colorTemp / 10) : 50;

  return (
    <div
      className={`device-card glass-card ${isOn ? 'device-on' : ''} ${!device.online ? 'device-offline' : ''}`}
      style={{ '--card-color': cfg.color, '--card-glow': cfg.glow }}
    >
      <CardHeader device={device} cfg={cfg} statusText={!device.online ? 'Offline' : isOn ? 'Ligada' : 'Desligada'}>
        <SwitchToggle checked={!!isOn} disabled={!device.online || loading} loading={loading} onChange={handleToggle} />
      </CardHeader>

      {device.online && (hasBright || hasCTemp || hasColor) && (
        <>
          <button className="device-expand-btn" onClick={() => setExpanded(v => !v)}>
            <span>Controles de luz</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <div className="device-controls">
              {hasBright && (
                <div className="control-group">
                  <div className="control-label">
                    <Sun size={14} /><span>Brilho</span>
                    <span className="control-value">{bPct}%</span>
                  </div>
                  <input type="range" className="slider-range" min="1" max="100" value={bPct}
                    onChange={e => handleBright(+e.target.value)}
                    style={{ background: `linear-gradient(to right,var(--accent-amber) 0%,var(--accent-amber) ${bPct}%,rgba(255,255,255,0.1) ${bPct}%,rgba(255,255,255,0.1) 100%)` }}
                  />
                </div>
              )}
              {hasCTemp && (
                <div className="control-group">
                  <div className="control-label">
                    <span>🌡️</span><span>Temperatura</span>
                    <span className="control-value">{tPct > 50 ? 'Fria' : 'Quente'}</span>
                  </div>
                  <input type="range" className="slider-range colortemp-slider" min="0" max="100" value={tPct}
                    onChange={e => handleCTemp(+e.target.value)} />
                </div>
              )}
              {hasColor && (
                <div className="control-group">
                  <div className="control-label"><Palette size={14} /><span>Cor</span></div>
                  <div className="color-presets">
                    {COLOR_PRESETS.map(p => (
                      <button key={p.label} className="color-preset-btn"
                        style={{ background: p.bg }} title={p.label}
                        onClick={() => handleColor(p.h, p.s, p.v)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="device-badge">{cfg.label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  CÂMERA — PTZ + feature toggles
// ══════════════════════════════════════════════════════════════════
function CameraCard({ device, cfg, onToast }) {
  const feat = device.cameraFeatures || {};
  const [expanded, setExpanded]     = useState(false);
  const [ptzLoading, setPtzLoading] = useState(false);
  const [toggling, setToggling]     = useState(null);

  const [camState, setCamState] = useState({
    motionDetect: feat.motionDetect ?? false,
    nightVision:  feat.nightVision  ?? 'auto',
    privacyMode:  feat.privacyMode  ?? false,
    floodLight:   feat.floodLight   ?? false,
    siren:        feat.siren        ?? false,
  });

  const ptz = async (dir) => {
    if (!device.online || ptzLoading) return;
    setPtzLoading(true);
    try { await devicesAPI.cameraPtz(device.id, dir); }
    catch { onToast?.('Erro no PTZ', 'error'); }
    finally { setPtzLoading(false); }
  };

  const toggleFeat = async (key, apiCall, labelOn, labelOff) => {
    if (!device.online || toggling) return;
    const next = !camState[key];
    setToggling(key);
    setCamState(s => ({ ...s, [key]: next }));
    try {
      await apiCall(device.id, next);
      onToast?.(next ? labelOn : labelOff, 'success');
    } catch {
      setCamState(s => ({ ...s, [key]: !next }));
      onToast?.('Erro ao configurar câmera', 'error');
    } finally { setToggling(null); }
  };

  const cycleNight = async () => {
    if (!device.online || toggling) return;
    const modes = ['auto', 'on', 'off'];
    const next = modes[(modes.indexOf(camState.nightVision) + 1) % modes.length];
    setToggling('nightVision');
    setCamState(s => ({ ...s, nightVision: next }));
    try { await devicesAPI.cameraNightVision(device.id, next); onToast?.(`Visão noturna: ${next}`, 'success'); }
    catch { onToast?.('Erro na visão noturna', 'error'); }
    finally { setToggling(null); }
  };

  const nvLabels = { auto: '🌙 Auto', on: '🌙 On', off: '🌙 Off' };

  const hasAnyControl = feat.hasPtz || feat.hasMotionDetect || feat.hasNightVision ||
                        feat.hasFloodLight || feat.hasSiren || feat.hasPrivacyMode;

  return (
    <div
      className={`device-card glass-card camera-card ${!device.online ? 'device-offline' : ''}`}
      style={{ '--card-color': cfg.color, '--card-glow': cfg.glow }}
    >
      <CardHeader device={device} cfg={cfg} statusText={device.online ? 'Online' : 'Offline'}>
        <button className="btn-icon" title="Capturar foto"
          onClick={async () => {
            try {
              const r = await devicesAPI.cameraSnapshot(device.id);
              if (r.data.url) window.open(r.data.url, '_blank');
              else onToast?.('Snapshot indisponível para este modelo', 'info');
            } catch { onToast?.('Erro ao capturar foto', 'error'); }
          }}
        >
          <Camera size={16} />
        </button>
      </CardHeader>

      {/* Status badges */}
      <div className="camera-badges">
        {camState.privacyMode && <span className="cam-badge badge-privacy">🔒 Privacidade</span>}
        {camState.motionDetect && <span className="cam-badge badge-motion">📡 Movimento ativo</span>}
        {camState.siren && <span className="cam-badge badge-siren">🔊 Sirene</span>}
        {camState.floodLight && <span className="cam-badge badge-flood">💡 Luz ligada</span>}
      </div>

      <button className="device-expand-btn" onClick={() => setExpanded(v => !v)}>
        <span>Controles da câmera</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="device-controls">
          {/* PTZ pad */}
          {feat.hasPtz && (
            <div className="control-group">
              <div className="control-label"><span>🕹️</span><span>Mover câmera (PTZ)</span></div>
              <div className="ptz-pad">
                <div className="ptz-row">
                  <div />
                  <button className="ptz-btn" disabled={!device.online || ptzLoading} onClick={() => ptz('up')}><ArrowUp size={16} /></button>
                  <div />
                </div>
                <div className="ptz-row">
                  <button className="ptz-btn" disabled={!device.online || ptzLoading} onClick={() => ptz('left')}><ArrowLeft size={16} /></button>
                  <button className="ptz-btn ptz-stop" disabled={!device.online || ptzLoading} onClick={() => ptz('stop')}><StopCircle size={16} /></button>
                  <button className="ptz-btn" disabled={!device.online || ptzLoading} onClick={() => ptz('right')}><ArrowRight size={16} /></button>
                </div>
                <div className="ptz-row">
                  <button className="ptz-btn" disabled={!device.online || ptzLoading} onClick={() => ptz('zoom_out')}><ZoomOut size={15} /></button>
                  <button className="ptz-btn" disabled={!device.online || ptzLoading} onClick={() => ptz('down')}><ArrowDown size={16} /></button>
                  <button className="ptz-btn" disabled={!device.online || ptzLoading} onClick={() => ptz('zoom_in')}><ZoomIn size={15} /></button>
                </div>
              </div>
            </div>
          )}

          {/* Feature toggles */}
          <div className="camera-toggles">
            {feat.hasMotionDetect && (
              <div className="cam-toggle-row">
                <span className="cam-toggle-label">📡 Detecção de movimento</span>
                <SwitchToggle checked={camState.motionDetect} disabled={!device.online || !!toggling}
                  loading={toggling === 'motionDetect'}
                  onChange={() => toggleFeat('motionDetect', devicesAPI.cameraMotion, 'Detecção ativada', 'Detecção desativada')} />
              </div>
            )}
            {feat.hasNightVision && (
              <div className="cam-toggle-row clickable" onClick={device.online ? cycleNight : undefined}>
                <span className="cam-toggle-label">🌙 Visão noturna</span>
                <span className="cam-toggle-mode">{toggling === 'nightVision' ? '...' : nvLabels[camState.nightVision] || camState.nightVision}</span>
              </div>
            )}
            {feat.hasFloodLight && (
              <div className="cam-toggle-row">
                <span className="cam-toggle-label">💡 Luz flood</span>
                <SwitchToggle checked={camState.floodLight} disabled={!device.online || !!toggling}
                  loading={toggling === 'floodLight'}
                  onChange={() => toggleFeat('floodLight', devicesAPI.cameraFloodLight, 'Luz ligada', 'Luz desligada')} />
              </div>
            )}
            {feat.hasSiren && (
              <div className="cam-toggle-row">
                <span className="cam-toggle-label" style={camState.siren ? { color: 'var(--accent-red)' } : {}}>🔊 Sirene</span>
                <SwitchToggle checked={camState.siren} disabled={!device.online || !!toggling}
                  loading={toggling === 'siren'} color={camState.siren ? '#f87171' : undefined}
                  onChange={() => toggleFeat('siren', devicesAPI.cameraSiren, 'Sirene ligada', 'Sirene desligada')} />
              </div>
            )}
            {feat.hasPrivacyMode && (
              <div className="cam-toggle-row">
                <span className="cam-toggle-label">🔒 Modo privacidade</span>
                <SwitchToggle checked={camState.privacyMode} disabled={!device.online || !!toggling}
                  loading={toggling === 'privacyMode'}
                  onChange={() => toggleFeat('privacyMode', devicesAPI.cameraPrivacy, 'Privacidade ativada', 'Privacidade desativada')} />
              </div>
            )}
          </div>

          {!hasAnyControl && (
            <p className="no-controls-hint">
              Esta câmera não reportou capacidades de controle via API.<br />
              Use o app Tuya/Smart Life para configurações avançadas.
            </p>
          )}
        </div>
      )}

      <div className="device-badge">{cfg.label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  SENSOR DE PORTA/JANELA
// ══════════════════════════════════════════════════════════════════
function DoorSensorCard({ device, cfg, onToast }) {
  const rawState = device.doorSensorState ??
    getVal(device.status, ['doorcontact_state', 'contact', 'state', 'door_contact_state']);

  // Tuya: true / "open" / "open" = aberta
  const isOpen  = rawState === true || rawState === 'true' || rawState === 'open';
  const battery = getVal(device.status, ['battery_percentage', 'battery', 'va_battery']);
  const tamper  = getVal(device.status, ['temper_alarm', 'tamper']);

  const doorColor = isOpen ? '#fb923c' : '#34d399';
  const DoorIcon  = isOpen ? DoorOpen  : DoorClosed;

  return (
    <div
      className={`device-card glass-card door-card ${!device.online ? 'device-offline' : ''} ${isOpen ? 'door-open' : ''}`}
      style={{ '--card-color': doorColor, '--card-glow': `rgba(${hexToRgb(doorColor)},0.3)` }}
    >
      <div className="device-header">
        <div className="device-icon-wrap" style={{ background: `rgba(${hexToRgb(doorColor)},0.18)`, border: `1px solid rgba(${hexToRgb(doorColor)},0.35)` }}>
          <DoorIcon size={24} style={{ color: doorColor }} />
        </div>
        <div className="device-info">
          <h3 className="device-name">{device.name}</h3>
          <div className="device-meta">
            <span className={`status-dot ${device.online ? 'online' : 'offline'}`} />
            <span className="device-status-text" style={{ color: doorColor, fontWeight: 600 }}>
              {!device.online ? 'Offline' : isOpen ? '🔓 ABERTA' : '🔒 Fechada'}
            </span>
          </div>
        </div>

        {/* Badge grande de estado */}
        <div className={`door-state-badge ${isOpen ? 'open' : 'closed'}`}>
          {isOpen ? 'Aberta' : 'Fechada'}
        </div>
      </div>

      {/* Chips de info */}
      <div className="sensor-info-row">
        {battery !== null && (
          <div className={`sensor-info-chip ${battery < 20 ? 'chip-warn' : ''}`}>
            <span>🔋</span><span>{battery}%{battery < 20 ? ' Baixo!' : ''}</span>
          </div>
        )}
        {tamper && (
          <div className="sensor-info-chip chip-danger"><span>⚠️</span><span>Violado!</span></div>
        )}
        <div className="sensor-info-chip">
          <span>📡</span><span>{device.online ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      <div className="device-badge">{cfg.label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  SENSOR DE MOVIMENTO / PRESENÇA
// ══════════════════════════════════════════════════════════════════
function MotionSensorCard({ device, cfg, onToast }) {
  const rawState = device.motionState ??
    getVal(device.status, ['pir', 'motion_state', 'occupancy', 'presence_state']);

  const hasMotion   = rawState === true || rawState === 'true' || rawState === 'pir' || rawState === 'motion';
  const battery     = getVal(device.status, ['battery_percentage', 'battery', 'va_battery']);
  const sensitivity = getVal(device.status, ['sensitivity', 'pir_sensitivity']);

  const motColor = hasMotion ? '#f472b6' : '#94a3b8';

  return (
    <div
      className={`device-card glass-card motion-card ${!device.online ? 'device-offline' : ''} ${hasMotion ? 'motion-active' : ''}`}
      style={{ '--card-color': motColor, '--card-glow': `rgba(${hexToRgb(motColor)},0.3)` }}
    >
      <div className="device-header">
        <div className="device-icon-wrap" style={{ background: `rgba(${hexToRgb(motColor)},0.18)` }}>
          <Activity size={22} style={{ color: motColor }} />
        </div>
        <div className="device-info">
          <h3 className="device-name">{device.name}</h3>
          <div className="device-meta">
            <span className={`status-dot ${device.online ? 'online' : 'offline'}`} />
            <span className="device-status-text" style={{ color: motColor, fontWeight: hasMotion ? 700 : 400 }}>
              {!device.online ? 'Offline' : hasMotion ? '🚨 MOVIMENTO!' : '✅ Sem movimento'}
            </span>
          </div>
        </div>
        {hasMotion && <div className="motion-pulse-ring" style={{ '--ring-color': motColor }} />}
      </div>

      <div className="sensor-info-row">
        {battery !== null && (
          <div className={`sensor-info-chip ${battery < 20 ? 'chip-warn' : ''}`}>
            <span>🔋</span><span>{battery}%</span>
          </div>
        )}
        {sensitivity !== null && (
          <div className="sensor-info-chip"><span>🎯</span><span>Sens. {sensitivity}</span></div>
        )}
        <div className="sensor-info-chip">
          <span>📡</span><span>{device.online ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      <div className="device-badge">{cfg.label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  GENÉRICO (tomadas, clima, outros)
// ══════════════════════════════════════════════════════════════════
function GenericCard({ device, cfg, onToast }) {
  const [loading, setLoading] = useState(false);
  const [ls, setLs]           = useState(device.status || []);

  const isOn       = getVal(ls, ['switch', 'switch_1', 'switch_led', 'on', 'power']);
  const hasToggle  = ls.some(s => ['switch', 'switch_1', 'switch_led'].includes(s.code));

  const upd = (code, value) => setLs(prev => {
    const i = prev.findIndex(s => s.code === code);
    if (i >= 0) { const n = [...prev]; n[i] = { code, value }; return n; }
    return [...prev, { code, value }];
  });

  const handleToggle = async () => {
    if (!device.online || loading) return;
    setLoading(true);
    const next = !isOn;
    const code = ls.find(s => s.code === 'switch_led') ? 'switch_led' :
                 ls.find(s => s.code === 'switch_1')   ? 'switch_1'   : 'switch';
    upd(code, next);
    try {
      await devicesAPI.toggle(device.id, next, 'switch');
      onToast?.(`${device.name} ${next ? 'ligado' : 'desligado'}`, 'success');
    } catch { onToast?.('Erro ao controlar dispositivo', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div
      className={`device-card glass-card ${isOn ? 'device-on' : ''} ${!device.online ? 'device-offline' : ''}`}
      style={{ '--card-color': cfg.color, '--card-glow': cfg.glow }}
    >
      <CardHeader device={device} cfg={cfg}
        statusText={!device.online ? 'Offline' : isOn ? 'Ligado' : 'Desligado'}>
        {hasToggle && (
          <SwitchToggle checked={!!isOn} disabled={!device.online || loading} loading={loading} onChange={handleToggle} />
        )}
      </CardHeader>
      <div className="device-badge">{cfg.label}</div>
    </div>
  );
}
