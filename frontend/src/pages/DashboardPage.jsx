// src/pages/DashboardPage.jsx - Dashboard principal atualizada
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lightbulb, Plug, ToggleLeft, Cpu, Wifi,
  RefreshCw, AlertCircle, Boxes, Activity,
  Camera, Shield, DoorClosed, Thermometer, Wind,
} from 'lucide-react';
import { devicesAPI, settingsAPI } from '../services/api';
import DeviceCard from '../components/DeviceCard';
import ToastContainer from '../components/Toast';
import { useToast } from '../hooks/useToast';
import './DashboardPage.css';

// ── Configuração de todas as categorias suportadas ─────────────────
const CATEGORY_LABELS = {
  light:         { label: 'Luzes',           icon: Lightbulb,   color: '#fbbf24' },
  socket:        { label: 'Tomadas',          icon: Plug,        color: '#34d399' },
  switch:        { label: 'Interruptores',    icon: ToggleLeft,  color: '#4f8ef7' },
  climate:       { label: 'Climatização',     icon: Thermometer, color: '#22d3ee' },
  camera:        { label: 'Câmeras',          icon: Camera,      color: '#a78bfa' },
  door_sensor:   { label: 'Sensores de Porta',icon: DoorClosed,  color: '#fb923c' },
  motion_sensor: { label: 'Sensores de Mov.', icon: Activity,    color: '#f472b6' },
  security:      { label: 'Segurança',        icon: Shield,      color: '#f87171' },
  curtain:       { label: 'Cortinas',         icon: Wind,        color: '#94a3b8' },
  other:         { label: 'Outros',           icon: Cpu,         color: '#a78bfa' },
};

