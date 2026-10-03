const Database = require('better-sqlite3');
const db = new Database(require('path').join(__dirname, 'parque.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS atracoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, tipo TEXT NOT NULL,
  capacidade INTEGER NOT NULL, idade_minima INTEGER NOT NULL DEFAULT 0,
  horarios TEXT NOT NULL, vip INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS visitantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE, nascimento TEXT NOT NULL, ingresso TEXT NOT NULL,
  cartao_bandeira TEXT, cartao_final TEXT);
CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitante_id INTEGER NOT NULL REFERENCES visitantes(id),
  atracao_id INTEGER NOT NULL REFERENCES atracoes(id),
  horario TEXT NOT NULL, vip INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando',
  entrou_em TEXT NOT NULL, embarcou_em TEXT);
`);

module.exports = db;
