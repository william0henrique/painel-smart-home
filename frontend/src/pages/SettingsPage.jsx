// src/pages/SettingsPage.jsx - Página de configurações
import { useState, useEffect } from 'react';
import {
  Save, RefreshCw, Shield, Wifi, User, Lock,
  CheckCircle, AlertCircle, Server, Clock, Palette
} from 'lucide-react';
import { settingsAPI, devicesAPI, authAPI } from '../services/api';
import ToastContainer from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toasts, success, error: showError } = useToast();

  const [settings, setSettings] = useState({
    panel_name: 'Painel Smart Home',
    theme: 'dark',
    update_interval: '10000',
    language: 'pt-BR',
  });

  const [connection, setConnection] = useState(null);
  const [testingConn, setTestingConn] = useState(false);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    settingsAPI.get()
      .then(res => {
        const s = res.data.settings;
        setSettings({
          panel_name: s.panel_name || 'Painel Smart Home',
          theme: s.theme || 'dark',
          update_interval: s.update_interval || '10000',
          language: s.language || 'pt-BR',
        });
        setConnection({
          configured: s.tuyaConfigured,
          region: s.tuyaRegion,
        });
      })
      .catch(() => showError('Erro ao carregar configurações'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.update({
        ...settings,
        update_interval: parseInt(settings.update_interval),
      });

      // Aplicar tema imediatamente
      document.documentElement.setAttribute('data-theme', settings.theme);

      success('Configurações salvas com sucesso!');
    } catch (err) {
      showError(err.response?.data?.error || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    try {
      const res = await devicesAPI.testConnection();
      setConnection(prev => ({ ...prev, tested: true, ok: res.data.connected, message: res.data.message }));
      if (res.data.connected) success('Conexão com Tuya estabelecida!');
      else showError('Falha na conexão: ' + res.data.message);
    } catch (err) {
      showError('Erro ao testar conexão');
    } finally {
      setTestingConn(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      showError('Preencha todos os campos');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showError('As novas senhas não coincidem');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showError('Nova senha deve ter pelo menos 8 caracteres');
      return;
    }

    setChangingPassword(true);
    try {
      await authAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      success('Senha alterada! Faça login novamente.');
      setTimeout(() => {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      showError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const INTERVALS = [
    { value: '5000', label: '5 segundos' },
    { value: '10000', label: '10 segundos' },
    { value: '30000', label: '30 segundos' },
    { value: '60000', label: '1 minuto' },
    { value: '300000', label: '5 minutos' },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Gerencie o painel e a conexão com a Tuya</p>
        </div>
      </div>

      <div className="settings-grid">

        {/* Painel settings */}
        <section className="settings-section glass-card">
          <div className="section-header">
            <div className="section-icon">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="section-title">Painel</h2>
              <p className="section-desc">Nome, tema e preferências</p>
            </div>
          </div>

          <div className="settings-fields">
            <div className="form-group">
              <label className="input-label">Nome do Painel</label>
              <input
                className="input-field"
                value={settings.panel_name}
                onChange={e => setSettings(s => ({ ...s, panel_name: e.target.value }))}
                placeholder="Minha Casa"
              />
            </div>

            <div className="form-group">
              <label className="input-label">Tema</label>
              <div className="theme-options">
                {['dark', 'light'].map(theme => (
                  <button
                    key={theme}
                    className={`theme-option ${settings.theme === theme ? 'active' : ''}`}
                    onClick={() => setSettings(s => ({ ...s, theme }))}
                  >
                    {theme === 'dark' ? '🌙 Escuro' : '☀️ Claro'}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="input-label">
                <Clock size={13} />
                Intervalo de Atualização
              </label>
              <select
                className="input-field"
                value={settings.update_interval}
                onChange={e => setSettings(s => ({ ...s, update_interval: e.target.value }))}
              >
                {INTERVALS.map(i => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
              <p className="field-hint">Com que frequência os dispositivos são atualizados automaticamente.</p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <span className="btn-spinner" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </section>

        {/* Tuya connection */}
        <section className="settings-section glass-card">
          <div className="section-header">
            <div className="section-icon" style={{ background: 'rgba(34, 211, 238, 0.15)', borderColor: 'rgba(34, 211, 238, 0.3)', color: 'var(--accent-cyan)' }}>
              <Wifi size={20} />
            </div>
            <div>
              <h2 className="section-title">Conexão Tuya</h2>
              <p className="section-desc">API Cloud da Tuya</p>
            </div>
          </div>

          <div className="settings-fields">
            <div className={`connection-status ${connection?.configured ? 'configured' : 'not-configured'}`}>
              {connection?.configured ? (
                <>
                  <CheckCircle size={18} />
                  <div>
                    <strong>Credenciais configuradas</strong>
                    <p>As credenciais Tuya estão no arquivo .env do backend</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle size={18} />
                  <div>
                    <strong>Credenciais não configuradas</strong>
                    <p>Configure TUYA_CLIENT_ID e TUYA_CLIENT_SECRET no arquivo .env</p>
                  </div>
                </>
              )}
            </div>

            {connection?.region && (
              <div className="info-row">
                <Server size={14} />
                <span className="info-label">Região:</span>
                <code className="info-value">{connection.region}</code>
              </div>
            )}

            {connection?.tested && (
              <div className={`connection-test-result ${connection.ok ? 'ok' : 'fail'}`}>
                {connection.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{connection.message}</span>
              </div>
            )}

            <button
              className="btn btn-ghost"
              onClick={handleTestConnection}
              disabled={testingConn}
            >
              {testingConn ? <span className="btn-spinner" style={{ borderTopColor: 'var(--accent-cyan)' }} /> : <RefreshCw size={16} />}
              {testingConn ? 'Testando...' : 'Testar Conexão'}
            </button>

            <div className="info-box">
              <Shield size={15} />
              <p>
                As credenciais da API Tuya ficam <strong>apenas no backend</strong> (.env), nunca no frontend.
                Acesse <a href="https://iot.tuya.com" target="_blank" rel="noreferrer">iot.tuya.com</a> para obter suas credenciais.
              </p>
            </div>
          </div>
        </section>

        {/* Security / Change password */}
        <section className="settings-section glass-card">
          <div className="section-header">
            <div className="section-icon" style={{ background: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.25)', color: 'var(--accent-red)' }}>
              <Lock size={20} />
            </div>
            <div>
              <h2 className="section-title">Segurança</h2>
              <p className="section-desc">Alterar senha de acesso</p>
            </div>
          </div>

          <div className="settings-fields">
            <div className="user-badge">
              <User size={16} />
              <span>Logado como <strong>{user?.username}</strong></span>
            </div>

            <div className="form-group">
              <label className="input-label">Senha Atual</label>
              <input
                type="password"
                className="input-field"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label className="input-label">Nova Senha</label>
              <input
                type="password"
                className="input-field"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="form-group">
              <label className="input-label">Confirmar Nova Senha</label>
              <input
                type="password"
                className="input-field"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repita a nova senha"
              />
            </div>

            <button
              className="btn btn-ghost"
              onClick={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? <span className="btn-spinner" /> : <Lock size={16} />}
              {changingPassword ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </section>

        {/* About */}
        <section className="settings-section glass-card about-section">
          <div className="section-header">
            <div className="section-icon">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="section-title">Sobre</h2>
              <p className="section-desc">Painel Smart Home v1.0.0</p>
            </div>
          </div>
          <div className="about-info">
            <div className="about-row">
              <span>Versão</span><code>1.0.0</code>
            </div>
            <div className="about-row">
              <span>Backend</span><code>Node.js + Express</code>
            </div>
            <div className="about-row">
              <span>Banco</span><code>SQLite</code>
            </div>
            <div className="about-row">
              <span>API</span><code>Tuya Cloud API v1.0</code>
            </div>
            <div className="about-row">
              <span>Frontend</span><code>React + Vite</code>
            </div>
          </div>
        </section>

      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
