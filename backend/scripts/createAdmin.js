// scripts/createAdmin.js - Script para criar usuário admin inicial
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const readline = require('readline');
const { getDb } = require('../database/init');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
  console.log('');
  console.log('🏠 Painel Smart Home - Criação de Usuário Admin');
  console.log('===============================================');
  console.log('');

  const db = getDb();

  // Verificar se já existe admin
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    const confirm = await question('⚠️  Já existem usuários cadastrados. Continuar? (s/N): ');
    if (confirm.toLowerCase() !== 's') {
      console.log('Operação cancelada.');
      rl.close();
      return;
    }
  }

  const username = await question('👤 Nome de usuário: ');
  const password = await question('🔑 Senha (mín. 8 caracteres): ');
  const confirm = await question('🔑 Confirmar senha: ');

  if (!username || username.length < 3) {
    console.error('❌ Nome de usuário deve ter ao menos 3 caracteres.');
    rl.close();
    return;
  }

  if (!password || password.length < 8) {
    console.error('❌ Senha deve ter ao menos 8 caracteres.');
    rl.close();
    return;
  }

  if (password !== confirm) {
    console.error('❌ As senhas não coincidem.');
    rl.close();
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, 'admin')
    `).run(username, hash);

    console.log('');
    console.log('✅ Usuário criado com sucesso!');
    console.log(`   ID: ${result.lastInsertRowid}`);
    console.log(`   Usuário: ${username}`);
    console.log(`   Role: admin`);
    console.log('');
    console.log('💡 Agora você pode fazer login no Painel Smart Home.');
    console.log('');
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.error('❌ Esse nome de usuário já existe!');
    } else {
      console.error('❌ Erro ao criar usuário:', err.message);
    }
  }

  rl.close();
}

main().catch(console.error);