// Ordem de exibição das seções
const CATEGORY_ORDER = [
  'light', 'socket', 'switch', 'door_sensor',
  'motion_sensor', 'camera', 'climate', 'security', 'curtain', 'other',
];

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)}, ${parseInt(r[2],16)}, ${parseInt(r[3],16)}` : '148,163,184';
}

function StatCard({ icon: Icon, label, value, color, glow, sub, alert }) {
  return (
    <div
      className={`stat-card glass-card ${alert ? 'stat-alert' : ''}`}
      style={{ '--stat-color': color, '--stat-glow': glow }}
    >
      <div className="stat-icon" style={{ background: `rgba(${hexToRgb(color)}, 0.15)` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [devices, setDevices]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [updateInterval, setUpdateInterval] = useState(10000);
  const [fromCache, setFromCache]         = useState(false);
  const intervalRef                       = useRef(null);
  const { toasts, success, error: showError, info } = useToast();

  const fetchDevices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await devicesAPI.getAll();
      setDevices(res.data.devices || []);
      setFromCache(res.data.fromCache || false);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao carregar dispositivos';
      setError(msg);
      if (!silent) showError(msg);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Carregar configurações
  useEffect(() => {
    settingsAPI.get()
      .then(res => {
        const iv = parseInt(res.data.settings.update_interval || '10000');
        setUpdateInterval(iv);
      })
      .catch(() => {});
  }, []);

  // Carga inicial
  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchDevices(true), updateInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchDevices, updateInterval]);

  // ── Estatísticas ──────────────────────────────────────────────────
  const getSwitchOn = (device) => {
    const status = device.status || [];
    // Lâmpadas usam switch_led
    const codes = ['switch_led', 'switch_1', 'switch'];
    return status.some(s => codes.includes(s.code) && s.value === true);
  };

  const stats = {
    total:       devices.length,
    online:      devices.filter(d => d.online).length,
    lightsOn:    devices.filter(d => d.category === 'light'  && getSwitchOn(d)).length,
    socketsOn:   devices.filter(d => d.category === 'socket' && getSwitchOn(d)).length,
    switchesOn:  devices.filter(d => d.category === 'switch' && (device => {
      // Conta se pelo menos 1 gang está ligado
      const s = device.status || [];
      return s.some(x => /^switch_\d+$/.test(x.code) && x.value === true);
    })(d)).length,
    doorsOpen:   devices.filter(d => {
      if (d.category !== 'door_sensor') return false;
      const state = d.doorSensorState ??
        (d.status || []).find(s => ['doorcontact_state','contact','state'].includes(s.code))?.value;
      return state === true || state === 'true' || state === 'open';
    }).length,
    motionActive: devices.filter(d => {
      if (d.category !== 'motion_sensor') return false;
      const state = d.motionState ??
        (d.status || []).find(s => ['pir','motion_state','occupancy'].includes(s.code))?.value;
      return state === true || state === 'true' || state === 'pir' || state === 'motion';
    }).length,
    cameras: devices.filter(d => d.category === 'camera').length,
  };

  // ── Agrupamento por categoria ─────────────────────────────────────
  const grouped = {};
  devices.forEach(d => {
    const cat = d.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(d);
  });

  const handleToast = (msg, type) => {
    if (type === 'success') success(msg);
    else if (type === 'error') showError(msg);
    else info(msg);
  };

  return (
    <div className="dashboard">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {lastUpdate
              ? `Atualizado às ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Carregando...'}
            {fromCache && ' · ⚠️ Cache local'}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => fetchDevices()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ── Banner de erro ─────────────────────────────────────── */}
      {error && !loading && devices.length === 0 && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <div>
            <strong>Erro de conexão com a API Tuya</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ── Estatísticas ───────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard icon={Boxes}      label="Dispositivos"   value={stats.total}
          color="#a78bfa" glow="rgba(167,139,250,0.3)"
          sub={`${stats.online} online`} />

        <StatCard icon={Wifi}       label="Online"         value={stats.online}
          color="#34d399" glow="rgba(52,211,153,0.3)"
          sub={stats.total > 0 ? `${Math.round(stats.online / stats.total * 100)}%` : '0%'} />

        <StatCard icon={Lightbulb}  label="Luzes Ligadas"  value={stats.lightsOn}
          color="#fbbf24" glow="rgba(251,191,36,0.3)" />

        <StatCard icon={ToggleLeft} label="Interruptores"  value={stats.switchesOn}
          color="#4f8ef7" glow="rgba(79,142,247,0.3)"
          sub="gangs ativos" />

        {stats.cameras > 0 && (
          <StatCard icon={Camera}   label="Câmeras"        value={stats.cameras}
            color="#a78bfa" glow="rgba(167,139,250,0.3)"
            sub={`${devices.filter(d => d.category === 'camera' && d.online).length} online`} />
        )}

        {devices.some(d => d.category === 'door_sensor') && (
          <StatCard icon={DoorClosed} label="Portas Abertas" value={stats.doorsOpen}
            color={stats.doorsOpen > 0 ? '#fb923c' : '#34d399'}
            glow={stats.doorsOpen > 0 ? 'rgba(251,146,60,0.3)' : 'rgba(52,211,153,0.3)'}
            alert={stats.doorsOpen > 0}
            sub={stats.doorsOpen > 0 ? '⚠️ Atenção' : 'Todas fechadas'} />
        )}

        {devices.some(d => d.category === 'motion_sensor') && (
          <StatCard icon={Activity} label="Movimento"      value={stats.motionActive}
            color={stats.motionActive > 0 ? '#f472b6' : '#94a3b8'}
            glow={stats.motionActive > 0 ? 'rgba(244,114,182,0.3)' : 'rgba(148,163,184,0.3)'}
            alert={stats.motionActive > 0}
            sub={stats.motionActive > 0 ? '🚨 Detectado' : 'Nenhum'} />
        )}
      </div>

      {/* ── Loading ────────────────────────────────────────────── */}
      {loading && devices.length === 0 && (
        <div className="devices-loading">
          <div className="loading-orb" />
          <p>Buscando dispositivos Tuya...</p>
        </div>
      )}

      {/* ── Dispositivos por categoria ─────────────────────────── */}
      {CATEGORY_ORDER
        .filter(cat => grouped[cat]?.length > 0)
        .map(category => {
          const catConfig = CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
          const CatIcon   = catConfig.icon;
          const devs      = grouped[category];

          return (
            <section key={category} className="category-section">
              <div className="category-header">
                <div className="category-icon" style={{ color: catConfig.color }}>
                  <CatIcon size={18} />
                </div>
                <h2 className="category-title">{catConfig.label}</h2>
                <span className="category-count">{devs.length}</span>

                {/* Badge de alerta para sensores */}
                {category === 'door_sensor' && stats.doorsOpen > 0 && (
                  <span className="category-alert">
                    {stats.doorsOpen} aberta{stats.doorsOpen > 1 ? 's' : ''}
                  </span>
                )}
                {category === 'motion_sensor' && stats.motionActive > 0 && (
                  <span className="category-alert category-alert-motion">
                    {stats.motionActive} ativo{stats.motionActive > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className={`devices-grid ${category === 'camera' ? 'devices-grid-wide' : ''}`}>
                {devs.map(device => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onToast={handleToast}
                  />
                ))}
              </div>
            </section>
          );
        })
      }

      {/* ── Empty state ────────────────────────────────────────── */}
      {!loading && devices.length === 0 && !error && (
        <div className="empty-state glass-card">
          <div className="empty-icon">🏠</div>
          <h3>Nenhum dispositivo encontrado</h3>
          <p>
            Verifique se as credenciais Tuya estão configuradas corretamente no
            arquivo <code>backend/.env</code> e se os dispositivos estão vinculados
            ao projeto no <a href="https://iot.tuya.com" target="_blank" rel="noreferrer">iot.tuya.com</a>
          </p>
          <button className="btn btn-primary" onClick={() => fetchDevices()}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
