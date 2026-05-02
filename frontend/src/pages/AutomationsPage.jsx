// src/pages/AutomationsPage.jsx - Página de automações
import { useState, useEffect } from 'react';
import { Plus, Play, Trash2, Edit2, Zap, Clock, CheckCircle, XCircle, Power } from 'lucide-react';
import { automationsAPI, devicesAPI } from '../services/api';
import ToastContainer from '../components/Toast';
import { useToast } from '../hooks/useToast';
import './AutomationsPage.css';

const ICON_OPTIONS = ['zap', 'moon', 'sun', 'film', 'coffee', 'home', 'star', 'music'];
const COLOR_OPTIONS = [
  '#6366f1', '#4f8ef7', '#a78bfa', '#34d399',
  '#fbbf24', '#f87171', '#fb923c', '#22d3ee',
];

const ICONS_EMOJI = {
  zap: '⚡', moon: '🌙', sun: '☀️', film: '🎬',
  coffee: '☕', home: '🏠', star: '⭐', music: '🎵',
};

// Exemplos de automações prontas
const AUTOMATION_TEMPLATES = [
  {
    name: 'Modo Cinema',
    description: 'Apaga as luzes e deixa o ambiente escuro',
    icon: 'film',
    color: '#6366f1',
    actions: [
      { type: 'switch', deviceId: '', value: false, label: 'Desligar luz principal' },
    ],
  },
  {
    name: 'Bom Dia',
    description: 'Liga as luzes em branco suave',
    icon: 'sun',
    color: '#fbbf24',
    actions: [
      { type: 'toggle', deviceId: '', value: true, label: 'Ligar luz' },
      { type: 'brightness', deviceId: '', value: 70, label: 'Brilho 70%' },
    ],
  },
  {
    name: 'Modo Dormir',
    description: 'Desliga tudo para dormir',
    icon: 'moon',
    color: '#4f8ef7',
    actions: [
      { type: 'switch', deviceId: '', value: false, label: 'Desligar tudo' },
    ],
  },
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [running, setRunning] = useState(null);
  const { toasts, success, error: showError } = useToast();

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'zap',
    color: '#6366f1',
    actions: [],
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [autoRes, devRes] = await Promise.allSettled([
        automationsAPI.getAll(),
        devicesAPI.getAll(),
      ]);

      if (autoRes.status === 'fulfilled') {
        setAutomations(autoRes.value.data.automations || []);
      }
      if (devRes.status === 'fulfilled') {
        setDevices(devRes.value.data.devices || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (template = null) => {
    if (template) {
      setForm({ ...template, actions: [...template.actions] });
    } else {
      setForm({ name: '', description: '', icon: 'zap', color: '#6366f1', actions: [] });
    }
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (automation) => {
    setForm({
      name: automation.name,
      description: automation.description || '',
      icon: automation.icon || 'zap',
      color: automation.color || '#6366f1',
      actions: [...automation.actions],
    });
    setEditing(automation);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showError('Nome da automação é obrigatório');
      return;
    }
    if (form.actions.length === 0) {
      showError('Adicione pelo menos uma ação');
      return;
    }

    try {
      if (editing) {
        await automationsAPI.update(editing.id, form);
        success('Automação atualizada!');
      } else {
        await automationsAPI.create(form);
        success('Automação criada!');
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      showError(err.response?.data?.error || 'Erro ao salvar automação');
    }
  };

  const handleRun = async (automation) => {
    setRunning(automation.id);
    try {
      const res = await automationsAPI.run(automation.id);
      if (res.data.status === 'success') {
        success(`"${automation.name}" executada com sucesso!`);
      } else {
        success(`"${automation.name}" executada com ${res.data.status === 'partial' ? 'alguns erros' : 'erros'}`);
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Erro ao executar automação');
    } finally {
      setRunning(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta automação?')) return;
    try {
      await automationsAPI.delete(id);
      success('Automação removida');
      fetchAll();
    } catch {
      showError('Erro ao remover automação');
    }
  };

  const addAction = () => {
    setForm(f => ({
      ...f,
      actions: [...f.actions, { type: 'toggle', deviceId: '', value: true, label: '' }],
    }));
  };

  const updateAction = (idx, field, value) => {
    setForm(f => {
      const actions = [...f.actions];
      actions[idx] = { ...actions[idx], [field]: value };
      return { ...f, actions };
    });
  };

  const removeAction = (idx) => {
    setForm(f => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));
  };

  const ACTION_TYPES = [
    { value: 'toggle',     label: 'Ligar/Desligar (LED/lâmpada)' },
    { value: 'switch',     label: 'Ligar/Desligar (interruptor)' },
    { value: 'switchGang', label: 'Botão específico (multi-gang)' },
    { value: 'brightness', label: 'Ajustar Brilho (%)' },
    { value: 'colorTemp',  label: 'Temperatura de Cor (%)' },
    { value: 'camMotion',  label: 'Câmera: Detecção de Movimento' },
    { value: 'camSiren',   label: 'Câmera: Sirene' },
    { value: 'camFlood',   label: 'Câmera: Luz Flood' },
    { value: 'camPrivacy', label: 'Câmera: Modo Privacidade' },
  ];

  return (
    <div className="automations-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Automações</h1>
          <p className="page-subtitle">Crie cenas e sequências de comandos</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreate()}>
          <Plus size={16} />
          Nova Automação
        </button>
      </div>

      {/* Templates */}
      {automations.length === 0 && !loading && (
        <div className="templates-section">
          <h3 className="templates-title">Começar com um modelo</h3>
          <div className="templates-grid">
            {AUTOMATION_TEMPLATES.map(tmpl => (
              <button
                key={tmpl.name}
                className="template-card glass-card"
                onClick={() => openCreate(tmpl)}
                style={{ '--tmpl-color': tmpl.color }}
              >
                <span className="template-icon">{ICONS_EMOJI[tmpl.icon]}</span>
                <div>
                  <div className="template-name">{tmpl.name}</div>
                  <div className="template-desc">{tmpl.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Automations list */}
      {loading ? (
        <div className="devices-loading">
          <div className="loading-orb" />
          <p>Carregando automações...</p>
        </div>
      ) : (
        <div className="automations-grid">
          {automations.map(auto => (
            <div
              key={auto.id}
              className={`automation-card glass-card ${!auto.is_active ? 'inactive' : ''}`}
              style={{ '--auto-color': auto.color }}
            >
              <div className="auto-header">
                <div className="auto-icon" style={{ background: `${auto.color}22`, border: `1px solid ${auto.color}44` }}>
                  {ICONS_EMOJI[auto.icon] || '⚡'}
                </div>
                <div className="auto-info">
                  <h3 className="auto-name">{auto.name}</h3>
                  {auto.description && (
                    <p className="auto-desc">{auto.description}</p>
                  )}
                </div>
              </div>

              <div className="auto-actions-count">
                <Zap size={13} />
                {auto.actions.length} {auto.actions.length === 1 ? 'ação' : 'ações'}
              </div>

              <div className="auto-footer">
                <button
                  className="btn btn-primary btn-sm auto-run-btn"
                  onClick={() => handleRun(auto)}
                  disabled={running === auto.id || !auto.is_active}
                  style={{ background: auto.color }}
                >
                  {running === auto.id ? (
                    <span className="btn-spinner" />
                  ) : (
                    <Play size={14} />
                  )}
                  Executar
                </button>

                <div className="auto-actions-btns">
                  <button className="btn-icon" onClick={() => openEdit(auto)} title="Editar">
                    <Edit2 size={15} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ color: 'var(--accent-red)' }}
                    onClick={() => handleDelete(auto.id)}
                    title="Remover"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add button card */}
          <button className="add-automation-card glass-card" onClick={() => openCreate()}>
            <Plus size={24} />
            <span>Nova Automação</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editing ? 'Editar Automação' : 'Nova Automação'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Name */}
              <div className="form-group">
                <label className="input-label">Nome</label>
                <input
                  className="input-field"
                  placeholder="Ex: Modo Cinema"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="input-label">Descrição (opcional)</label>
                <input
                  className="input-field"
                  placeholder="Ex: Deixa o ambiente escuro"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Icon + Color */}
              <div className="form-row">
                <div className="form-group">
                  <label className="input-label">Ícone</label>
                  <div className="icon-grid">
                    {ICON_OPTIONS.map(ic => (
                      <button
                        key={ic}
                        className={`icon-btn ${form.icon === ic ? 'active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, icon: ic }))}
                      >
                        {ICONS_EMOJI[ic]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="input-label">Cor</label>
                  <div className="color-grid">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        className={`color-btn ${form.color === c ? 'active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setForm(f => ({ ...f, color: c }))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="form-group">
                <div className="actions-header">
                  <label className="input-label">Ações</label>
                  <button className="btn btn-ghost btn-sm" onClick={addAction}>
                    <Plus size={14} />
                    Adicionar
                  </button>
                </div>

                <div className="actions-list">
                  {form.actions.map((action, idx) => (
                    <div key={idx} className="action-item">
                      <div className="action-row">
                        <select
                          className="input-field action-select"
                          value={action.type}
                          onChange={e => updateAction(idx, 'type', e.target.value)}
                        >
                          {ACTION_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>

                        <select
                          className="input-field action-select"
                          value={action.deviceId}
                          onChange={e => updateAction(idx, 'deviceId', e.target.value)}
                        >
                          <option value="">Selecionar dispositivo</option>
                          {devices.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>

                      {(action.type === 'toggle' || action.type === 'switch' ||
                        action.type === 'camMotion' || action.type === 'camSiren' ||
                        action.type === 'camFlood' || action.type === 'camPrivacy') && (
                          <select
                            className="input-field action-select-small"
                            value={action.value}
                            onChange={e => updateAction(idx, 'value', e.target.value === 'true')}
                          >
                            <option value="true">Ligar / Ativar</option>
                            <option value="false">Desligar / Desativar</option>
                          </select>
                        )}

                        {action.type === 'switchGang' && (
                          <>
                            <input
                              type="number"
                              className="input-field action-select-small"
                              min="1" max="6"
                              placeholder="Botão nº"
                              value={action.gangNum || 1}
                              onChange={e => updateAction(idx, 'gangNum', Number(e.target.value))}
                            />
                            <select
                              className="input-field action-select-small"
                              value={action.value}
                              onChange={e => updateAction(idx, 'value', e.target.value === 'true')}
                            >
                              <option value="true">Ligar</option>
                              <option value="false">Desligar</option>
                            </select>
                          </>
                        )}

                        {(action.type === 'brightness' || action.type === 'colorTemp') && (
                          <input
                            type="number"
                            className="input-field action-select-small"
                            min="0"
                            max="100"
                            placeholder="0-100"
                            value={action.value}
                            onChange={e => updateAction(idx, 'value', Number(e.target.value))}
                          />
                        )}

                        <button className="btn-icon" onClick={() => removeAction(idx)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {form.actions.length === 0 && (
                    <p className="actions-empty">Nenhuma ação. Clique em Adicionar.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? 'Salvar' : 'Criar Automação'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
