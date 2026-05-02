// database/init.js - Inicialização e configuração do banco SQLite
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- Tabela de usuários do painel
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    -- Tabela de configurações do painel
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de automações
    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'zap',
      color TEXT DEFAULT '#6366f1',
      actions TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de log de execuções de automações
    CREATE TABLE IF NOT EXISTS automation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id INTEGER REFERENCES automations(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de tentativas de login (brute force protection)
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      username TEXT,
      success INTEGER DEFAULT 0,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de cache de dispositivos (para offline/fallback)
    CREATE TABLE IF NOT EXISTS device_cache (
      device_id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      online INTEGER DEFAULT 0,
      status TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Configurações padrão
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('panel_name', 'Painel Smart Home'),
      ('theme', 'dark'),
      ('update_interval', '10000'),
      ('language', 'pt-BR');
  `);
}

// Limpar tentativas de login antigas (mais de 1 hora)
function cleanOldLoginAttempts() {
  const db = getDb();
  db.prepare(`
    DELETE FROM login_attempts 
    WHERE attempted_at < datetime('now', '-1 hour')
  `).run();
}

// Executar limpeza periodicamente
setInterval(cleanOldLoginAttempts, 30 * 60 * 1000); // a cada 30 min

module.exports = { getDb };
